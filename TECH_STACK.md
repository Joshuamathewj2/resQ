# ResQ Tech Stack Choices & Justifications

This document explains and justifies the technology stack selected for the **ResQ** emergency response agent.

---

## 1. Core Framework: React 18 + TypeScript (PWA)

* **Why React**: Highly reusable component model, fast updates, and rich ecosystem. React allows us to build a rich visual interface (telemetry graphs, active countdowns, timeline history) easily.
* **Why TypeScript**: Crucial for defining strict type-safety around complex sensor data payloads, agent states, Gemini Vision responses, and persistent IndexedDB log models.
* **Why PWA (Vite)**: 
  - PWAs can access native hardware APIs (camera, accelerometer, GPS) direct from mobile browsers without the build/signing overhead of native mobile apps.
  - Can be added directly to the Android/iOS home screen.
  - Highly portable, allowing quick local demos via standard browsers.

---

## 2. AI Vision: Google Gemini 1.5 Flash

* **Why 1.5 Flash**: Optimized for speed, low latency, and multimodal capabilities. In emergency response scenarios, response latency is critical. 
* **Vision & Reasoning in One Call**: Gemini 1.5 Flash natively accepts base64 media context combined with text commands, permitting scene evaluation (detecting injury, unconsciousness, vehicle damage) and multi-step reasoning in a single API round-trip.
* **Cost & Throughput**: Extremely economical, making it ideal for continuous polling or frequent incident checks.

---

## 3. Sensor Layer: HTML5 Sensor APIs

* **DeviceMotionEvent (Web Sensor API)**: Native browser standard to access raw accelerometer (X, Y, Z axes, including or excluding gravity). Readily available on modern mobile browsers.
* **Navigator Geolocation**: Browser native API that leverages a combination of GPS, Cell ID, and Wi-Fi triangulation to return high-accuracy coordinates.

---

## 4. Notification Layer: Twilio SMS & Protocol Fallbacks

* **Twilio SMS**: Standard carrier-independent dispatch solution. Delivers SMS alerts with location hyperlinks directly to preconfigured emergency contacts.
* **Anchored Fallback URI Protocols (`tel:`, `mailto:`)**: In situations where Twilio credentials are not active or the user lacks cellular data connection, the application falls back to standard client protocols:
  - `tel:112` or contact's phone number to quickly trigger direct phone dialing.
  - `mailto:` to populate an email client with pre-formatted location coordinates and AI assessment logs.

---

## 5. State Management & Persistent Storage

* **Zustand**: A lightweight, fast state management library. Extremely straightforward to integrate with React hooks, avoids boilerplate, and easily coordinates the state machine (`IDLE` $\rightarrow$ `MONITORING` $\rightarrow$ `IMPACT_DETECTED` $\rightarrow$ `NOTIFYING`).
* **IndexedDB (via custom wrapper)**: Local browser storage that supports complex objects and files. Perfect for maintaining a permanent audit log of incidents (which includes base64 image snapshots, GPS tracks, and AI JSON reasoning reports) without external database costs.
* **localStorage**: Simple key-value storage used to persist user profile options and emergency contact information locally.
