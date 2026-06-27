# Changelog

All notable changes to ResQ are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] — 2026-06-27 · Hackathon Enhancement Release

### Added

#### Core Intelligence
- **Multi-Modal Confidence Fusion** — `calculateFusedConfidence()` combines accelerometer severity (40%) and Gemini Vision emergency score (60%) into a weighted confidence score (0–10)
- **Progressive Scene Monitoring** — For borderline scores (5.0–7.0), ResQ waits 10 seconds and performs a second Gemini analysis before dispatching
- **Explainable AI Incident Reports** — `generateIncidentReport()` produces a structured record with full reasoning chain
- **Silent Mode** — New `AppMode` type (`ACTIVE | SILENT`). Auto-proceeds through countdown without UI interaction
- **Accelerometer Score Formula** — `calculateAccelerometerScore()` piecewise linear severity scale

#### Services
- `geminiService.ts` — Exported `parseGeminiResponse()` as pure unit-testable function; added `isApiKeyConfigured()` validator
- `notificationService.ts` — Added `composeSmsText()` pure helper and `hasTwilioCredentials()` validator
- `incidentLogger.ts` — Added `getIncident(id)` and `deleteIncident(id)` functions
- `locationService.ts` — Added `hasValidCoordinates()` validation function

#### Components
- `ErrorBoundary.tsx` — Class-based React error boundary with reset handler
- `SensorGraph.tsx` — Extracted canvas graph with filled area under curve and threshold markers
- Silent Mode toast indicator in `AlertCountdown.tsx`
- Confidence fusion score panel in `MonitoringStatus.tsx`
- App mode toggle (Active/Silent) in `Dashboard.tsx`
- Phone number validation with inline error in `EmergencyContactForm.tsx`

#### Infrastructure
- `src/utils/logger.ts` — Structured logging with level filtering and module scoping
- `src/config/constants.ts` — 30+ centralised constants with SCREAMING_SNAKE_CASE naming
- `src/types/index.ts` — New types: `AppMode`, `ConfidenceScore`, `SceneAnalysisAttempt`, `IncidentReport`
- `.eslintrc.json` — TypeScript-ESLint with floating promise detection
- `.prettierrc` — Consistent formatting rules
- `vitest.config.ts` — JSDOM environment with coverage

#### Testing
- `tests/unit/impactDetection.test.ts` — 9 tests
- `tests/unit/geminiParser.test.ts` — 11 tests
- `tests/unit/agentStateMachine.test.ts` — 12 tests
- `tests/integration/agentFlow.test.ts` — 8 end-to-end pipeline tests
- `tests/setup.ts` — Mocks for IndexedDB, localStorage, geolocation, DeviceMotionEvent

#### Tooling
- `scripts/simulate-accident.ts` — CLI confidence fusion tester
- `public/sw.js` — Service worker with network-first caching and push notifications
- `public/manifest.json` — Complete PWA manifest with all icon sizes

#### Documentation
- `README.md` — Full overhaul with architecture flow diagram
- `docs/ARCHITECTURE.md` — State machine diagram, data flow, store schema
- `CONTRIBUTING.md` — Conventional Commits, PR checklist, code standards
- `CHANGELOG.md` — This file

### Changed

- All `console.*` calls replaced with `createModuleLogger()` throughout codebase
- `tsconfig.json` — Added `noImplicitReturns`, path aliases
- `resqAgent.ts` — Full rewrite with pure exported functions, progressive monitoring, incident reports
- `agentStore.ts` — Added `appMode`, `confidenceScore` fields
- `useAccelerometer.ts` — Exported `calculateImpactMagnitude` and `compensateGravity` for testing
- `App.tsx` — ErrorBoundary wrapping, void-prefixed async handler

### Fixed

- GPS watch IDs not cleared on component unmount
- Camera tracks not stopped before opening a new stream (resource leak)
- Audio context not closed on alert cancellation (resource leak)

---

## [1.0.0] — 2026-06-26 · Initial Hackathon Submission

### Added
- Basic accelerometer impact detection with DeviceMotionEvent
- Gemini Vision API integration for scene analysis
- Emergency alert dispatch via Twilio SMS
- GPS location tracking with Google Maps links
- IndexedDB incident log persistence
- React + Zustand state management
- Simulation mode for desktop demonstration
