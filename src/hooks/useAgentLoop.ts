/**
 * @file src/hooks/useAgentLoop.ts
 * @description Main orchestration hook for the ResQ agent control loop.
 *
 * Manages the primary reactive effects that drive the agent's state machine:
 *
 * 1. **Countdown Timer** — Counts down from 30s after impact detection.
 *    Auto-dispatches if the timer expires without manual cancellation.
 *    In Silent Mode, this runs invisibly without requiring user interaction.
 *
 * 2. **Visual Scene Analysis** — On IMPACT_DETECTED → activates camera,
 *    captures a frame, and runs the multi-modal AI analysis pipeline.
 *    Routes to DISPATCH, PROGRESSIVE_CHECK, or FALSE_ALARM based on score.
 *
 * 3. **Progressive Monitoring** — For borderline confidence scores (5–7),
 *    waits 10 seconds and performs a second Gemini analysis before deciding.
 *
 * 4. **Post-Incident Monitoring** — Periodic camera checks every 30 seconds
 *    after emergency dispatch (up to POST_INCIDENT_MAX_CHECKS times).
 */

import { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import {
  runIncidentAnalysis,
  dispatchEmergencyAction,
  runProgressiveMonitoring,
} from '../agents/resqAgent';
import {
  COUNTDOWN_DURATION_SEC,
  POST_INCIDENT_INTERVAL_MS,
  POST_INCIDENT_MAX_CHECKS,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('AgentLoop');

/**
 * Orchestrates the agent state machine's asynchronous control loops.
 *
 * @param startCamera - Activates the camera and returns a MediaStream
 * @param stopCamera - Stops all active camera tracks
 * @param captureFrame - Captures a JPEG frame from a stream as raw base64
 * @returns Object with `cancelAlert` function for user-initiated cancellation
 *
 * @example
 * ```tsx
 * const { cancelAlert } = useAgentLoop(startCamera, stopCamera, captureFrame);
 * <button onClick={cancelAlert}>I'm Safe</button>
 * ```
 */
export const useAgentLoop = (
  startCamera: () => Promise<MediaStream | null>,
  stopCamera: () => void,
  captureFrame: (stream?: MediaStream) => Promise<string | null>
) => {
  const {
    agentState,
    appMode,
    setAgentState,
    setCountdownSeconds,
    currentMagnitude,
    addLog,
    endIncident,
  } = useAgentStore();

  const countdownIntervalRef = useRef<number | null>(null);
  /** Guards against double-triggering the async analysis pipeline. */
  const isAnalyzing = useRef<boolean>(false);
  /** Tracks number of post-incident monitoring cycles completed. */
  const postIncidentChecks = useRef<number>(0);

  // ── Effect 1: Countdown Timer ───────────────────────────────────────────────

  /**
   * Starts the 30-second cancellation countdown when the agent enters IMPACT_DETECTED.
   * The countdown runs independently of the scene analysis (which may be concurrent).
   *
   * Behavior:
   * - ACTIVE mode: countdown is visible on screen; user can cancel
   * - SILENT mode: countdown runs invisibly; auto-dispatches on expiry
   */
  useEffect(() => {
    if (agentState === 'IMPACT_DETECTED') {
      setCountdownSeconds(COUNTDOWN_DURATION_SEC);

      countdownIntervalRef.current = window.setInterval(() => {
        const currentSeconds = useAgentStore.getState().countdownSeconds;

        if (currentSeconds <= 1) {
          if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          addLog('WARNING', '⏳ Countdown expired. User did not cancel — auto-dispatching.');
          void dispatchEmergencyAction();
        } else {
          setCountdownSeconds(currentSeconds - 1);
        }
      }, 1000);
    } else {
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [agentState, setCountdownSeconds, addLog]);

  // ── Effect 2: Visual Scene Analysis Pipeline ──────────────────────────────

  /**
   * Triggered on IMPACT_DETECTED state entry.
   * Activates the camera, captures a frame, and runs the multi-modal
   * confidence fusion pipeline via runIncidentAnalysis().
   *
   * After receiving results, routes to:
   * - DISPATCH — if finalScore ≥ 7.0
   * - PROGRESSIVE_CHECK — if 5.0 ≤ finalScore < 7.0
   * - FALSE_ALARM — if finalScore < 5.0
   */
  useEffect(() => {
    const triggerVisualAnalysis = async () => {
      if (agentState !== 'IMPACT_DETECTED' || isAnalyzing.current) return;

      isAnalyzing.current = true;
      setAgentState('SCENE_ANALYSIS');
      addLog('INFO', '📸 Activating camera for post-impact scene capture...');

      try {
        const cameraStream = await startCamera();

        if (!cameraStream) {
          addLog('ERROR', '❌ Camera unavailable. Continuing with countdown-only mode.');
          setAgentState('IMPACT_DETECTED');
          isAnalyzing.current = false;
          return;
        }

        const base64Data = await captureFrame(cameraStream);
        stopCamera();

        if (!base64Data) {
          addLog('ERROR', '❌ Frame capture failed. Continuing with countdown-only mode.');
          setAgentState('IMPACT_DETECTED');
          isAnalyzing.current = false;
          return;
        }

        addLog('INFO', '🖼️ Camera frame captured and encoded. Sending to AI pipeline...');
        addLog('INFO', '📷 Frame captured.', undefined, base64Data);

        const result = await runIncidentAnalysis(base64Data, currentMagnitude);

        if (result.recommendedAction === 'DISPATCH') {
          addLog('ALERT', '🚨 High confidence emergency! Stopping countdown — dispatching immediately.');
          if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setAgentState('EMERGENCY_CONFIRMED');
          await dispatchEmergencyAction();
        } else if (result.recommendedAction === 'PROGRESSIVE_CHECK') {
          addLog('INFO', '🔍 Borderline score. Initiating progressive scene re-check...');
          const progressiveResult = await runProgressiveMonitoring(
            captureFrame,
            startCamera,
            stopCamera,
            currentMagnitude
          );

          if (progressiveResult.recommendedAction === 'DISPATCH') {
            addLog('ALERT', '🚨 Progressive check confirmed emergency — dispatching.');
            setAgentState('EMERGENCY_CONFIRMED');
            await dispatchEmergencyAction();
          } else {
            addLog('INFO', '✅ Progressive check: scene cleared. Returning to monitoring.');
            setAgentState('FALSE_ALARM');
            setTimeout(() => {
              endIncident();
              setAgentState('MONITORING');
            }, 3000);
          }
        } else {
          // FALSE_ALARM
          addLog('INFO', '✅ AI analysis: scene is safe. No emergency detected. Returning to monitoring.');
          setAgentState('FALSE_ALARM');
          setTimeout(() => {
            endIncident();
            setAgentState('MONITORING');
          }, 3000);
        }
      } catch (err) {
        log.error('Visual analysis pipeline threw unhandled error', err);
        addLog('ERROR', `❌ Analysis pipeline error: ${String(err)}`);
        setAgentState('IMPACT_DETECTED');
      } finally {
        isAnalyzing.current = false;
      }
    };

    void triggerVisualAnalysis();
  }, [agentState, startCamera, stopCamera, captureFrame, currentMagnitude, addLog, setAgentState, endIncident]);

  // ── Effect 3: Post-Incident Monitoring ────────────────────────────────────

  /**
   * Runs periodic camera checks every POST_INCIDENT_INTERVAL_MS (30s) after
   * emergency dispatch. Captures and logs each frame to the incident timeline.
   * Stops automatically after POST_INCIDENT_MAX_CHECKS (3) cycles.
   */
  useEffect(() => {
    let periodicCheckInterval: number | null = null;
    postIncidentChecks.current = 0;

    if (agentState === 'POST_INCIDENT_MONITORING') {
      addLog('INFO', `🔄 Post-incident monitoring active. Checking every ${POST_INCIDENT_INTERVAL_MS / 1000}s.`);

      periodicCheckInterval = window.setInterval(async () => {
        postIncidentChecks.current += 1;
        addLog(
          'INFO',
          `🔄 Post-incident check ${postIncidentChecks.current}/${POST_INCIDENT_MAX_CHECKS}...`
        );

        try {
          const stream = await startCamera();
          if (stream) {
            const img = await captureFrame(stream);
            stopCamera();
            if (img) {
              addLog('INFO', `📷 Check ${postIncidentChecks.current}: scene updated.`, undefined, img);
            }
          }

          if (postIncidentChecks.current >= POST_INCIDENT_MAX_CHECKS) {
            addLog('INFO', '✅ Post-incident monitoring complete. Awaiting manual reset.');
            if (periodicCheckInterval !== null) {
              clearInterval(periodicCheckInterval);
            }
          }
        } catch (err) {
          log.error('Post-incident monitoring check failed', err);
          addLog('WARNING', `Post-incident check error: ${String(err)}`);
        }
      }, POST_INCIDENT_INTERVAL_MS);
    }

    return () => {
      if (periodicCheckInterval !== null) {
        clearInterval(periodicCheckInterval);
      }
    };
  }, [agentState, startCamera, stopCamera, captureFrame, addLog]);

  // ── Public Actions ─────────────────────────────────────────────────────────

  /**
   * Cancels the current alert, stops the countdown, and returns to monitoring.
   * Logs a manual cancellation confirmation to the incident timeline.
   */
  const cancelAlert = () => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    addLog('INFO', '✅ Alert manually cancelled by user — user confirmed safe.');
    endIncident();
    setAgentState('MONITORING');
  };

  return { cancelAlert, appMode };
};
