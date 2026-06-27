import React, { useEffect, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import { ShieldAlert, X } from 'lucide-react';

interface AlertCountdownProps {
  onCancel: () => void;
}

export const AlertCountdown: React.FC<AlertCountdownProps> = ({ onCancel }) => {
  const { agentState, countdownSeconds, activeAnalysisResult } = useAgentStore();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenIntervalRef = useRef<number | null>(null);

  const isActive = agentState === 'IMPACT_DETECTED' || agentState === 'SCENE_ANALYSIS';

  // Dynamic Audio Siren synthesis using Web Audio API
  useEffect(() => {
    if (isActive) {
      // Initialize Audio Context on user interaction/activation
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
        
        // Loop siren sound
        sirenIntervalRef.current = window.setInterval(() => {
          if (!audioCtxRef.current) return;
          
          try {
            const osc = audioCtxRef.current.createOscillator();
            const gainNode = audioCtxRef.current.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(audioCtxRef.current.destination);
            
            // Alternating police/siren frequency pitch
            const now = audioCtxRef.current.currentTime;
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.linearRampToValueAtTime(1000, now + 0.4);
            
            // Fade out quickly to avoid clipping clicks
            gainNode.gain.setValueAtTime(0.12, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
            
            osc.start(now);
            osc.stop(now + 0.5);
          } catch (e) {
            console.error('Audio synthesis failed:', e);
          }
        }, 600);
      }
    } else {
      // Clean up audio context
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
        sirenIntervalRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    }

    return () => {
      if (sirenIntervalRef.current) {
        clearInterval(sirenIntervalRef.current);
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  // Calculate visual ring stroke offset percentage
  const circumference = 2 * Math.PI * 60; // radius = 60
  const progressOffset = circumference - (countdownSeconds / 30) * circumference;

  return (
    <div className="alert-overlay">
      <div className="alert-box">
        <div className="alert-icon-pulse">
          <ShieldAlert className="w-12 h-12 text-rose-500" />
        </div>

        <h1 className="alert-title">
          {activeAnalysisResult ? "🚨 EMERGENCY DETECTED" : "POTENTIAL ACCIDENT DETECTED"}
        </h1>
        
        <p className="alert-subtitle">
          {agentState === 'SCENE_ANALYSIS' 
            ? '🤖 ResQ AI is capturing camera footage & analyzing scene...' 
            : activeAnalysisResult 
              ? `Contacting emergency contacts in ${countdownSeconds}s`
              : 'Sustained G-force detected. Initiating emergency procedures.'}
        </p>

        {/* Countdown Ring */}
        <div className="timer-wrapper">
          <svg className="timer-svg" width="140" height="140">
            <circle 
              className="timer-circle-bg" 
              cx="70" 
              cy="70" 
              r="60" 
            />
            <circle 
              className="timer-circle-progress" 
              cx="70" 
              cy="70" 
              r="60" 
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
            />
          </svg>
          <div className="timer-text">{countdownSeconds}s</div>
        </div>

        <p className="alert-instructions">
          If you are safe, click the cancel button below immediately to dismiss this emergency alert.
        </p>

        <button onClick={onCancel} className="btn-cancel-alert flex-align justify-center">
          <X className="w-6 h-6" />
          <span>I AM SAFE - CANCEL ALERT</span>
        </button>
      </div>
    </div>
  );
};
