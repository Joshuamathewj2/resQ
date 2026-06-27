/**
 * @file src/services/geminiService.ts
 * @description Gemini Vision API client for ResQ scene analysis.
 *
 * Provides three functions for querying Google's Gemini 1.5 Flash model:
 * 1. `analyzeScene`  — Primary scene analysis with image payload
 * 2. `analyzeSimulationScene` — Text-only scene description for simulation mode
 * 3. `analyzeSimulationMonitoring` — Post-incident situational updates
 *
 * A pure `parseGeminiResponse` function is exported for unit testing.
 */

import {
  GEMINI_API_URL,
  GEMINI_SCENE_TEMPERATURE,
  GEMINI_MONITORING_TEMPERATURE,
} from '../config/constants';
import { GeminiResponse } from '../types';
import { createModuleLogger } from '../utils/logger';

const log = createModuleLogger('GeminiService');

// ─────────────────────────────────────────────────────────────────────────────
// PROMPT TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/** System instruction given to Gemini to define its role and output schema. */
const SCENE_ANALYSIS_SYSTEM_INSTRUCTION = `
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

JSON Response Schema:
{
  "personVisible": boolean,
  "personStatus": "standing" | "walking" | "sitting" | "lying_down" | "unconscious" | "not_visible" | "injured" | "unknown",
  "injuryLikelihood": "none" | "low" | "medium" | "high",
  "apparentDanger": "none" | "low" | "medium" | "high",
  "emergencyScore": number (0-10, where 0=completely safe, 10=critical emergency),
  "visualObservations": "string describing all visible evidence",
  "reasoning": "step-by-step logic used to determine the emergencyScore"
}
`.trim();

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS (unit-testable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses and validates a raw JSON string from Gemini into a typed GeminiResponse.
 *
 * This is a pure function with no side effects, designed to be unit-testable.
 * It validates required fields and clamps the emergencyScore to [0, 10].
 *
 * @param rawText - The raw text string from the Gemini API response
 * @returns Validated and typed GeminiResponse object
 * @throws {SyntaxError} If the text is not valid JSON
 * @throws {Error} If required fields are missing from the parsed object
 *
 * @example
 * ```ts
 * const response = parseGeminiResponse('{"personStatus":"lying_down","injuryLikelihood":"high","emergencyScore":8,"reasoning":"..."}');
 * ```
 */
export function parseGeminiResponse(rawText: string): GeminiResponse {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('parseGeminiResponse: received empty response text from Gemini API');
  }

  const parsed = JSON.parse(trimmed) as Record<string, unknown>;

  // Validate required fields
  if (typeof parsed['personStatus'] !== 'string') {
    throw new Error('parseGeminiResponse: missing required field "personStatus"');
  }
  if (typeof parsed['injuryLikelihood'] !== 'string') {
    throw new Error('parseGeminiResponse: missing required field "injuryLikelihood"');
  }
  if (typeof parsed['emergencyScore'] !== 'number') {
    throw new Error('parseGeminiResponse: missing or non-numeric field "emergencyScore"');
  }
  if (typeof parsed['reasoning'] !== 'string') {
    throw new Error('parseGeminiResponse: missing required field "reasoning"');
  }

  // Clamp emergencyScore to valid range [0, 10]
  const clampedScore = Math.max(0, Math.min(10, parsed['emergencyScore']));

  return {
    personVisible: typeof parsed['personVisible'] === 'boolean' ? parsed['personVisible'] : undefined,
    personStatus: parsed['personStatus'] as GeminiResponse['personStatus'],
    injuryLikelihood: parsed['injuryLikelihood'] as GeminiResponse['injuryLikelihood'],
    apparentDanger: (parsed['apparentDanger'] as GeminiResponse['apparentDanger']) ?? undefined,
    emergencyScore: clampedScore,
    visualObservations: typeof parsed['visualObservations'] === 'string'
      ? parsed['visualObservations']
      : undefined,
    reasoning: parsed['reasoning'],
    recommendation: (parsed['recommendation'] as GeminiResponse['recommendation']) ?? undefined,
  };
}

/**
 * Checks whether a Gemini API key is configured and not a placeholder value.
 *
 * @param apiKey - The API key string to validate
 * @returns true if the key appears to be a real configured key
 */
export function isApiKeyConfigured(apiKey: string | undefined): apiKey is string {
  return Boolean(apiKey) && apiKey !== 'your_gemini_api_key_here';
}

// ─────────────────────────────────────────────────────────────────────────────
// MOCK RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a mock GeminiResponse for demo/development use when no API key is set.
 *
 * @param impactForce - The measured impact magnitude in m/s²
 * @returns Simulated scene analysis result based on impact severity
 */
function getMockResponse(impactForce: number): GeminiResponse {
  const isHighForce = impactForce > 30;
  return {
    personVisible: true,
    personStatus: isHighForce ? 'lying_down' : 'standing',
    injuryLikelihood: isHighForce ? 'high' : 'none',
    apparentDanger: isHighForce ? 'high' : 'none',
    emergencyScore: isHighForce ? 8 : 2,
    visualObservations: isHighForce
      ? 'User appears to be lying horizontally on the ground near debris. Rear camera snapshot is blurry but suggests collision.'
      : 'User is visible, standing upright, holding the phone. No immediate structural damage or injuries visible.',
    reasoning: `[MOCK] Impact magnitude registered ${impactForce.toFixed(1)} m/s². Simulated vision model confirms user status aligns with impact telemetry.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Primary scene analysis function. Sends a camera frame and contextual data
 * to Gemini Vision API and returns a structured scene assessment.
 *
 * Falls back to a mock response if:
 * - No API key is configured
 * - The API returns a non-200 status
 * - The response cannot be parsed as valid JSON
 *
 * @param base64Image - Raw base64-encoded JPEG image data (without data: prefix)
 * @param impactForce - Measured impact magnitude in m/s² at time of capture
 * @param coordinates - GPS coordinates at time of capture (may be null if unavailable)
 * @returns Parsed scene assessment from Gemini, or mock response on failure
 *
 * @example
 * ```ts
 * const result = await analyzeScene(base64Data, 31.2, { latitude: 12.97, longitude: 80.22 });
 * if (result.emergencyScore >= 7) { // emergency confirmed }
 * ```
 */
export const analyzeScene = async (
  base64Image: string,
  impactForce: number,
  coordinates: { latitude: number | null; longitude: number | null }
): Promise<GeminiResponse> => {
  // Input validation
  if (!base64Image || base64Image.length < 100) {
    log.warn('analyzeScene called with empty or too-short image data. Using mock response.');
    return getMockResponse(impactForce);
  }

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!isApiKeyConfigured(apiKey)) {
    log.warn('Gemini API key not configured. Returning mock scene analysis for demo.');
    return getMockResponse(impactForce);
  }

  const promptText = `
Analyze this post-impact camera frame. The user was subjected to a physical impact force of ${impactForce.toFixed(2)} m/s².
Current GPS location coordinates: Latitude=${coordinates.latitude ?? 'Unknown'}, Longitude=${coordinates.longitude ?? 'Unknown'}.

Inspect the scene and determine if the user is in danger, unconscious, lying down, or if this is a false alarm.
Return a strict JSON response conforming to the system instruction schema.
  `.trim();

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            ],
          },
        ],
        systemInstruction: { parts: [{ text: SCENE_ANALYSIS_SYSTEM_INSTRUCTION }] },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: GEMINI_SCENE_TEMPERATURE,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const textResult = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;

    if (!textResult) {
      throw new Error('Gemini response contained no text content in expected path');
    }

    return parseGeminiResponse(textResult);
  } catch (error) {
    log.error('Gemini Vision API request failed. Falling back to mock response.', error);
    return getMockResponse(impactForce);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION-SPECIFIC API CALLS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Text-only scene analysis for the demo simulation mode.
 * Describes a motorcycle collision scenario and asks Gemini to classify it.
 * Falls back to a hardcoded high-severity mock response if no API key exists.
 *
 * @returns GeminiResponse representing a high-severity collision scenario
 */
export const analyzeSimulationScene = async (): Promise<GeminiResponse> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!isApiKeyConfigured(apiKey)) {
    return {
      personStatus: 'unconscious',
      injuryLikelihood: 'high',
      emergencyScore: 9,
      reasoning:
        '[MOCK] Rider is lying motionless on the highway after a simulated 31.2 m/s² crash event. Mock activation returned high hazard alert.',
      recommendation: 'EMERGENCY_CONFIRMED',
    };
  }

  const systemInstruction =
    'You are ResQ, an AI emergency response agent. Analyze this accident scenario and return ONLY a JSON object matching the schema exactly. No markdown.';

  const promptText = `
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
  `.trim();

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: GEMINI_SCENE_TEMPERATURE,
        },
      }),
    });

    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!text) throw new Error('Empty response from Gemini simulation call');

    return parseGeminiResponse(text);
  } catch (err) {
    log.error('Simulation Gemini call failed, using mock data.', err);
    return {
      personStatus: 'unconscious',
      injuryLikelihood: 'high',
      emergencyScore: 8.5,
      reasoning:
        '[MOCK] Rider is unconscious on the asphalt after a simulated high-speed collision. Vehicle debris is scattered around.',
      recommendation: 'EMERGENCY_CONFIRMED',
    };
  }
};

/** Shape of the periodic monitoring update from Gemini. */
export interface MonitoringFeedUpdate {
  /** Narrative description of the current scene status */
  situationUpdate: string;
  /** Whether emergency responders or help have arrived */
  helpArrived: boolean;
  /** Whether the agent should continue periodic monitoring */
  continueMonitoring: boolean;
}

/**
 * Queries Gemini for a situational update during post-incident monitoring.
 * Returns a dynamic narrative describing how the scene has evolved since dispatch.
 *
 * Falls back to one of three randomly-selected mock scenarios if no API key is set.
 *
 * @returns Structured monitoring update with situational narrative
 */
export const analyzeSimulationMonitoring = async (): Promise<MonitoringFeedUpdate> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

  if (!isApiKeyConfigured(apiKey)) {
    const seed = Math.random();
    if (seed < 0.4) {
      return {
        situationUpdate: 'Bystander is performing initial assessment of the victim. No emergency vehicles visible yet.',
        helpArrived: false,
        continueMonitoring: true,
      };
    } else if (seed < 0.8) {
      return {
        situationUpdate: 'First responder ambulance has arrived on scene. Paramedics are assessing the rider.',
        helpArrived: true,
        continueMonitoring: true,
      };
    } else {
      return {
        situationUpdate: 'Victim has been loaded into ambulance. Scene is stabilizing. Alert concluded.',
        helpArrived: true,
        continueMonitoring: false,
      };
    }
  }

  const promptText = `
MONITORING MODE: Emergency services have been alerted after a motorcycle collision.
Describe the current scene status. Has anything changed? Generate a realistic update.
Return ONLY this JSON: { "situationUpdate": "string", "helpArrived": boolean, "continueMonitoring": boolean }
  `.trim();

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: GEMINI_MONITORING_TEMPERATURE,
        },
      }),
    });

    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
    if (!text) throw new Error('Empty response from Gemini monitoring call');

    return JSON.parse(text.trim()) as MonitoringFeedUpdate;
  } catch (err) {
    log.error('Monitoring Gemini call failed, using mock data.', err);
    return {
      situationUpdate: 'Ambulance is visible in the distance. Paramedics are preparing equipment.',
      helpArrived: true,
      continueMonitoring: true,
    };
  }
};
