import constants from '../constants.js';

const FEW_SECONDS = 5; // "Worked for a few seconds"
const MAX_SECONDS = 900; // cap a single turn at 15 minutes

// "Worked for 29s", "Thought for 7 seconds", "Worked for 1m 12s" -> seconds.
export function parseWorkSeconds(label) {
  const m = /^(?:worked|thought|reasoned) for\s+(.*)$/i.exec((label || '').trim());
  if (!m) return 0;
  const rest = m[1];
  if (/\b(?:few|couple)\b/i.test(rest)) return FEW_SECONDS;
  const h = /(\d+)\s*h(?:ours?|rs?)?\b/i.exec(rest);
  const min = /(\d+)\s*m(?:in(?:ute)?s?)?\b/i.exec(rest);
  const s = /(\d+)\s*s(?:ec(?:ond)?s?)?\b/i.exec(rest);
  let total = 0;
  if (h) total += Number(h[1]) * 3600;
  if (min) total += Number(min[1]) * 60;
  if (s) total += Number(s[1]);
  return Math.min(total, MAX_SECONDS);
}

// Look for a short element whose whole text is the label, so neighbouring
// text can never get glued onto it.
export function findWorkLabel(turn) {
  for (const node of turn.querySelectorAll('button, summary, span, div')) {
    const t = (node.textContent || '').trim();
    if (t.length <= 40 && /^(?:worked|thought|reasoned) for\b/i.test(t)) return t;
  }
  return '';
}

export function workSecondsForTurn(turn) {
  return parseWorkSeconds(findWorkLabel(turn));
}

// Seconds of hidden work -> energy, then water and carbon using the same
// per-Wh ratios as whichever methodology is selected.
export function hiddenWorkUsage(seconds, calc) {
  const energyWh = (seconds * constants.workPowerKw * 1000) / 3600;
  const probe = calc({ inputTokens: 500, outputTokens: 500 });
  return {
    energyWh,
    waterMl: energyWh * (probe.waterMl / probe.energyWh),
    carbonG: probe.carbonG != null ? energyWh * (probe.carbonG / probe.energyWh) : 0,
  };
}