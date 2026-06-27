/**
 * @file src/components/Dashboard.tsx
 * @description Main telemetry console dashboard panel.
 *
 * Displays:
 * - Live accelerometer telemetry via the SensorGraph component
 * - Current agent state badge with animated indicators
 * - GPS coordinates and emergency contact count
 * - Multi-modal confidence score (when available)
 * - Monitoring control buttons (Start/Stop, Simulate, Reset)
 * - App mode toggle (Active vs Silent)
 */

import React from 'react';
import { useAgentStore } from '../store/agentStore';
import { formatCoordinates } from '../services/locationService';
import { SensorGraph } from './SensorGraph';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Play,
  Square,
  Compass,
  RefreshCw,
  Volume2,
  VolumeX,
  BarChart2,
} from 'lucide-react';

interface DashboardProps {
  /** Callback to start monitoring (request permissions + begin sensor loop) */
  onStart: () => void;
  /** Callback to stop monitoring and return to IDLE */
  onStop: () => void;
  /** Callback to trigger the full accident simulation flow */
  onSimulate: () => void;
  /** Callback to reset the agent state and clear all logs */
  onReset: () => void;
  /** Whether the accelerometer listener is currently active */
  isListening: boolean;
}

/**
 * Returns the appropriate status badge element for the current agent state.
 *
 * @param agentState - The current state machine position
 * @returns A styled badge JSX element
 */
function getStatusBadge(agentState: string): React.ReactElement {
  switch (agentState) {
    case 'IDLE':
      return (
        <div className="status-badge state-idle">
          <Shield className="w-5 h-5 text-gray-400" />
          <span>Agent Idle</span>
        </div>
      );
    case 'MONITORING':
      return (
        <div className="status-badge state-monitoring">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span className="text-emerald-400">Monitoring Active</span>
        </div>
      );
    case 'IMPACT_DETECTED':
    case 'SCENE_ANALYSIS':
      return (
        <div className="status-badge state-warning animate-pulse">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <span className="text-rose-500">IMPACT DETECTED</span>
        </div>
      );
    case 'EMERGENCY_CONFIRMED':
    case 'NOTIFYING':
      return (
        <div className="status-badge state-alert animate-pulse">
          <ShieldAlert className="w-5 h-5 text-amber-500" />
          <span className="text-amber-500">DISPATCHING ALERTS</span>
        </div>
      );
    case 'FALSE_ALARM':
      return (
        <div className="status-badge state-monitoring">
          <ShieldCheck className="w-5 h-5 text-sky-400" />
          <span className="text-sky-400">False Alarm Cleared</span>
        </div>
      );
    case 'POST_INCIDENT_MONITORING':
      return (
        <div className="status-badge state-warning">
          <Shield className="w-5 h-5 text-amber-400" />
          <span className="text-amber-400">Post-Incident Watch</span>
        </div>
      );
    default:
      return (
        <div className="status-badge state-idle">
          <Shield className="w-5 h-5 text-gray-400" />
          <span>{agentState}</span>
        </div>
      );
  }
}

/**
 * Telemetry console dashboard with sensor graph, status indicators, and controls.
 *
 * @param props - Component props
 *
 * @example
 * ```tsx
 * <Dashboard onStart={handleStart} onStop={handleStop} onSimulate={simulate} onReset={reset} isListening={isListening} />
 * ```
 */
export const Dashboard: React.FC<DashboardProps> = ({
  onStart,
  onStop,
  onSimulate,
  onReset,
  isListening,
}) => {
  const { agentState, coordinates, contacts, confidenceScore, appMode, setAppMode } =
    useAgentStore();

  return (
    <div className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <h2 className="section-title">Telemetry Console</h2>
          <p className="section-subtitle">Real-time force sensors & agent state machine</p>
        </div>
        {getStatusBadge(agentState)}
      </div>

      {/* Sensor Graph */}
      <SensorGraph isListening={isListening} />

      {/* Info Grid */}
      <div className="info-grid">
        <div className="info-tile">
          <div className="tile-header">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>GPS Coordinates</span>
          </div>
          <p className="tile-value text-sky-300">{formatCoordinates(coordinates)}</p>
        </div>

        <div className="info-tile">
          <div className="tile-header">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Emergency Contacts</span>
          </div>
          <p className="tile-value text-amber-300">{contacts.length} Configured</p>
        </div>

        {confidenceScore && (
          <div className="info-tile" style={{ gridColumn: '1 / -1' }}>
            <div className="tile-header">
              <BarChart2 className="w-4 h-4 text-violet-400" />
              <span>Multi-Modal Confidence Score</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '4px' }}>
              <span className="tile-value" style={{ color: '#c4b5fd' }}>
                Final: <strong>{confidenceScore.finalScore.toFixed(1)}/10</strong>
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Accel: {confidenceScore.accelScore.toFixed(1)} × {confidenceScore.accelWeight} +{' '}
                Vision: {confidenceScore.visionScore.toFixed(1)} × {confidenceScore.visionWeight}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Control Row */}
      <div className="control-row">
        {!isListening ? (
          <button
            id="btn-start-monitoring"
            onClick={onStart}
            className="btn btn-primary btn-flex"
          >
            <Play className="w-4 h-4" />
            <span>Start Monitoring</span>
          </button>
        ) : (
          <button
            id="btn-stop-monitoring"
            onClick={onStop}
            className="btn btn-danger btn-flex"
          >
            <Square className="w-4 h-4" />
            <span>Stop Monitoring</span>
          </button>
        )}

        <button
          id="btn-simulate-impact"
          onClick={onSimulate}
          disabled={!isListening}
          className={`btn btn-secondary btn-flex ${!isListening ? 'btn-disabled' : ''}`}
          title={!isListening ? 'Start monitoring first' : 'Simulate a crash impact event'}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Simulate Impact</span>
        </button>

        {/* App Mode Toggle */}
        <button
          id="btn-toggle-mode"
          onClick={() => setAppMode(appMode === 'ACTIVE' ? 'SILENT' : 'ACTIVE')}
          className="btn btn-tertiary btn-flex"
          title={
            appMode === 'ACTIVE'
              ? 'Switch to Silent Mode (auto-proceed, no UI interaction)'
              : 'Switch to Active Mode (visual alerts + manual cancel)'
          }
        >
          {appMode === 'ACTIVE' ? (
            <Volume2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <VolumeX className="w-4 h-4 text-amber-400" />
          )}
          <span>{appMode === 'ACTIVE' ? 'Active' : 'Silent'}</span>
        </button>

        <button
          id="btn-reset-agent"
          onClick={onReset}
          className="btn btn-tertiary btn-icon-only"
          title="Reset agent state and clear all logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Mode description */}
      <p style={{ fontSize: '0.72rem', color: '#4b5563', marginTop: '8px', textAlign: 'right' }}>
        {appMode === 'ACTIVE'
          ? '🔊 Active Mode: visual alerts shown, manual cancel required'
          : '🔇 Silent Mode: auto-proceeds on timer expiry — designed for wrist/bag mounting'}
      </p>
    </div>
  );
};

export default Dashboard;
