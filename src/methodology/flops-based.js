import constants from '../constants.js';

const C = constants.flopsBased;
const activeParams = C.assumedActiveParamsBillion * 1e9;

// Standard transformer inference approximation: ~2 x params FLOPs per
// token for a full forward pass. Output tokens pay this in full
// (autoregressive, one pass each); input tokens are processed in
// parallel during prefill, so they're weighted lighter.
const INPUT_PREFILL_DISCOUNT = 0.3;

export function calculate({ inputTokens, outputTokens }) {
  const outputFlops = C.flopsPerTokenMultiplier * activeParams * outputTokens;
  const inputFlops = C.flopsPerTokenMultiplier * activeParams * inputTokens * INPUT_PREFILL_DISCOUNT;

  const energyWh = ((outputFlops + inputFlops) * C.hardwareEfficiencyJPerFlop) / 3600;
  const waterMl = energyWh * constants.waterConversion.directPlusGrid.mlPerWh;

  return {
    methodology: 'flops-based',
    source: C.source,
    energyWh: round(energyWh),
    waterMl: round(waterMl),
    inputTokens,
    outputTokens,
  };
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}
