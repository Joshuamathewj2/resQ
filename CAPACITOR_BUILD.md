# ResQ — Capacitor Android Build Reference

This document outlines the developer workflow, setup instructions, and build commands for deploying the ResQ application onto a native Android device.

---

## 1. Prerequisites

Before building for Android, ensure you have:
- **Node.js** ≥ 18 and **npm** ≥ 9
- **Android Studio** installed (with SDK API 33+)
- A physical Android device with USB debugging enabled, or an Android Virtual Device (AVD) emulator configured.

---

## 2. Developer Workflow & Build Commands

Run the following commands in the project root:

### Step 1 — Clean Build the React SPA
Builds the production bundle into the `dist/` directory:
```bash
npm run build
```

### Step 2 — Sync Assets to native platform
Copies compiled assets and syncs Capacitor plugins to the Android project directory:
```bash
npx cap sync android
```

### Step 3 — Run directly on a connected device
Spins up the build pipeline, compiles the APK, and deploys it to your connected device:
```bash
npx cap run android
```

---

## 3. Reference Commands

| Command | Action |
|---------|--------|
| `npx cap sync android` | Syncs assets after code changes (run after `npm run build`) |
| `npx cap open android` | Opens the native Android project in Android Studio |
| `npx cap run android --list` | Lists all connected debug devices and active emulators |
| `npx cap run android --target=<device-id>` | Deploys explicitly to a specific device ID |

---

## 4. Background Monitoring (Foreground Service)

ResQ runs a sticky Android foreground service (`ResQForegroundService.java`) which keeps the CPU awake and allows continuous sensor monitoring when the app is backgrounded.

- The service displays a persistent notification title: **ResQ Active**
- Foreground service types requested: `location` and `camera`
- Custom start/stop commands can be sent using the Capacitor `BackgroundService` plugin bridge.
