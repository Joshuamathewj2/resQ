/**
 * @file src/hooks/useCamera.ts
 * @description React hook for Capacitor Camera stream management and frame capture.
 *
 * Replaces getUserMedia with the Capacitor Camera plugin.
 * Returns a base64 JPEG image string matching the exact interface contract
 * expected by useAgentLoop.ts and App.tsx.
 */

import { useState, useCallback, useRef } from 'react';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';
import { useAgentStore } from '../store/agentStore';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('Camera');

/**
 * Manages native camera permissions and frame capture for ResQ scene analysis.
 */
export const useCamera = () => {
  const { addLog } = useAgentStore();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Request permission and starts native camera setup.
   * Returns a dummy MediaStream to satisfy the hook signature and loop checks.
   */
  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const permission = await Camera.requestPermissions();
      if (permission.camera !== 'granted') {
        addLog('ERROR', '📷 Native camera permission denied.');
        setCameraPermission(false);
        return null;
      }

      setCameraPermission(true);
      addLog('INFO', '📷 Native camera permissions verified.');
      
      // Return a dummy MediaStream to keep compatibility with browser stream interfaces
      const dummyStream = new MediaStream();
      setStream(dummyStream);
      return dummyStream;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `📷 Native camera check failed: ${errMsg}`);
      log.error('requestPermissions failed', error);
      setCameraPermission(false);
      return null;
    }
  }, [addLog]);

  /**
   * Teardown function for stopCamera. No-op for Capacitor Camera.
   */
  const stopCamera = useCallback(() => {
    setStream(null);
    log.debug('Camera session concluded.');
  }, []);

  /**
   * Captures a single frame using the Capacitor Camera.
   * Returns the raw base64 JPEG string (without prefix).
   */
  const captureFrame = useCallback(
    async (_activeStream?: MediaStream): Promise<string | null> => {
      try {
        addLog('INFO', '📷 Triggering native camera scene capture...');

        const photo = await Camera.getPhoto({
          quality: 85,
          resultType: CameraResultType.Base64,
          source: CameraSource.Camera,
          direction: CameraDirection.Rear,
          allowEditing: false,
          saveToGallery: false,
          width: 640,
          height: 480,
        });

        if (!photo.base64String) {
          addLog('ERROR', '📷 Failed to capture base64 image from native camera.');
          return null;
        }

        addLog('INFO', '📷 Native scene capture successful.');
        return photo.base64String;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        addLog('ERROR', `📷 Native camera capture failed: ${errMsg}`);
        log.error('getPhoto threw an exception', err);
        return null;
      }
    },
    [addLog]
  );

  return {
    stream,
    cameraPermission,
    videoRef,
    startCamera,
    stopCamera,
    captureFrame,
  };
};
export default useCamera;
