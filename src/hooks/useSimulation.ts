/**
 * @file src/hooks/useSimulation.ts
 * @description Demo simulation controller hook for ResQ.
 *
 * Provides a complete end-to-end accident simulation for demonstrations
 * on desktop devices (which lack physical accelerometers). The simulation
 * walks through the full agent state machine pipeline:
 *
 * 1. Accelerometer spike animation (5 → 14.5 → 28.2 → 31.2 m/s²)
 * 2. Camera activation overlay
 * 3. Real Gemini API call (or mock if no API key)
 * 4. 30-second cancellation countdown
 * 5. Emergency SMS dispatch (simulated overlay)
 * 6. Post-incident monitoring feed via Gemini
 *
 * Also provides `cancelSimulation` and `resetAgent` utilities.
 */

import { useRef, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import { analyzeSimulationScene, analyzeSimulationMonitoring } from '../services/geminiService';
import { COUNTDOWN_DURATION_SEC } from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('Simulation');

/** Impact force steps (m/s²) used to animate the accelerometer graph spike. */
const SIMULATION_FORCE_STEPS = [5.1, 14.5, 28.2, 31.2] as const;

/** Peak force value used in the simulated crash (m/s²). */
const SIMULATION_PEAK_FORCE = 31.2;

/**
 * Controls the full demo accident simulation flow.
 *
 * @returns Object with `runDemoSimulation`, `cancelSimulation`, `resetAgent`, and `triggerSimulationDispatch`
 *
 * @example
 * ```tsx
 * const { runDemoSimulation, cancelSimulation, resetAgent } = useSimulation();
 * <button onClick={runDemoSimulation}>Simulate Accident</button>
 * ```
 */
export const useSimulation = () => {
  const store = useAgentStore();
  const {
    setAgentState,
    setCurrentMagnitude,
    pushMagnitudeHistory,
    addLog,
    setActiveAnalysisResult,
    setConfidenceScore,
    setCountdownSeconds,
    setCameraActiveSimulated,
    setShowSmsSimulated,
    setSmsMessageSimulated,
    addPostIncidentFeed,
    endIncident,
    startNewIncident,
    coordinates,
    contacts,
    userProfile,
  } = store;

  const countdownIntervalRef = useRef<number | null>(null);
  const monitoringIntervalRef = useRef<number | null>(null);
  const graphIntervalRef = useRef<number | null>(null);

  /**
   * Clears all active simulation intervals.
   * Called before any new simulation phase to prevent overlapping timers.
   */
  const cleanAllSimulationIntervals = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (monitoringIntervalRef.current !== null) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    if (graphIntervalRef.current !== null) {
      clearInterval(graphIntervalRef.current);
      graphIntervalRef.current = null;
    }
  }, []);

  /**
   * Cancels an in-progress simulation and returns the agent to MONITORING state.
   * Animates the graph back to zero and logs the false alarm.
   */
  const cancelSimulation = useCallback(() => {
    cleanAllSimulationIntervals();

    let currentForce = SIMULATION_PEAK_FORCE;
    graphIntervalRef.current = window.setInterval(() => {
      currentForce = Math.max(0, currentForce - 4);
      setCurrentMagnitude(currentForce);
      pushMagnitudeHistory(currentForce);
      if (currentForce <= 0 && graphIntervalRef.current !== null) {
        clearInterval(graphIntervalRef.current);
        graphIntervalRef.current = null;
      }
    }, 50);

    addLog('INFO', '🟢 User confirmed safe — simulation alert cancelled (false alarm).');
    endIncident();
    setAgentState('MONITORING');
  }, [cleanAllSimulationIntervals, setCurrentMagnitude, pushMagnitudeHistory, addLog, endIncident, setAgentState]);

  /**
   * Resets the entire agent to IDLE and clears all logs.
   * Used by the reset button to start a clean demo.
   */
  const resetAgent = useCallback(() => {
    cleanAllSimulationIntervals();
    endIncident();
    setAgentState('IDLE');
    store.clearLogs();
    addLog('INFO', '🔄 System reset. All logs cleared. Agent returned to IDLE.');
  }, [cleanAllSimulationIntervals, endIncident, setAgentState, store, addLog]);

  /**
   * Triggers the simulated emergency dispatch sequence (Step 5B).
   *
   * Shows the SMS preview overlay with the composed alert message,
   * then begins post-incident monitoring with periodic Gemini updates.
   */
  const triggerSimulationDispatch = useCallback(() => {
    cleanAllSimulationIntervals();
    setAgentState('NOTIFYING');

    const primaryContact = contacts[0] ?? { name: 'Emergency Contact', phone: '+1 (555) 000-0000', email: '' };
    const score = store.activeAnalysisResult?.emergencyScore ?? 8.5;

    const lat = coordinates.latitude ?? 12.9716;
    const lng = coordinates.longitude ?? 80.2209;
    const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;

    const smsText = [
      `🚨 EMERGENCY ALERT from ResQ`,
      `Person: ${userProfile.name || 'Unknown'} (${userProfile.bloodType || '?'})`,
      `AI Confidence: ${score}/10`,
      `Status: Rider unconscious on road after collision.`,
      `Location: [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
      `Maps: ${mapUrl}`,
      `Medical: ${userProfile.medicalConditions || 'None'} | Allergies: ${userProfile.allergies || 'None'}`,
      `— ResQ Autonomous Emergency Agent`,
    ].join('\n');

    setSmsMessageSimulated(smsText);
    setShowSmsSimulated(true);

    addLog('ACTION', `📨 Emergency alert dispatched to ${primaryContact.name} (${primaryContact.phone})`);
    setAgentState('POST_INCIDENT_MONITORING');
    addLog('INFO', '📈 Starting post-incident visual surveillance feed...');

    let checkCount = 0;
    monitoringIntervalRef.current = window.setInterval(async () => {
      checkCount += 1;
      addLog('INFO', `🤖 Post-incident monitoring check ${checkCount}/3...`);

      try {
        const update = await analyzeSimulationMonitoring();
        addPostIncidentFeed(update.situationUpdate);
        addLog('INFO', `🔄 Situation update: ${update.situationUpdate}`);

        if (!update.continueMonitoring || checkCount >= 3) {
          addLog('DECISION', '🏥 Rescue complete. Post-incident monitoring concluded.');
          if (monitoringIntervalRef.current !== null) {
            clearInterval(monitoringIntervalRef.current);
            monitoringIntervalRef.current = null;
          }
        }
      } catch (err) {
        log.error('Monitoring update failed', err);
      }
    }, 10_000);
  }, [
    contacts,
    coordinates,
    userProfile,
    store.activeAnalysisResult,
    addLog,
    setAgentState,
    setSmsMessageSimulated,
    setShowSmsSimulated,
    addPostIncidentFeed,
    cleanAllSimulationIntervals,
  ]);

  /**
   * Runs the complete 6-step demo simulation sequence.
   *
   * Sequence:
   * 1. Animate accelerometer graph spike (100ms steps)
   * 2. Show camera activation overlay (500ms)
   * 3. Call Gemini API for scene analysis (1500ms after camera)
   * 4. Start 30-second countdown if emergency confirmed
   * 5. Auto-dispatch on countdown expiry
   * 6. Post-incident monitoring loop
   */
  const runDemoSimulation = useCallback(() => {
    cleanAllSimulationIntervals();
    addLog('INFO', '🚀 Demo simulation started — simulating motorcycle collision scenario...');

    // Step 1: Animate graph spike
    let tick = 0;
    graphIntervalRef.current = window.setInterval(() => {
      const force = SIMULATION_FORCE_STEPS[tick] ?? SIMULATION_PEAK_FORCE;
      setCurrentMagnitude(force);
      pushMagnitudeHistory(force);
      tick += 1;
      if (tick >= SIMULATION_FORCE_STEPS.length && graphIntervalRef.current !== null) {
        clearInterval(graphIntervalRef.current);
        graphIntervalRef.current = null;
      }
    }, 100);

    // Step 2: Trigger IMPACT_DETECTED
    startNewIncident();
    setAgentState('IMPACT_DETECTED');
    addLog('WARNING', `⚡ Impact detected — ${SIMULATION_PEAK_FORCE} m/s² — initiating scene analysis`);

    // Step 2: Camera activation overlay
    setTimeout(() => {
      setCameraActiveSimulated(true);
      addLog('INFO', '🎥 Camera feed acquired — transmitting to Gemini Vision');

      // Step 3: Gemini API call
      setTimeout(async () => {
        setCameraActiveSimulated(false);
        setAgentState('SCENE_ANALYSIS');
        addLog('INFO', '🤖 Calling Gemini Vision API for scene reasoning...');

        try {
          const result = await analyzeSimulationScene();
          setActiveAnalysisResult(result);

          // Compute and store confidence score
          const { calculateAccelerometerScore, calculateFusedConfidence } = await import('../agents/resqAgent');
          const accelScore = calculateAccelerometerScore(SIMULATION_PEAK_FORCE);
          const confidence = calculateFusedConfidence(accelScore, result.emergencyScore);
          setConfidenceScore(confidence);

          addLog(
            'DECISION',
            `🤖 Gemini: Status=${result.personStatus}, Score=${result.emergencyScore}/10, Rec=${result.recommendation ?? 'N/A'}`
          );
          addLog(
            'DECISION',
            `🔀 Fused confidence: ${confidence.finalScore.toFixed(1)}/10 [Accel: ${accelScore.toFixed(1)} × 0.4 + Vision: ${result.emergencyScore} × 0.6]`
          );
          addLog('INFO', `🤖 Reasoning: ${result.reasoning}`);

          if (confidence.finalScore >= 7.0 || result.recommendation === 'EMERGENCY_CONFIRMED') {
            // Step 4: Countdown
            setAgentState('IMPACT_DETECTED');
            setCountdownSeconds(COUNTDOWN_DURATION_SEC);

            let secondsLeft = COUNTDOWN_DURATION_SEC;
            countdownIntervalRef.current = window.setInterval(() => {
              secondsLeft -= 1;
              setCountdownSeconds(secondsLeft);

              if (secondsLeft % 5 === 0 && secondsLeft > 0) {
                addLog('WARNING', `⏳ Emergency sequence active — ${secondsLeft}s remaining`);
              }

              if (secondsLeft <= 0) {
                if (countdownIntervalRef.current !== null) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                void triggerSimulationDispatch();
              }
            }, 1000);
          } else {
            addLog('INFO', '🟢 Gemini classified scene as safe. Monitoring resumed.');
            endIncident();
            setAgentState('MONITORING');
          }
        } catch (err) {
          log.error('Simulation Gemini analysis failed', err);
          addLog('ERROR', `Simulation analysis error: ${String(err)}`);
          setAgentState('MONITORING');
        }
      }, 1500);
    }, 500);
  }, [
    cleanAllSimulationIntervals,
    addLog,
    setCurrentMagnitude,
    pushMagnitudeHistory,
    startNewIncident,
    setAgentState,
    setCameraActiveSimulated,
    setActiveAnalysisResult,
    setConfidenceScore,
    setCountdownSeconds,
    endIncident,
    triggerSimulationDispatch,
  ]);

  return {
    runDemoSimulation,
    cancelSimulation,
    resetAgent,
    triggerSimulationDispatch,
  };
};
