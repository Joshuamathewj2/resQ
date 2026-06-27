/**
 * @file src/components/AlertCountdown.tsx
 * @description Emergency alert countdown overlay component.
 *
 * Renders a full-screen modal overlay when the agent enters IMPACT_DETECTED
 * or SCENE_ANALYSIS states. Features:
 * - Animated SVG ring countdown timer
 * - Web Audio API siren synthesis (Active Mode only)
 * - AI analysis result summary when available
 * - Multi-modal confidence score display
 * - Manual cancel button (Active Mode) or auto-progress indicator (Silent Mode)
 *
 * In Silent Mode, no user interaction is required — the countdown runs
 * invisibly and the agent auto-dispatches when the timer expires.
 */

import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import { ShieldAlert, X, VolumeX } from 'lucide-react';
import { COUNTDOWN_DURATION_SEC } from '../config/constants';

interface AlertCountdownProps {
  /** Callback invoked when the user clicks the "I Am Safe" cancel button. */
  onCancel: () => void;
}

/**
 * Full-screen emergency alert overlay with countdown timer.
 *
 * Visible when agentState is 'IMPACT_DETECTED' or 'SCENE_ANALYSIS'.
 * In Active Mode, shows all UI elements and requires user interaction to cancel.
 * In Silent Mode, shows a minimal "silent monitoring" indicator instead.
 *
 * @param props - Component props
 * @param props.onCancel - Invoked when the user confirms they are safe
 *
 * @example
 * ```tsx
 * <AlertCountdown onCancel={handleCancelAll} />
 * ```
 */
export const AlertCountdown: React.FC<AlertCountdownProps> = ({ onCancel }) => {
  const { agentState, countdownSeconds, activeAnalysisResult, confidenceScore, appMode } =
    useAgentStore();

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);

  const isActive = agentState === 'IMPACT_DETECTED' || agentState === 'SCENE_ANALYSIS';
  const isSilentMode = appMode === 'SILENT';

  // ── Web Audio Siren (Active Mode only) ─────────────────────────────────────

  /**
   * Synthesizes a repeating siren pulse using the Web Audio API.
   * Only active in ACTIVE mode — silenced in SILENT mode.
   * Uses sawtooth oscillator with frequency ramp for alert sound.
   */
  useEffect(() => {
    if (isActive && !isSilentMode) {
      const AudioCtxClass =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtxClass) {
        audioCtxRef.current = new AudioCtxClass();

        sirenIntervalRef.current = window.setInterval(() => {
          if (!audioCtxRef.current) return;
          try {
            const osc = audioCtxRef.current.createOscillator();
            const gainNode = audioCtxRef.current.createGain();
            osc.connect(gainNode);
            gainNode.connect(audioCtxRef.current.destination);

            const now = audioCtxRef.current.currentTime;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1000, now + 0.4);
            gainNode.gain.setValueAtTime(0.12, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            osc.start(now);
            osc.stop(now + 0.5);
          } catch (_e) {
            // Audio synthesis may fail on devices without speaker access — safe to ignore
          }
        }, 600);
      }
    } else {
      if (sirenIntervalRef.current !== null) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        void audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    }

    return () => {
      if (sirenIntervalRef.current !== null) clearInterval(sirenIntervalRef.current);
      if (audioCtxRef.current) void audioCtxRef.current.close();
    };
  }, [isActive, isSilentMode]);

  if (!isActive) return null;

  // In Silent Mode — render minimal non-intrusive indicator
  if (isSilentMode) {
    return (
      <div
        id="silent-mode-indicator"
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          background: 'rgba(245, 158, 11, 0.15)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '12px',
          padding: '0.75rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          fontSize: '0.85rem',
          color: '#fbbf24',
        }}
      >
        <VolumeX style={{ width: '1rem', height: '1rem' }} />
        <span>
          Silent Mode — auto-dispatching in <strong>{countdownSeconds}s</strong>
        </span>
      </div>
    );
  }

  // ── SVG Ring Progress ──────────────────────────────────────────────────────
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (countdownSeconds / COUNTDOWN_DURATION_SEC) * circumference;
  const urgencyColor =
    countdownSeconds <= 10 ? '#ef4444' : countdownSeconds <= 20 ? '#f59e0b' : '#10b981';

  return (
    <div className="alert-overlay" id="emergency-alert-overlay">
      <div className="alert-box">
        {/* Alert Icon */}
        <div className="alert-icon-pulse">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
        </div>

        {/* Title */}
        <h1 className="alert-title">
          {activeAnalysisResult ? '🚨 EMERGENCY DETECTED' : 'POTENTIAL ACCIDENT DETECTED'}
        </h1>

        {/* Subtitle / State Description */}
        <p className="alert-subtitle">
          {agentState === 'SCENE_ANALYSIS'
            ? '🤖 ResQ AI is capturing & analyzing the scene...'
            : activeAnalysisResult
            ? `AI confirmed emergency — contacting contacts in ${countdownSeconds}s`
            : 'Sustained G-force detected. Initiating emergency procedures.'}
        </p>

        {/* Confidence Score Badge */}
        {confidenceScore && (
          <div
            style={{
              background: 'rgba(167, 139, 250, 0.1)',
              border: '1px solid rgba(167, 139, 250, 0.3)',
              borderRadius: '8px',
              padding: '6px 14px',
              fontSize: '0.78rem',
              color: '#c4b5fd',
              marginBottom: '12px',
              textAlign: 'center',
            }}
          >
            🔀 Fused Confidence: <strong>{confidenceScore.finalScore.toFixed(1)}/10</strong>
            {' '}(Accel: {confidenceScore.accelScore.toFixed(1)} × {confidenceScore.accelWeight} +
            Vision: {confidenceScore.visionScore.toFixed(1)} × {confidenceScore.visionWeight})
          </div>
        )}

        {/* AI Assessment Summary */}
        {activeAnalysisResult && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '0.8rem',
              color: '#fca5a5',
              marginBottom: '12px',
              textAlign: 'left',
              lineHeight: 1.5,
            }}
          >
            <strong>AI Assessment:</strong> Status={activeAnalysisResult.personStatus.replace(/_/g, ' ')},
            Injury={activeAnalysisResult.injuryLikelihood}, Score={activeAnalysisResult.emergencyScore}/10
          </div>
        )}

        {/* Countdown Ring */}
        <div className="timer-wrapper">
          <svg className="timer-svg" width="140" height="140" aria-label={`${countdownSeconds} seconds remaining`}>
            <circle className="timer-circle-bg" cx="70" cy="70" r={radius} />
            <circle
              className="timer-circle-progress"
              cx="70"
              cy="70"
              r={radius}
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              stroke={urgencyColor}
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.5s ease' }}
            />
          </svg>
          <div className="timer-text" style={{ color: urgencyColor }}>
            {countdownSeconds}s
          </div>
        </div>

        <p className="alert-instructions">
          If you are safe, tap the button below <strong>immediately</strong> to cancel this alert.
        </p>

        {/* Cancel Button */}
        <button
          id="btn-cancel-alert"
          onClick={onCancel}
          className="btn-cancel-alert flex-align justify-center"
          aria-label="Cancel emergency alert - I am safe"
        >
          <X className="w-6 h-6" />
          <span>I AM SAFE — CANCEL ALERT</span>
        </button>
      </div>
    </div>
  );
};

export default AlertCountdown;
