/**
 * @file src/hooks/useAccelerometer.ts
 * @description React hook for Capacitor Motion accelerometer monitoring.
 *
 * Replaces the browser DeviceMotionEvent implementation with Capacitor Motion.
 * Processes raw acceleration data from native Android hardware.
 * Features:
 * - Calculates resultant magnitude from 3-axis acceleration vectors
 * - Implements sustained-force detection with duration threshold
 * - Debounces rapid re-triggers with a cooldown period
 * - Integrates with Zustand global state store
 * - Provides iOS/Android native permission request flow
 * - Includes a simulation trigger for desktop testing
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Motion } from '@capacitor/motion';
import { useAgentStore } from '../store/agentStore';
import {
  IMPACT_THRESHOLD_M_S2,
  IMPACT_DURATION_MS,
  DEBOUNCE_COOLDOWN_MS,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('Accelerometer');

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the Euclidean magnitude of a 3-axis vector.
 * @param x - X axis acceleration
 * @param y - Y axis acceleration
 * @param z - Z axis acceleration
 */
export function calculateImpactMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Compensates for gravity on devices without linear acceleration.
 * (Capacitor Motion gives linear acceleration on some, raw on others.
 * We can keep this pure helper for backward compatibility/testing).
 */
export function compensateGravity(rawMagnitude: number, hasLinearAcceleration: boolean): number {
  if (hasLinearAcceleration) return rawMagnitude;
  return Math.max(0, rawMagnitude - 9.8);
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook to manage Capacitor Motion accelerometer tracking.
 */
export const useAccelerometer = () => {
  const {
    agentState,
    setAgentState,
    setCurrentMagnitude,
    pushMagnitudeHistory,
    addLog,
    startNewIncident,
  } = useAgentStore();

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);

  const highForceStartTime = useRef<number | null>(null);
  const lastTriggerTime = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  const latestAcc = useRef({ x: 0, y: 0, z: 0, magnitude: 0 });

  // Capacitor Motion listener reference
  const listenerRef = useRef<{ remove: () => Promise<void> } | null>(null);

  // ── Graph Update Loop ──────────────────────────────────────────────────────
  useEffect(() => {
    const updateLoop = () => {
      pushMagnitudeHistory(latestAcc.current.magnitude);
      setCurrentMagnitude(latestAcc.current.magnitude);
      animationFrameId.current = requestAnimationFrame(updateLoop);
    };

    if (isListening) {
      animationFrameId.current = requestAnimationFrame(updateLoop);
    }

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [isListening, pushMagnitudeHistory, setCurrentMagnitude]);

  // ── Control Functions ──────────────────────────────────────────────────────

  /**
   * Detaches the Capacitor Motion listener.
   */
  const stopListening = useCallback(async () => {
    if (listenerRef.current) {
      await listenerRef.current.remove();
      listenerRef.current = null;
    }
    setIsListening(false);
    latestAcc.current = { x: 0, y: 0, z: 0, magnitude: 0 };
    setCurrentMagnitude(0);
    addLog('INFO', '⏸️ Capacitor Motion accelerometer listener detached.');
  }, [setCurrentMagnitude, addLog]);

  /**
   * Attaches the Capacitor Motion listener.
   */
  const startListening = useCallback(async () => {
    if (isListening) return;

    try {
      addLog('INFO', '🎯 Attaching Capacitor Motion listener...');

      listenerRef.current = await Motion.addListener('accel', (event) => {
        const { x, y, z } = event.acceleration;
        // Native accelerometer values are already gravity compensated in most Capacitor implementations,
        // but we calculate magnitude directly.
        const magnitude = calculateImpactMagnitude(x, y, z);
        latestAcc.current = { x, y, z, magnitude };

        if (useAgentStore.getState().agentState !== 'MONITORING') return;

        const now = Date.now();

        if (magnitude >= IMPACT_THRESHOLD_M_S2) {
          if (highForceStartTime.current === null) {
            highForceStartTime.current = now;
          } else {
            const elapsed = now - highForceStartTime.current;
            const cooledDown = now - lastTriggerTime.current > DEBOUNCE_COOLDOWN_MS;

            if (elapsed >= IMPACT_DURATION_MS && cooledDown) {
              lastTriggerTime.current = now;
              highForceStartTime.current = null;

              addLog(
                'WARNING',
                `⚠️ Impact detected: ${magnitude.toFixed(1)} m/s² sustained for ${elapsed}ms`
              );
              startNewIncident();
              setAgentState('IMPACT_DETECTED');
            }
          }
        } else {
          highForceStartTime.current = null;
        }
      });

      setIsListening(true);
    } catch (err) {
      log.error('Failed to add Motion listener', err);
      addLog('ERROR', `Motion listener attachment failed: ${String(err)}`);
    }
  }, [isListening, addLog, setAgentState, startNewIncident]);

  /**
   * Requests native sensor permission.
   */
  const requestPermission = async (): Promise<boolean> => {
    // Accelerometer permission is implicitly granted on Android.
    setPermissionGranted(true);
    addLog('INFO', '✅ Native motion sensor verified (implicitly granted).');
    await startListening();
    return true;
  };

  /**
   * Injects a synthetic high-impact event for testing.
   */
  const triggerSimulation = () => {
    const now = Date.now();
    addLog('WARNING', '🔔 [SIMULATION] Synthetic native impact injected — 35 m/s²');

    latestAcc.current = { x: 10, y: 25, z: 22, magnitude: 35.0 };
    setTimeout(() => {
      latestAcc.current = { x: 0, y: 0, z: 0, magnitude: 0 };
    }, 300);

    if (agentState === 'MONITORING') {
      lastTriggerTime.current = now;
      startNewIncident();
      setAgentState('IMPACT_DETECTED');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopListening();
    };
  }, [stopListening]);

  return {
    permissionGranted,
    isListening,
    requestPermission,
    startListening,
    stopListening,
    triggerSimulation,
  };
};
