/**
 * @file src/types/index.ts
 * @description Central TypeScript type definitions for the ResQ application.
 *
 * All shared interfaces, union types, and enumerations are declared here.
 * Import from this barrel file to avoid deep relative paths in consumer modules.
 */

// ─────────────────────────────────────────────────────────────────────────────
// AGENT STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All valid states for the ResQ autonomous agent state machine.
 *
 * Transition diagram:
 * ```
 * IDLE → MONITORING → IMPACT_DETECTED → SCENE_ANALYSIS
 *                                            │
 *                         ┌─────────────────┬┴──────────────────┐
 *                         ▼                 ▼                   ▼
 *                 FALSE_ALARM    EMERGENCY_CONFIRMED     (borderline: re-check)
 *                         │                 │
 *                         ▼                 ▼
 *                    MONITORING          NOTIFYING
 *                                           │
 *                                           ▼
 *                                 POST_INCIDENT_MONITORING
 *                                           │
 *                                           ▼
 *                                       MONITORING
 * ```
 */
export type AgentState =
  | 'IDLE'
  | 'MONITORING'
  | 'IMPACT_DETECTED'
  | 'SCENE_ANALYSIS'
  | 'EMERGENCY_CONFIRMED'
  | 'FALSE_ALARM'
  | 'NOTIFYING'
  | 'POST_INCIDENT_MONITORING';

// ─────────────────────────────────────────────────────────────────────────────
// APP CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The operational mode of the ResQ application.
 * - `ACTIVE`: Full visual alerts — countdown timer, flashing UI, audio cues.
 * - `SILENT`: Minimal UI interaction — auto-proceeds after timer expiry.
 *             Designed for wrist-mounted or bag-mounted deployments.
 */
export type AppMode = 'ACTIVE' | 'SILENT';

// ─────────────────────────────────────────────────────────────────────────────
// USER DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Emergency contact information stored in localStorage and used in SMS alerts.
 */
export interface EmergencyContact {
  /** Unique identifier for the contact entry */
  id: string;
  /** Full name of the emergency contact */
  name: string;
  /** E.164 format phone number (e.g. +919876543210) */
  phone: string;
  /** Email address for fallback mailto notification */
  email: string;
  /** Relationship descriptor (e.g. "Spouse", "Parent", "Friend") */
  relation: string;
}

/**
 * User medical profile stored in localStorage and included in emergency messages.
 */
export interface UserProfile {
  /** User's full name as it should appear in emergency alerts */
  name: string;
  /** ABO/Rh blood type (e.g. "A+", "O-") */
  bloodType: string;
  /** Free-text description of relevant medical conditions */
  medicalConditions: string;
  /** Free-text description of known allergies */
  allergies: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SENSOR DATA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GPS coordinates captured via the Geolocation API.
 * All fields are nullable to represent "not yet acquired" state.
 */
export interface GPSCoordinates {
  /** Decimal degrees latitude. Positive = North, Negative = South. */
  latitude: number | null;
  /** Decimal degrees longitude. Positive = East, Negative = West. */
  longitude: number | null;
  /** Accuracy radius in meters. Lower is better. */
  accuracy: number | null;
  /** Unix timestamp (ms) when the coordinates were recorded. */
  timestamp: number | null;
}

/**
 * Raw 3-axis accelerometer reading with computed resultant magnitude.
 */
export interface SensorData {
  /** Acceleration on the X axis (m/s²) */
  x: number;
  /** Acceleration on the Y axis (m/s²) */
  y: number;
  /** Acceleration on the Z axis (m/s²) */
  z: number;
  /** Euclidean magnitude: √(x² + y² + z²) */
  magnitude: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// INCIDENT LOGGING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single entry in the real-time incident timeline log.
 */
export interface IncidentLog {
  /** Unique log entry ID combining timestamp + random suffix */
  id: string;
  /** ISO 8601 timestamp of when this log was created */
  timestamp: string;
  /** Severity/category classification for UI rendering and filtering */
  type: 'INFO' | 'WARNING' | 'ALERT' | 'ERROR' | 'DECISION' | 'ACTION';
  /** Human-readable summary message */
  message: string;
  /** Optional extended details or data payload */
  details?: string;
  /** Optional Base64-encoded JPEG snapshot captured at this log point */
  image?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI / GEMINI API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Structured response returned by the Gemini Vision API after scene analysis.
 * This is the parsed JSON object extracted from the API response text.
 */
export interface GeminiResponse {
  /** Whether the camera frame contained a visible person */
  personVisible?: boolean;
  /**
   * Assessed status of the person detected in the scene.
   * 'injured' and 'unknown' added for extended classification accuracy.
   */
  personStatus:
    | 'standing'
    | 'walking'
    | 'sitting'
    | 'lying_down'
    | 'unconscious'
    | 'not_visible'
    | 'injured'
    | 'unknown';
  /** Probability assessment of physical injury */
  injuryLikelihood: 'none' | 'low' | 'medium' | 'high';
  /** Overall danger level present in the scene */
  apparentDanger?: 'none' | 'low' | 'medium' | 'high';
  /**
   * Emergency severity score from 0 (safe) to 10 (critical emergency).
   * Used as one signal in the multi-modal confidence fusion.
   */
  emergencyScore: number;
  /** Textual description of what is visually visible in the frame */
  visualObservations?: string;
  /** Step-by-step explanation of how the score was determined */
  reasoning: string;
  /** Optional direct recommendation from the model */
  recommendation?: 'EMERGENCY_CONFIRMED' | 'FALSE_ALARM';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIDENCE FUSION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Multi-modal confidence fusion result combining accelerometer and vision signals.
 *
 * Formula: finalScore = (accelWeight × accelScore) + (visionWeight × visionScore)
 */
export interface ConfidenceScore {
  /** Accelerometer-derived severity score (0–10) */
  accelScore: number;
  /** Gemini Vision-derived emergency score (0–10) */
  visionScore: number;
  /** Weighted average of both scores (0–10) */
  finalScore: number;
  /** Weight applied to accelScore (0.0–1.0) */
  accelWeight: number;
  /** Weight applied to visionScore (0.0–1.0) */
  visionWeight: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT REASONING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete result from the ResQ agent's integrated reasoning pipeline.
 */
export interface IntegratedReasoningResult {
  /** Whether the agent determined this is a confirmed emergency */
  isEmergencyConfirmed: boolean;
  /** The fused confidence score used to make the decision */
  confidenceScore: ConfidenceScore;
  /** Recommended next action for the orchestrating hook */
  recommendedAction: 'DISPATCH' | 'MONITOR' | 'PROGRESSIVE_CHECK' | 'FALSE_ALARM';
  /** Human-readable incident summary for the notification SMS */
  incidentSummary: string;
  /** Full reasoning chain for the incident report */
  detailedReasoning: string;
  /** Whether this result came from a second progressive check */
  isProgressiveResult?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROGRESSIVE MONITORING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stores a single Gemini scene analysis attempt for comparison in progressive monitoring.
 */
export interface SceneAnalysisAttempt {
  /** Attempt number (1 = first analysis, 2 = progressive re-check) */
  attemptNumber: 1 | 2;
  /** ISO 8601 timestamp of when this analysis was run */
  timestamp: string;
  /** The Gemini response for this attempt */
  response: GeminiResponse;
  /** The confidence score computed from this attempt */
  confidence: ConfidenceScore;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPLAINABLE AI INCIDENT REPORT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A structured, explainable AI incident report generated after every incident
 * (whether emergency or false alarm). Stored in IndexedDB.
 */
export interface IncidentReport {
  /** Unique incident identifier (e.g. INCIDENT-1704067200000) */
  incidentId: string;
  /** ISO 8601 timestamp of when the incident was triggered */
  triggeredAt: string;
  /** ISO 8601 timestamp of when the incident was resolved */
  resolvedAt: string;
  /** Final agent state when the incident was closed */
  finalState: AgentState;
  /** Whether an emergency alert was dispatched */
  emergencyDispatched: boolean;
  /** Peak accelerometer magnitude recorded during the incident */
  peakAccelerationMs2: number;
  /** All Gemini API calls made during this incident */
  sceneAnalysisAttempts: SceneAnalysisAttempt[];
  /** Final fused confidence score */
  finalConfidenceScore: ConfidenceScore;
  /** GPS coordinates at time of impact */
  coordinates: GPSCoordinates;
  /** Plain-English explanation of the final decision */
  decisionReasoning: string;
  /** Ordered list of incident log entries for full timeline */
  logs: IncidentLog[];
}
