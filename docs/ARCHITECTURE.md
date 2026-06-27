# ResQ System Architecture

## Overview

ResQ is a Progressive Web App implementing an autonomous AI emergency agent that runs entirely on-device in the browser. It uses a reactive state machine orchestrated by React hooks, with all decision logic centralised in the agent reasoning layer.

---

## State Machine

```
                    ┌──────────────┐
                    │     IDLE     │
                    └──────┬───────┘
                           │ User clicks "Start Monitoring"
                           ▼
                    ┌──────────────┐
                    │  MONITORING  │◄──────────────────────────────┐
                    └──────┬───────┘                               │
                           │ Accelerometer ≥ 24.5 m/s²             │
                           │ sustained for ≥ 200ms                 │
                           ▼                                        │
                    ┌──────────────────┐                           │
                    │ IMPACT_DETECTED  │                           │
                    └──────┬───────────┘                           │
                           │ Camera activated                      │
                           ▼                                        │
                    ┌──────────────────┐                           │
                    │  SCENE_ANALYSIS  │                           │
                    └──────┬───────────┘                           │
                           │ Gemini API returns                    │
                           │ Confidence score computed             │
                           ▼                                        │
               ┌───────────┼────────────────┐                     │
               │           │                │                      │
          Score < 5    Score 5–7       Score ≥ 7                   │
               │           │                │                      │
               ▼           ▼                ▼                      │
          FALSE_ALARM  10s wait       EMERGENCY_CONFIRMED           │
               │           │                │                      │
               │      2nd Gemini            ▼                      │
               │       check           NOTIFYING                   │
               │           │                │                      │
               │      ┌────┴─────┐          ▼                      │
               │   Score<5  Score≥5  POST_INCIDENT_MONITORING      │
               │      │      │          │                           │
               └──────┴──────┘          └───────────────────────────┘
                  FALSE_ALARM            (after 3 checks or manual reset)
```

---

## Component Architecture

```
App
├── ErrorBoundary (global)
│   ├── Header
│   ├── Dashboard
│   │   └── SensorGraph (canvas)
│   ├── ErrorBoundary (local)
│   │   └── MonitoringStatus
│   ├── ErrorBoundary (local)
│   │   └── IncidentTimeline
│   └── EmergencyContactForm
├── AlertCountdown (overlay)
├── Camera Simulation Overlay (conditional)
└── SMS Preview Overlay (conditional)
```

---

## Data Flow

```
DeviceMotionEvent
    │
    ▼
useAccelerometer.ts
    │ magnitude (m/s²)
    ▼
useAgentStore (Zustand)
    │ currentMagnitude, accelerometerHistory
    │
    ├──► SensorGraph (canvas render)
    │
    └──► useAgentLoop.ts
              │ IMPACT_DETECTED trigger
              ▼
         useCamera.ts
              │ base64 JPEG frame
              ▼
         resqAgent.ts
              │
              ├── calculateAccelerometerScore()
              │      accelScore (0–10)
              │
              ├── geminiService.ts → Gemini Vision API
              │      visionScore (0–10)
              │
              ├── calculateFusedConfidence()
              │      finalScore = 0.4×accel + 0.6×vision
              │
              └── classifyConfidenceScore()
                     │
                     ├── DISPATCH → notificationService.ts → Twilio/mailto
                     ├── PROGRESSIVE_CHECK → 10s delay → second analysis
                     └── FALSE_ALARM → return to MONITORING
```

---

## Services Layer

| Service | Responsibility | External Dependencies |
|---------|---------------|----------------------|
| `geminiService.ts` | Vision API calls, response parsing | Google Gemini API |
| `notificationService.ts` | SMS dispatch, fallback alerts | Twilio REST API |
| `incidentLogger.ts` | Incident record persistence | IndexedDB |
| `locationService.ts` | GPS formatting, Maps links | None (pure functions) |

---

## State Store Schema

The Zustand store (`agentStore.ts`) is the single source of truth:

```typescript
{
  // Machine state
  agentState: AgentState;
  appMode: 'ACTIVE' | 'SILENT';

  // Sensor data
  coordinates: GPSCoordinates;
  currentMagnitude: number;
  accelerometerHistory: number[];      // Rolling 50-point history

  // Incident data
  logs: IncidentLog[];                 // Prepended (newest first)
  currentIncidentId: string | null;
  activeAnalysisResult: GeminiResponse | null;
  confidenceScore: ConfidenceScore | null;
  countdownSeconds: number;

  // User config (localStorage-backed)
  contacts: EmergencyContact[];
  userProfile: UserProfile;
}
```

---

## Multi-Modal Confidence Fusion

```
finalScore = (ACCEL_WEIGHT × accelScore) + (VISION_WEIGHT × visionScore)
           = (0.4 × accelScore) + (0.6 × visionScore)

Scoring zones:
  ≥ 7.0   → DISPATCH          (emergency confirmed, alerts sent)
  5.0–6.9 → PROGRESSIVE_CHECK  (borderline, second analysis after 10s)
  < 5.0   → FALSE_ALARM        (scene assessed as safe)
```

The 60/40 split intentionally weights vision more heavily than sensor data. This reduces false positives from events like phone drops or bumpy roads that register high G-force but are visually benign.

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | React + Vite | 18.x / 5.x |
| Language | TypeScript | 5.x (strict mode) |
| State | Zustand | 4.x |
| AI Model | Gemini 1.5 Flash | via REST API |
| SMS | Twilio REST API | v2010-04-01 |
| Persistence | IndexedDB | Browser native |
| PWA | Service Worker | Workbox-free |
| Testing | Vitest + JSDOM | 2.x |
| Linting | ESLint + TypeScript-ESLint | 8.x |
| Formatting | Prettier | 3.x |

---

## Security Considerations

- API keys are stored as `VITE_*` environment variables, not in source code
- Gemini API calls go directly from the browser — no backend server required
- Camera frames are not stored on disk — they are base64-encoded, sent to Gemini, then discarded
- IndexedDB incident records contain only log text, not image data
- All sensor access requires explicit browser permission grants
