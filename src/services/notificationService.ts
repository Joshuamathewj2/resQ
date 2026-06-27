/**
 * @file src/services/notificationService.ts
 * @description Emergency alert dispatch service for ResQ.
 *
 * Implements a two-tier notification strategy:
 *
 * **Tier 1 — Twilio SMS API**: If `VITE_TWILIO_*` environment variables are
 * configured, sends direct SMS to all emergency contacts via the Twilio REST API.
 * Each contact's phone number receives an individually dispatched message.
 *
 * **Tier 2 — Browser Fallback**: If Twilio is not configured or all Twilio
 * calls fail, falls back to native browser protocols:
 * - `mailto:` — opens the device email client with a pre-composed alert
 * - `tel:` — opens the phone dialer to the primary emergency contact
 *
 * @see {@link https://www.twilio.com/docs/sms/api} for Twilio API documentation
 */

import { EmergencyContact, GPSCoordinates, UserProfile } from '../types';
import { getGoogleMapsLink } from './locationService';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('NotificationService');

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** Input data required to compose and send emergency alerts. */
interface AlertData {
  /** List of emergency contacts to notify */
  contacts: EmergencyContact[];
  /** User medical profile for inclusion in the alert message */
  userProfile: UserProfile;
  /** GPS coordinates at time of incident */
  coordinates: GPSCoordinates;
  /** AI-determined emergency severity score (0–10) */
  emergencyScore: number;
  /** AI reasoning text explaining the score */
  reasoning: string;
  /** One-sentence incident summary for the SMS body */
  incidentSummary: string;
}

/** Return value from the alert dispatch operation. */
interface AlertResult {
  /** Whether at least one alert was successfully dispatched */
  success: boolean;
  /** Which notification pathway was used */
  method: 'twilio' | 'fallback';
  /** Human-readable log lines describing each dispatch attempt */
  logs: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates that all required Twilio environment variables are set to real values
 * (not placeholder strings from the .env.example file).
 *
 * @param accountSid - Twilio Account SID
 * @param authToken - Twilio Auth Token
 * @param fromNumber - Twilio source phone number
 * @returns true if all three values are present and non-placeholder
 */
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

/**
 * Composes the emergency SMS body text from incident data.
 * Keeps the message concise and informative for first responders.
 *
 * @param data - Alert data containing user profile, location, and AI summary
 * @returns Formatted SMS body string
 */
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
// MAIN DISPATCH FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sends emergency alerts to all configured contacts via the best available method.
 *
 * Attempts Twilio SMS first. If Twilio credentials are missing or all SMS calls
 * fail, automatically falls back to mailto + tel browser protocols.
 *
 * @param data - Alert payload containing contacts, location, and AI analysis
 * @returns Promise resolving to AlertResult with dispatch outcome details
 *
 * @example
 * ```ts
 * const result = await sendEmergencyAlerts({
 *   contacts, userProfile, coordinates, emergencyScore: 8.5,
 *   reasoning: 'Rider unconscious...', incidentSummary: 'High severity crash detected'
 * });
 * result.logs.forEach(line => addLog('INFO', line));
 * ```
 */
export const sendEmergencyAlerts = async (data: AlertData): Promise<AlertResult> => {
  if (!data.contacts || data.contacts.length === 0) {
    log.warn('sendEmergencyAlerts called with no contacts — aborting dispatch');
    return { success: false, method: 'fallback', logs: ['⚠️ No emergency contacts configured.'] };
  }

  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID as string | undefined;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN as string | undefined;
  const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER as string | undefined;

  const smsText = composeSmsText(data);
  const alertLogs: string[] = [];

  // ── Tier 1: Twilio SMS ────────────────────────────────────────────────────

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

  // ── Tier 2: Browser Fallback ──────────────────────────────────────────────

  alertLogs.push('📲 Executing native browser alert protocols...');

  // Mailto trigger
  const emails = data.contacts.map(c => c.email).filter(Boolean).join(',');
  if (emails) {
    const mailSubject = encodeURIComponent(
      `🚨 ResQ Emergency Alert: ${data.userProfile.name || 'User'}`
    );
    const mailBody = encodeURIComponent(smsText);
    const mailtoUrl = `mailto:${emails}?subject=${mailSubject}&body=${mailBody}`;
    window.open(mailtoUrl, '_blank');
    alertLogs.push('📬 Mailto protocol triggered — email client should open.');
  }

  // Tel dialer for primary contact
  const primaryContact = data.contacts[0];
  if (primaryContact?.phone) {
    window.location.href = `tel:${primaryContact.phone}`;
    alertLogs.push(`📞 Phone dialer triggered for ${primaryContact.name} (${primaryContact.phone}).`);
  } else {
    alertLogs.push('⚠️ No phone number available for primary contact.');
  }

  return { success: true, method: 'fallback', logs: alertLogs };
};
