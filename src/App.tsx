import React, { useEffect } from 'react';
import { useAgentStore } from './store/agentStore';
import { useAccelerometer } from './hooks/useAccelerometer';
import { useCamera } from './hooks/useCamera';
import { useGPS } from './hooks/useGPS';
import { useAgentLoop } from './hooks/useAgentLoop';
import { useSimulation } from './hooks/useSimulation';
import { Dashboard } from './components/Dashboard';
import { MonitoringStatus } from './components/MonitoringStatus';
import { AlertCountdown } from './components/AlertCountdown';
import { EmergencyContactForm } from './components/EmergencyContactForm';
import { IncidentTimeline } from './components/IncidentTimeline';

export const App: React.FC = () => {
  const { 
    setAgentState, 
    addLog, 
    isCameraActiveSimulated, 
    showSmsSimulated, 
    smsMessageSimulated, 
    setShowSmsSimulated 
  } = useAgentStore();
  
  // Initialize device hooks
  const { startCamera, stopCamera, captureFrame } = useCamera();
  const { startTracking, stopTracking } = useGPS();
  const { 
    isListening, 
    requestPermission, 
    stopListening 
  } = useAccelerometer();

  // Initialize simulation controller hook
  const { runDemoSimulation, cancelSimulation, resetAgent } = useSimulation();

  // Orchestrate the main agent control loops
  const { cancelAlert } = useAgentLoop(startCamera, stopCamera, captureFrame);

  // Monitor toggle trigger functions
  const handleStartMonitoring = async () => {
    const motionPerm = await requestPermission();
    
    if (motionPerm) {
      startTracking(); // Start location monitoring
      setAgentState('MONITORING');
      addLog('INFO', '🚀 ResQ system monitoring successfully initialized.');
    } else {
      alert('ResQ requires motion sensors to detect impacts.');
    }
  };

  const handleStopMonitoring = () => {
    stopListening();
    stopTracking();
    setAgentState('IDLE');
    addLog('INFO', '⏸️ ResQ system paused.');
  };

  // Consolidate cancel action for both simulator & accelerometer
  const handleCancelAll = () => {
    cancelAlert();
    cancelSimulation();
  };

  // Clean up hooks on unmount
  useEffect(() => {
    return () => {
      stopListening();
      stopTracking();
    };
  }, [stopListening, stopTracking]);

  return (
    <div className="app-container">
      {/* Navigation Brand Header */}
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-logo">🚨</span>
          <div>
            <h1 className="brand-title">ResQ</h1>
            <p className="brand-tagline">AI Autonomous Emergency Agent</p>
          </div>
        </div>
      </header>

      {/* Main Grid Panels */}
      <main>
        {/* Telemetry Dashboard Console */}
        <Dashboard
          onStart={handleStartMonitoring}
          onStop={handleStopMonitoring}
          onSimulate={runDemoSimulation}
          onReset={resetAgent}
          isListening={isListening}
        />

        {/* AI Agent Status Observation Log Panel */}
        <MonitoringStatus />

        {/* Console Incident Timelines and Archive Logs */}
        <IncidentTimeline />

        {/* Medical configuration & contact records */}
        <EmergencyContactForm />
      </main>

      {/* Red Alert Countdown Modal Overlay */}
      <AlertCountdown onCancel={handleCancelAll} />

      {/* Simulated Camera Feed Acquisition Overlay */}
      {isCameraActiveSimulated && (
        <div className="alert-overlay" style={{ background: 'rgba(0, 0, 0, 0.9)', zIndex: 10000 }}>
          <div className="alert-box" style={{ borderColor: '#38bdf8', boxShadow: '0 0 50px rgba(56, 189, 248, 0.4)' }}>
            <div className="brand-logo" style={{ fontSize: '3rem', marginBottom: '16px' }}>📷</div>
            <h2 className="alert-title" style={{ color: '#38bdf8' }}>Camera Activated</h2>
            <p className="alert-subtitle" style={{ fontSize: '1.1rem', marginTop: '8px' }}>Capturing scene for AI analysis...</p>
          </div>
        </div>
      )}

      {/* Simulated SMS Alert Delivery Acknowledgment Modal */}
      {showSmsSimulated && (
        <div className="alert-overlay" style={{ background: 'rgba(0, 0, 0, 0.85)', zIndex: 9999 }}>
          <div className="alert-box" style={{ borderColor: '#10b981', boxShadow: '0 0 50px rgba(16, 185, 129, 0.4)', maxWidth: '520px' }}>
            <div className="brand-logo" style={{ fontSize: '3rem', marginBottom: '16px' }}>💬</div>
            <h2 className="alert-title" style={{ color: '#10b981' }}>Simulated SMS Transmission</h2>
            <p className="section-subtitle" style={{ marginBottom: '16px' }}>The following autonomous dispatch alert has been sent to emergency contacts:</p>
            <div className="summary-text-block" style={{ textAlign: 'left', background: '#0a0a0f', border: '1px solid #1e1e24', fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
              {smsMessageSimulated}
            </div>
            <button 
              onClick={() => setShowSmsSimulated(false)} 
              className="btn btn-primary mt-4" 
              style={{ width: '100%', background: '#10b981', color: '#fff', fontSize: '1rem', padding: '12px' }}
            >
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
