# ResQ Implementation Plan (Phased Checklist)

This document contains the detailed phased implementation plan for the **ResQ** Emergency Response Agent application.

---

## Phased Build Checklist

### Phase 1: Planning and Documentation
- [x] Write `README.md`
- [x] Write `ARCHITECTURE.md`
- [ ] Write project-level copy of `IMPLEMENTATION_PLAN.md`
- [ ] Write `TECH_STACK.md`
- [ ] Write `GEMINI_PROMPTS.md`
- [ ] Write `API_INTEGRATION.md`
- [ ] Write `.env.example`

### Phase 2: Project Scaffold & Store Setup
- [ ] Set up `package.json` with React, TypeScript, Zustand, Lucide-React, and Vite plugins (HTTPS basic-ssl).
- [ ] Set up `vite.config.ts` to run HTTPS dev server (necessary for sensor/camera Web APIs).
- [ ] Create `public/manifest.json` for PWA registration.
- [ ] Create standard TypeScript interfaces and model types in `src/types/index.ts`.
- [ ] Implement global state management in `src/store/agentStore.ts`.

### Phase 3: Accelerometer & Impact Detection
- [ ] Implement `useAccelerometer.ts` listening to `devicemotion`.
- [ ] Implement magnitude calculation: $\sqrt{x^2 + y^2 + z^2}$ with gravity compensation or raw force monitoring.
- [ ] Build threshold spike checker ($> 25\text{ m/s}^2$) sustained for $200\text{ms}$.
- [ ] Add debounce/cooldown mechanism to prevent double-triggers.

### Phase 4: Camera Capture on Trigger
- [ ] Implement `useCamera.ts` hook utilizing `navigator.mediaDevices.getUserMedia`.
- [ ] Handle automatic track initiation, canvas capture, conversion to base64, and track shutdown.
- [ ] Implement permissions handler showing custom dialog instructions.

### Phase 5: Gemini Vision API Integration
- [ ] Implement `geminiService.ts` targeting Google Gemini 1.5 Flash endpoint.
- [ ] Handle sending base64 images and JSON system prompt instructions.
- [ ] Write parsing rules for JSON response structure containing scoring metrics.

### Phase 6: AI Reasoning Agent
- [ ] Implement `resqAgent.ts` core controller.
- [ ] Tie together sensor input, camera grab, and Gemini response evaluations.
- [ ] Establish logical transition thresholds for the agent pipeline.

### Phase 7: GPS Location Capture
- [ ] Implement `useGPS.ts` hooking into `navigator.geolocation`.
- [ ] Update state store with active coordinate updates.
- [ ] Implement Google Maps link helper formatting inside `locationService.ts`.

### Phase 8: Emergency Notification Services
- [ ] Implement `notificationService.ts` executing REST triggers to Twilio Gateway.
- [ ] Set up fallback link generator utilizing `mailto:` and `tel:` protocols with pre-filled SMS/mail templates.

### Phase 9: Incident Timeline Logging
- [ ] Implement `incidentLogger.ts` utilising IndexedDB API for persistent storage.
- [ ] Add event logger hooks inside state changes to capture full agent audits.

### Phase 10: UI, Countdown & Polish
- [ ] Implement dark-themed dashboard UI showing real-time accelerometer readings on canvas.
- [ ] Build `AlertCountdown.tsx` modal overlay with sound and bright warnings.
- [ ] Compile, run strict TS builds, and test on actual devices.
