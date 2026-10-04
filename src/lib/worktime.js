import constants from '../constants.js';

const FEW_SECONDS = 5; // "Worked for a few seconds"
const MAX_SECONDS = 900; // cap a single turn at 15 minutes
const WORK_POWER_KW = constants.workPowerKw ?? 0.73;
const IMAGE_WH = constants.imageEnergyWh ?? 2.9;

const TURN_SELECTOR = 'article, [data-testid^="conversation-turn"], [data-turn-id]';

function turnId(turn) {
  return (turn && (turn.getAttribute('data-turn-id') || turn.getAttribute('data-testid'))) || '';
}

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

// Finds every "Worked for 29s" style label in the chat and returns
// [{ idPart, seconds }]. It walks text nodes instead of depending on how
// ChatGPT wraps assistant messages. ChatGPT does not always show this label.
const LABEL_START = /^\s*(?:worked|thought|reasoned) for\b/i;

export function scanWorkLabels(root) {
  const out = [];
  const walker = document.createTreeWalker(root, 4); // 4 = NodeFilter.SHOW_TEXT
  let order = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (!LABEL_START.test(node.nodeValue || '')) continue;
    const start = node.parentElement;
    if (!start || start.closest('[data-message-author-role="user"]')) continue;
    // The number may sit in a sibling element, so widen up to 3 levels while the text stays short.
    let label = '';
    let el = start;
    for (let i = 0; i < 3 && el; i++, el = el.parentElement) {
      const t = (el.textContent || '').trim();
      if (t.length > 40) break;
      if (parseWorkSeconds(t) > 0) {
        label = t;
        break;
      }
    }
    if (!label) continue;
    out.push({ idPart: turnId(start.closest(TURN_SELECTOR)) || `label-${order}`, seconds: parseWorkSeconds(label) });
    order++;
  }
  return out;
}

// ChatGPT gives every generated image alt text starting "Generated image" and
// a file id in its address. Returns [{ id, idPart }] for images in replies.
export function scanGeneratedImages(root) {
  const out = [];
  for (const img of root.querySelectorAll('img[alt^="Generated image"]')) {
    if (img.closest('[data-message-author-role="user"]')) continue;
    const size = img.naturalWidth || Number(img.getAttribute('width')) || 0;
    if (size < 256) continue; // skip icons and tiny previews
    const src = img.getAttribute('src') || '';
    const m = /[?&]id=([^&]+)/.exec(src);
    const id = m ? m[1] : src.slice(0, 80) || img.getAttribute('alt');
    out.push({ id, idPart: turnId(img.closest(TURN_SELECTOR)) || `img-${id}` });
  }
  return out;
}

// Energy -> usage, using the same per-Wh water and carbon ratios as whichever
// methodology is selected.
function usageFromEnergy(energyWh, calc) {
  const probe = calc({ inputTokens: 500, outputTokens: 500 });
  return {
    energyWh,
    waterMl: energyWh * (probe.waterMl / probe.energyWh),
    carbonG: probe.carbonG != null ? energyWh * (probe.carbonG / probe.energyWh) : 0,
  };
}

export function hiddenWorkUsage(seconds, calc) {
  return usageFromEnergy((seconds * WORK_POWER_KW * 1000) / 3600, calc);
}

export function imageUsage(count, calc) {
  return usageFromEnergy(count * IMAGE_WH, calc);
}