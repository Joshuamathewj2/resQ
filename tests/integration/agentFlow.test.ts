/**
 * @file tests/integration/agentFlow.test.ts
 * @description Integration tests for the ResQ agent decision pipeline.
 *
 * Tests the end-to-end reasoning flow by wiring together:
 * - calculateAccelerometerScore (sensor layer)
 * - calculateFusedConfidence (fusion layer)
 * - classifyConfidenceScore (decision layer)
 *
 * Covers the three decision paths:
 * 1. High confidence → DISPATCH
 * 2. Borderline confidence → PROGRESSIVE_CHECK
 * 3. Low confidence → FALSE_ALARM
 *
 * Also tests the progressive monitoring escalation behaviour.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAccelerometerScore,
  calculateFusedConfidence,
  classifyConfidenceScore,
  generateIncidentSummary,
} from '../../src/agents/resqAgent';
import { parseGeminiResponse } from '../../src/services/geminiService';
import {
  EMERGENCY_THRESHOLD_SCORE,
  BORDERLINE_SCORE_MIN,
  BORDERLINE_SCORE_MAX,
} from '../../src/config/constants';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** High-severity Gemini response fixture */
const HIGH_SEVERITY_GEMINI_JSON = JSON.stringify({
  personVisible: true,
  personStatus: 'unconscious',
  injuryLikelihood: 'high',
  apparentDanger: 'high',
  emergencyScore: 9,
  visualObservations: 'Rider lying motionless on road. Helmet visible but no movement detected.',
  reasoning: 'High impact telemetry correlates with visually unconscious rider.',
  recommendation: 'EMERGENCY_CONFIRMED',
});

/** Low-severity Gemini response fixture (false alarm) */
const LOW_SEVERITY_GEMINI_JSON = JSON.stringify({
  personVisible: true,
  personStatus: 'standing',
  injuryLikelihood: 'none',
  apparentDanger: 'none',
  emergencyScore: 1,
  visualObservations: 'User is standing upright, holding phone. No visible damage.',
  reasoning: 'Phone likely dropped on a soft surface. User is fine.',
  recommendation: 'FALSE_ALARM',
});

/** Borderline Gemini response fixture (mid-range score) */
const BORDERLINE_GEMINI_JSON = JSON.stringify({
  personStatus: 'sitting',
  injuryLikelihood: 'low',
  emergencyScore: 5,
  reasoning: 'User is seated. Moderate impact detected. Situation is unclear.',
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Agent Decision Pipeline — End-to-End', () => {
  describe('Path 1: High impact force + high vision score → DISPATCH', () => {
    it('routes to DISPATCH for crash-level input (31.2 m/s² + score 9)', () => {
      const geminiResult = parseGeminiResponse(HIGH_SEVERITY_GEMINI_JSON);
      const accelScore = calculateAccelerometerScore(31.2);
      const confidence = calculateFusedConfidence(accelScore, geminiResult.emergencyScore);
      const action = classifyConfidenceScore(confidence);

      expect(accelScore).toBeGreaterThan(7);
      expect(confidence.finalScore).toBeGreaterThanOrEqual(EMERGENCY_THRESHOLD_SCORE);
      expect(action).toBe('DISPATCH');
    });

    it('confidence score satisfies ACCEL_WEIGHT + VISION_WEIGHT = 1.0 invariant', () => {
      const geminiResult = parseGeminiResponse(HIGH_SEVERITY_GEMINI_JSON);
      const accelScore = calculateAccelerometerScore(31.2);
      const confidence = calculateFusedConfidence(accelScore, geminiResult.emergencyScore);

      expect(confidence.accelWeight + confidence.visionWeight).toBeCloseTo(1.0, 5);
    });

    it('generates an informative emergency incident summary', () => {
      const geminiResult = parseGeminiResponse(HIGH_SEVERITY_GEMINI_JSON);
      const accelScore = calculateAccelerometerScore(31.2);
      const confidence = calculateFusedConfidence(accelScore, geminiResult.emergencyScore);
      const summary = generateIncidentSummary(geminiResult, 31.2, confidence);

      expect(summary).toContain('EMERGENCY CONFIRMED');
      expect(summary).toContain('31.2');
    });
  });

  describe('Path 2: Moderate input → PROGRESSIVE_CHECK (first attempt)', () => {
    it('routes to PROGRESSIVE_CHECK for borderline score (score 5)', () => {
      const geminiResult = parseGeminiResponse(BORDERLINE_GEMINI_JSON);
      // Moderate impact force (not extreme)
      const accelScore = calculateAccelerometerScore(22);
      const confidence = calculateFusedConfidence(accelScore, geminiResult.emergencyScore);
      const action = classifyConfidenceScore(confidence, false);

      expect(confidence.finalScore).toBeGreaterThanOrEqual(BORDERLINE_SCORE_MIN);
      expect(confidence.finalScore).toBeLessThan(BORDERLINE_SCORE_MAX);
      expect(action).toBe('PROGRESSIVE_CHECK');
    });

    it('escalates borderline to DISPATCH on progressive (second) attempt', () => {
      const geminiResult = parseGeminiResponse(BORDERLINE_GEMINI_JSON);
      const accelScore = calculateAccelerometerScore(22);
      const confidence = calculateFusedConfidence(accelScore, geminiResult.emergencyScore);
      // Second attempt — isProgressiveResult = true
      const action = classifyConfidenceScore(confidence, true);

      // On second attempt, score >= 5 should still dispatch (conservative)
      expect(action).toBe('DISPATCH');
    });
  });

  describe('Path 3: Low impact + low vision → FALSE_ALARM', () => {
    it('routes to FALSE_ALARM for dropped phone scenario', () => {
      const geminiResult = parseGeminiResponse(LOW_SEVERITY_GEMINI_JSON);
      // Low force (below threshold but triggered somehow)
      const accelScore = calculateAccelerometerScore(10);
      const confidence = calculateFusedConfidence(accelScore, geminiResult.emergencyScore);
      const action = classifyConfidenceScore(confidence);

      expect(confidence.finalScore).toBeLessThan(BORDERLINE_SCORE_MIN);
      expect(action).toBe('FALSE_ALARM');
    });
  });

  describe('Constants validation', () => {
    it('EMERGENCY_THRESHOLD is 7.0', () => {
      expect(EMERGENCY_THRESHOLD_SCORE).toBe(7.0);
    });

    it('BORDERLINE range is contiguous [5.0, 7.0)', () => {
      expect(BORDERLINE_SCORE_MIN).toBe(5.0);
      expect(BORDERLINE_SCORE_MAX).toBe(7.0);
    });

    it('boundaries are exclusive on high end (score 7.0 = DISPATCH, not PROGRESSIVE)', () => {
      const exactThreshold = {
        accelScore: 7,
        visionScore: 7,
        finalScore: 7.0,
        accelWeight: 0.4,
        visionWeight: 0.6,
      };
      expect(classifyConfidenceScore(exactThreshold)).toBe('DISPATCH');
    });
  });
});
