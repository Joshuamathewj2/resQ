/**
 * @file src/components/PermissionSetup.tsx
 * @description Native permission verification panel for ResQ.
 *
 * Explains and requests native permissions (Sensors, Camera, GPS Location, Notifications)
 * in sequence using Capacitor APIs. Visualizes permission state with colored indicators
 * and grants access to the dashboard once completed.
 */

import React, { useEffect, useState } from 'react';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import { ShieldCheck, Camera as CameraIcon, Compass, Bell, AlertTriangle } from 'lucide-react';

interface PermissionSetupProps {
  /** Callback fired once all necessary permissions are granted. */
  onComplete: () => void;
}

/**
 * Screen showing native permission requests in sequence with premium glassmorphism styling.
 */
export const PermissionSetup: React.FC<PermissionSetupProps> = ({ onComplete }) => {
  const [motionStatus, setMotionStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [cameraStatus, setCameraStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [gpsStatus, setGpsStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [notificationStatus, setNotificationStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const checkInitialPermissions = async () => {
    try {
      // Geolocation check
      const gpsState = await Geolocation.checkPermissions();
      if (gpsState.location === 'granted') setGpsStatus('granted');

      // Camera check
      const cameraState = await Camera.checkPermissions();
      if (cameraState.camera === 'granted') setCameraStatus('granted');

      // Notification check
      const notifState = await LocalNotifications.checkPermissions();
      if (notifState.display === 'granted') setNotificationStatus('granted');

      // Check if all are already granted
      if (
        gpsState.location === 'granted' &&
        cameraState.camera === 'granted' &&
        notifState.display === 'granted'
      ) {
        setMotionStatus('granted');
        onComplete();
      }
    } catch (_err) {
      // Ignored during initial load (e.g. running on web)
    }
  };

  useEffect(() => {
    void checkInitialPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestMotion = () => {
    // Android does not have runtime permission request for accelerometer.
    // It is granted implicitly.
    setMotionStatus('granted');
  };

  const requestCamera = async () => {
    try {
      const res = await Camera.requestPermissions();
      if (res.camera === 'granted') {
        setCameraStatus('granted');
      } else {
        setCameraStatus('denied');
      }
    } catch (e) {
      setErrorMsg(`Camera error: ${String(e)}`);
    }
  };

  const requestGPS = async () => {
    try {
      const res = await Geolocation.requestPermissions();
      if (res.location === 'granted') {
        setGpsStatus('granted');
      } else {
        setGpsStatus('denied');
      }
    } catch (e) {
      setErrorMsg(`GPS error: ${String(e)}`);
    }
  };

  const requestNotifications = async () => {
    try {
      const res = await LocalNotifications.requestPermissions();
      if (res.display === 'granted') {
        setNotificationStatus('granted');
      } else {
        setNotificationStatus('denied');
      }
    } catch (e) {
      setErrorMsg(`Notification error: ${String(e)}`);
    }
  };

  const allGranted =
    motionStatus === 'granted' &&
    cameraStatus === 'granted' &&
    gpsStatus === 'granted' &&
    notificationStatus === 'granted';

  const handleFinish = () => {
    if (allGranted) {
      localStorage.setItem('resq_permissions_configured', 'true');
      onComplete();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#f1f5f9',
        padding: '2rem',
        fontFamily: 'Outfit, sans-serif',
      }}
    >
      <div
        style={{
          background: 'rgba(30, 30, 40, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '2.5rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>🛡️</span>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '1rem', color: '#fff' }}>
            System Setup
          </h1>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            ResQ requires the following native phone hardware permissions to operate autonomously.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '0.75rem',
              fontSize: '0.8rem',
              color: '#fca5a5',
              marginBottom: '1.5rem',
            }}
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
          {/* Motion Sensors */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Compass className="w-5 h-5 text-indigo-400" />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Accelerometer & Sensors</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>For native G-force impact detection</p>
              </div>
            </div>
            {motionStatus === 'granted' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <button
                onClick={() => void requestMotion()}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid #6366f1',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Grant
              </button>
            )}
          </div>

          {/* GPS Location */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Compass className="w-5 h-5 text-sky-400" />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>GPS Location</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>To route rescuers to the accident scene</p>
              </div>
            </div>
            {gpsStatus === 'granted' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <button
                onClick={() => void requestGPS()}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'rgba(14, 165, 233, 0.2)',
                  border: '1px solid #0ea5e9',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Grant
              </button>
            )}
          </div>

          {/* Camera Access */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <CameraIcon className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Rear Camera</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>For Gemini AI visual accident assessment</p>
              </div>
            </div>
            {cameraStatus === 'granted' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <button
                onClick={() => void requestCamera()}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid #10b981',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Grant
              </button>
            )}
          </div>

          {/* Local Notifications */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Bell className="w-5 h-5 text-amber-400" />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>System Notifications</h3>
                <p style={{ fontSize: '0.75rem', color: '#64748b' }}>For background alerts & countdown status</p>
              </div>
            </div>
            {notificationStatus === 'granted' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            ) : (
              <button
                onClick={() => void requestNotifications()}
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid #f59e0b',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Grant
              </button>
            )}
          </div>
        </div>

        <button
          onClick={handleFinish}
          disabled={!allGranted}
          style={{
            width: '100%',
            background: allGranted ? '#ef4444' : '#1e293b',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            padding: '1rem',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: allGranted ? 'pointer' : 'not-allowed',
            transition: 'background 0.3s ease',
          }}
        >
          {allGranted ? 'Start ResQ Monitoring' : 'Grant All Permissions to Proceed'}
        </button>
      </div>
    </div>
  );
};
export default PermissionSetup;
