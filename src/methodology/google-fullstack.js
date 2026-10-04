import constants from '../constants.js';

const C = constants.googleFullStack;
const perTokenEnergyWh = C.energyWhPerPrompt / C.assumedTokensPerPrompt;
const perTokenWaterMl = C.waterMlPerPrompt / C.assumedTokensPerPrompt;

export function calculate({ inputTokens, outputTokens }) {
  const totalTokens = inputTokens + outputTokens;
  return {
    methodology: 'google-fullstack',
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
