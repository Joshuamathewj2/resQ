import { CONFIG } from '../config/constants';
import { GeminiResponse } from '../types';

export const analyzeScene = async (
  base64Image: string,
  impactForce: number,
  coordinates: { latitude: number | null; longitude: number | null }
): Promise<GeminiResponse> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    console.warn('Gemini API key is not set. Falling back to mock scene analysis for demo.');
    return getMockResponse(impactForce);
  }

  const promptText = `
    Analyze this post-impact camera frame. The user was subjected to a physical impact force of ${impactForce.toFixed(2)} m/s².
    Current GPS location coordinates are: Latitude: ${coordinates.latitude ?? 'Unknown'}, Longitude: ${coordinates.longitude ?? 'Unknown'}.
    
    Inspect the scene. Determine if the user is in danger, unconscious, lying down, or if it is a false alarm.
    Return a strict JSON response conforming to the system prompt specification.
  `;

  const systemInstruction = `
    You are the visual cortex of an AI autonomous emergency response system called ResQ.
    Your goal is to inspect a camera frame captured immediately following a high-impact event (such as a vehicle collision or a personal fall) and evaluate the immediate safety of the user.

    Analyze the image carefully for physical evidence:
    - Is a person visible?
    - Are they standing, walking, sitting, or lying on the ground/road?
    - Do they appear to be injured, bleeding, unconscious, or trapped?
    - Are there emergency responders or bystanders helping them?
    - Is there evidence of vehicle crash damage (airbags deployed, smashed glass, bent metal)?
    - Or does the scene suggest a false alarm (e.g. phone dropped on a floor mat, dark pocket, household floor with no injury visible)?

    You must respond in strict JSON format using the schema below. Do not include markdown code block formatting or any text outside the JSON object.

    JSON Response Schema:
    {
      "personVisible": boolean,
      "personStatus": "standing" | "walking" | "sitting" | "lying_down" | "unconscious" | "not_visible",
      "injuryLikelihood": "none" | "low" | "medium" | "high",
      "apparentDanger": "none" | "low" | "medium" | "high",
      "emergencyScore": number,
      "visualObservations": "string describing visual evidence found",
      "reasoning": "step-by-step logic used to arrive at the emergencyScore"
    }
  `;

  try {
    const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: base64Image,
                },
              },
            ],
          },
        ],
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API HTTP ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResult) {
      throw new Error('Empty response content received from Gemini.');
    }

    const parsed: GeminiResponse = JSON.parse(textResult.trim());
    return parsed;
  } catch (error) {
    console.error('Gemini Vision API request failed:', error);
    return getMockResponse(impactForce);
  }
};

// SIMULATION METHOD: Step 3 actual Gemini call (Text-Only)
export const analyzeSimulationScene = async (): Promise<GeminiResponse> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return {
      personStatus: 'unconscious',
      injuryLikelihood: 'high',
      emergencyScore: 9,
      reasoning: 'Rider is lying motionless on the highway after a simulated 31.2 m/s² crash event. Mock activation returned high hazard alert.',
      recommendation: 'EMERGENCY_CONFIRMED'
    };
  }

  const systemInstruction = "You are ResQ, an AI emergency response agent. Analyze this accident scenario and return ONLY a JSON object.";
  const promptText = `
    SIMULATION MODE: A motorcycle rider has just experienced a high-impact collision event (31.2 m/s²). 
    The rider is lying motionless on the road. Helmet is on but the rider is not moving. 
    Another vehicle has stopped nearby. Analyze this scene and return ONLY this JSON:
    {
      "personStatus": "unconscious" | "standing" | "walking" | "injured" | "unknown",
      "injuryLikelihood": "high" | "medium" | "low",
      "emergencyScore": number,
      "reasoning": "string (2-3 sentences)",
      "recommendation": "EMERGENCY_CONFIRMED" | "FALSE_ALARM"
    }
  `;

  try {
    const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const parsed = JSON.parse(text.trim());
    return parsed;
  } catch (err) {
    console.error('Simulation Gemini call failed, using mock data:', err);
    return {
      personStatus: 'unconscious',
      injuryLikelihood: 'high',
      emergencyScore: 8.5,
      reasoning: 'Rider is unconscious on the asphalt after a simulated high-speed collision. Vehicle debris is scattered around.',
      recommendation: 'EMERGENCY_CONFIRMED'
    };
  }
};

// SIMULATION METHOD: Step 6 Monitoring Update
export interface MonitoringFeedUpdate {
  situationUpdate: string;
  helpArrived: boolean;
  continueMonitoring: boolean;
}

export const analyzeSimulationMonitoring = async (): Promise<MonitoringFeedUpdate> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    const randomSeed = Math.random();
    if (randomSeed < 0.4) {
      return {
        situationUpdate: 'Bystander is performing initial checking of the victim. No police/ambulance visible yet.',
        helpArrived: false,
        continueMonitoring: true
      };
    } else if (randomSeed < 0.8) {
      return {
        situationUpdate: 'First responder ambulance has arrived on scene. Paramedics are active.',
        helpArrived: true,
        continueMonitoring: true
      };
    } else {
      return {
        situationUpdate: 'Victim is loaded into ambulance. Situation stabilized. Alert concluded.',
        helpArrived: true,
        continueMonitoring: false
      };
    }
  }

  const promptText = `
    MONITORING MODE: Emergency services have been alerted. 
    Describe current scene status of the motorcycle collision. Has the situation changed? 
    Generate a dynamic, realistic scenario update.
    Return JSON: { "situationUpdate": "string describing update", "helpArrived": boolean, "continueMonitoring": boolean }
  `;

  try {
    const response = await fetch(`${CONFIG.GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return JSON.parse(text.trim());
  } catch (err) {
    console.error('Monitoring Gemini call failed, using mock:', err);
    return {
      situationUpdate: 'Ambulance is visible in the distance. Paramedics are setting up stretchers.',
      helpArrived: true,
      continueMonitoring: true
    };
  }
};

const getMockResponse = (impactForce: number): GeminiResponse => {
  const isHighForce = impactForce > 30;
  return {
    personVisible: true,
    personStatus: isHighForce ? 'lying_down' : 'standing',
    injuryLikelihood: isHighForce ? 'high' : 'none',
    apparentDanger: isHighForce ? 'high' : 'none',
    emergencyScore: isHighForce ? 8 : 2,
    visualObservations: isHighForce 
      ? 'User appears to be lying horizontally on the ground near debris. Rear camera snapshot is blurry but suggests collision.' 
      : 'User is visible, standing upright, holding the phone. No immediate structural damage or injuries visible in frame.',
    reasoning: `Impact magnitude registered ${impactForce.toFixed(1)} m/s². Simulated vision model confirms user status aligns with impact telemetry.`
  };
};
