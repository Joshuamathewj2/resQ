import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';

export const useGPS = () => {
  const { setCoordinates, addLog } = useAgentStore();
  const [gpsPermission, setGpsPermission] = useState<boolean | null>(null);
  const watchId = useRef<number | null>(null);

  const startTracking = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      addLog('ERROR', 'Geolocation API is not supported by this browser.');
      setGpsPermission(false);
      // Fallback location for demo purposes
      setCoordinates({
        latitude: 12.9716,
        longitude: 80.2209,
        accuracy: 10,
        timestamp: Date.now()
      });
      return;
    }

    // Clean up previous watch if existing
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    addLog('INFO', 'Initializing real-time GPS tracking watch...');

    // Get current position once immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsPermission(true);
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
      },
      (error) => {
        addLog('WARNING', `Could not get current GPS coordinates: ${error.message}. Using demo location (12.9716° N, 80.2209° E).`);
        setCoordinates({
          latitude: 12.9716,
          longitude: 80.2209,
          accuracy: 10,
          timestamp: Date.now()
        });
      }
    );

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setGpsPermission(true);
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        setCoordinates(coords);
      },
      (error) => {
        addLog('ERROR', `GPS tracking error: ${error.message} (code ${error.code})`);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsPermission(false);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [setCoordinates, addLog]);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      addLog('INFO', 'Real-time GPS tracking watch stopped.');
    }
  }, [addLog]);

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
    stopTracking
  };
};
