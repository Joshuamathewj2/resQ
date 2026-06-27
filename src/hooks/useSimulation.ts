import { useRef, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import { analyzeSimulationScene, analyzeSimulationMonitoring } from '../services/geminiService';

export const useSimulation = () => {
  const store = useAgentStore();
  const {
    setAgentState,
    setCurrentMagnitude,
    pushMagnitudeHistory,
    addLog,
    setActiveAnalysisResult,
    setCountdownSeconds,
    setCameraActiveSimulated,
    setShowSmsSimulated,
    setSmsMessageSimulated,
    addPostIncidentFeed,
    endIncident,
    coordinates,
    contacts,
    userProfile
  } = store;

  const countdownIntervalRef = useRef<number | null>(null);
  const monitoringIntervalRef = useRef<number | null>(null);
  const graphIntervalRef = useRef<number | null>(null);

  const cleanAllSimulationIntervals = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
    }
    if (graphIntervalRef.current) {
      clearInterval(graphIntervalRef.current);
      graphIntervalRef.current = null;
    }
  }, []);

  // Cancel Simulation (Step 5A)
  const cancelSimulation = useCallback(() => {
    cleanAllSimulationIntervals();
    
    // Animate returning to flat line graph
    let currentForce = 31.2;
    graphIntervalRef.current = window.setInterval(() => {
      currentForce = Math.max(0, currentForce - 4);
      setCurrentMagnitude(currentForce);
      pushMagnitudeHistory(currentForce);
      if (currentForce <= 0) {
        if (graphIntervalRef.current) clearInterval(graphIntervalRef.current);
      }
    }, 50);

    addLog('INFO', '🟢 User confirmed safe — false alarm cancelled');
    endIncident();
    setAgentState('MONITORING');
  }, [cleanAllSimulationIntervals, setCurrentMagnitude, pushMagnitudeHistory, addLog, endIncident, setAgentState]);

  // Reset/Reset Database button (🔄) next to Simulate button
  const resetAgent = useCallback(() => {
    cleanAllSimulationIntervals();
    endIncident();
    setAgentState('IDLE');
    store.clearLogs();
    addLog('INFO', '🔄 System reset. Logs cleared. State returned to IDLE.');
  }, [cleanAllSimulationIntervals, endIncident, setAgentState, addLog]);

  // Dispatch Emergency simulated alerts (Step 5B)
  const triggerSimulationDispatch = useCallback(() => {
    cleanAllSimulationIntervals();
    setAgentState('NOTIFYING');

    // Retrieve active contact (default to Peter)
    const primaryContact = contacts[0] || { name: 'Peter', phone: '+919940335499', email: '' };
    const score = store.activeAnalysisResult?.emergencyScore ?? 8.5;
    
    const lat = coordinates.latitude ?? 12.9716;
    const lng = coordinates.longitude ?? 80.2209;
    const mapUrl = `https://maps.google.com/?q=${lat},${lng}`;

    const smsText = `EMERGENCY ALERT: ${userProfile.name || 'Tony Stark'} (Blood Type: ${userProfile.bloodType || 'A+'}) may have been in a road accident. 
AI Confidence: ${score}/10. Last Location: [${lat.toFixed(4)}, ${lng.toFixed(4)}] 
Google Maps: ${mapUrl}
Medical Info: ${userProfile.medicalConditions || 'Healthy'} | Allergies: ${userProfile.allergies || 'No'}
— ResQ Autonomous Emergency Agent`;

    setSmsMessageSimulated(smsText);
    setShowSmsSimulated(true);

    addLog('ACTION', `📨 Emergency alert dispatched to ${primaryContact.name} (${primaryContact.phone})`);
    setAgentState('POST_INCIDENT_MONITORING');

    // Step 6: Post Incident Monitoring
    addLog('INFO', '📈 Starting post-incident visual surveillance feedback...');
    monitoringIntervalRef.current = window.setInterval(async () => {
      addLog('INFO', '🤖 Running periodic post-incident monitoring re-evaluation...');
      try {
        const update = await analyzeSimulationMonitoring();
        addPostIncidentFeed(update.situationUpdate);
        addLog('INFO', `🔄 Feed Update: ${update.situationUpdate}`);
        
        if (!update.continueMonitoring) {
          addLog('DECISION', '🏥 Rescue complete. Ending monitoring feed.');
          if (monitoringIntervalRef.current) clearInterval(monitoringIntervalRef.current);
        }
      } catch (err) {
        console.error('Monitoring update failed', err);
      }
    }, 10000);
  }, [contacts, coordinates, userProfile, store.activeAnalysisResult, addLog, setAgentState, setSmsMessageSimulated, setShowSmsSimulated, addPostIncidentFeed, cleanAllSimulationIntervals]);

  // Run full simulation sequentially
  const runDemoSimulation = useCallback(() => {
    cleanAllSimulationIntervals();
    addLog('INFO', '🚀 Starting automated demo simulation...');

    // Step 1: Spike accelerometer graph
    let tick = 0;
    const forces = [5.1, 14.5, 28.2, 31.2];
    
    graphIntervalRef.current = window.setInterval(() => {
      const force = forces[tick] || 31.2;
      setCurrentMagnitude(force);
      pushMagnitudeHistory(force);
      tick++;
      if (tick >= forces.length) {
        if (graphIntervalRef.current) clearInterval(graphIntervalRef.current);
      }
    }, 100);

    setAgentState('IMPACT_DETECTED');
    addLog('WARNING', '⚡ High-impact event detected — 31.2 m/s² — initiating scene analysis protocol');

    // Step 2: Camera Activation
    setTimeout(() => {
      setCameraActiveSimulated(true);
      addLog('INFO', '🎥 Camera feed acquired — transmitting to Gemini Vision');
      
      // Step 3: Real Gemini API Call after 1.5s
      setTimeout(async () => {
        setCameraActiveSimulated(false);
        setAgentState('SCENE_ANALYSIS');
        addLog('INFO', '🤖 Contacting Gemini API for visual scene reasoning...');
        
        try {
          const result = await analyzeSimulationScene();
          setActiveAnalysisResult(result);
          addLog('DECISION', `🤖 Gemini Response: Status: ${result.personStatus}, Score: ${result.emergencyScore}/10, Recommendation: ${result.recommendation}`);
          addLog('INFO', `🤖 Reasoning: ${result.reasoning}`);

          if (result.emergencyScore > 6 || result.recommendation === 'EMERGENCY_CONFIRMED') {
            // Step 4: 30 Second Cancellation Countdown
            setAgentState('IMPACT_DETECTED');
            setCountdownSeconds(30);
            
            let secondsLeft = 30;
            countdownIntervalRef.current = window.setInterval(() => {
              secondsLeft--;
              setCountdownSeconds(secondsLeft);
              
              if (secondsLeft % 5 === 0 && secondsLeft > 0) {
                addLog('WARNING', `⏳ Emergency sequence active — ${secondsLeft}s remaining`);
              }
              
              if (secondsLeft <= 0) {
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                triggerSimulationDispatch();
              }
            }, 1000);
          } else {
            addLog('INFO', '🟢 Gemini classified scene as safe. Monitoring resumed.');
            setAgentState('MONITORING');
          }
        } catch (err) {
          addLog('ERROR', `Simulation analysis failed: ${err}`);
          setAgentState('MONITORING');
        }
      }, 1500);
    }, 500);

  }, [cleanAllSimulationIntervals, addLog, setCurrentMagnitude, pushMagnitudeHistory, setAgentState, setCameraActiveSimulated, setActiveAnalysisResult, setCountdownSeconds, triggerSimulationDispatch]);

  return {
    runDemoSimulation,
    cancelSimulation,
    resetAgent,
    triggerSimulationDispatch
  };
};
