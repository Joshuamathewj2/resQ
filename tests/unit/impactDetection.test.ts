/**
 * @file tests/unit/impactDetection.test.ts
 * @description Unit tests for accelerometer impact detection utility functions.
 *
 * Tests the pure functions exported from useAccelerometer.ts:
 * - calculateImpactMagnitude: 3-axis vector magnitude calculation
 * - compensateGravity: gravity subtraction from raw readings
 *
 * These functions have no React or browser dependencies, making them
 * fully unit-testable in a Node/JSDOM environment.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateImpactMagnitude,
  compensateGravity,
} from '../../src/hooks/useAccelerometer';

describe('calculateImpactMagnitude', () => {
  it('returns 0 when all axes are 0', () => {
    expect(calculateImpactMagnitude(0, 0, 0)).toBe(0);
  });

  it('returns the single-axis value when only one axis is non-zero', () => {
    expect(calculateImpactMagnitude(9.8, 0, 0)).toBeCloseTo(9.8, 3);
    expect(calculateImpactMagnitude(0, 9.8, 0)).toBeCloseTo(9.8, 3);
    expect(calculateImpactMagnitude(0, 0, 9.8)).toBeCloseTo(9.8, 3);
  });

  it('correctly computes magnitude for a known 3D vector', () => {
    // √(3² + 4² + 0²) = √(9 + 16) = √25 = 5
    expect(calculateImpactMagnitude(3, 4, 0)).toBeCloseTo(5, 5);
  });

  it('correctly computes magnitude for a high-impact event', () => {
    // √(10² + 25² + 22²) ≈ 35.0
    const result = calculateImpactMagnitude(10, 25, 22);
    expect(result).toBeGreaterThan(34);
    expect(result).toBeLessThan(36);
  });

  it('handles negative axis values correctly (magnitude is always positive)', () => {
    const positive = calculateImpactMagnitude(3, 4, 0);
    const negative = calculateImpactMagnitude(-3, -4, 0);
    expect(positive).toBeCloseTo(negative, 5);
    expect(negative).toBeGreaterThan(0);
  });
});

describe('compensateGravity', () => {
  it('returns the rawMagnitude unchanged when linear acceleration data is available', () => {
    expect(compensateGravity(31.2, true)).toBe(31.2);
    expect(compensateGravity(9.8, true)).toBe(9.8);
  });

  it('subtracts 9.8 from raw magnitude when no linear acceleration available', () => {
    expect(compensateGravity(19.8, false)).toBeCloseTo(10.0, 3);
    expect(compensateGravity(9.8, false)).toBeCloseTo(0.0, 3);
  });

  it('floors result at 0 when raw magnitude is below gravity (phone at rest)', () => {
    // If device is stationary, raw = ~9.8 from gravity only → compensated = 0
    expect(compensateGravity(9.8, false)).toBeGreaterThanOrEqual(0);
    // Very low raw magnitude should not produce negative results
    expect(compensateGravity(5.0, false)).toBe(0);
    expect(compensateGravity(0, false)).toBe(0);
  });

  it('correctly compensates a high-impact reading', () => {
    // Raw = 40 m/s² (high impact including gravity) → 40 - 9.8 = 30.2
    expect(compensateGravity(40, false)).toBeCloseTo(30.2, 1);
  });
});
