/**
 * @file src/hooks/useGPS.ts
 * @description React hook for native GPS location tracking via Capacitor Geolocation.
 *
 * Replaces Navigator Geolocation with the Capacitor Geolocation plugin.
 * Keeps the identical startTracking/stopTracking interface contract.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { useAgentStore } from '../store/agentStore';
import {
  DEMO_GPS_LATITUDE,
  DEMO_GPS_LONGITUDE,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('GPS');

/**
 * Manages native GPS tracking for ResQ location-based emergency dispatch.
 */
export const useGPS = () => {
  const { setCoordinates, addLog } = useAgentStore();
  const [gpsPermission, setGpsPermission] = useState<boolean | null>(null);
  
  /** Stores the watchPosition callback ID for cleanup. */
  const watchId = useRef<string | null>(null);

  /**
   * Begins native GPS tracking.
   */
  const startTracking = useCallback(async () => {
    try {
      const permission = await Geolocation.requestPermissions();
      if (permission.coarseLocation !== 'granted' && permission.location !== 'granted') {
        addLog('WARNING', '🗺️ Native GPS permission denied. Using fallback coordinates.');
        setGpsPermission(false);
        setCoordinates({
          latitude: DEMO_GPS_LATITUDE,
          longitude: DEMO_GPS_LONGITUDE,
          accuracy: 50,
          timestamp: Date.now(),
        });
        return;
      }

      setGpsPermission(true);
      addLog('INFO', '🗺️ Initializing native GPS tracking...');

      // Immediate position fix
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
      });

      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
      });

      // Continuous native watch
      watchId.current = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
        },
        (pos, err) => {
          if (err) {
            log.warn('Native geolocation watch error:', err);
            return;
          }
          if (pos) {
            setCoordinates({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              timestamp: pos.timestamp,
            });
          }
        }
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      addLog('WARNING', `🗺️ GPS initialization failed: ${errMsg}. Using fallback.`);
      log.error('startTracking failed', error);
      setCoordinates({
        latitude: DEMO_GPS_LATITUDE,
        longitude: DEMO_GPS_LONGITUDE,
        accuracy: 50,
        timestamp: Date.now(),
      });
    }
  }, [setCoordinates, addLog]);

  /**
   * Stops Geolocation watch.
   */
  const stopTracking = useCallback(async () => {
    if (watchId.current !== null) {
      await Geolocation.clearWatch({ id: watchId.current });
      watchId.current = null;
      addLog('INFO', '🗺️ Native GPS tracking stopped.');
    }
  }, [addLog]);

  /** Cleanup on unmount. */
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        void Geolocation.clearWatch({ id: watchId.current });
      }
    };
  }, []);

  return {
    gpsPermission,
    startTracking,
    stopTracking,
  };
};
export default useGPS;
