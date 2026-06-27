export type AgentState =
  | 'IDLE'
  | 'MONITORING'
  | 'IMPACT_DETECTED'
  | 'SCENE_ANALYSIS'
  | 'EMERGENCY_CONFIRMED'
  | 'NOTIFYING'
  | 'POST_INCIDENT_MONITORING';

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  relation: string;
}

export interface UserProfile {
  name: string;
  bloodType: string;
  medicalConditions: string;
  allergies: string;
}

export interface GPSCoordinates {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timestamp: number | null;
}

export interface SensorData {
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export interface IncidentLog {
  id: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'ERROR' | 'DECISION' | 'ACTION';
  message: string;
  details?: string;
  image?: string; // Base64 snapshot if captured
}

export interface GeminiResponse {
  personVisible?: boolean;
  personStatus: 'standing' | 'walking' | 'sitting' | 'lying_down' | 'unconscious' | 'not_visible' | 'injured' | 'unknown';
  injuryLikelihood: 'none' | 'low' | 'medium' | 'high';
  apparentDanger?: 'none' | 'low' | 'medium' | 'high';
  emergencyScore: number; // 0 to 10
  visualObservations?: string;
  reasoning: string;
  recommendation?: 'EMERGENCY_CONFIRMED' | 'FALSE_ALARM';
}

export interface IntegratedReasoningResult {
  isEmergencyConfirmed: boolean;
  emergencyScore: number;
  recommendedAction: 'DISPATCH' | 'MONITOR' | 'FALSE_ALARM';
  incidentSummary: string;
  detailedReasoning: string;
}
