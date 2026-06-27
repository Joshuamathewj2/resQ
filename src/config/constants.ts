export const CONFIG = {
  // Accelerometer Thresholds
  IMPACT_THRESHOLD_G: 2.5, // 2.5 G's
  IMPACT_THRESHOLD_M_S2: 24.5, // 2.5 * 9.8 m/s² (approx 24.5 m/s²)
  IMPACT_DURATION_MS: 200,    // Duration the force must be sustained to count as potential impact
  DEBOUNCE_COOLDOWN_MS: 10000, // Cooldown after impact detection to prevent multi-triggers (10s)
  
  // Alert Timings
  COUNTDOWN_DURATION_SEC: 30, // 30-second cancellation timer

  // Gemini Settings
  GEMINI_MODEL: 'gemini-1.5-flash',
  GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',

  // Local Storage Keys
  STORAGE_KEYS: {
    CONTACTS: 'resq_emergency_contacts',
    USER_PROFILE: 'resq_user_profile'
  }
};
