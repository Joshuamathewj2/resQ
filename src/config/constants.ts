/**
 * @file src/config/constants.ts
 * @description Central configuration constants for the ResQ application.
 *
 * All magic numbers, threshold values, API endpoints, timing delays, and
 * storage keys are declared here. Import from this file instead of
 * hard-coding values anywhere else in the codebase.
 *
 * Naming convention: SCREAMING_SNAKE_CASE for all exported constants.
 */

/** ─────────────────────────────────────────────────────────────────────────
 * SENSOR & IMPACT DETECTION
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Minimum acceleration magnitude (in m/s²) required to classify an event
 * as a potential impact. Equivalent to approximately 2.5 G.
 */
export const IMPACT_THRESHOLD_M_S2 = 24.5;

/**
 * Minimum duration (in milliseconds) the acceleration must stay above
 * IMPACT_THRESHOLD_M_S2 before triggering an incident. Prevents spikes
 * from phone taps or brief vibrations from triggering alerts.
 */
export const IMPACT_DURATION_MS = 200;

/**
 * Cooldown period (in milliseconds) after an impact detection event.
 * Prevents multiple rapid triggers from a single physical event.
 */
export const DEBOUNCE_COOLDOWN_MS = 10_000;

/**
 * Maximum force value (m/s²) used for normalizing the sensor graph Y-axis.
 * Values above this are clamped visually but still tracked for detection.
 */
export const CANVAS_MAX_FORCE_M_S2 = 45;

/**
 * Number of historical data points stored for the accelerometer graph.
 * Represents a rolling window of recent readings.
 */
export const ACCELEROMETER_HISTORY_SIZE = 50;

/** ─────────────────────────────────────────────────────────────────────────
 * ALERT & TIMING
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Duration (in seconds) of the cancellation countdown before auto-dispatch.
 * User must tap "Cancel" within this window to abort the emergency alert.
 */
export const COUNTDOWN_DURATION_SEC = 30;

/**
 * Delay (in milliseconds) after camera stream activation before capturing
 * a frame. Allows the camera to auto-adjust exposure and white balance.
 */
export const CAMERA_CAPTURE_DELAY_MS = 500;

/**
 * Interval (in milliseconds) between post-incident monitoring checks.
 * After an emergency is dispatched, the system re-evaluates this often.
 */
export const POST_INCIDENT_INTERVAL_MS = 30_000;

/**
 * Maximum number of post-incident monitoring cycles before automatically
 * concluding the monitoring phase.
 */
export const POST_INCIDENT_MAX_CHECKS = 3;

/**
 * Delay (in milliseconds) before running the second Gemini analysis in
 * progressive monitoring mode (when the initial score is borderline).
 */
export const PROGRESSIVE_RECHECK_DELAY_MS = 10_000;

/** ─────────────────────────────────────────────────────────────────────────
 * CONFIDENCE FUSION SCORING
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Weight applied to the accelerometer-derived score in the fused confidence
 * calculation. Must satisfy: ACCEL_WEIGHT + VISION_WEIGHT = 1.0
 */
export const CONFIDENCE_ACCEL_WEIGHT = 0.4;

/**
 * Weight applied to the Gemini Vision-derived score in the fused confidence
 * calculation. Must satisfy: ACCEL_WEIGHT + VISION_WEIGHT = 1.0
 */
export const CONFIDENCE_VISION_WEIGHT = 0.6;

/**
 * Minimum fused confidence score required to classify an event as a
 * confirmed emergency and trigger autonomous dispatch. Range: 0–10.
 */
export const EMERGENCY_THRESHOLD_SCORE = 7.0;

/**
 * Minimum fused confidence score for the "borderline" zone that triggers
 * progressive scene monitoring (a second Gemini analysis after a delay).
 */
export const BORDERLINE_SCORE_MIN = 5.0;

/**
 * Maximum fused confidence score for the "borderline" zone. Scores above
 * this threshold immediately confirm an emergency without re-checking.
 */
export const BORDERLINE_SCORE_MAX = 7.0;

/** ─────────────────────────────────────────────────────────────────────────
 * GEMINI API
 * ───────────────────────────────────────────────────────────────────────── */

/** The Gemini model identifier used for all Vision API requests. */
export const GEMINI_MODEL = 'gemini-1.5-flash';

/** Full Gemini Vision API URL with model path but without the API key query param. */
export const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/** Temperature setting for scene analysis — low to ensure deterministic, safe outputs. */
export const GEMINI_SCENE_TEMPERATURE = 0.1;

/** Temperature setting for simulation/monitoring updates — higher for varied narrative. */
export const GEMINI_MONITORING_TEMPERATURE = 0.7;

/** ─────────────────────────────────────────────────────────────────────────
 * CAMERA
 * ───────────────────────────────────────────────────────────────────────── */

/** Preferred camera resolution width (pixels). Falls back to device default. */
export const CAMERA_WIDTH_PX = 640;

/** Preferred camera resolution height (pixels). Falls back to device default. */
export const CAMERA_HEIGHT_PX = 480;

/** JPEG quality factor for captured frames sent to Gemini (0.0–1.0). */
export const CAMERA_JPEG_QUALITY = 0.85;

/** ─────────────────────────────────────────────────────────────────────────
 * GPS / LOCATION
 * ───────────────────────────────────────────────────────────────────────── */

/** Fallback GPS latitude used when geolocation permission is denied. */
export const DEMO_GPS_LATITUDE = 12.9716;

/** Fallback GPS longitude used when geolocation permission is denied. */
export const DEMO_GPS_LONGITUDE = 80.2209;

/** GPS accuracy setting — requests maximum precision from the browser. */
export const GPS_HIGH_ACCURACY = true;

/** GPS request timeout in milliseconds before triggering the error callback. */
export const GPS_TIMEOUT_MS = 10_000;

/** ─────────────────────────────────────────────────────────────────────────
 * INDEXEDDB
 * ───────────────────────────────────────────────────────────────────────── */

/** IndexedDB database name for incident record persistence. */
export const DB_NAME = 'ResQ_Database';

/** IndexedDB schema version. Increment when changing the object store schema. */
export const DB_VERSION = 1;

/** Name of the IndexedDB object store holding incident records. */
export const DB_STORE_NAME = 'incidents';

/** ─────────────────────────────────────────────────────────────────────────
 * LOCAL STORAGE KEYS
 * ───────────────────────────────────────────────────────────────────────── */

/** localStorage key for persisting the emergency contacts list. */
export const STORAGE_KEY_CONTACTS = 'resq_emergency_contacts';

/** localStorage key for persisting the user medical profile. */
export const STORAGE_KEY_USER_PROFILE = 'resq_user_profile';

/** localStorage key for persisting the app mode (ACTIVE / SILENT). */
export const STORAGE_KEY_APP_MODE = 'resq_app_mode';

/** ─────────────────────────────────────────────────────────────────────────
 * LEGACY GROUPED EXPORT (for backward compatibility with existing imports)
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * Grouped CONFIG object preserved for backward compatibility.
 * Prefer importing individual constants directly in new code.
 * @deprecated Use named exports instead: `import { IMPACT_THRESHOLD_M_S2 } from '@config/constants'`
 */
export const CONFIG = {
  IMPACT_THRESHOLD_G: 2.5,
  IMPACT_THRESHOLD_M_S2,
  IMPACT_DURATION_MS,
  DEBOUNCE_COOLDOWN_MS,
  COUNTDOWN_DURATION_SEC,
  GEMINI_MODEL,
  GEMINI_API_URL,
  STORAGE_KEYS: {
    CONTACTS: STORAGE_KEY_CONTACTS,
    USER_PROFILE: STORAGE_KEY_USER_PROFILE,
    APP_MODE: STORAGE_KEY_APP_MODE,
  },
} as const;
