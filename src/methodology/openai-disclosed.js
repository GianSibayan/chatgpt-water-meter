import constants from '../constants.js';

const C = constants.openaiDisclosed;
const perTokenEnergyWh = C.energyWhPerQuery / C.assumedTokensPerQuery;
const perTokenWaterMl = C.waterMlPerQuery / C.assumedTokensPerQuery;

export function calculate({ inputTokens, outputTokens }) {
  const totalTokens = inputTokens + outputTokens;
  return {
    methodology: 'openai-disclosed',
    source: C.source,
    energyWh: round(totalTokens * perTokenEnergyWh),
    waterMl: round(totalTokens * perTokenWaterMl),
    inputTokens,
    outputTokens,
  };
}

function round(n) {
  return Math.round(n * 10000) / 10000;
}
