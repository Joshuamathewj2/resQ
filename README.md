# ResQ — AI Autonomous Emergency Response Agent

<div align="center">

![ResQ Banner](https://img.shields.io/badge/ResQ-Emergency%20AI%20Agent-red?style=for-the-badge&logo=shield&logoColor=white)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Gemini](https://img.shields.io/badge/Gemini-1.5%20Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-green?style=flat-square)](https://web.dev/progressive-web-apps/)
[![Tests](https://img.shields.io/badge/Tests-Vitest-6E9F18?style=flat-square&logo=vitest)](https://vitest.dev/)

**ResQ** is an AI-powered Progressive Web App that autonomously detects accidents through smartphone sensors, analyzes crash scenes using multi-modal AI reasoning, and dispatches emergency alerts — all without requiring human input.

[Live Demo](#deployment) · [Architecture](docs/ARCHITECTURE.md) · [API Guide](docs/API_INTEGRATION.md) · [Contributing](CONTRIBUTING.md)

</div>

---

## How It Works

```
Smartphone Accelerometer → Impact Detection → Camera Capture
        ↓                                          ↓
  Sensor Score (40%)                    Gemini Vision Score (60%)
        ↓                                          ↓
        └──────── Multi-Modal Confidence Fusion ───────┘
                              ↓
              ┌───────────────┼───────────────┐
           Score ≥ 7       Score 5–7        Score < 5
              ↓                ↓                ↓
         DISPATCH      PROGRESSIVE_CHECK    FALSE_ALARM
              ↓                ↓
         SMS Alert    10s delay + recheck
```

### Key Innovation: Multi-Modal Confidence Fusion

ResQ does **not** dispatch alerts based on accelerometer force alone. Instead, it fuses two independent signals:

| Signal | Weight | Source |
|--------|--------|--------|
| Accelerometer severity score | 40% | `calculateAccelerometerScore(magnitude)` |
| Gemini Vision emergency score | 60% | AI scene analysis of camera frame |
| **Fused score** | 100% | Dispatch decision threshold: **≥ 7.0 / 10** |

---

## Features

| Feature | Status | Details |
|---------|--------|---------|
| 🔢 Accelerometer Impact Detection | ✅ | Sustained-force algorithm with debounce |
| 🤖 Gemini Vision Scene Analysis | ✅ | `gemini-1.5-flash` with structured JSON output |
| 🔀 Multi-Modal Confidence Fusion | ✅ | Weighted average of sensor + vision scores |
| 🔍 Progressive Monitoring | ✅ | Second Gemini check for borderline scores |
| 📨 Twilio SMS Dispatch | ✅ | Real API or browser mailto/tel fallback |
| 🗺️ GPS Location Tracking | ✅ | Google Maps link in alerts |
| 💾 IndexedDB Audit Trail | ✅ | Full incident log persistence |
| 🔇 Silent Mode | ✅ | Auto-proceed without UI interaction |
| 📈 Post-Incident Monitoring | ✅ | Periodic scene re-checks after dispatch |
| 🛡️ Error Boundaries | ✅ | React error boundaries on all panels |
| 📱 PWA + Service Worker | ✅ | Offline capability, push notifications |
| 🧪 Unit + Integration Tests | ✅ | Vitest with 20+ test cases |
| 📝 TypeScript Strict Mode | ✅ | Zero implicit any, full null safety |

---

## Quick Start

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A mobile device or Chrome DevTools with sensor emulation

### Installation

```bash
git clone https://github.com/Joshuamathewj2/resQ.git
cd resQ
npm install
```

### Environment Setup

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required for AI scene analysis (get from Google AI Studio)
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Twilio SMS dispatch (falls back to mailto if absent)
VITE_TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
VITE_TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
VITE_TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Optional: logging verbosity (debug | info | warn | error | silent)
VITE_LOG_LEVEL=info
```

### Running Locally

```bash
npm run dev
```

> **Note:** Motion sensors require HTTPS. The dev server uses `@vitejs/plugin-basic-ssl` to serve over HTTPS automatically.

Open **https://localhost:5173** on your mobile device or Chrome with sensor simulation enabled.

---

## Architecture Overview

```
src/
├── agents/
│   └── resqAgent.ts           # Core reasoning pipeline (fusion, classification, dispatch)
├── components/
│   ├── AlertCountdown.tsx     # Emergency overlay with countdown ring
│   ├── Dashboard.tsx          # Telemetry console with sensor graph
│   ├── EmergencyContactForm.tsx # Settings: contacts + medical profile
│   ├── ErrorBoundary.tsx      # React error boundary
│   ├── IncidentTimeline.tsx   # Log viewer + IndexedDB archive
│   ├── MonitoringStatus.tsx   # AI analysis panel with confidence scores
│   └── SensorGraph.tsx        # Canvas-based accelerometer graph
├── config/
│   └── constants.ts           # All magic numbers and configuration values
├── hooks/
│   ├── useAccelerometer.ts    # DeviceMotionEvent listener + impact detection
│   ├── useAgentLoop.ts        # Countdown, analysis, post-incident loops
│   ├── useCamera.ts           # Camera stream + frame capture
│   ├── useGPS.ts              # Geolocation watchPosition
│   └── useSimulation.ts       # Desktop demo simulation controller
├── services/
│   ├── geminiService.ts       # Gemini Vision API client
│   ├── incidentLogger.ts      # IndexedDB CRUD
│   ├── locationService.ts     # GPS formatting utilities
│   └── notificationService.ts # Twilio SMS + browser fallback
├── store/
│   └── agentStore.ts          # Zustand global state
├── types/
│   └── index.ts               # All TypeScript interfaces
└── utils/
    └── logger.ts              # Structured logging utility

tests/
├── unit/
│   ├── agentStateMachine.test.ts
│   ├── geminiParser.test.ts
│   └── impactDetection.test.ts
├── integration/
│   └── agentFlow.test.ts
└── setup.ts

scripts/
└── simulate-accident.ts       # CLI confidence fusion tester

public/
├── manifest.json              # PWA manifest (all icon sizes)
└── sw.js                      # Service worker (network-first cache)
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full state machine diagram and data flow.

---

## Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Expected output:
```
 ✓ tests/unit/impactDetection.test.ts (9 tests)
 ✓ tests/unit/geminiParser.test.ts (11 tests)
 ✓ tests/unit/agentStateMachine.test.ts (12 tests)
 ✓ tests/integration/agentFlow.test.ts (8 tests)
```

---

## CLI Simulation

Test the confidence fusion algorithm without a browser:

```bash
# Default: motorcycle collision scenario (31.2 m/s², vision=8.5)
npx tsx scripts/simulate-accident.ts

# Custom: high-force low-vision scenario
npx tsx scripts/simulate-accident.ts --force=28.0 --vision=4.5
```

---

## Demo Simulation (Browser)

1. Open the app in a browser (desktop is fine)
2. Click **Start Monitoring**
3. Click **Simulate Impact**

The simulation walks through the complete pipeline:
- Accelerometer graph spike animation
- Camera activation overlay
- Gemini AI scene analysis (or mock if no API key)
- 30-second cancellation countdown
- Emergency SMS dispatch overlay
- Post-incident monitoring feed

---

## Deployment

The app is a static SPA and can be deployed to any CDN or hosting service:

```bash
npm run build
# → dist/ folder ready for deployment
```

Recommended platforms: Netlify, Vercel, Firebase Hosting, GitHub Pages.

> **HTTPS required** — Motion sensors, camera access, and PWA installation all require a secure context.

---

## API Integration

See [API_INTEGRATION.md](API_INTEGRATION.md) for complete setup guides for:
- **Gemini API** — Google AI Studio key configuration
- **Twilio** — SMS dispatch setup with free trial account
- **Environment variable reference** — all `VITE_*` variables

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Branch naming conventions
- Commit message format (Conventional Commits)
- PR checklist
- Testing requirements

---

## License

MIT © Joshua Mathew J — Built for the Meta AI × Hailbet AI Hackathon 2024.
