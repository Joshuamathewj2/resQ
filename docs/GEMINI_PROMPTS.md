# ResQ — Gemini Prompts Reference

This document describes all Gemini API prompts used in the ResQ system, including the expected JSON output schema and example responses.

---

## 1. Primary Scene Analysis Prompt

**Function:** `analyzeScene()` in `src/services/geminiService.ts`  
**Model:** `gemini-1.5-flash`  
**Temperature:** `0.1` (deterministic, for safety-critical decisions)  
**Trigger:** Immediately after a camera frame is captured post-impact

### System Instruction

```
You are the visual cortex of an AI autonomous emergency response system called ResQ.
Your goal is to inspect a camera frame captured immediately following a high-impact event
(such as a vehicle collision or a personal fall) and evaluate the immediate safety of the user.

Analyze the image carefully for physical evidence:
- Is a person visible?
- Are they standing, walking, sitting, or lying on the ground/road?
- Do they appear to be injured, bleeding, unconscious, or trapped?
- Are there emergency responders or bystanders helping them?
- Is there evidence of vehicle crash damage (airbags deployed, smashed glass, bent metal)?
- Or does the scene suggest a false alarm (e.g. phone dropped on a floor mat, dark pocket)?

You MUST respond in strict JSON format using the schema below.
Do NOT include markdown code block formatting or any text outside the JSON object.
```

### User Prompt (dynamically composed)

```
Analyze this post-impact camera frame. The user was subjected to a physical impact force of {impactForce} m/s².
Current GPS location coordinates: Latitude={latitude}, Longitude={longitude}.

Inspect the scene and determine if the user is in danger, unconscious, lying down, or if this is a false alarm.
Return a strict JSON response conforming to the system instruction schema.
```

### Expected JSON Response Schema

```json
{
  "personVisible": boolean,
  "personStatus": "standing" | "walking" | "sitting" | "lying_down" | "unconscious" | "not_visible" | "injured" | "unknown",
  "injuryLikelihood": "none" | "low" | "medium" | "high",
  "apparentDanger": "none" | "low" | "medium" | "high",
  "emergencyScore": number,
  "visualObservations": "string describing visible evidence",
  "reasoning": "step-by-step logic for the score"
}
```

### `emergencyScore` Guidelines

| Score | Meaning |
|-------|---------|
| 0–2 | Safe — phone dropped, device bump, no person visible |
| 3–4 | Low concern — person visible, standing, no injury signs |
| 5–6 | Borderline — person sitting/disoriented, unclear scene |
| 7–8 | Emergency — person lying down, appears injured |
| 9–10 | Critical — person unconscious, severe crash evidence |

### Example Response (High Severity)

```json
{
  "personVisible": true,
  "personStatus": "unconscious",
  "injuryLikelihood": "high",
  "apparentDanger": "high",
  "emergencyScore": 9,
  "visualObservations": "Rider lying motionless on asphalt. Helmet on but no movement. Vehicle debris visible in frame. No bystanders assisting.",
  "reasoning": "Impact telemetry of 31.2 m/s² combined with visual evidence of an unconscious prone person on a road surface strongly indicates a serious collision requiring immediate emergency response."
}
```

### Example Response (False Alarm)

```json
{
  "personVisible": true,
  "personStatus": "standing",
  "injuryLikelihood": "none",
  "apparentDanger": "none",
  "emergencyScore": 1,
  "visualObservations": "User is standing upright in what appears to be an indoor environment. Phone is likely in hand. No hazards visible.",
  "reasoning": "Despite elevated accelerometer reading, scene shows no physical injury indicators. User appears alert and upright. Likely a phone drop or running impact."
}
```

---

## 2. Simulation Scene Analysis Prompt

**Function:** `analyzeSimulationScene()` in `src/services/geminiService.ts`  
**Model:** `gemini-1.5-flash`  
**Temperature:** `0.1`  
**Trigger:** When "Simulate Impact" demo button is clicked

### Prompt

```
SIMULATION MODE: A motorcycle rider has just experienced a high-impact collision event (31.2 m/s²).
The rider is lying motionless on the road. Helmet is on but the rider is not moving.
Another vehicle has stopped nearby.

Analyze this scene and return ONLY this JSON:
{
  "personStatus": "unconscious" | "standing" | "walking" | "injured" | "unknown",
  "injuryLikelihood": "high" | "medium" | "low" | "none",
  "emergencyScore": number (0-10),
  "reasoning": "string (2-3 sentences)",
  "recommendation": "EMERGENCY_CONFIRMED" | "FALSE_ALARM"
}
```

---

## 3. Post-Incident Monitoring Prompt

**Function:** `analyzeSimulationMonitoring()` in `src/services/geminiService.ts`  
**Model:** `gemini-1.5-flash`  
**Temperature:** `0.7` (higher — allows narrative variety)  
**Trigger:** Every 10 seconds during `POST_INCIDENT_MONITORING` state (simulation mode)

### Prompt

```
MONITORING MODE: Emergency services have been alerted after a motorcycle collision.
Describe the current scene status. Has anything changed? Generate a realistic update.
Return ONLY this JSON: { "situationUpdate": "string", "helpArrived": boolean, "continueMonitoring": boolean }
```

### Example Responses

**Cycle 1 (help not yet arrived):**
```json
{
  "situationUpdate": "A bystander is kneeling next to the rider, checking for responsiveness. No emergency vehicles visible yet.",
  "helpArrived": false,
  "continueMonitoring": true
}
```

**Cycle 2 (help arrived):**
```json
{
  "situationUpdate": "An ambulance has arrived at the scene. Two paramedics are performing initial trauma assessment on the rider.",
  "helpArrived": true,
  "continueMonitoring": true
}
```

**Cycle 3 (scene stabilised):**
```json
{
  "situationUpdate": "The rider has been stabilised and loaded into the ambulance. Police are managing traffic. Scene is under control.",
  "helpArrived": true,
  "continueMonitoring": false
}
```

---

## Response Parsing

All Gemini responses are parsed by the `parseGeminiResponse()` pure function in `geminiService.ts`:

```typescript
export function parseGeminiResponse(rawText: string): GeminiResponse {
  // 1. Validates non-empty input
  // 2. JSON.parse with full type casting
  // 3. Validates required fields (personStatus, injuryLikelihood, emergencyScore, reasoning)
  // 4. Clamps emergencyScore to [0, 10]
  // 5. Returns typed GeminiResponse object
}
```

The function is exported as a pure function and covered by 11 unit tests in `tests/unit/geminiParser.test.ts`.

---

## Fallback Behaviour

If no API key is configured (`VITE_GEMINI_API_KEY` not set or set to placeholder):

| Scenario | Mock Response |
|----------|--------------|
| `analyzeScene()` with impact > 30 m/s² | Score 8, status: `lying_down`, high severity |
| `analyzeScene()` with impact ≤ 30 m/s² | Score 2, status: `standing`, no injury |
| `analyzeSimulationScene()` | Score 9, status: `unconscious`, `EMERGENCY_CONFIRMED` |
| `analyzeSimulationMonitoring()` | Randomly cycles through 3 narrative stages |
