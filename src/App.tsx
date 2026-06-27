/**
 * @file src/App.tsx
 * @description Root application component for ResQ.
 *
 * Composes all top-level hooks, wires them together, and renders the
 * application layout. The component tree is wrapped in an ErrorBoundary
 * to prevent full UI crashes during active monitoring sessions.
 *
 * Layout:
 * - Header: brand logo, title, tagline
 * - Main: Dashboard + MonitoringStatus + IncidentTimeline + Settings
 * - Overlays: AlertCountdown, Camera simulation overlay, SMS preview modal
 */

import React, { useEffect, useState } from 'react';
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
import { ErrorBoundary } from './components/ErrorBoundary';
import { PermissionSetup } from './components/PermissionSetup';

/**
 * Root application component.
 *
 * Initialises all hooks and renders the full ResQ interface.
 * Wrapped in ErrorBoundary at the call site in main.tsx to catch
 * any unhandled rendering errors without crashing the monitoring session.
 *
 * @example
 * ```tsx
 * // In main.tsx:
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 */
export const App: React.FC = () => {
  const [permissionsConfigured, setPermissionsConfigured] = useState(
    localStorage.getItem('resq_permissions_configured') === 'true'
  );

  const {
    setAgentState,
    addLog,
    isCameraActiveSimulated,
    showSmsSimulated,
    smsMessageSimulated,
    setShowSmsSimulated,
  } = useAgentStore();

  // ── Device Hooks ────────────────────────────────────────────────────────
  const { startCamera, stopCamera, captureFrame } = useCamera();
  const { startTracking, stopTracking } = useGPS();
  const { isListening, requestPermission, stopListening } = useAccelerometer();

  // ── Control Hooks ────────────────────────────────────────────────────────
  const { runDemoSimulation, cancelSimulation, resetAgent } = useSimulation();

  // Orchestrate agent control loops (countdown, analysis, post-incident)
  const { cancelAlert } = useAgentLoop(startCamera, stopCamera, captureFrame);

  // ── Monitoring Control Handlers ──────────────────────────────────────────

  /**
   * Starts the monitoring session. Requests accelerometer permission first,
   * then initialises GPS tracking and transitions to MONITORING state.
   */
  const handleStartMonitoring = async () => {
    const motionPermGranted = await requestPermission();
    if (motionPermGranted) {
      startTracking();
      setAgentState('MONITORING');
      addLog('INFO', '🚀 ResQ monitoring session initialised. Watching for high-impact events...');
    } else {
      alert('ResQ requires motion sensor access to detect impacts. Please grant permission and try again.');
    }
  };

  /**
   * Stops monitoring and returns the agent to IDLE state.
   * Detaches all event listeners and clears GPS tracking.
   */
  const handleStopMonitoring = () => {
    stopListening();
    stopTracking();
    setAgentState('IDLE');
    addLog('INFO', '⏸️ ResQ monitoring session paused. Agent returned to IDLE.');
  };

  /**
   * Unified cancel handler that aborts both live alerts and demo simulation alerts.
   * Called by the AlertCountdown cancel button.
   */
  const handleCancelAll = () => {
    cancelAlert();
    cancelSimulation();
  };

  // ── Cleanup on Unmount ───────────────────────────────────────────────────

  /**
   * Ensures sensor listeners and GPS watches are cleaned up when the component
   * unmounts (e.g., navigating away or hot-reloading in development).
   */
  useEffect(() => {
    return () => {
      stopListening();
      stopTracking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!permissionsConfigured) {
    return <PermissionSetup onComplete={() => setPermissionsConfigured(true)} />;
  }

  return (
    <div className="app-container">
      {/* ── Brand Header ──────────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="brand-section">
          <span className="brand-logo" aria-hidden="true">🚨</span>
          <div>
            <h1 className="brand-title">ResQ</h1>
            <p className="brand-tagline">AI Autonomous Emergency Agent</p>
          </div>
        </div>
      </header>

      {/* ── Main Content Grid ──────────────────────────────────────────────── */}
      <main>
        {/* Telemetry Dashboard with sensor graph and controls */}
        <Dashboard
          onStart={() => void handleStartMonitoring()}
          onStop={handleStopMonitoring}
          onSimulate={runDemoSimulation}
          onReset={resetAgent}
          isListening={isListening}
        />

        {/* AI Agent Status Panel — hidden in IDLE */}
        <ErrorBoundary>
          <MonitoringStatus />
        </ErrorBoundary>

        {/* Incident log timeline + IndexedDB archive */}
        <ErrorBoundary>
          <IncidentTimeline />
        </ErrorBoundary>

        {/* User medical profile + emergency contacts settings */}
        <EmergencyContactForm />
      </main>

      {/* ── Overlays ──────────────────────────────────────────────────────── */}

      {/* Emergency alert countdown modal */}
      <AlertCountdown onCancel={handleCancelAll} />

      {/* Camera acquisition simulation overlay */}
      {isCameraActiveSimulated && (
        <div
          id="camera-simulation-overlay"
          className="alert-overlay"
          style={{ background: 'rgba(0, 0, 0, 0.9)', zIndex: 10000 }}
        >
          <div
            className="alert-box"
            style={{ borderColor: '#38bdf8', boxShadow: '0 0 50px rgba(56, 189, 248, 0.4)' }}
          >
            <div className="brand-logo" style={{ fontSize: '3rem', marginBottom: '16px' }}>
              📷
            </div>
            <h2 className="alert-title" style={{ color: '#38bdf8' }}>
              Camera Activated
            </h2>
            <p className="alert-subtitle" style={{ fontSize: '1.1rem', marginTop: '8px' }}>
              Capturing post-impact scene for AI analysis...
            </p>
          </div>
        </div>
      )}

      {/* Simulated SMS dispatch preview modal */}
      {showSmsSimulated && (
        <div
          id="sms-simulation-overlay"
          className="alert-overlay"
          style={{ background: 'rgba(0, 0, 0, 0.85)', zIndex: 9999 }}
        >
          <div
            className="alert-box"
            style={{
              borderColor: '#10b981',
              boxShadow: '0 0 50px rgba(16, 185, 129, 0.4)',
              maxWidth: '520px',
            }}
          >
            <div className="brand-logo" style={{ fontSize: '3rem', marginBottom: '16px' }}>
              💬
            </div>
            <h2 className="alert-title" style={{ color: '#10b981' }}>
              Emergency Alert Dispatched
            </h2>
            <p className="section-subtitle" style={{ marginBottom: '16px' }}>
              The following autonomous emergency SMS has been sent to your contacts:
            </p>
            <div
              className="summary-text-block"
              style={{
                textAlign: 'left',
                background: '#0a0a0f',
                border: '1px solid #1e1e24',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5',
              }}
            >
              {smsMessageSimulated}
            </div>
            <button
              id="btn-acknowledge-sms"
              onClick={() => setShowSmsSimulated(false)}
              className="btn btn-primary mt-4"
              style={{
                width: '100%',
                background: '#10b981',
                color: '#fff',
                fontSize: '1rem',
                padding: '12px',
              }}
            >
              Acknowledge & Continue Monitoring
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
