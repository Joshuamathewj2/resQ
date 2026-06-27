import { useEffect, useRef, useState, useCallback } from 'react';
import { useAgentStore } from '../store/agentStore';
import { CONFIG } from '../config/constants';

export const useAccelerometer = () => {
  const { 
    agentState, 
    setAgentState, 
    setCurrentMagnitude, 
    pushMagnitudeHistory, 
    addLog,
    startNewIncident
  } = useAgentStore();

  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isListening, setIsListening] = useState(false);
  
  const highForceStartTime = useRef<number | null>(null);
  const lastTriggerTime = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  
  // Track current acceleration values for graph rendering
  const latestAcc = useRef({ x: 0, y: 0, z: 0, magnitude: 0 });

  // Update history via requestAnimationFrame for smooth UI rendering (60fps)
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
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isListening, pushMagnitudeHistory, setCurrentMagnitude]);

  const handleMotionEvent = useCallback((event: DeviceMotionEvent) => {
    // Prefer raw acceleration (excluding gravity). Fallback to including gravity if null
    const acc = event.acceleration || event.accelerationIncludingGravity;
    if (!acc) return;

    const x = acc.x || 0;
    const y = acc.y || 0;
    const z = acc.z || 0;

    // Calculate magnitude
    let magnitude = Math.sqrt(x * x + y * y + z * z);

    // If using accelerationIncludingGravity, subtract approx earth gravity (9.8 m/s²) if no actual movement
    if (event.accelerationIncludingGravity && !event.acceleration) {
      magnitude = Math.max(0, magnitude - 9.8);
    }

    latestAcc.current = { x, y, z, magnitude };

    // Impact Detection Logic
    if (agentState === 'MONITORING') {
      const now = Date.now();
      
      // Threshold check
      if (magnitude >= CONFIG.IMPACT_THRESHOLD_M_S2) {
        if (highForceStartTime.current === null) {
          highForceStartTime.current = now;
        } else {
          const elapsed = now - highForceStartTime.current;
          // Check if force is sustained for > 200ms
          if (elapsed >= CONFIG.IMPACT_DURATION_MS && (now - lastTriggerTime.current > CONFIG.DEBOUNCE_COOLDOWN_MS)) {
            lastTriggerTime.current = now;
            highForceStartTime.current = null;
            
            addLog('WARNING', `⚠️ High force detected: ${magnitude.toFixed(1)} m/s² sustained for ${elapsed}ms`);
            startNewIncident();
            setAgentState('IMPACT_DETECTED');
          }
        }
      } else {
        // Reset sustained timer if force drops below threshold
        highForceStartTime.current = null;
      }
    }
  }, [agentState, addLog, startNewIncident, setAgentState]);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    if (isListening) return;

    addLog('INFO', 'Initializing accelerometer listener...');
    window.addEventListener('devicemotion', handleMotionEvent);
    setIsListening(true);
  }, [isListening, handleMotionEvent, addLog]);

  const stopListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    if (!isListening) return;

    window.removeEventListener('devicemotion', handleMotionEvent);
    setIsListening(false);
    latestAcc.current = { x: 0, y: 0, z: 0, magnitude: 0 };
    setCurrentMagnitude(0);
    addLog('INFO', 'Stopped accelerometer listener.');
  }, [isListening, handleMotionEvent, setCurrentMagnitude, addLog]);

  // Request Permission (primarily for iOS / Safari)
  const requestPermission = async () => {
    if (typeof window === 'undefined') return false;

    // Check if the permission API exists (Safari iOS 13+)
    const DeviceMotionEventWithPermission = DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<PermissionState>;
    };

    if (typeof DeviceMotionEventWithPermission.requestPermission === 'function') {
      try {
        const response = await DeviceMotionEventWithPermission.requestPermission();
        const granted = response === 'granted';
        setPermissionGranted(granted);
        if (granted) {
          addLog('INFO', 'Sensor permission granted by user.');
          startListening();
        } else {
          addLog('ERROR', 'Sensor permission denied by user.');
        }
        return granted;
      } catch (err) {
        addLog('ERROR', `Error requesting sensor permissions: ${err}`);
        setPermissionGranted(false);
        return false;
      }
    } else {
      // Browsers where permission is not explicitly needed (e.g. most Android Chrome versions)
      setPermissionGranted(true);
      startListening();
      return true;
    }
  };

  // Simulate an impact event (useful for desktop demo testing)
  const triggerSimulation = () => {
    const now = Date.now();
    addLog('WARNING', '🔔 [SIMULATION] Simulating crash impact spike (35 m/s²)...');
    
    // Briefly simulate high readings on the graph
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
    triggerSimulation
  };
};
