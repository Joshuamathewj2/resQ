/**
 * @file src/agents/resqAgent.ts
 * @description Core ResQ autonomous reasoning agent.
 *
 * This module implements the intelligent decision layer that sits between
 * raw sensor data and emergency dispatch. It orchestrates:
 *
 * 1. **Multi-Modal Confidence Fusion** — Combines accelerometer severity
 *    (40% weight) and Gemini Vision emergency score (60% weight) into a
 *    single normalized confidence score.
 *
 * 2. **Progressive Scene Monitoring** — For borderline scores (5–7),
 *    delays dispatch and requests a second Gemini analysis after 10 seconds
 *    to confirm or cancel the alert.
 *
 * 3. **Explainable AI Incident Reports** — After every incident, generates
 *    a structured report containing the full reasoning chain, all API calls,
 *    scores, and the final decision with justification.
 *
 * 4. **Emergency Dispatch** — Coordinates with notificationService to send
 *    SMS and fallback alerts when emergency is confirmed.
 */

import { analyzeScene } from '../services/geminiService';
import { sendEmergencyAlerts } from '../services/notificationService';
import { saveIncident } from '../services/incidentLogger';
import { useAgentStore } from '../store/agentStore';
import {
  IntegratedReasoningResult,
  ConfidenceScore,
  GeminiResponse,
  SceneAnalysisAttempt,
  IncidentReport,
} from '../types';
import {
  CONFIDENCE_ACCEL_WEIGHT,
  CONFIDENCE_VISION_WEIGHT,
  EMERGENCY_THRESHOLD_SCORE,
  BORDERLINE_SCORE_MIN,
  BORDERLINE_SCORE_MAX,
  PROGRESSIVE_RECHECK_DELAY_MS,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('ResQAgent');

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS (unit-testable, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a raw accelerometer magnitude (m/s²) into a normalized severity
 * score between 0 and 10.
 *
 * Scoring scale:
 * - 0–15 m/s²   → score 0–3 (low activity, likely walking or carrying)
 * - 15–25 m/s²  → score 3–6 (significant jolt, potentially concerning)
 * - 25–35 m/s²  → score 6–9 (high-impact event, very likely serious)
 * - 35+ m/s²    → score 9–10 (extreme impact, almost certainly emergency)
 *
 * @param magnitudeMs2 - Raw accelerometer resultant magnitude in m/s²
 * @returns Score between 0.0 and 10.0 (inclusive)
 *
 * @example
 * calculateAccelerometerScore(0)    // → 0
 * calculateAccelerometerScore(24.5) // → ~5.8
 * calculateAccelerometerScore(40)   // → 10
 */
export function calculateAccelerometerScore(magnitudeMs2: number): number {
  if (magnitudeMs2 <= 0) return 0;

  // Piecewise linear mapping with hard cap at 10
  let score: number;
  if (magnitudeMs2 <= 15) {
    score = (magnitudeMs2 / 15) * 3;
  } else if (magnitudeMs2 <= 25) {
    score = 3 + ((magnitudeMs2 - 15) / 10) * 3;
  } else if (magnitudeMs2 <= 35) {
    score = 6 + ((magnitudeMs2 - 25) / 10) * 3;
  } else {
    score = 9 + Math.min(1, (magnitudeMs2 - 35) / 10);
  }

  return Math.max(0, Math.min(10, score));
}

/**
 * Combines accelerometer and Gemini Vision scores into a single weighted
 * confidence score using the configured weight constants.
 *
 * Formula: finalScore = (ACCEL_WEIGHT × accelScore) + (VISION_WEIGHT × visionScore)
 *
 * Default weights: 40% accelerometer, 60% vision.
 * This prioritizes the visual confirmation over raw sensor data, reducing
 * false positives from bumps and drops that don't result in actual injury.
 *
 * @param accelScore - Accelerometer severity score (0–10)
 * @param visionScore - Gemini Vision emergency score (0–10)
 * @param accelWeight - Optional override for accelerometer weight (default: CONFIDENCE_ACCEL_WEIGHT)
 * @param visionWeight - Optional override for vision weight (default: CONFIDENCE_VISION_WEIGHT)
 * @returns Complete ConfidenceScore object with individual and fused scores
 *
 * @example
 * calculateFusedConfidence(8, 9)
 * // → { accelScore: 8, visionScore: 9, finalScore: 8.6, accelWeight: 0.4, visionWeight: 0.6 }
 */
export function calculateFusedConfidence(
  accelScore: number,
  visionScore: number,
  accelWeight: number = CONFIDENCE_ACCEL_WEIGHT,
  visionWeight: number = CONFIDENCE_VISION_WEIGHT
): ConfidenceScore {
  const finalScore = accelWeight * accelScore + visionWeight * visionScore;
  return {
    accelScore: Math.round(accelScore * 10) / 10,
    visionScore: Math.round(visionScore * 10) / 10,
    finalScore: Math.round(finalScore * 10) / 10,
    accelWeight,
    visionWeight,
  };
}

/**
 * Classifies a fused confidence score into a recommended action.
 *
 * Decision logic:
 * - finalScore ≥ EMERGENCY_THRESHOLD (7.0) → 'DISPATCH'
 * - BORDERLINE_MIN (5.0) ≤ finalScore < BORDERLINE_MAX (7.0) → 'PROGRESSIVE_CHECK'
 * - finalScore < BORDERLINE_MIN (5.0) → 'FALSE_ALARM'
 *
 * @param confidence - The computed ConfidenceScore object
 * @param isProgressiveResult - Whether this score came from a second check
 * @returns The recommended action string
 */
export function classifyConfidenceScore(
  confidence: ConfidenceScore,
  isProgressiveResult = false
): IntegratedReasoningResult['recommendedAction'] {
  const { finalScore } = confidence;

  if (finalScore >= EMERGENCY_THRESHOLD_SCORE) {
    return 'DISPATCH';
  }

  // For progressive results (second check), only DISPATCH or FALSE_ALARM
  if (isProgressiveResult) {
    return finalScore >= BORDERLINE_SCORE_MIN ? 'DISPATCH' : 'FALSE_ALARM';
  }

  if (finalScore >= BORDERLINE_SCORE_MIN && finalScore < BORDERLINE_SCORE_MAX) {
    return 'PROGRESSIVE_CHECK';
  }

  return 'FALSE_ALARM';
}

/**
 * Generates a human-readable incident summary from a Gemini response,
 * suitable for inclusion in the emergency SMS message.
 *
 * @param visionResult - The scene analysis from Gemini
 * @param impactForce - The peak accelerometer reading
 * @param confidence - The computed confidence score
 * @returns A one-to-two sentence incident summary string
 */
export function generateIncidentSummary(
  visionResult: GeminiResponse,
  impactForce: number,
  confidence: ConfidenceScore
): string {
  const statusFormatted = visionResult.personStatus.replace(/_/g, ' ');
  const isEmergency = confidence.finalScore >= EMERGENCY_THRESHOLD_SCORE;

  if (isEmergency) {
    return (
      `AI EMERGENCY CONFIRMED: User is ${statusFormatted} with ${visionResult.injuryLikelihood} injury likelihood. ` +
      `Impact force: ${impactForce.toFixed(1)} m/s². Fused confidence score: ${confidence.finalScore.toFixed(1)}/10.`
    );
  }

  return (
    `Scene assessed as potentially stable. User status: ${statusFormatted}. ` +
    `Impact: ${impactForce.toFixed(1)} m/s². AI confidence: ${confidence.finalScore.toFixed(1)}/10.`
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AGENT PIPELINE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Runs the primary incident analysis pipeline.
 *
 * Orchestration steps:
 * 1. Compute accelerometer score from impact magnitude
 * 2. Call Gemini Vision API with the captured image
 * 3. Compute multi-modal confidence fusion score
 * 4. Classify into DISPATCH / PROGRESSIVE_CHECK / FALSE_ALARM
 * 5. Log all scores and decisions to incident timeline
 *
 * @param base64Image - Raw base64 JPEG image captured at impact
 * @param impactForce - Peak accelerometer magnitude at time of impact (m/s²)
 * @param isProgressiveResult - Set to true when this is a second-attempt analysis
 * @returns Complete reasoning result with action recommendation
 *
 * @example
 * ```ts
 * const result = await runIncidentAnalysis(imageData, 31.2);
 * if (result.recommendedAction === 'DISPATCH') {
 *   await dispatchEmergencyAction();
 * }
 * ```
 */
export const runIncidentAnalysis = async (
  base64Image: string,
  impactForce: number,
  isProgressiveResult = false
): Promise<IntegratedReasoningResult> => {
  const store = useAgentStore.getState();
  const { coordinates, addLog, setActiveAnalysisResult, setConfidenceScore } = store;

  addLog('INFO', '🤖 Agent: Starting multi-modal scene analysis pipeline...');

  // Step 1: Calculate accelerometer score
  const accelScore = calculateAccelerometerScore(impactForce);
  addLog(
    'INFO',
    `📊 Accelerometer score: ${accelScore.toFixed(1)}/10 (magnitude: ${impactForce.toFixed(1)} m/s²)`
  );

  try {
    // Step 2: Fetch Gemini Vision analysis
    const visionResult = await analyzeScene(base64Image, impactForce, coordinates);
    setActiveAnalysisResult(visionResult);

    addLog(
      'DECISION',
      `🤖 Gemini Vision: Score ${visionResult.emergencyScore}/10 | Status: ${visionResult.personStatus} | Danger: ${visionResult.apparentDanger ?? 'unknown'}`
    );
    addLog('INFO', `🤖 Reasoning: ${visionResult.reasoning}`);

    // Step 3: Fuse scores
    const confidence = calculateFusedConfidence(accelScore, visionResult.emergencyScore);
    setConfidenceScore(confidence);

    addLog(
      'DECISION',
      `🔀 Fused confidence: ${confidence.finalScore.toFixed(1)}/10 ` +
        `[Accel: ${confidence.accelScore.toFixed(1)} × ${CONFIDENCE_ACCEL_WEIGHT} + ` +
        `Vision: ${confidence.visionScore.toFixed(1)} × ${CONFIDENCE_VISION_WEIGHT}]`
    );

    // Step 4: Classify
    const recommendedAction = classifyConfidenceScore(confidence, isProgressiveResult);
    const isEmergencyConfirmed = recommendedAction === 'DISPATCH';
    const incidentSummary = generateIncidentSummary(visionResult, impactForce, confidence);
    const detailedReasoning =
      `Fused analysis of telemetry (${impactForce.toFixed(1)} m/s²) and Gemini Vision ` +
      `(${visionResult.emergencyScore}/10) yielded confidence ${confidence.finalScore.toFixed(1)}/10. ` +
      `Action: ${recommendedAction}. ${isProgressiveResult ? '[Progressive re-check]' : ''} ` +
      `Vision reasoning: ${visionResult.reasoning}`;

    addLog(
      'DECISION',
      `✅ Agent decision: ${recommendedAction} (threshold: ${EMERGENCY_THRESHOLD_SCORE})`
    );

    return {
      isEmergencyConfirmed,
      confidenceScore: confidence,
      recommendedAction,
      incidentSummary,
      detailedReasoning,
      isProgressiveResult,
    };
  } catch (error) {
    log.error('Agent reasoning pipeline failed', error);
    addLog(
      'ERROR',
      `🚨 Agent pipeline error: ${String(error)}. Applying safety fallback protocol.`
    );

    // Safety fallback: treat as borderline (triggers countdown without immediate dispatch)
    const fallbackConfidence = calculateFusedConfidence(accelScore, 6.0);
    setConfidenceScore(fallbackConfidence);

    return {
      isEmergencyConfirmed: false,
      confidenceScore: fallbackConfidence,
      recommendedAction: 'PROGRESSIVE_CHECK',
      incidentSummary:
        'Telemetry recorded crash-threshold impact force. AI scene analysis failed. Awaiting safety countdown.',
      detailedReasoning:
        'Critical analysis failure during Gemini API call. Safety timer initiated. User must manually confirm or cancel.',
    };
  }
};

/**
 * Runs a progressive scene re-check for borderline incidents.
 *
 * Waits PROGRESSIVE_RECHECK_DELAY_MS (default: 10s), then captures a new
 * image and runs analysis again. If the second score still falls in the
 * borderline range, it escalates to DISPATCH as a conservative safety measure.
 *
 * @param captureFrame - Function to capture a camera frame
 * @param startCamera - Function to start the camera stream
 * @param stopCamera - Function to stop the camera stream
 * @param impactForce - The original impact force magnitude
 * @returns Result of the second analysis attempt
 */
export const runProgressiveMonitoring = async (
  captureFrame: (stream?: MediaStream) => Promise<string | null>,
  startCamera: () => Promise<MediaStream | null>,
  stopCamera: () => void,
  impactForce: number
): Promise<IntegratedReasoningResult> => {
  const { addLog } = useAgentStore.getState();

  addLog(
    'INFO',
    `🔍 Progressive monitoring: borderline score detected. Re-checking in ${PROGRESSIVE_RECHECK_DELAY_MS / 1000}s...`
  );

  await new Promise<void>(resolve => setTimeout(resolve, PROGRESSIVE_RECHECK_DELAY_MS));

  addLog('INFO', '📸 Progressive check: capturing second scene frame...');

  const stream = await startCamera();
  if (!stream) {
    addLog('ERROR', '❌ Progressive check: camera unavailable. Escalating to DISPATCH for safety.');
    const fallbackScore = calculateFusedConfidence(
      calculateAccelerometerScore(impactForce),
      7.5
    );
    return {
      isEmergencyConfirmed: true,
      confidenceScore: fallbackScore,
      recommendedAction: 'DISPATCH',
      incidentSummary: 'Progressive check failed (camera unavailable). Escalated for safety.',
      detailedReasoning: 'Second scene analysis could not be performed due to camera failure. Conservative escalation applied.',
      isProgressiveResult: true,
    };
  }

  const secondImage = await captureFrame(stream);
  stopCamera();

  if (!secondImage) {
    addLog('ERROR', '❌ Progressive check: frame capture failed. Escalating to DISPATCH for safety.');
    const fallbackScore = calculateFusedConfidence(
      calculateAccelerometerScore(impactForce),
      7.5
    );
    return {
      isEmergencyConfirmed: true,
      confidenceScore: fallbackScore,
      recommendedAction: 'DISPATCH',
      incidentSummary: 'Progressive check failed (image capture error). Escalated for safety.',
      detailedReasoning: 'Second frame could not be captured. Conservative escalation applied.',
      isProgressiveResult: true,
    };
  }

  addLog('INFO', '🤖 Progressive check: running second Gemini analysis...');
  return runIncidentAnalysis(secondImage, impactForce, true);
};

/**
 * Dispatches the emergency alert sequence.
 *
 * Orchestration steps:
 * 1. Validates emergency contacts exist
 * 2. Transitions state to NOTIFYING
 * 3. Calls notificationService (Twilio or fallback)
 * 4. Transitions to POST_INCIDENT_MONITORING
 * 5. Saves full incident record to IndexedDB
 *
 * @returns true if alerts were dispatched successfully, false otherwise
 *
 * @example
 * ```ts
 * const dispatched = await dispatchEmergencyAction();
 * if (!dispatched) { log.error('Emergency dispatch failed'); }
 * ```
 */
export const dispatchEmergencyAction = async (): Promise<boolean> => {
  const store = useAgentStore.getState();
  const { contacts, userProfile, coordinates, activeAnalysisResult, currentIncidentId, logs, addLog, setAgentState } =
    store;

  if (contacts.length === 0) {
    addLog('ERROR', '🚨 Dispatch aborted: No emergency contacts configured. Please add contacts.');
    return false;
  }

  setAgentState('NOTIFYING');
  addLog('ACTION', '🚀 Initiating autonomous emergency dispatch...');

  const score = activeAnalysisResult?.emergencyScore ?? 10;
  const reasoning = activeAnalysisResult?.reasoning ?? 'Sustained accelerometer crash threshold exceeded.';
  const incidentSummary = activeAnalysisResult
    ? `User is ${activeAnalysisResult.personStatus.replace(/_/g, ' ')} with ${activeAnalysisResult.injuryLikelihood} injury likelihood.`
    : 'Accelerometer detected severe impact force. User did not respond within the cancellation window.';

  try {
    const result = await sendEmergencyAlerts({
      contacts,
      userProfile,
      coordinates,
      emergencyScore: score,
      reasoning,
      incidentSummary,
    });

    result.logs.forEach(logLine => {
      addLog('INFO', `📡 ${logLine}`);
    });

    setAgentState('POST_INCIDENT_MONITORING');
    addLog('INFO', '📈 Shifted to POST_INCIDENT_MONITORING. Periodic re-checks initialized.');

    // Persist full incident record to IndexedDB
    if (currentIncidentId) {
      await saveIncident(currentIncidentId, logs);
      addLog('INFO', `💾 Incident archived to IndexedDB: ${currentIncidentId}`);
    }

    return true;
  } catch (error) {
    log.error('Emergency alert dispatch failed', error);
    addLog('ERROR', `🚨 Dispatch failure: ${String(error)}`);
    setAgentState('POST_INCIDENT_MONITORING');
    return false;
  }
};

/**
 * Generates a structured explainable AI incident report from the current incident state.
 *
 * The report includes every Gemini API call, all scores, the final decision reasoning,
 * sensor timeline, and GPS coordinates. Intended for IndexedDB storage and UI display.
 *
 * @param attempts - All scene analysis attempts made during the incident
 * @param peakForce - Peak accelerometer magnitude recorded
 * @param emergencyDispatched - Whether alerts were sent
 * @returns Complete IncidentReport ready for storage
 */
export const generateIncidentReport = (
  attempts: SceneAnalysisAttempt[],
  peakForce: number,
  emergencyDispatched: boolean
): IncidentReport => {
  const store = useAgentStore.getState();
  const { currentIncidentId, agentState, coordinates, logs, confidenceScore } = store;

  const now = new Date().toISOString();
  const finalConfidence = confidenceScore ?? calculateFusedConfidence(
    calculateAccelerometerScore(peakForce),
    attempts[attempts.length - 1]?.response.emergencyScore ?? 0
  );

  const decisionReasoning =
    `Incident triggered by ${peakForce.toFixed(1)} m/s² impact force. ` +
    `${attempts.length} Gemini analysis attempt(s) performed. ` +
    `Fused confidence score: ${finalConfidence.finalScore.toFixed(1)}/10. ` +
    `Emergency dispatched: ${emergencyDispatched ? 'YES' : 'NO — below threshold or manually cancelled'}.`;

  return {
    incidentId: currentIncidentId ?? `INCIDENT-${Date.now()}`,
    triggeredAt: logs[logs.length - 1]?.timestamp ?? now,
    resolvedAt: now,
    finalState: agentState,
    emergencyDispatched,
    peakAccelerationMs2: peakForce,
    sceneAnalysisAttempts: attempts,
    finalConfidenceScore: finalConfidence,
    coordinates,
    decisionReasoning,
    logs: [...logs],
  };
};
