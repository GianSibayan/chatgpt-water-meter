import constants from '../constants.js';

const { anchors } = constants.jeghamBenchmark;
const { pue, wueSiteLPerKwh, wueSourceLPerKwh, cifKgPerKwh } = constants.infrastructure;

// Water(L) = (E_kWh/PUE)*WUEsite + E_kWh*WUEsource; Carbon(kg) = E_kWh*CIF.
// Converting to a per-Wh basis, the kWh->Wh and L->mL conversions cancel,
// so these are already correct as mL-per-Wh and g-per-Wh multipliers.
const mlWaterPerWh = (1 / pue) * wueSiteLPerKwh + wueSourceLPerKwh;
const gCarbonPerWh = cifKgPerKwh;

function interpolateEnergy(totalTokens) {
  // Below the smallest measured point, scale down proportionally instead of
  // charging the full 400-token cost to a one-line reply.
  if (totalTokens <= anchors[0].totalTokens) {
    return anchors[0].energyWh * (totalTokens / anchors[0].totalTokens);
  }
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (totalTokens <= b.totalTokens) {
      const t = (totalTokens - a.totalTokens) / (b.totalTokens - a.totalTokens);
      return a.energyWh + t * (b.energyWh - a.energyWh);
    }
  }
  // Flat extrapolation past the longest measured anchor, rather than
  // guessing at a slope the paper didn't measure.
  return anchors[anchors.length - 1].energyWh;
}

export function calculate({ inputTokens, outputTokens }) {
  const totalTokens = inputTokens + outputTokens;
  const energyWh = interpolateEnergy(totalTokens);

  return {
    methodology: 'jegham-benchmark',
    source: constants.jeghamBenchmark.source,
    energyWh: round(energyWh),
    waterMl: round(energyWh * mlWaterPerWh),
    carbonG: round(energyWh * gCarbonPerWh),
    inputTokens,
    outputTokens,
  };
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}
