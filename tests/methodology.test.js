import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculate as openai } from '../src/methodology/openai-disclosed.js';
import { calculate as google } from '../src/methodology/google-fullstack.js';
import { calculate as flops } from '../src/methodology/flops-based.js';
import { calculate as jegham } from '../src/methodology/jegham-benchmark.js';

const ALL = [openai, google, flops, jegham];

// Calibration check: a typical ~500in/500out exchange should land in the
// same order of magnitude as the published reference points (0.2-0.5 Wh).
// If a constants.js edit blows way past this, something's wrong.
test('all methodologies land in a defensible range for a typical exchange', () => {
  for (const calc of ALL) {
    const r = calc({ inputTokens: 500, outputTokens: 500 });
    assert.ok(r.energyWh > 0.05 && r.energyWh < 1.0, `${r.methodology}: got ${r.energyWh} Wh`);
    assert.ok(r.waterMl > 0, `${r.methodology}: water should be positive`);
  }
});

// The flat-rate methodologies (openai/google/flops) scale proportionally
// with tokens by construction. jegham-benchmark interpolates real measured
// data points and has a fixed overhead baked in, so doubling tokens does
// NOT double its energy, that's the whole point of it being based on
// actual measurements rather than a per-token constant. Test each
// accordingly instead of assuming one scaling rule fits all four.
test('flat-rate methodologies scale proportionally with token count', () => {
  for (const calc of [openai, google, flops]) {
    const a = calc({ inputTokens: 500, outputTokens: 500 });
    const b = calc({ inputTokens: 1000, outputTokens: 1000 });
    assert.ok(Math.abs(b.energyWh - 2 * a.energyWh) < 0.001, `${b.methodology}: ${b.energyWh} vs ${2 * a.energyWh}`);
  }
});

test('jegham-benchmark increases monotonically with token count but is not purely proportional', () => {
  const a = jegham({ inputTokens: 500, outputTokens: 500 });
  const b = jegham({ inputTokens: 1000, outputTokens: 1000 });
  assert.ok(b.energyWh > a.energyWh, 'more tokens should cost more energy');
  assert.ok(b.energyWh < 2 * a.energyWh, 'but not scale linearly, there is a fixed per-query overhead');
});

test('every methodology carries a citation', () => {
  for (const calc of ALL) {
    const r = calc({ inputTokens: 100, outputTokens: 100 });
    assert.ok(r.source && r.source.length > 10);
  }
});
