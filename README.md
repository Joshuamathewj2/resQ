# ResQ: AI-Powered Autonomous Emergency Response Agent

ResQ is a mobile-first Progressive Web App (PWA) designed to transform a standard smartphone into an intelligent, autonomous emergency response agent. It silently monitors device accelerometer telemetry during travel, detects high-impact forces indicative of vehicular or personal accidents, activates the device camera to analyze the scene using Google's Gemini Vision API, and uses grounded AI reasoning to decide whether to dispatch an autonomous emergency alert to saved contacts.

---

## 🚨 Problem Statement

Every year, millions of motor vehicle accidents and personal falls result in severe injuries or fatalities due to delayed emergency response. In many scenarios, victims are rendered unconscious, trapped, or too disoriented to call for help manually. 

Existing automatic crash notification systems (like Apple's Crash Detection or specialized OBD-II dongles) can be prone to false positives (e.g., dropping a phone, heavy braking, sports activities) and are closed-source or device-locked. False positives strain emergency response networks, while false negatives put lives at risk.

## 💡 The ResQ Solution

ResQ introduces a multi-stage validation pipeline that combines **physical telemetry** with **visual/contextual reasoning**:

1. **Physical Telemetry (Sensors)**: Continuously records accelerometer magnitude. If a threshold of `> 25 m/s²` is sustained for more than `200ms`, an impact event is triggered.
2. **Visual Verification (AI Vision)**: Activates the rear camera to capture base64 frames of the scene.
3. **Reasoning Agent (Gemini 1.5 Flash)**: Processes the captured image and ambient data. It evaluates whether the user is injured, lying down, moving, receiving help, or if the scene indicates a false alarm (e.g., phone dropped in a car cup holder).
4. **Pre-Notification Countdown**: Triggers a loud, highly visible 30-second cancellation window, allowing the user to manually cancel the alert if they are safe.
5. **Autonomous Dispatch**: If the countdown expires OR if the AI confirms a high-confidence emergency, the agent sends an SMS with exact GPS coordinates (Google Maps link) and AI incident summary to emergency contacts, followed by a voice call fallback request.

---

## 🏗️ Architecture Overview

```
                     ┌───────────────────────────┐
                     │    Mobile Browser PWA     │
                     └─────────────┬─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Sensor Layer   │       │   Camera Hook   │       │    GPS Hook     │
│ (Accelerometer) │       │  (getUserMedia) │       │ (Geolocation)   │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │ Resultant Force         │ Base64 Image            │ Lat/Lng Coords
         ▼                         ▼                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Zustand State Store                           │
│     (IDLE -> MONITORING -> IMPACT -> ANALYZING -> NOTIFYING)        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            ResQ Agent                               │
│  (Orchestrates Gemini Vision + Locates Contacts + Sends Alerts)    │
└────────────────┬───────────────────────────────────┬────────────────┘
                 │                                   │
                 ▼                                   ▼
┌─────────────────────────────────┐ ┌─────────────────────────────────┐
│       Gemini Vision API         │ │      Twilio SMS / Fallback      │
│  (Scene Analysis & Reasoning)   │ │      (Emergency Dispatch)       │
└─────────────────────────────────┘ └─────────────────────────────────┘
```

---

## 🛠️ Tech Stack

- **Frontend Core**: React 18, TypeScript, Vite
- **Styling**: Modern CSS (featuring dark mode, glassmorphism, responsive grid, dynamic telemetry graphs)
- **State Management**: Zustand
- **AI Core**: Google Gemini 1.5 Flash API
- **Location**: HTML5 Geolocation API (formatted to Google Maps links)
- **Sensor Telemetry**: Web DeviceMotionEvent API
- **Notifications**: Twilio SMS API with mailto/tel fallback anchor protocols
- **Local Storage**: IndexedDB (via custom logger) for persistent local timeline audit logs, and `localStorage` for emergency contact info.

---

## ⚙️ Configuration & Setup

### Prerequisites
- Node.js (v18 or higher)
- A Google Gemini API Key (obtain from Google AI Studio)
- (Optional) Twilio Account SID, Auth Token, and a Twilio phone number. If omitted, the application falls back to direct `mailto:` and `tel:` protocols.

### Environment Setup
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_TWILIO_ACCOUNT_SID=your_twilio_sid_here
VITE_TWILIO_AUTH_TOKEN=your_twilio_token_here
VITE_TWILIO_PHONE_NUMBER=your_twilio_phone_number_here
```

### Installation
```bash
npm install
```

### Development Server
Run Vite's HTTPS enabled dev server:
```bash
npm run dev
```

*Note: Since browsers require HTTPS to grant access to cameras and device motion sensors, the dev server is configured to automatically run with local HTTPS capability using `@vitejs/plugin-basic-ssl`.*

---

## 📱 Demo Workflow

1. **Configure Emergency Contacts**: Open the app and fill in the Emergency Contact form.
2. **Start Monitoring**: Tap "Start Monitoring". The system status changes to `MONITORING`, displaying live accelerometer data on a canvas graph.
3. **Simulate Impact**: Click the **"Simulate Impact"** button in the dashboard (to simulate an accident on devices without an accelerometer, like desktops).
4. **Cancellation Window**: The alert countdown starts (30s) with an audible alarm indicator and screen flash.
5. **AI Vision Analysis**: The camera automatically triggers, captures a frame, and sends it to the Gemini 1.5 Flash model.
6. **Decision & Timeline**: The AI's JSON assessment (injury likelihood, status, reasoning) is output to the live Incident Timeline in real-time.
7. **Dispatch**: If the countdown expires or the score is high, an alert is sent, displaying notification status and triggering fallback contact triggers.
