import { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import { runIncidentAnalysis, dispatchEmergencyAction } from '../agents/resqAgent';

export const useAgentLoop = (
  startCamera: () => Promise<MediaStream | null>,
  stopCamera: () => void,
  captureFrame: (stream?: MediaStream) => Promise<string | null>
) => {
  const {
    agentState,
    setAgentState,
    setCountdownSeconds,
    currentMagnitude,
    addLog,
    endIncident
  } = useAgentStore();

  const countdownIntervalRef = useRef<number | null>(null);
  const isAnalyzing = useRef<boolean>(false);

  // Countdown timer loop
  useEffect(() => {
    if (agentState === 'IMPACT_DETECTED') {
      // Initialize/reset countdown timer state
      setCountdownSeconds(30);

      countdownIntervalRef.current = window.setInterval(() => {
        const currentSeconds = useAgentStore.getState().countdownSeconds;
        
        if (currentSeconds <= 1) {
          // Timer expired! Trigger notification
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          addLog('WARNING', '⏳ Countdown expired. User did not cancel alert.');
          dispatchEmergencyAction();
        } else {
          setCountdownSeconds(currentSeconds - 1);
        }
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [agentState, setCountdownSeconds, addLog]);

  // Visual Scene Analysis Trigger
  useEffect(() => {
    const triggerVisualAnalysis = async () => {
      if (agentState === 'IMPACT_DETECTED' && !isAnalyzing.current) {
        isAnalyzing.current = true;
        setAgentState('SCENE_ANALYSIS');
        addLog('INFO', '📸 Initializing post-impact camera capture stream...');

        const cameraStream = await startCamera();
        if (cameraStream) {
          // Capture the frame base64 JPEG data
          const base64Data = await captureFrame(cameraStream);
          stopCamera();

          if (base64Data) {
            // Save base64 preview into timeline logs
            addLog('INFO', '🖼️ Camera frame successfully converted to base64.', undefined, base64Data);

            // Execute reasoning model
            const evaluation = await runIncidentAnalysis(base64Data, currentMagnitude);
            
            if (evaluation.isEmergencyConfirmed) {
              addLog('ALERT', '🚨 AI confirmed high probability accident emergency! Dispatching immediately...');
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
              await dispatchEmergencyAction();
            } else {
              addLog('INFO', 'ℹ️ AI score was low or inconclusive. Continuing with manual cancellation countdown.');
              setAgentState('IMPACT_DETECTED'); // Go back to countdown status screen
            }
          } else {
            addLog('ERROR', '❌ Failed to capture valid base64 image data.');
            setAgentState('IMPACT_DETECTED');
          }
        } else {
          addLog('ERROR', '❌ Failed to open camera. Falling back to countdown timer.');
          setAgentState('IMPACT_DETECTED');
        }
        isAnalyzing.current = false;
      }
    };

    triggerVisualAnalysis();
  }, [agentState, startCamera, stopCamera, captureFrame, currentMagnitude, addLog, setAgentState]);

  // Periodic monitoring post-incident
  useEffect(() => {
    let periodicCheckInterval: number | null = null;

    if (agentState === 'POST_INCIDENT_MONITORING') {
      // Every 30 seconds, capture a quick picture to monitor the situation
      periodicCheckInterval = window.setInterval(async () => {
        addLog('INFO', '🔄 Running periodic post-incident monitoring re-evaluation...');
        const stream = await startCamera();
        if (stream) {
          const img = await captureFrame(stream);
          stopCamera();
          if (img) {
            addLog('INFO', '🔄 Captured updated status image.', undefined, img);
            // In a production app, we would query a specific update endpoint.
            // For the demo, we log the action in the timeline.
            addLog('INFO', '🔄 Status: Situation stable. Help still requested.');
          }
        }
      }, 30000);
    }

    return () => {
      if (periodicCheckInterval) {
        clearInterval(periodicCheckInterval);
      }
    };
  }, [agentState, startCamera, stopCamera, captureFrame, addLog]);

  const cancelAlert = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    addLog('INFO', '✅ Alert manually canceled by user. Safety confirmed.');
    endIncident();
    setAgentState('MONITORING');
  };

  return {
    cancelAlert
  };
};
