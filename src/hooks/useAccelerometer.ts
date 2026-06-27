/**
 * @file src/hooks/useAccelerometer.ts
 * @description React hook for DeviceMotionEvent accelerometer monitoring.
 *
 * Listens to the Web DeviceMotion API and processes raw acceleration data
 * into impact severity assessments. Key features:
 *
 * - Calculates resultant magnitude from 3-axis acceleration readings
 * - Compensates for gravity when only `accelerationIncludingGravity` is available
 * - Implements sustained-force detection with configurable duration threshold
 * - Debounces rapid re-triggers with a cooldown period
 * - Exports pure utility functions (`calculateImpactMagnitude`) for unit testing
 * - Provides iOS Safari permission request flow
 * - Includes a simulation trigger for desktop demo testing
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import {
  IMPACT_THRESHOLD_M_S2,
  IMPACT_DURATION_MS,
  DEBOUNCE_COOLDOWN_MS,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('Accelerometer');

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS (unit-testable, no side effects)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the Euclidean (resultant) magnitude of a 3-axis acceleration vector.
 *
 * This is a pure function with no side effects, suitable for unit testing.
 *
 * @param x - Acceleration on the X axis (m/s²)
 * @param y - Acceleration on the Y axis (m/s²)
 * @param z - Acceleration on the Z axis (m/s²)
 * @returns Scalar magnitude: √(x² + y² + z²)
 *
 * @example
 * calculateImpactMagnitude(0, 0, 9.8)  // → 9.8 (gravity only)
 * calculateImpactMagnitude(10, 25, 22) // → ~35.0 (high impact)
 */
export function calculateImpactMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/**
 * Compensates for Earth's gravitational acceleration when the device only
 * provides `accelerationIncludingGravity` (i.e. raw sensor without fusion).
 *
 * Subtracts the approximate gravity magnitude (9.8 m/s²) from the raw reading
 * and floors the result at 0 to avoid negative magnitudes.
 *
 * @param rawMagnitude - Uncompensated magnitude including gravity
 * @param hasLinearAcceleration - true if hardware provides gravity-compensated data
 * @returns Gravity-compensated magnitude (≥ 0)
 *
 * @example
 * compensateGravity(9.8, false)   // → 0 (phone at rest)
 * compensateGravity(40.0, false)  // → 30.2 (high impact)
 * compensateGravity(31.2, true)   // → 31.2 (already compensated)
 */
export function compensateGravity(rawMagnitude: number, hasLinearAcceleration: boolean): number {
  if (hasLinearAcceleration) return rawMagnitude;
  return Math.max(0, rawMagnitude - 9.8);
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook that initializes and manages the DeviceMotion accelerometer listener.
 *
 * @returns Object containing permission state, listening state, and control functions:
 * - `permissionGranted` — null (unknown), true (granted), or false (denied)
 * - `isListening` — whether the event listener is currently attached
 * - `requestPermission` — async function to request iOS permission and start listening
 * - `startListening` — imperatively attach the event listener
 * - `stopListening` — detach the event listener and reset readings
 * - `triggerSimulation` — inject a synthetic high-impact event for desktop demos
 *
 * @example
 * ```tsx
 * const { isListening, requestPermission, triggerSimulation } = useAccelerometer();
 * ```
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

  /**
   * Tracks the timestamp when acceleration first exceeded the impact threshold.
   * Used to enforce the sustained-force detection requirement.
   */
  const highForceStartTime = useRef<number | null>(null);

  /**
   * Timestamp of the last triggered impact event.
   * Used to enforce the debounce cooldown between successive triggers.
   */
  const lastTriggerTime = useRef<number>(0);

  /** requestAnimationFrame ID for the graph update loop. */
  const animationFrameId = useRef<number | null>(null);

  /** Shared mutable reference for the latest accelerometer reading. */
  const latestAcc = useRef({ x: 0, y: 0, z: 0, magnitude: 0 });

  // ── Graph Update Loop ──────────────────────────────────────────────────────

  /**
   * Runs a requestAnimationFrame loop to push magnitude readings into the
   * rolling history and update the current magnitude state at ~60fps.
   * Starts when listening begins and stops on cleanup.
   */
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

  // ── Event Handler ──────────────────────────────────────────────────────────

  /**
   * Processes a DeviceMotionEvent to detect high-impact events.
   *
   * Algorithm:
   * 1. Read x/y/z from `acceleration` (preferred — excludes gravity)
   *    or fall back to `accelerationIncludingGravity`
   * 2. Compute resultant magnitude and compensate for gravity if needed
   * 3. In MONITORING state, check if magnitude exceeds threshold
   * 4. If sustained for ≥ IMPACT_DURATION_MS and outside debounce window → trigger incident
   *
   * @param event - The native DeviceMotionEvent from the browser
   */
  const handleMotionEvent = useCallback(
    (event: DeviceMotionEvent) => {
      const acc = event.acceleration ?? event.accelerationIncludingGravity;
      if (!acc) return;

      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;

      const rawMagnitude = calculateImpactMagnitude(x, y, z);
      const hasLinearAcc = event.acceleration !== null && event.acceleration !== undefined;
      const magnitude = compensateGravity(rawMagnitude, hasLinearAcc);

      latestAcc.current = { x, y, z, magnitude };

      if (agentState !== 'MONITORING') return;

      const now = Date.now();

      if (magnitude >= IMPACT_THRESHOLD_M_S2) {
        if (highForceStartTime.current === null) {
          // First frame above threshold — start the sustained-force timer
          highForceStartTime.current = now;
        } else {
          const elapsed = now - highForceStartTime.current;
          const cooledDown = now - lastTriggerTime.current > DEBOUNCE_COOLDOWN_MS;

          if (elapsed >= IMPACT_DURATION_MS && cooledDown) {
            // Sustained high-force event confirmed → trigger incident
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
        // Force dropped below threshold — reset the sustained-force timer
        highForceStartTime.current = null;
      }
    },
    [agentState, addLog, startNewIncident, setAgentState]
  );

  // ── Control Functions ──────────────────────────────────────────────────────

  /**
   * Attaches the DeviceMotion event listener to the window.
   * No-ops if already listening or not in a browser environment.
   */
  const startListening = useCallback(() => {
    if (typeof window === 'undefined' || isListening) return;

    addLog('INFO', '🎯 Accelerometer listener attached. Monitoring for impacts...');
    window.addEventListener('devicemotion', handleMotionEvent);
    setIsListening(true);
  }, [isListening, handleMotionEvent, addLog]);

  /**
   * Detaches the DeviceMotion event listener and resets readings to zero.
   */
  const stopListening = useCallback(() => {
    if (typeof window === 'undefined' || !isListening) return;

    window.removeEventListener('devicemotion', handleMotionEvent);
    setIsListening(false);
    latestAcc.current = { x: 0, y: 0, z: 0, magnitude: 0 };
    setCurrentMagnitude(0);
    addLog('INFO', '⏸️ Accelerometer listener detached.');
  }, [isListening, handleMotionEvent, setCurrentMagnitude, addLog]);

  /**
   * Requests DeviceMotion permission (required on iOS Safari 13+).
   *
   * On browsers that don't require explicit permission (most Android Chrome),
   * this function immediately grants permission and starts listening.
   *
   * @returns Promise resolving to true if permission was granted
   */
  const requestPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    // iOS 13+ requires explicit permission request
    const DeviceMotionEventTyped = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };

    if (typeof DeviceMotionEventTyped.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEventTyped.requestPermission();
        const granted = response === 'granted';
        setPermissionGranted(granted);
        if (granted) {
          addLog('INFO', '✅ Motion sensor permission granted by user.');
          startListening();
        } else {
          addLog('ERROR', '❌ Motion sensor permission denied by user.');
        }
        return granted;
      } catch (err) {
        log.error('Error requesting DeviceMotion permission', err);
        addLog('ERROR', `Permission request failed: ${String(err)}`);
        setPermissionGranted(false);
        return false;
      }
    } else {
      // Non-iOS: permission not required
      setPermissionGranted(true);
      startListening();
      return true;
    }
  };

  /**
   * Injects a synthetic high-impact event for desktop demo testing.
   *
   * Briefly sets the magnitude to 35 m/s² on the graph, then resets to zero.
   * Immediately triggers the IMPACT_DETECTED state transition if monitoring is active.
   */
  const triggerSimulation = () => {
    const now = Date.now();
    addLog('WARNING', '🔔 [SIMULATION] Synthetic crash impact injected — 35 m/s²');

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

  // ── Cleanup ────────────────────────────────────────────────────────────────

  /** Remove event listener on component unmount. */
  useEffect(() => {
    return () => {
      if (isListening) {
        window.removeEventListener('devicemotion', handleMotionEvent);
      }
    };
  }, [isListening, handleMotionEvent]);

  return {
    permissionGranted,
    isListening,
    requestPermission,
    startListening,
    stopListening,
    triggerSimulation,
  };
};
