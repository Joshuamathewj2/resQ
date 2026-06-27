/**
 * @file src/services/notificationService.ts
 * @description Emergency alert dispatch service for ResQ (native + web).
 *
 * Implements a hybrid notification strategy:
 * - On native platforms (Android/iOS): Uses Capacitor Haptics, Local Notifications,
 *   deep-linked SMS, and native system emergency dialer.
 * - On web platforms: Uses Twilio SMS API with browser mailto/tel fallbacks.
 */

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { EmergencyContact, GPSCoordinates, UserProfile } from '../types';
import { getGoogleMapsLink } from './locationService';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('NotificationService');

// ─────────────────────────────────────────────────────────────────────────────
// CAPACITOR NATIVE emergency helper functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Triggers native haptic vibration, then opens the system dialer with the number prefilled.
 */
export async function triggerEmergencyDialer(emergencyNumber: string): Promise<void> {
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
    const dialUrl = `tel:${emergencyNumber}`;
    window.open(dialUrl, '_system');
    log.info(`Native emergency dialer opened for: ${emergencyNumber}`);
  } catch (err) {
    log.error('Failed to trigger native emergency dialer', err);
  }
}

/**
 * Compiles and sends a native SMS deep link to the recipient.
 */
export async function sendEmergencySMS(
  contactNumber: string,
  contactName: string,
  location: { lat: number; lng: number; googleMapsLink: string },
  incidentSummary: string,
  confidenceScore: number
): Promise<void> {
  const message = encodeURIComponent(
    `🚨 EMERGENCY ALERT — ResQ\n` +
    `${contactName} may have been in a road accident.\n\n` +
    `📍 Location: ${location.googleMapsLink}\n` +
    `🤖 AI Confidence: ${confidenceScore.toFixed(1)}/10\n` +
    `🕐 Time: ${new Date().toLocaleTimeString()}\n\n` +
    `Incident: ${incidentSummary}\n` +
    `Please check on them immediately.`
  );

  const smsUrl = `sms:${contactNumber}?body=${message}`;
  window.open(smsUrl, '_system');
  log.info(`Native SMS deep link triggered for: ${contactNumber}`);
}

/**
 * Schedules and displays a native system notification.
 */
export async function showEmergencyNotification(title: string, body: string): Promise<void> {
  try {
    await LocalNotifications.requestPermissions();
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Date.now(),
          title,
          body,
          sound: 'beep.wav',
          actionTypeId: 'EMERGENCY',
          extra: { type: 'emergency' },
        },
      ],
    });
    log.info('Native local notification scheduled.');
  } catch (err) {
    log.error('Failed to trigger native local notification', err);
  }
}

/**
 * Vibrates the device in a repeating pattern.
 */
export async function triggerHapticAlert(): Promise<void> {
  try {
    for (let i = 0; i < 3; i++) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
      await new Promise(r => setTimeout(r, 300));
    }
    log.info('Native haptic alert triggered.');
  } catch (err) {
    log.error('Failed to trigger native haptic alert', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEB PLATFORM TWILIO SMS IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

interface AlertData {
  contacts: EmergencyContact[];
  userProfile: UserProfile;
  coordinates: GPSCoordinates;
  emergencyScore: number;
  reasoning: string;
  incidentSummary: string;
}

interface AlertResult {
  success: boolean;
  method: 'twilio' | 'fallback';
  logs: string[];
}

function hasTwilioCredentials(
  accountSid: string | undefined,
  authToken: string | undefined,
  fromNumber: string | undefined
): accountSid is string {
  return (
    Boolean(accountSid) &&
    Boolean(authToken) &&
    Boolean(fromNumber) &&
    accountSid !== 'your_twilio_account_sid_here' &&
    authToken !== 'your_twilio_auth_token_here' &&
    fromNumber !== 'your_twilio_phone_number_here'
  );
}

function composeSmsText(data: AlertData): string {
  const mapsLink = getGoogleMapsLink(data.coordinates);
  const timeString = new Date().toLocaleTimeString();

  return [
    `🚨 EMERGENCY ALERT from ResQ`,
    `Person: ${data.userProfile.name || 'Unknown User'}`,
    `Status: ${data.incidentSummary}`,
    `AI Confidence: ${data.emergencyScore}/10`,
    `Location: ${mapsLink}`,
    `Time: ${timeString}`,
    `Blood Type: ${data.userProfile.bloodType || 'Unknown'}`,
    `Medical Info: ${data.userProfile.medicalConditions || 'None on file'}`,
    `— Sent automatically by ResQ Emergency Agent`,
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED ALERT DISPATCH (React store entrypoint)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends emergency alerts using either native Capacitor features or Web Twilio client.
 */
export const sendEmergencyAlerts = async (data: AlertData): Promise<AlertResult> => {
  if (!data.contacts || data.contacts.length === 0) {
    log.warn('sendEmergencyAlerts called with no contacts');
    return { success: false, method: 'fallback', logs: ['⚠️ No emergency contacts configured.'] };
  }

  const alertLogs: string[] = [];

  // ── Native Mobile Platform Flow ───────────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    alertLogs.push('📱 Running on native platform. Dispatching native emergency actions...');
    
    await triggerHapticAlert();
    await showEmergencyNotification(
      '🚨 Emergency Detected',
      'ResQ has detected a possible accident. Opening emergency services.'
    );

    const primaryContact = data.contacts[0]!;
    const lat = data.coordinates.latitude ?? 12.9716;
    const lng = data.coordinates.longitude ?? 80.2209;
    const mapsLink = getGoogleMapsLink(data.coordinates);

    alertLogs.push(`💬 Launching native SMS messenger to: ${primaryContact.name}`);
    await sendEmergencySMS(
      primaryContact.phone,
      data.userProfile.name,
      { lat, lng, googleMapsLink: mapsLink },
      data.incidentSummary,
      data.emergencyScore
    );

    alertLogs.push(`📞 Launching native emergency dialer to: ${primaryContact.name}`);
    await triggerEmergencyDialer(primaryContact.phone);

    return { success: true, method: 'fallback', logs: alertLogs };
  }

  // ── Web Twilio Platform Flow ──────────────────────────────────────────────
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID as string | undefined;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN as string | undefined;
  const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER as string | undefined;

  const smsText = composeSmsText(data);

  if (hasTwilioCredentials(accountSid, authToken, fromNumber)) {
    alertLogs.push('📡 Twilio credentials detected. Attempting SMS dispatch...');
    let allSuccess = true;

    for (const contact of data.contacts) {
      if (!contact.phone) {
        alertLogs.push(`⚠️ Skipping ${contact.name} — no phone number configured.`);
        continue;
      }

      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const headers = new Headers();
        headers.set('Authorization', `Basic ${btoa(`${accountSid}:${authToken}`)}`);
        headers.set('Content-Type', 'application/x-www-form-urlencoded');

        const params = new URLSearchParams();
        params.append('To', contact.phone);
        params.append('From', fromNumber!);
        params.append('Body', smsText);

        const response = await fetch(url, { method: 'POST', headers, body: params });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Twilio HTTP ${response.status}: ${errText}`);
        }

        alertLogs.push(`✅ SMS sent to ${contact.name} (${contact.phone}) via Twilio.`);
        log.info(`SMS dispatched to ${contact.name}`);
      } catch (err) {
        allSuccess = false;
        const errMsg = err instanceof Error ? err.message : String(err);
        alertLogs.push(`❌ Twilio SMS failed for ${contact.name}: ${errMsg}`);
        log.error(`Twilio SMS dispatch failed for ${contact.name}`, err);
      }
    }

    if (allSuccess && data.contacts.length > 0) {
      return { success: true, method: 'twilio', logs: alertLogs };
    }
  } else {
    alertLogs.push('ℹ️ Twilio not configured. Activating browser fallback protocols...');
    log.info('Twilio credentials absent — using browser fallback');
  }

  // Mailto fallback
  const emails = data.contacts.map(c => c.email).filter(Boolean).join(',');
  if (emails) {
    const mailSubject = encodeURIComponent(`🚨 ResQ Emergency Alert: ${data.userProfile.name || 'User'}`);
    const mailBody = encodeURIComponent(smsText);
    window.open(`mailto:${emails}?subject=${mailSubject}&body=${mailBody}`, '_blank');
    alertLogs.push('📬 Mailto protocol triggered.');
  }

  // Tel dialer fallback
  const primaryContact = data.contacts[0];
  if (primaryContact?.phone) {
    window.location.href = `tel:${primaryContact.phone}`;
    alertLogs.push(`📞 Phone dialer triggered for ${primaryContact.name}.`);
  }

  return { success: true, method: 'fallback', logs: alertLogs };
};
