/**
 * @file src/store/agentStore.ts
 * @description Zustand state store for ResQ global application state.
 *
 * This store is the single source of truth for:
 * - Agent state machine current state
 * - Live sensor readings and history
 * - GPS coordinates
 * - Emergency contacts and user profile
 * - Incident logs and analysis results
 * - App mode (Active vs Silent)
 * - Multi-modal confidence scores
 * - Simulation-specific UI state
 *
 * State is persisted to localStorage for contacts, profile, and app mode.
 * Incident logs are persisted to IndexedDB via the incidentLogger service.
 */

import { create } from 'zustand';
import {
  AgentState,
  AppMode,
  EmergencyContact,
  UserProfile,
  GPSCoordinates,
  IncidentLog,
  GeminiResponse,
  ConfidenceScore,
} from '../types';
import {
  COUNTDOWN_DURATION_SEC,
  STORAGE_KEY_CONTACTS,
  STORAGE_KEY_USER_PROFILE,
  STORAGE_KEY_APP_MODE,
  ACCELEROMETER_HISTORY_SIZE,
} from '../config/constants';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('AgentStore');

// ─────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

/** Complete shape of the Zustand agent store — state fields + action methods. */
interface AgentStore {
  // ── State Fields ────────────────────────────────────────────────────────────

  /** Current state machine position */
  agentState: AgentState;
  /** App operational mode: ACTIVE (full UI) or SILENT (auto-proceed) */
  appMode: AppMode;
  /** Latest GPS fix */
  coordinates: GPSCoordinates;
  /** Most recent accelerometer resultant magnitude (m/s²) */
  currentMagnitude: number;
  /** Rolling history of magnitudes for the telemetry graph */
  accelerometerHistory: number[];
  /** Chronological incident timeline (newest first in UI) */
  logs: IncidentLog[];
  /** Configured emergency contacts */
  contacts: EmergencyContact[];
  /** User medical profile */
  userProfile: UserProfile;
  /** Seconds remaining on the cancellation countdown */
  countdownSeconds: number;
  /** Active incident ID (null when no incident is in progress) */
  currentIncidentId: string | null;
  /** Most recent Gemini Vision analysis result */
  activeAnalysisResult: GeminiResponse | null;
  /** Multi-modal fused confidence score for the current incident */
  confidenceScore: ConfidenceScore | null;

  // ── Simulation UI State ─────────────────────────────────────────────────────
  /** Whether the simulated camera capture overlay is shown */
  isCameraActiveSimulated: boolean;
  /** Whether the simulated SMS preview overlay is shown */
  showSmsSimulated: boolean;
  /** Content of the simulated SMS message for display */
  smsMessageSimulated: string;
  /** Ordered feed of post-incident status updates */
  postIncidentFeed: string[];

  // ── Actions ─────────────────────────────────────────────────────────────────

  /**
   * Transitions the agent to a new state.
   * Logs the transition to the incident timeline.
   * No-ops if the state is already the requested value.
   */
  setAgentState: (state: AgentState) => void;

  /** Sets the app operational mode and persists to localStorage. */
  setAppMode: (mode: AppMode) => void;

  /** Updates the GPS coordinates in state. */
  setCoordinates: (coords: GPSCoordinates) => void;

  /** Updates the current accelerometer reading. */
  setCurrentMagnitude: (mag: number) => void;

  /**
   * Pushes a new magnitude reading into the rolling graph history.
   * Drops the oldest value to maintain ACCELEROMETER_HISTORY_SIZE length.
   */
  pushMagnitudeHistory: (mag: number) => void;

  /**
   * Appends a new log entry to the incident timeline.
   * Entries are prepended (newest first) for UI display.
   */
  addLog: (type: IncidentLog['type'], message: string, details?: string, image?: string) => void;

  /** Clears all log entries from state (does not affect IndexedDB). */
  clearLogs: () => void;

  /** Updates the emergency contacts list and persists to localStorage. */
  setContacts: (contacts: EmergencyContact[]) => void;

  /** Updates the user medical profile and persists to localStorage. */
  setUserProfile: (profile: UserProfile) => void;

  /** Updates the countdown timer value. */
  setCountdownSeconds: (seconds: number) => void;

  /**
   * Starts a new incident record.
   * Generates a unique incident ID, resets per-incident state, and logs the trigger.
   * @returns The newly generated incident ID
   */
  startNewIncident: () => string;

  /** Concludes the current incident and resets incident-specific state. */
  endIncident: () => void;

  /** Stores the latest Gemini Vision analysis result. */
  setActiveAnalysisResult: (result: GeminiResponse | null) => void;

  /** Stores the latest fused confidence score. */
  setConfidenceScore: (score: ConfidenceScore | null) => void;

  // Simulation-specific actions
  /** Shows/hides the camera capture simulation overlay. */
  setCameraActiveSimulated: (active: boolean) => void;
  /** Shows/hides the SMS preview simulation overlay. */
  setShowSmsSimulated: (show: boolean) => void;
  /** Sets the simulated SMS message content. */
  setSmsMessageSimulated: (msg: string) => void;
  /** Prepends a post-incident status update to the feed. */
  addPostIncidentFeed: (feedItem: string) => void;
  /** Clears the post-incident monitoring feed. */
  clearPostIncidentFeed: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely reads and JSON-parses a value from localStorage.
 * Returns the defaultValue if the key is missing or parsing fails.
 *
 * @param key - The localStorage key to read
 * @param defaultValue - Fallback value if key is absent or malformed
 * @returns Parsed value or defaultValue
 */
function getLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : defaultValue;
  } catch (e) {
    log.warn(`Failed to parse localStorage key "${key}". Using default.`, e);
    return defaultValue;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT DATA
// ─────────────────────────────────────────────────────────────────────────────

/** Demo emergency contact pre-populated for hackathon judging convenience. */
const DEFAULT_CONTACTS: EmergencyContact[] = [
  { id: '1', name: 'Peter', phone: '+919940335499', email: 'peter@spider.web', relation: 'Friend' },
];

/** Demo user profile pre-populated for hackathon judging convenience. */
const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Tony Stark',
  bloodType: 'A+',
  medicalConditions: 'Healthy',
  allergies: 'None',
};

// ─────────────────────────────────────────────────────────────────────────────
// STORE DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The global Zustand store instance.
 * Access state reactively in React components with `useAgentStore(selector)`.
 * Access state imperatively outside React with `useAgentStore.getState()`.
 */
export const useAgentStore = create<AgentStore>((set, get) => ({
  // ── Initial State ──────────────────────────────────────────────────────────
  agentState: 'IDLE',
  appMode: getLocalStorage<AppMode>(STORAGE_KEY_APP_MODE, 'ACTIVE'),
  coordinates: { latitude: null, longitude: null, accuracy: null, timestamp: null },
  currentMagnitude: 0,
  accelerometerHistory: Array<number>(ACCELEROMETER_HISTORY_SIZE).fill(0),
  logs: [],
  contacts: getLocalStorage<EmergencyContact[]>(STORAGE_KEY_CONTACTS, DEFAULT_CONTACTS),
  userProfile: getLocalStorage<UserProfile>(STORAGE_KEY_USER_PROFILE, DEFAULT_USER_PROFILE),
  countdownSeconds: COUNTDOWN_DURATION_SEC,
  currentIncidentId: null,
  activeAnalysisResult: null,
  confidenceScore: null,

  // Simulation state
  isCameraActiveSimulated: false,
  showSmsSimulated: false,
  smsMessageSimulated: '',
  postIncidentFeed: [],

  // ── Actions ────────────────────────────────────────────────────────────────

  setAgentState: (agentState: AgentState) => {
    const oldState = get().agentState;
    if (oldState === agentState) return;
    set({ agentState });
    get().addLog('INFO', `🔄 State transition: ${oldState} ➔ ${agentState}`);
  },

  setAppMode: (appMode: AppMode) => {
    localStorage.setItem(STORAGE_KEY_APP_MODE, JSON.stringify(appMode));
    set({ appMode });
  },

  setCoordinates: (coordinates: GPSCoordinates) => set({ coordinates }),

  setCurrentMagnitude: (currentMagnitude: number) => set({ currentMagnitude }),

  pushMagnitudeHistory: (mag: number) =>
    set(state => ({
      accelerometerHistory: [...state.accelerometerHistory.slice(1), mag],
    })),

  addLog: (type, message, details, image) => {
    const newLog: IncidentLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
      image,
    };
    set(state => ({ logs: [newLog, ...state.logs] }));
  },

  clearLogs: () => set({ logs: [] }),

  setContacts: (contacts: EmergencyContact[]) => {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
    set({ contacts });
  },

  setUserProfile: (userProfile: UserProfile) => {
    localStorage.setItem(STORAGE_KEY_USER_PROFILE, JSON.stringify(userProfile));
    set({ userProfile });
  },

  setCountdownSeconds: (countdownSeconds: number) => set({ countdownSeconds }),

  startNewIncident: () => {
    const incidentId = `INCIDENT-${Date.now()}`;
    set({
      currentIncidentId: incidentId,
      countdownSeconds: COUNTDOWN_DURATION_SEC,
      activeAnalysisResult: null,
      confidenceScore: null,
      postIncidentFeed: [],
    });
    get().addLog('ALERT', `🚨 NEW INCIDENT CAPTURED: ${incidentId}`);
    return incidentId;
  },

  endIncident: () => {
    get().addLog('INFO', 'Incident resolved. System returning to monitoring.');
    set({
      currentIncidentId: null,
      activeAnalysisResult: null,
      confidenceScore: null,
      countdownSeconds: COUNTDOWN_DURATION_SEC,
      isCameraActiveSimulated: false,
      showSmsSimulated: false,
      smsMessageSimulated: '',
      postIncidentFeed: [],
    });
  },

  setActiveAnalysisResult: (activeAnalysisResult: GeminiResponse | null) =>
    set({ activeAnalysisResult }),

  setConfidenceScore: (confidenceScore: ConfidenceScore | null) => set({ confidenceScore }),

  // Simulation-specific
  setCameraActiveSimulated: (isCameraActiveSimulated: boolean) =>
    set({ isCameraActiveSimulated }),
  setShowSmsSimulated: (showSmsSimulated: boolean) => set({ showSmsSimulated }),
  setSmsMessageSimulated: (smsMessageSimulated: string) => set({ smsMessageSimulated }),
  addPostIncidentFeed: (feedItem: string) =>
    set(state => ({ postIncidentFeed: [feedItem, ...state.postIncidentFeed] })),
  clearPostIncidentFeed: () => set({ postIncidentFeed: [] }),
}));
