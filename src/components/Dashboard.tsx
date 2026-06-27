import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import { CONFIG } from '../config/constants';
import { formatCoordinates } from '../services/locationService';
import { Shield, ShieldAlert, ShieldCheck, Activity, Zap, Play, Square, Compass, RefreshCw } from 'lucide-react';

interface DashboardProps {
  onStart: () => void;
  onStop: () => void;
  onSimulate: () => void;
  onReset: () => void;
  isListening: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onStart,
  onStop,
  onSimulate,
  onReset,
  isListening
}) => {
  const { 
    agentState, 
    currentMagnitude, 
    accelerometerHistory, 
    coordinates,
    contacts
  } = useAgentStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render Real-time Accelerometer Canvas Graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw background grid lines
    ctx.strokeStyle = '#1e1e24';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let j = 0; j < height; j += 30) {
      ctx.beginPath();
      ctx.moveTo(0, j);
      ctx.lineTo(width, j);
      ctx.stroke();
    }

    // Draw threshold line (25 m/s²)
    const thresholdY = height - (CONFIG.IMPACT_THRESHOLD_M_S2 / 45) * height;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    // Draw threshold text label
    ctx.fillStyle = '#ef4444';
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillText(`Impact Threshold (24.5 m/s²)`, 10, thresholdY - 4);

    // Draw acceleration line path
    ctx.strokeStyle = isListening ? '#10b981' : '#6b7280';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const pointsCount = accelerometerHistory.length;
    const step = width / (pointsCount - 1);

    accelerometerHistory.forEach((val, index) => {
      // Map force (0 - 45 m/s²) to canvas coordinate heights
      const y = height - (Math.min(val, 45) / 45) * height;
      const x = index * step;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }, [accelerometerHistory, isListening]);

  // Return badge style according to state machine status
  const getStatusBadge = () => {
    switch (agentState) {
      case 'IDLE':
        return (
          <div className="status-badge state-idle">
            <Shield className="w-5 h-5 text-gray-400" />
            <span>Agent Sleep (Idle)</span>
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
            <span className="text-rose-500">POTENTIAL IMPACT</span>
          </div>
        );
      default:
        return (
          <div className="status-badge state-alert animate-pulse">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <span className="text-amber-500">DISPATCHING HELPLINES</span>
          </div>
        );
    }
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-header">
        <div>
          <h2 className="section-title">Telemetry Console</h2>
          <p className="section-subtitle">Real-time force sensors & agent state</p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Sensor Canvas Graph */}
      <div className="graph-container">
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={180} 
          className="telemetry-canvas"
        />
        <div className="current-stat">
          <Activity className={`w-4 h-4 ${isListening ? 'text-emerald-500 animate-pulse' : 'text-gray-500'}`} />
          <span>Current Force: <strong className="text-white">{currentMagnitude.toFixed(2)}</strong> m/s²</span>
        </div>
      </div>

      {/* Status Details Grid */}
      <div className="info-grid">
        <div className="info-tile">
          <div className="tile-header">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>GPS Tracking Coordinates</span>
          </div>
          <p className="tile-value text-sky-300">
            {formatCoordinates(coordinates)}
          </p>
        </div>

        <div className="info-tile">
          <div className="tile-header">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Emergency Contacts</span>
          </div>
          <p className="tile-value text-amber-300">
            {contacts.length} Configured Contacts
          </p>
        </div>
      </div>

      {/* Dash Control Triggers */}
      <div className="control-row">
        {!isListening ? (
          <button onClick={onStart} className="btn btn-primary btn-flex">
            <Play className="w-4 h-4" />
            <span>Start Telemetry Monitoring</span>
          </button>
        ) : (
          <button onClick={onStop} className="btn btn-danger btn-flex">
            <Square className="w-4 h-4" />
            <span>Stop Monitoring</span>
          </button>
        )}

        <button 
          onClick={onSimulate} 
          disabled={!isListening}
          className={`btn btn-secondary btn-flex ${!isListening ? 'btn-disabled' : ''}`}
        >
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Simulate Impact Force</span>
        </button>

        <button onClick={onReset} className="btn btn-tertiary btn-icon-only" title="Reset system state and logs">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
