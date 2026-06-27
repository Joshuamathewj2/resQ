import { useState, useCallback, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';

export const useCamera = () => {
  const { addLog } = useAgentStore();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Starts the camera stream (rear camera preferred)
  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      addLog('ERROR', 'MediaDevices API not supported on this browser.');
      return null;
    }

    try {
      // Clean up existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Try to get back camera
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false // No audio needed
      });

      setStream(mediaStream);
      setCameraPermission(true);
      addLog('INFO', 'Camera stream activated successfully.');
      return mediaStream;
    } catch (error) {
      addLog('ERROR', `Failed to open camera: ${error}`);
      setCameraPermission(false);
      return null;
    }
  }, [stream, addLog]);

  // Stops the camera stream tracks
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        addLog('INFO', `Camera track [${track.label}] stopped.`);
      });
      setStream(null);
    }
  }, [stream, addLog]);

  // Captures current frame from the stream and converts to JPEG Base64
  const captureFrame = useCallback(async (activeStream?: MediaStream): Promise<string | null> => {
    const currentStream = activeStream || stream;
    if (!currentStream) {
      addLog('ERROR', 'Cannot capture frame: Camera stream is not active.');
      return null;
    }

    return new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.srcObject = currentStream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        
        video.onloadedmetadata = () => {
          video.play().then(() => {
            // Give the video a moment to buffer frames
            setTimeout(() => {
              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth || 640;
              canvas.height = video.videoHeight || 480;
              
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Convert to base64 jpeg
                const base64Image = canvas.toDataURL('image/jpeg', 0.85);
                // Extract just the raw base64 data portion
                const rawBase64 = base64Image.split(',')[1];
                addLog('INFO', 'Camera frame snapshot captured successfully.');
                
                // Clean up video element
                video.pause();
                video.srcObject = null;
                
                resolve(rawBase64);
              } else {
                addLog('ERROR', 'Failed to get 2D context for canvas render.');
                resolve(null);
              }
            }, 500); // 500ms delay to let camera adjust auto-exposure
          }).catch(err => {
            addLog('ERROR', `Video play failed during frame capture: ${err}`);
            resolve(null);
          });
        };
      } catch (err) {
        addLog('ERROR', `Exception during camera capture: ${err}`);
        resolve(null);
      }
    });
  }, [stream, addLog]);

  return {
    stream,
    cameraPermission,
    videoRef,
    startCamera,
    stopCamera,
    captureFrame
  };
};
