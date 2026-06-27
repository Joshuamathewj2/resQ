/**
 * @file tests/unit/geminiParser.test.ts
 * @description Unit tests for the Gemini API response parsing and validation.
 *
 * Tests the pure function `parseGeminiResponse` exported from geminiService.ts:
 * - Valid JSON parsing into typed GeminiResponse objects
 * - Error throwing on malformed JSON
 * - Error throwing on missing required fields
 * - Score clamping to [0, 10] range
 * - Edge cases: empty string, whitespace, extra fields
 *
 * Also tests `isApiKeyConfigured` for credential validation logic.
 */

import { describe, it, expect } from 'vitest';
import { parseGeminiResponse, isApiKeyConfigured } from '../../src/services/geminiService';

describe('parseGeminiResponse', () => {
  it('successfully parses a valid emergency response', () => {
    const validJson = JSON.stringify({
      personVisible: true,
      personStatus: 'lying_down',
      injuryLikelihood: 'high',
      apparentDanger: 'high',
      emergencyScore: 8.5,
      visualObservations: 'Person lying on ground, not moving.',
      reasoning: 'High impact force and unconscious person indicate emergency.',
    });

    const result = parseGeminiResponse(validJson);

    expect(result.personStatus).toBe('lying_down');
    expect(result.injuryLikelihood).toBe('high');
    expect(result.emergencyScore).toBe(8.5);
    expect(result.personVisible).toBe(true);
    expect(result.reasoning).toBe('High impact force and unconscious person indicate emergency.');
  });

  it('successfully parses a safe/false-alarm response', () => {
    const safeJson = JSON.stringify({
      personStatus: 'standing',
      injuryLikelihood: 'none',
      apparentDanger: 'none',
      emergencyScore: 1,
      reasoning: 'Phone appears to have been dropped on a soft surface. User is standing upright.',
    });

    const result = parseGeminiResponse(safeJson);

    expect(result.personStatus).toBe('standing');
    expect(result.emergencyScore).toBe(1);
    expect(result.injuryLikelihood).toBe('none');
  });

  it('clamps emergencyScore above 10 to exactly 10', () => {
    const json = JSON.stringify({
      personStatus: 'unconscious',
      injuryLikelihood: 'high',
      emergencyScore: 15, // Out of range
      reasoning: 'Critical emergency.',
    });

    const result = parseGeminiResponse(json);
    expect(result.emergencyScore).toBe(10);
  });

  it('clamps emergencyScore below 0 to exactly 0', () => {
    const json = JSON.stringify({
      personStatus: 'standing',
      injuryLikelihood: 'none',
      emergencyScore: -5, // Out of range
      reasoning: 'All clear.',
    });

    const result = parseGeminiResponse(json);
    expect(result.emergencyScore).toBe(0);
  });

  it('throws SyntaxError on malformed JSON input', () => {
    expect(() => parseGeminiResponse('not valid json at all')).toThrow(SyntaxError);
    expect(() => parseGeminiResponse('{broken json')).toThrow();
    expect(() => parseGeminiResponse('undefined')).toThrow();
  });

  it('throws Error on empty string input', () => {
    expect(() => parseGeminiResponse('')).toThrow('empty response text');
    expect(() => parseGeminiResponse('   ')).toThrow('empty response text');
  });

  it('throws Error when personStatus is missing', () => {
    const json = JSON.stringify({
      injuryLikelihood: 'high',
      emergencyScore: 8,
      reasoning: 'Test reasoning.',
    });
    expect(() => parseGeminiResponse(json)).toThrow('personStatus');
  });

  it('throws Error when injuryLikelihood is missing', () => {
    const json = JSON.stringify({
      personStatus: 'lying_down',
      emergencyScore: 8,
      reasoning: 'Test reasoning.',
    });
    expect(() => parseGeminiResponse(json)).toThrow('injuryLikelihood');
  });

  it('throws Error when emergencyScore is missing or non-numeric', () => {
    const missingScore = JSON.stringify({
      personStatus: 'lying_down',
      injuryLikelihood: 'high',
      reasoning: 'Test.',
    });
    expect(() => parseGeminiResponse(missingScore)).toThrow('emergencyScore');

    const stringScore = JSON.stringify({
      personStatus: 'lying_down',
      injuryLikelihood: 'high',
      emergencyScore: '8', // String instead of number
      reasoning: 'Test.',
    });
    expect(() => parseGeminiResponse(stringScore)).toThrow('emergencyScore');
  });

  it('handles optional fields gracefully when absent', () => {
    const minimalJson = JSON.stringify({
      personStatus: 'unknown',
      injuryLikelihood: 'low',
      emergencyScore: 4,
      reasoning: 'Minimal valid response.',
    });

    const result = parseGeminiResponse(minimalJson);
    expect(result.personVisible).toBeUndefined();
    expect(result.apparentDanger).toBeUndefined();
    expect(result.visualObservations).toBeUndefined();
    expect(result.recommendation).toBeUndefined();
  });

  it('parses with leading/trailing whitespace in the JSON string', () => {
    const whitespaceWrapped = `  ${JSON.stringify({
      personStatus: 'sitting',
      injuryLikelihood: 'none',
      emergencyScore: 2,
      reasoning: 'User is sitting.',
    })}  `;

    const result = parseGeminiResponse(whitespaceWrapped);
    expect(result.personStatus).toBe('sitting');
  });
});

describe('isApiKeyConfigured', () => {
  it('returns false for undefined', () => {
    expect(isApiKeyConfigured(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isApiKeyConfigured('')).toBe(false);
  });

  it('returns false for the placeholder value', () => {
    expect(isApiKeyConfigured('your_gemini_api_key_here')).toBe(false);
  });

  it('returns true for a real-looking API key', () => {
    expect(isApiKeyConfigured('AIzaSyABC123xyz_realkey')).toBe(true);
  });
});
