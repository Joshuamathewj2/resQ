/**
 * @file src/hooks/useCamera.ts
 * @description React hook for camera stream management and frame capture.
 *
 * Wraps the MediaDevices API to provide:
 * - Camera stream activation (prefers rear/environment-facing camera)
 * - JPEG frame capture at configurable quality
 * - Proper stream cleanup to prevent resource leaks
 * - Permission state tracking
 *
 * The captured base64 image data is sent to Gemini Vision for scene analysis.
 */

import { useState, useCallback, useRef } from 'react';
import { useAgentStore } from '../store/agentStore';
import {
  CAMERA_WIDTH_PX,
  CAMERA_HEIGHT_PX,
  CAMERA_JPEG_QUALITY,
  CAMERA_CAPTURE_DELAY_MS,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('Camera');

/**
 * Manages camera stream lifecycle and frame capture for ResQ scene analysis.
 *
 * @returns Object containing:
 * - `stream` — Active MediaStream or null
 * - `cameraPermission` — null (unknown), true (granted), false (denied)
 * - `videoRef` — React ref for attaching to a `<video>` element if needed
 * - `startCamera` — Async function to activate the camera stream
 * - `stopCamera` — Function to stop all active camera tracks
 * - `captureFrame` — Async function to capture a JPEG base64 frame
 *
 * @example
 * ```tsx
 * const { startCamera, stopCamera, captureFrame } = useCamera();
 * const stream = await startCamera();
 * const base64 = await captureFrame(stream);
 * stopCamera();
 * ```
 */
export const useCamera = () => {
  const { addLog } = useAgentStore();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  /**
   * Activates the device camera, preferring the rear-facing (environment) camera.
   *
   * If a stream is already active, it is stopped before opening a new one
   * to prevent resource leaks. Falls back gracefully if the preferred camera
   * is unavailable (e.g., desktop webcam).
   *
   * @returns Active MediaStream on success, or null if the camera cannot be opened
   */
  const startCamera = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      addLog('ERROR', '📷 MediaDevices API not supported on this browser/device.');
      return null;
    }

    try {
      // Stop any existing stream before opening a new one
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear camera
          width: { ideal: CAMERA_WIDTH_PX },
          height: { ideal: CAMERA_HEIGHT_PX },
        },
        audio: false,
      });

      setStream(mediaStream);
      setCameraPermission(true);
      addLog('INFO', '📷 Camera stream activated successfully.');
      return mediaStream;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      addLog('ERROR', `📷 Camera activation failed: ${errMsg}`);
      log.error('getUserMedia failed', error);
      setCameraPermission(false);
      return null;
    }
  }, [stream, addLog]);

  /**
   * Stops all active camera tracks and clears the stream from state.
   * Should be called after frame capture to release the camera hardware.
   */
  const stopCamera = useCallback(() => {
    if (!stream) return;

    stream.getTracks().forEach(track => {
      track.stop();
      log.debug(`Camera track stopped: ${track.label}`);
    });
    setStream(null);
  }, [stream]);

  /**
   * Captures a single JPEG frame from the given (or stored) camera stream.
   *
   * Process:
   * 1. Creates an off-screen `<video>` element and attaches the stream
   * 2. Waits for metadata to load, then plays the video
   * 3. After CAMERA_CAPTURE_DELAY_MS (500ms), draws the frame to a canvas
   * 4. Exports the canvas as a base64-encoded JPEG string
   * 5. Cleans up the video element
   *
   * The base64 data returned is the raw encoded portion (without the `data:image/jpeg;base64,` prefix)
   * and can be sent directly to the Gemini Vision API `inlineData.data` field.
   *
   * @param activeStream - Optional stream override; uses stored stream if not provided
   * @returns Raw base64 JPEG string, or null if capture fails
   */
  const captureFrame = useCallback(
    async (activeStream?: MediaStream): Promise<string | null> => {
      const currentStream = activeStream ?? stream;
      if (!currentStream) {
        addLog('ERROR', '📷 Cannot capture frame: no active camera stream.');
        return null;
      }

      return new Promise<string | null>(resolve => {
        try {
          const video = document.createElement('video');
          video.srcObject = currentStream;
          video.setAttribute('playsinline', 'true');
          video.muted = true;

          video.onloadedmetadata = () => {
            video.play().then(() => {
              // Allow camera to auto-adjust exposure before capturing
              setTimeout(() => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || CAMERA_WIDTH_PX;
                canvas.height = video.videoHeight || CAMERA_HEIGHT_PX;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                  addLog('ERROR', '📷 Failed to get 2D canvas context for frame capture.');
                  resolve(null);
                  return;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', CAMERA_JPEG_QUALITY);
                // Strip the data URI prefix to get raw base64
                const rawBase64 = dataUrl.split(',')[1];

                // Cleanup
                video.pause();
                video.srcObject = null;

                if (!rawBase64 || rawBase64.length < 100) {
                  addLog('ERROR', '📷 Captured image data is too short or empty.');
                  resolve(null);
                  return;
                }

                addLog('INFO', '📷 Frame captured successfully.');
                resolve(rawBase64);
              }, CAMERA_CAPTURE_DELAY_MS);
            }).catch(err => {
              const errMsg = err instanceof Error ? err.message : String(err);
              addLog('ERROR', `📷 Video play failed during capture: ${errMsg}`);
              resolve(null);
            });
          };

          video.onerror = () => {
            addLog('ERROR', '📷 Video element error during frame capture.');
            resolve(null);
          };
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          addLog('ERROR', `📷 Exception during frame capture: ${errMsg}`);
          log.error('captureFrame threw an exception', err);
          resolve(null);
        }
      });
    },
    [stream, addLog]
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
