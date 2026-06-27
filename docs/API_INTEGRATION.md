# ResQ API Integration Guide

This guide details how to integrate the Google Gemini 1.5 Flash Vision API, the HTML5 Geolocation API, and the Twilio SMS Gateway.

---

## 1. Google Gemini 1.5 Flash Vision API

The app calls the Gemini API directly from the client side using the standard developer endpoint.

* **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={API_KEY}`
* **Method**: `POST`
* **Headers**: `Content-Type: application/json`

### Request Payload Format

The body contains a prompt instructing Gemini to return JSON and the base64 image data payload.

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "Analyze this post-impact camera frame. Return a strict JSON response containing: personVisible, personStatus, injuryLikelihood, apparentDanger, emergencyScore, visualObservations, and reasoning."
        },
        {
          "inlineData": {
            "mimeType": "image/jpeg",
            "data": "/9j/4AAQSkZJRgABAQ..."
          }
        }
      ]
    }
  ],
  "generationConfig": {
    "responseMimeType": "application/json"
  }
}
```

---

## 2. Geolocation API (GPS)

The application queries the HTML5 standard geolocation service to fetch the live latitude and longitude coordinates.

### Capture Code Pattern
```typescript
navigator.geolocation.getCurrentPosition(
  (position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    // Format into standard Google Maps Link
    const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  },
  (error) => {
    console.error("GPS access error:", error.message);
  },
  {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  }
);
```

---

## 3. Twilio SMS Integration

Twilio alerts are sent via direct HTTP POST requests to the Twilio REST API.

* **Endpoint**: `https://api.twilio.com/2010-04-01/Accounts/{ACCOUNT_SID}/Messages.json`
* **Method**: `POST`
* **Authentication**: Basic Authentication (`username: AccountSID`, `password: AuthToken`)
* **Headers**: `Content-Type: application/x-www-form-urlencoded`

### Request Body Form Fields
* `To`: Configured contact phone number (e.g. `+1234567890`)
* `From`: Configured Twilio number (e.g. `+1987654321`)
* `Body`: 
  ```text
  🚨 EMERGENCY ALERT: [Name] has been in an accident. 
  Location: https://www.google.com/maps?q=[Lat],[Lng]
  ResQ AI Confidence: [Score]/10. 
  Details: [AI Incident Summary]. 
  Time: [Timestamp]
  ```

---

## 4. Key Management & Environment Configuration

All credential tokens are fetched from the system environment via Vite's `import.meta.env` system:

```typescript
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const TWILIO_SID = import.meta.env.VITE_TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = import.meta.env.VITE_TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = import.meta.env.VITE_TWILIO_PHONE_NUMBER;
```
These values should be added to `.env` during setup.
