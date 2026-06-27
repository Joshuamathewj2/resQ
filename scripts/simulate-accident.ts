/**
 * @file scripts/simulate-accident.ts
 * @description CLI script for ResQ accident simulation testing.
 *
 * Simulates the full ResQ sensor-to-decision pipeline in a Node.js
 * environment without requiring a browser. Useful for:
 * - CI/CD pipeline validation
 * - Regression testing of the confidence fusion algorithm
 * - Debugging scoring changes in isolation
 *
 * Usage:
 *   npx tsx scripts/simulate-accident.ts
 *   npx tsx scripts/simulate-accident.ts --force=35.5 --vision=8
 *
 * Output: Prints a structured incident simulation report to stdout.
 */

import {
  IMPACT_THRESHOLD_M_S2,
  EMERGENCY_THRESHOLD_SCORE,
  BORDERLINE_SCORE_MIN,
  CONFIDENCE_ACCEL_WEIGHT,
  CONFIDENCE_VISION_WEIGHT,
} from '../src/config/constants';

// ─────────────────────────────────────────────────────────────────────────────
// INLINE PURE FUNCTIONS (duplicated here to avoid React/browser imports)
// ─────────────────────────────────────────────────────────────────────────────

function calculateAccelerometerScore(magnitudeMs2: number): number {
  if (magnitudeMs2 <= 0) return 0;
  let score: number;
  if (magnitudeMs2 <= 15) {
    score = (magnitudeMs2 / 15) * 3;
  } else if (magnitudeMs2 <= 25) {
    score = 3 + ((magnitudeMs2 - 15) / 10) * 3;
  } else if (magnitudeMs2 <= 35) {
    score = 6 + ((magnitudeMs2 - 25) / 10) * 3;
  } else {
    score = 9 + Math.min(1, (magnitudeMs2 - 35) / 10);
  }
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

function calculateFusedScore(accelScore: number, visionScore: number): number {
  return Math.round((CONFIDENCE_ACCEL_WEIGHT * accelScore + CONFIDENCE_VISION_WEIGHT * visionScore) * 10) / 10;
}

function classify(finalScore: number): string {
  if (finalScore >= EMERGENCY_THRESHOLD_SCORE) return 'DISPATCH';
  if (finalScore >= BORDERLINE_SCORE_MIN) return 'PROGRESSIVE_CHECK';
  return 'FALSE_ALARM';
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI ARGUMENT PARSING
// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (name: string, fallback: number): number => {
  const match = args.find(a => a.startsWith(`--${name}=`));
  if (match) {
    const val = parseFloat(match.split('=')[1] ?? '');
    return isNaN(val) ? fallback : val;
  }
  return fallback;
};

const impactForce = getArg('force', 31.2);   // m/s²
const visionScore = getArg('vision', 8.5);   // 0–10

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────

const SCENARIOS = [
  { name: 'Dropped phone (false alarm)',   force: 15.0, vision: 1.0 },
  { name: 'Minor fender bender',          force: 22.0, vision: 3.5 },
  { name: 'Borderline crash (re-check)',   force: 25.0, vision: 5.0 },
  { name: 'Motorcycle collision',          force: 31.2, vision: 8.5 },
  { name: 'Severe head-on collision',      force: 42.0, vision: 9.5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// REPORT PRINTING
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n══════════════════════════════════════════════════════════════');
console.log('  ResQ Accident Simulation — Confidence Fusion Report');
console.log('══════════════════════════════════════════════════════════════\n');

// Custom scenario from CLI args
const customAccel = calculateAccelerometerScore(impactForce);
const customFused = calculateFusedScore(customAccel, visionScore);
const customAction = classify(customFused);

console.log('▶ CUSTOM SCENARIO (from CLI arguments):');
console.log(`  Impact force    : ${impactForce} m/s² (threshold: ${IMPACT_THRESHOLD_M_S2})`);
console.log(`  Vision score    : ${visionScore}/10`);
console.log(`  Accel score     : ${customAccel}/10`);
console.log(`  Fused score     : ${customFused}/10 [${CONFIDENCE_ACCEL_WEIGHT}×${customAccel} + ${CONFIDENCE_VISION_WEIGHT}×${visionScore}]`);
console.log(`  Decision        : ${customAction === 'DISPATCH' ? '🚨' : customAction === 'PROGRESSIVE_CHECK' ? '🔍' : '✅'} ${customAction}`);
console.log('');

// Pre-defined scenarios
console.log('▶ PREDEFINED SCENARIO COMPARISON TABLE:');
console.log('─────────────────────────────────────────────────────────────');
console.log(`${'Scenario'.padEnd(32)} ${'Force'.padEnd(8)} ${'Accel'.padEnd(7)} ${'Vision'.padEnd(8)} ${'Fused'.padEnd(7)} Decision`);
console.log('─────────────────────────────────────────────────────────────');

for (const scenario of SCENARIOS) {
  const accel = calculateAccelerometerScore(scenario.force);
  const fused = calculateFusedScore(accel, scenario.vision);
  const action = classify(fused);
  const icon = action === 'DISPATCH' ? '🚨' : action === 'PROGRESSIVE_CHECK' ? '🔍' : '✅';
  console.log(
    `${scenario.name.padEnd(32)} ${String(scenario.force).padEnd(8)} ${String(accel).padEnd(7)} ${String(scenario.vision).padEnd(8)} ${String(fused).padEnd(7)} ${icon} ${action}`
  );
}

console.log('─────────────────────────────────────────────────────────────');
console.log('');
console.log(`Emergency dispatch threshold: ≥ ${EMERGENCY_THRESHOLD_SCORE}`);
console.log(`Progressive check zone:       ${BORDERLINE_SCORE_MIN} – ${EMERGENCY_THRESHOLD_SCORE - 0.01}`);
console.log(`False alarm zone:             < ${BORDERLINE_SCORE_MIN}`);
console.log('\n══════════════════════════════════════════════════════════════\n');
