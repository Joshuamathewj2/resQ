/**
 * @file src/hooks/useGPS.ts
 * @description React hook for real-time GPS location tracking via the Geolocation API.
 *
 * Provides continuous location monitoring using `watchPosition` for real-time
 * updates during monitoring. GPS coordinates are stored in the Zustand store
 * and formatted into Google Maps links for emergency alerts.
 *
 * Falls back to a hardcoded demo location (Chennai, India) if:
 * - The browser does not support the Geolocation API
 * - The user denies location permission
 * - Location acquisition times out
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import {
  DEMO_GPS_LATITUDE,
  DEMO_GPS_LONGITUDE,
  GPS_HIGH_ACCURACY,
  GPS_TIMEOUT_MS,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('GPS');

/**
 * Manages real-time GPS tracking for ResQ location-based emergency dispatch.
 *
 * @returns Object containing:
 * - `gpsPermission` — null (not requested), true (granted), false (denied)
 * - `startTracking` — Begins GPS watch and immediate position fix
 * - `stopTracking` — Clears the GPS watch subscription
 *
 * @example
 * ```tsx
 * const { gpsPermission, startTracking, stopTracking } = useGPS();
 * useEffect(() => { startTracking(); return stopTracking; }, []);
 * ```
 */
export const useGPS = () => {
  const { setCoordinates, addLog } = useAgentStore();
  const [gpsPermission, setGpsPermission] = useState<boolean | null>(null);
  /** Stores the watchPosition subscription ID for cleanup. */
  const watchId = useRef<number | null>(null);

  /**
   * Begins GPS tracking with a `watchPosition` subscription.
   *
   * Also fires `getCurrentPosition` once immediately to get a fast initial fix,
   * in case `watchPosition` takes time to stabilize.
   *
   * GPS options:
   * - `enableHighAccuracy: true` — requests GNSS (hardware GPS) over cell tower
   * - `timeout: 10000ms` — gives up if no fix within 10 seconds
   * - `maximumAge: 0` — always returns fresh coordinates (never cached)
   */
  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      addLog('WARNING', '🗺️ Geolocation API not supported. Using demo coordinates.');
      log.warn('navigator.geolocation unavailable — using fallback location');
      setGpsPermission(false);
      setCoordinates({
        latitude: DEMO_GPS_LATITUDE,
        longitude: DEMO_GPS_LONGITUDE,
        accuracy: 10,
        timestamp: Date.now(),
      });
      return;
    }

    // Clear any existing watch before starting a new one
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    addLog('INFO', '🗺️ Initializing GPS real-time tracking...');

    const geoOptions: PositionOptions = {
      enableHighAccuracy: GPS_HIGH_ACCURACY,
      timeout: GPS_TIMEOUT_MS,
      maximumAge: 0,
    };

    const onSuccess = (position: GeolocationPosition) => {
      setGpsPermission(true);
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });
    };

    const onError = (error: GeolocationPositionError) => {
      const errorMessages: Record<number, string> = {
        1: 'Permission denied by user',
        2: 'Position unavailable (no GPS signal)',
        3: 'Timeout — location fix took too long',
      };
      const message = errorMessages[error.code] ?? error.message;
      addLog('WARNING', `🗺️ GPS error: ${message}. Using demo coordinates.`);
      log.warn(`Geolocation error (code ${error.code}): ${message}`);

      if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
        setGpsPermission(false);
      }

      setCoordinates({
        latitude: DEMO_GPS_LATITUDE,
        longitude: DEMO_GPS_LONGITUDE,
        accuracy: 50,
        timestamp: Date.now(),
      });
    };

    // Immediate single fix
    navigator.geolocation.getCurrentPosition(onSuccess, onError, geoOptions);

    // Continuous watch
    watchId.current = navigator.geolocation.watchPosition(onSuccess, onError, geoOptions);
  }, [setCoordinates, addLog]);

  /**
   * Clears the GPS watchPosition subscription and logs the stop event.
   */
  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      addLog('INFO', '🗺️ GPS tracking stopped.');
    }
  }, [addLog]);

  /** Cleanup on component unmount. */
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  return {
    gpsPermission,
    startTracking,
    stopTracking,
  };
};
