import { create } from 'zustand';
import { AgentState, EmergencyContact, UserProfile, GPSCoordinates, IncidentLog, GeminiResponse } from '../types';
import { CONFIG } from '../config/constants';

interface AgentStore {
  agentState: AgentState;
  coordinates: GPSCoordinates;
  currentMagnitude: number;
  accelerometerHistory: number[];
  logs: IncidentLog[];
  contacts: EmergencyContact[];
  userProfile: UserProfile;
  countdownSeconds: number;
  currentIncidentId: string | null;
  activeAnalysisResult: GeminiResponse | null;
  
  // Simulation specific states
  isCameraActiveSimulated: boolean;
  showSmsSimulated: boolean;
  smsMessageSimulated: string;
  postIncidentFeed: string[];
  
  // Actions
  setAgentState: (state: AgentState) => void;
  setCoordinates: (coords: GPSCoordinates) => void;
  setCurrentMagnitude: (mag: number) => void;
  pushMagnitudeHistory: (mag: number) => void;
  addLog: (type: IncidentLog['type'], message: string, details?: string, image?: string) => void;
  clearLogs: () => void;
  setContacts: (contacts: EmergencyContact[]) => void;
  setUserProfile: (profile: UserProfile) => void;
  setCountdownSeconds: (seconds: number) => void;
  startNewIncident: () => string;
  endIncident: () => void;
  setActiveAnalysisResult: (result: GeminiResponse | null) => void;
  
  // Simulation actions
  setCameraActiveSimulated: (active: boolean) => void;
  setShowSmsSimulated: (show: boolean) => void;
  setSmsMessageSimulated: (msg: string) => void;
  addPostIncidentFeed: (feedItem: string) => void;
  clearPostIncidentFeed: () => void;
}

const getLocalStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
};

export const useAgentStore = create<AgentStore>((set, get) => ({
  agentState: 'IDLE',
  coordinates: { latitude: null, longitude: null, accuracy: null, timestamp: null },
  currentMagnitude: 0,
  accelerometerHistory: Array(50).fill(0),
  logs: [],
  contacts: getLocalStorage<EmergencyContact[]>(CONFIG.STORAGE_KEYS.CONTACTS, [
    // Pre-populate Peter for demo purposes if list is empty
    { id: '1', name: 'Peter', phone: '+919940335499', email: 'peter@spider.web', relation: 'Friend' }
  ]),
  userProfile: getLocalStorage<UserProfile>(CONFIG.STORAGE_KEYS.USER_PROFILE, {
    name: 'Tony Stark',
    bloodType: 'A+',
    medicalConditions: 'Healthy',
    allergies: 'No'
  }),
  countdownSeconds: CONFIG.COUNTDOWN_DURATION_SEC,
  currentIncidentId: null,
  activeAnalysisResult: null,
  
  // Simulation default values
  isCameraActiveSimulated: false,
  showSmsSimulated: false,
  smsMessageSimulated: '',
  postIncidentFeed: [],

  setAgentState: (agentState) => {
    const oldState = get().agentState;
    if (oldState !== agentState) {
      set({ agentState });
      get().addLog('INFO', `Agent state transitioned: ${oldState} ➔ ${agentState}`);
    }
  },
  
  setCoordinates: (coordinates) => set({ coordinates }),
  
  setCurrentMagnitude: (currentMagnitude) => set({ currentMagnitude }),
  
  pushMagnitudeHistory: (mag) => set((state) => {
    const history = [...state.accelerometerHistory.slice(1), mag];
    return { accelerometerHistory: history };
  }),
  
  addLog: (type, message, details, image) => {
    const newLog: IncidentLog = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      message,
      details,
      image
    };
    set((state) => ({ logs: [newLog, ...state.logs] }));
  },
  
  clearLogs: () => set({ logs: [] }),
  
  setContacts: (contacts) => {
    localStorage.setItem(CONFIG.STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    set({ contacts });
  },
  
  setUserProfile: (userProfile) => {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USER_PROFILE, JSON.stringify(userProfile));
    set({ userProfile });
  },
  
  setCountdownSeconds: (countdownSeconds) => set({ countdownSeconds }),
  
  startNewIncident: () => {
    const incidentId = `INCIDENT-${Date.now()}`;
    set({
      currentIncidentId: incidentId,
      countdownSeconds: CONFIG.COUNTDOWN_DURATION_SEC,
      activeAnalysisResult: null,
      postIncidentFeed: []
    });
    get().addLog('ALERT', `🚨 NEW INCIDENT CAPTURED: ${incidentId}`);
    return incidentId;
  },
  
  endIncident: () => {
    get().addLog('INFO', `Incident resolution concluded.`);
    set({
      currentIncidentId: null,
      activeAnalysisResult: null,
      countdownSeconds: CONFIG.COUNTDOWN_DURATION_SEC,
      isCameraActiveSimulated: false,
      showSmsSimulated: false,
      smsMessageSimulated: '',
      postIncidentFeed: []
    });
  },

  setActiveAnalysisResult: (activeAnalysisResult) => set({ activeAnalysisResult }),

  // Simulation actions
  setCameraActiveSimulated: (isCameraActiveSimulated) => set({ isCameraActiveSimulated }),
  setShowSmsSimulated: (showSmsSimulated) => set({ showSmsSimulated }),
  setSmsMessageSimulated: (smsMessageSimulated) => set({ smsMessageSimulated }),
  addPostIncidentFeed: (feedItem) => set((state) => ({ postIncidentFeed: [feedItem, ...state.postIncidentFeed] })),
  clearPostIncidentFeed: () => set({ postIncidentFeed: [] })
}));
