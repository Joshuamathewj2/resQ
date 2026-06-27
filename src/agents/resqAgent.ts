import { analyzeScene } from '../services/geminiService';
import { sendEmergencyAlerts } from '../services/notificationService';
import { saveIncident } from '../services/incidentLogger';
import { useAgentStore } from '../store/agentStore';
import { IntegratedReasoningResult } from '../types';

export const runIncidentAnalysis = async (
  base64Image: string,
  impactForce: number
): Promise<IntegratedReasoningResult> => {
  const store = useAgentStore.getState();
  const { coordinates, addLog, setActiveAnalysisResult } = store;

  addLog('INFO', '🤖 Agent starting visual cortex scene analysis...');
  
  try {
    // 1. Fetch visual observations from Gemini Vision
    const visionResult = await analyzeScene(base64Image, impactForce, coordinates);
    
    // Save visual cortex result in state store for UI inspection
    setActiveAnalysisResult(visionResult);
    addLog('DECISION', `🤖 AI Visual Assessment: Score ${visionResult.emergencyScore}/10. Status: ${visionResult.personStatus}. Danger: ${visionResult.apparentDanger}`);
    addLog('INFO', `🤖 AI Reasoning: ${visionResult.reasoning}`);

    // 2. Perform integrated reasoning (Agent Decision logic)
    const isEmergencyConfirmed = visionResult.emergencyScore >= 4.0;
    const recommendedAction = isEmergencyConfirmed ? 'DISPATCH' : 'MONITOR';

    const incidentSummary = isEmergencyConfirmed
      ? `Accident suspected: User status is ${visionResult.personStatus.replace('_', ' ')}. Visual danger level: ${visionResult.apparentDanger}.`
      : `Potential impact detected, but scene appears stable. User status: ${visionResult.personStatus.replace('_', ' ')}.`;

    const detailedReasoning = `Integrated logic combined telemetry G-force (${impactForce.toFixed(1)} m/s²) with Gemini Vision feedback. State is ${recommendedAction}. AI reasoning: ${visionResult.reasoning}`;

    return {
      isEmergencyConfirmed,
      emergencyScore: visionResult.emergencyScore,
      recommendedAction,
      incidentSummary,
      detailedReasoning
    };
  } catch (error) {
    addLog('ERROR', `🤖 Agent reasoning pipeline failed: ${error}. Proceeding with safety fallback protocols.`);
    
    // Safety Fallback (high alarm score to prioritize client safety on error)
    return {
      isEmergencyConfirmed: false, // Don't auto-dispatch instantly on network error, await countdown completion
      emergencyScore: 10,
      recommendedAction: 'MONITOR',
      incidentSummary: 'Telemetry recorded crash threshold force. AI reasoning failed to execute due to system error.',
      detailedReasoning: 'Critical analysis failure. Waiting for safety timer or manual feedback.'
    };
  }
};

export const dispatchEmergencyAction = async (): Promise<boolean> => {
  const store = useAgentStore.getState();
  const { 
    coordinates, 
    contacts, 
    userProfile, 
    activeAnalysisResult, 
    currentIncidentId,
    logs, 
    addLog, 
    setAgentState 
  } = store;

  if (contacts.length === 0) {
    addLog('ERROR', '🚨 Action canceled: No emergency contacts configured!');
    return false;
  }

  setAgentState('NOTIFYING');
  addLog('ACTION', '🚀 Initiating autonomous emergency dispatch...');

  const score = activeAnalysisResult?.emergencyScore ?? 10;
  const reasoning = activeAnalysisResult?.reasoning ?? 'Sustained accelerometer crash threshold exceeded.';
  const summary = activeAnalysisResult 
    ? `User is ${activeAnalysisResult.personStatus.replace('_', ' ')} with ${activeAnalysisResult.injuryLikelihood} injury likelihood.`
    : 'Accelerometer detected severe impact force. User unresponsive to cancel prompts.';

  try {
    const result = await sendEmergencyAlerts({
      contacts,
      userProfile,
      coordinates,
      emergencyScore: score,
      reasoning,
      incidentSummary: summary
    });

    result.logs.forEach(logLine => {
      addLog('INFO', `📡 ${logLine}`);
    });

    setAgentState('POST_INCIDENT_MONITORING');
    addLog('INFO', '📈 Shifted to POST_INCIDENT_MONITORING. Periodic re-checks initialized.');

    // Save incident logs permanently to local IndexedDB audit database
    if (currentIncidentId) {
      await saveIncident(currentIncidentId, logs);
      addLog('INFO', `💾 Incident timeline permanently archived in IndexedDB: ${currentIncidentId}`);
    }

    return true;
  } catch (error) {
    addLog('ERROR', `🚨 Failed to complete emergency alert dispatch: ${error}`);
    setAgentState('POST_INCIDENT_MONITORING');
    return false;
  }
};
