/**
 * @file src/components/SensorGraph.tsx
 * @description Real-time accelerometer telemetry canvas graph component.
 *
 * Renders a continuously-updating canvas-based line graph of accelerometer
 * magnitude readings. Features:
 * - 60fps updates via the useAccelerometer hook's requestAnimationFrame loop
 * - Threshold marker line at the configured impact detection level
 * - Color-coded trace: green (safe), red (above threshold)
 * - Background grid for readability
 * - Fills area under the curve for visual impact
 */

import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import {
  IMPACT_THRESHOLD_M_S2,
  CANVAS_MAX_FORCE_M_S2,
} from '../config/constants';
import { Activity } from 'lucide-react';

interface SensorGraphProps {
  /** Whether the accelerometer listener is currently active. */
  isListening: boolean;
}

/**
 * Canvas-based real-time sensor graph component.
 *
 * Subscribes to accelerometerHistory from the Zustand store and redraws
 * the canvas on every history update. The graph maps m/s² values to
 * Y-axis position within the canvas height.
 *
 * @param props - Component props
 * @param props.isListening - Controls graph trace color (green vs gray)
 *
 * @example
 * ```tsx
 * <SensorGraph isListening={isListening} />
 * ```
 */
export const SensorGraph: React.FC<SensorGraphProps> = ({ isListening }) => {
  const { currentMagnitude, accelerometerHistory } = useAgentStore();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Redraws the canvas whenever the accelerometer history changes.
   * Clears the previous frame and renders grid, threshold line, and data trace.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // ── Background Grid ──────────────────────────────────────────────────────
    ctx.strokeStyle = '#1e1e24';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // ── Impact Threshold Marker ──────────────────────────────────────────────
    const thresholdY = height - (IMPACT_THRESHOLD_M_S2 / CANVAS_MAX_FORCE_M_S2) * height;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(0, thresholdY);
    ctx.lineTo(width, thresholdY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Label
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.font = '10px Outfit, sans-serif';
    ctx.fillText(`Threshold (${IMPACT_THRESHOLD_M_S2} m/s²)`, 8, thresholdY - 4);

    // ── Data Trace ───────────────────────────────────────────────────────────
    const traceColor = isListening ? '#10b981' : '#4b5563';
    const count = accelerometerHistory.length;
    const step = width / Math.max(count - 1, 1);

    // Draw filled area under curve
    ctx.beginPath();
    accelerometerHistory.forEach((val, i) => {
      const y = height - (Math.min(val, CANVAS_MAX_FORCE_M_S2) / CANVAS_MAX_FORCE_M_S2) * height;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, height);
      ctx.lineTo(x, y);
    });
    ctx.lineTo((count - 1) * step, height);
    ctx.closePath();
    ctx.fillStyle = isListening ? 'rgba(16, 185, 129, 0.08)' : 'rgba(75, 85, 99, 0.05)';
    ctx.fill();

    // Draw trace line
    ctx.strokeStyle = traceColor;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    accelerometerHistory.forEach((val, i) => {
      const y = height - (Math.min(val, CANVAS_MAX_FORCE_M_S2) / CANVAS_MAX_FORCE_M_S2) * height;
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }, [accelerometerHistory, isListening]);

  return (
    <div className="graph-container">
      <canvas
        ref={canvasRef}
        id="sensor-telemetry-canvas"
        width={600}
        height={180}
        className="telemetry-canvas"
        aria-label="Real-time accelerometer telemetry graph"
        role="img"
      />
      <div className="current-stat">
        <Activity
          className={`w-4 h-4 ${isListening ? 'text-emerald-500 animate-pulse' : 'text-gray-500'}`}
        />
        <span>
          Current Force:{' '}
          <strong className="text-white">{currentMagnitude.toFixed(2)}</strong> m/s²
        </span>
      </div>
    </div>
  );
};

export default SensorGraph;
