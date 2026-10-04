import constants from './constants.js';
import { countTokens } from './lib/tokenizer.js';
import { calculate as calcOpenAI } from './methodology/openai-disclosed.js';
import { calculate as calcGoogle } from './methodology/google-fullstack.js';
import { calculate as calcFlops } from './methodology/flops-based.js';
import { calculate as calcJegham } from './methodology/jegham-benchmark.js';
import { addUsage, getTotals, getChatTotal } from './lib/storage.js';
import { workSecondsForTurn, hiddenWorkUsage } from './lib/worktime.js';
import { mountWidget, setToday, setChat, layoutWidget } from './lib/widget.js';

const METHODS = { openai: calcOpenAI, google: calcGoogle, flops: calcFlops, jegham: calcJegham };
let methodSetting = 'jegham';

chrome.storage.local.get('method').then((r) => {
  if (r.method) methodSetting = r.method;
});
// Saved chats live at /c/<id> (also inside projects). New chats have no id yet.
function currentChatId() {
  const m = location.pathname.match(/\/c\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function refreshTotals() {
  const { today } = await getTotals();
  setToday(today);
  const id = currentChatId();
  setChat(id ? (await getChatTotal(id)).waterMl : null);
}

chrome.storage.onChanged.addListener((changes) => {
  if (changes.method) methodSetting = changes.method.newValue;
  if (Object.keys(changes).some((k) => k.startsWith('usage:') || k.startsWith('chat:'))) refreshTotals();
});

// ChatGPT marks each message with data-message-author-role. This is the
// one DOM hook most community tooling has relied on; it WILL break on a
// frontend redesign. See METHODOLOGY.md for why there's no better option.
const MESSAGE_SELECTOR = '[data-message-author-role]';

const seen = new Set();
const workCounted = new Map(); // turn key -> seconds of hidden work already counted

// Messages already on screen when a page or saved chat loads are history, not
// new usage. The first pass after load (or after switching saved chats) only
// records them as seen. Going from a new chat ("/") into "/c/..." is not a
// switch, so the first exchange of a new chat still counts.
let baselinePending = true;
let lastPath = location.pathname;

function extractMessages() {
  return Array.from(document.querySelectorAll(MESSAGE_SELECTOR))
    .map((el) => ({
      id: el.getAttribute('data-message-id') || el.textContent.slice(0, 24),
      role: el.getAttribute('data-message-author-role'),
      text: el.textContent || '',
    }))
    .filter((m) => m.text.trim().length > 0);
}

// Hidden work (thinking, reading files, making images) has no text on the page
// except a label like "Worked for 29s" on the assistant's turn. The label can
// appear after the reply is first seen, so we track seconds already counted per
// turn and only add the difference.
function scanWork() {
  const found = new Map();
  for (const el of document.querySelectorAll('[data-message-author-role="assistant"]')) {
    const turn = el.closest('article, [data-testid^="conversation-turn"]') || el.parentElement;
    if (!turn) continue;
    const id = turn.getAttribute('data-turn-id') || turn.getAttribute('data-testid') || el.getAttribute('data-message-id') || '';
    const key = `${currentChatId() || 'new'}|${id}`;
    if (!found.has(key)) found.set(key, workSecondsForTurn(turn));
  }
  return found;
}

function processConversation() {
  const messages = extractMessages();
  const work = scanWork();

  if (location.pathname !== lastPath) {
    if (lastPath.includes('/c/')) baselinePending = true;
    lastPath = location.pathname;
  }
  if (baselinePending) {
    for (const m of messages) seen.add(m.id);
    for (const [key, secs] of work) workCounted.set(key, secs);
    baselinePending = false;
    return;
  }

  let inputTokens = 0;
  let outputTokens = 0;

  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const tokens = countTokens(m.text);
    if (m.role === 'user') {
      inputTokens += tokens;
    } else if (m.role === 'assistant') {
      outputTokens += tokens;
    }
  }

  let hiddenSeconds = 0;
  for (const [key, secs] of work) {
    const before = workCounted.get(key) || 0;
    if (secs > before) {
      hiddenSeconds += secs - before;
      workCounted.set(key, secs);
    }
  }

  if (inputTokens === 0 && outputTokens === 0 && hiddenSeconds === 0) return;

  const calc = METHODS[methodSetting] || calcJegham;
  const total = { energyWh: 0, waterMl: 0, carbonG: 0 };
  const addTo = (r) => {
    total.energyWh += r.energyWh;
    total.waterMl += r.waterMl;
    total.carbonG += r.carbonG || 0;
  };
  if (inputTokens > 0 || outputTokens > 0) {
    addTo(calc({ inputTokens: inputTokens + constants.hiddenOverheadTokens, outputTokens }));
  }
  if (hiddenSeconds > 0) addTo(hiddenWorkUsage(hiddenSeconds, calc));

  addUsage(total, currentChatId());
}

// ChatGPT streams responses token by token, so the DOM mutates dozens of
// times per reply. Processing on every single mutation risks reading a
// message while it's still mid-stream (undercounting it, then never
// re-counting it since its id is already marked "seen"). Debouncing
// coalesces a burst of mutations into one read, ~1.2s after things settle,
// by which point the reply has almost always finished.
let debounceTimer = null;
function scheduleProcess() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(processConversation, 1200);
}

const observer = new MutationObserver(() => scheduleProcess());
observer.observe(document.body, { childList: true, subtree: true });

mountWidget();
refreshTotals();
scheduleProcess();

// The sidebar opening or closing shifts the message box without any event we
// can hook reliably, so re-measure on resize and on a cheap interval.
window.addEventListener('resize', layoutWidget);
let shownPath = location.pathname;
setInterval(() => {
  layoutWidget();
  if (location.pathname !== shownPath) {
    shownPath = location.pathname;
    refreshTotals();
  }
}, 500);