import { EmergencyContact, GPSCoordinates, UserProfile } from '../types';
import { getGoogleMapsLink } from './locationService';

interface AlertData {
  contacts: EmergencyContact[];
  userProfile: UserProfile;
  coordinates: GPSCoordinates;
  emergencyScore: number;
  reasoning: string;
  incidentSummary: string;
}

export const sendEmergencyAlerts = async (data: AlertData): Promise<{ success: boolean; method: 'twilio' | 'fallback'; logs: string[] }> => {
  const accountSid = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
  const authToken = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
  const fromNumber = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
  
  const hasTwilioKeys = accountSid && authToken && fromNumber &&
                        accountSid !== 'your_twilio_account_sid_here' &&
                        authToken !== 'your_twilio_auth_token_here' &&
                        fromNumber !== 'your_twilio_phone_number_here';

  const mapsLink = getGoogleMapsLink(data.coordinates);
  const timeString = new Date().toLocaleTimeString();
  const alertLogs: string[] = [];

  const smsText = `🚨 EMERGENCY ALERT: ${data.userProfile.name || 'User'} may have been in an accident. 
Location: ${mapsLink}
ResQ AI Confidence: ${data.emergencyScore}/10.
Status: ${data.incidentSummary}
Time: ${timeString}.
Blood Type: ${data.userProfile.bloodType || 'Unknown'}
Medical Info: ${data.userProfile.medicalConditions || 'None'}`;

  if (hasTwilioKeys) {
    alertLogs.push('Twilio credentials found. Attempting API SMS dispatch...');
    let twilioSuccess = true;

    for (const contact of data.contacts) {
      if (!contact.phone) continue;
      
      try {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const headers = new Headers();
        headers.set('Authorization', 'Basic ' + btoa(`${accountSid}:${authToken}`));
        headers.set('Content-Type', 'application/x-www-form-urlencoded');

        const params = new URLSearchParams();
        params.append('To', contact.phone);
        params.append('From', fromNumber);
        params.append('Body', smsText);

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: params
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Twilio HTTP ${response.status}: ${errText}`);
        }
        
        alertLogs.push(`✅ SMS alert successfully sent to ${contact.name} (${contact.phone}) via Twilio.`);
      } catch (err) {
        twilioSuccess = false;
        alertLogs.push(`❌ Twilio SMS failed for ${contact.name}: ${err}`);
      }
    }

    if (twilioSuccess && data.contacts.length > 0) {
      return { success: true, method: 'twilio', logs: alertLogs };
    }
  } else {
    alertLogs.push('Twilio credentials missing. Falling back to native device protocols...');
  }

  // Fallback Mode: Trigger Mailto and Tel protocols
  alertLogs.push('Executing browser fallback systems...');
  
  // Create mailto link
  const emails = data.contacts.map(c => c.email).filter(Boolean).join(',');
  if (emails) {
    const mailSubject = encodeURIComponent(`🚨 ResQ Autonomous Emergency Notification: ${data.userProfile.name || 'User'}`);
    const mailBody = encodeURIComponent(smsText);
    const mailtoUrl = `mailto:${emails}?subject=${mailSubject}&body=${mailBody}`;
    
    // Open in new tab or trigger email app
    window.open(mailtoUrl, '_blank');
    alertLogs.push('📬 Triggered mailto protocol for email clients.');
  }

  // Try dialing first contact's phone
  const primaryContact = data.contacts[0];
  if (primaryContact && primaryContact.phone) {
    const telUrl = `tel:${primaryContact.phone}`;
    // In a PWA, redirecting to a tel: url brings up the phone dialer
    window.location.href = telUrl;
    alertLogs.push(`📞 Triggered primary phone call dialing prompt: ${primaryContact.name} (${primaryContact.phone}).`);
  } else {
    alertLogs.push('⚠️ No phone numbers available to dial.');
  }

  return { 
    success: true, 
    method: 'fallback', 
    logs: alertLogs 
  };
};
