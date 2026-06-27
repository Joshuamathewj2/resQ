/**
 * @file tests/unit/agentStateMachine.test.ts
 * @description Unit tests for the ResQ agent's pure reasoning functions.
 *
 * Tests the functions exported from resqAgent.ts:
 * - calculateAccelerometerScore: magnitude → 0-10 severity scale
 * - calculateFusedConfidence: multi-modal weighted average fusion
 * - classifyConfidenceScore: score → action recommendation routing
 * - generateIncidentSummary: human-readable summary generation
 *
 * All tested functions are pure (no side effects, no store dependencies),
 * making them fully unit-testable without mocking.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateAccelerometerScore,
  calculateFusedConfidence,
  classifyConfidenceScore,
} from '../../src/agents/resqAgent';

describe('calculateAccelerometerScore', () => {
  it('returns 0 for zero or negative input', () => {
    expect(calculateAccelerometerScore(0)).toBe(0);
    expect(calculateAccelerometerScore(-5)).toBe(0);
  });

  it('returns low scores for low-force readings (< 15 m/s²)', () => {
    const score5 = calculateAccelerometerScore(5);
    expect(score5).toBeGreaterThan(0);
    expect(score5).toBeLessThan(3);
  });

  it('returns medium score at the impact threshold (~24.5 m/s²)', () => {
    const score = calculateAccelerometerScore(24.5);
    // At threshold, should be around 5.7-5.8 (in the medium band)
    expect(score).toBeGreaterThan(5);
    expect(score).toBeLessThan(7);
  });

  it('returns high score for severe impacts (> 30 m/s²)', () => {
    const score = calculateAccelerometerScore(31.2);
    expect(score).toBeGreaterThan(7);
    expect(score).toBeLessThanOrEqual(10);
  });

  it('caps at exactly 10 for extreme impact values', () => {
    expect(calculateAccelerometerScore(100)).toBe(10);
    expect(calculateAccelerometerScore(45)).toBe(10);
    expect(calculateAccelerometerScore(35.1)).toBeLessThanOrEqual(10);
  });

  it('returns monotonically increasing values', () => {
    const scores = [0, 5, 10, 15, 20, 25, 30, 35, 40].map(calculateAccelerometerScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]!);
    }
  });
});

describe('calculateFusedConfidence', () => {
  it('computes correct weighted average with default weights (0.4 + 0.6)', () => {
    // finalScore = 0.4 * 8 + 0.6 * 9 = 3.2 + 5.4 = 8.6
    const result = calculateFusedConfidence(8, 9);
    expect(result.finalScore).toBeCloseTo(8.6, 1);
    expect(result.accelScore).toBe(8);
    expect(result.visionScore).toBe(9);
    expect(result.accelWeight).toBe(0.4);
    expect(result.visionWeight).toBe(0.6);
  });

  it('returns 0 when both scores are 0', () => {
    const result = calculateFusedConfidence(0, 0);
    expect(result.finalScore).toBe(0);
  });

  it('returns 10 when both scores are 10', () => {
    const result = calculateFusedConfidence(10, 10);
    expect(result.finalScore).toBe(10);
  });

  it('respects custom weight parameters', () => {
    // Equal weights: 0.5 * 6 + 0.5 * 4 = 5.0
    const result = calculateFusedConfidence(6, 4, 0.5, 0.5);
    expect(result.finalScore).toBeCloseTo(5.0, 1);
    expect(result.accelWeight).toBe(0.5);
    expect(result.visionWeight).toBe(0.5);
  });

  it('correctly rounds scores to one decimal place', () => {
    const result = calculateFusedConfidence(7.333, 8.666);
    expect(result.accelScore).toBe(7.3);
    expect(result.visionScore).toBe(8.7);
  });

  it('produces borderline score in the 5–7 range for moderate inputs', () => {
    // accel=5, vision=6 → 0.4*5 + 0.6*6 = 2+3.6 = 5.6
    const result = calculateFusedConfidence(5, 6);
    expect(result.finalScore).toBeGreaterThanOrEqual(5.0);
    expect(result.finalScore).toBeLessThan(7.0);
  });
});

describe('classifyConfidenceScore', () => {
  it('returns DISPATCH for scores at or above emergency threshold (7.0)', () => {
    const highConf = calculateFusedConfidence(10, 10);
    expect(classifyConfidenceScore(highConf)).toBe('DISPATCH');

    const borderHighConf = { ...highConf, finalScore: 7.0 };
    expect(classifyConfidenceScore(borderHighConf)).toBe('DISPATCH');
  });

  it('returns PROGRESSIVE_CHECK for borderline scores (5.0–6.9)', () => {
    const borderline = { ...calculateFusedConfidence(5, 6), finalScore: 5.6 };
    expect(classifyConfidenceScore(borderline)).toBe('PROGRESSIVE_CHECK');

    const upperBorderline = { ...calculateFusedConfidence(5, 6), finalScore: 6.9 };
    expect(classifyConfidenceScore(upperBorderline)).toBe('PROGRESSIVE_CHECK');
  });

  it('returns FALSE_ALARM for scores below 5.0', () => {
    const lowConf = { ...calculateFusedConfidence(2, 1), finalScore: 1.4 };
    expect(classifyConfidenceScore(lowConf)).toBe('FALSE_ALARM');

    const justBelow = { ...calculateFusedConfidence(2, 1), finalScore: 4.9 };
    expect(classifyConfidenceScore(justBelow)).toBe('FALSE_ALARM');
  });

  it('returns DISPATCH instead of PROGRESSIVE_CHECK on second progressive attempt', () => {
    // On second attempt, borderline scores should resolve to DISPATCH
    const borderline = { ...calculateFusedConfidence(5, 6), finalScore: 5.5 };
    expect(classifyConfidenceScore(borderline, true)).toBe('DISPATCH');
  });

  it('returns FALSE_ALARM on progressive attempt for scores < 5.0', () => {
    const lowConf = { ...calculateFusedConfidence(2, 1), finalScore: 3.0 };
    expect(classifyConfidenceScore(lowConf, true)).toBe('FALSE_ALARM');
  });
});
