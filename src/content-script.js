import constants from './constants.js';
import { countTokens } from './lib/tokenizer.js';
import { calculate as calcOpenAI } from './methodology/openai-disclosed.js';
import { calculate as calcGoogle } from './methodology/google-fullstack.js';
import { calculate as calcFlops } from './methodology/flops-based.js';
import { calculate as calcJegham } from './methodology/jegham-benchmark.js';
import { addUsage, getTotals, getChatTotal } from './lib/storage.js';
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
      reasoning: !!el.querySelector('[data-reasoning], .reasoning, [aria-label*="reasoning" i]'),
    }))
    .filter((m) => m.text.trim().length > 0);
}

function processConversation() {
  const messages = extractMessages();

  if (location.pathname !== lastPath) {
    if (lastPath.includes('/c/')) baselinePending = true;
    lastPath = location.pathname;
  }
  if (baselinePending) {
    for (const m of messages) seen.add(m.id);
    baselinePending = false;
    return;
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let sawReasoning = false;

  for (const m of messages) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    const tokens = countTokens(m.text);
    if (m.role === 'user') {
      inputTokens += tokens;
    } else if (m.role === 'assistant') {
      outputTokens += tokens;
      if (m.reasoning) sawReasoning = true;
    }
  }

  if (inputTokens === 0 && outputTokens === 0) return;

  const totalInput = inputTokens + constants.hiddenOverheadTokens;
  const effectiveOutput = sawReasoning ? outputTokens * constants.reasoningMultiplier : outputTokens;

  const calc = METHODS[methodSetting] || calcJegham;
  const result = calc({ inputTokens: totalInput, outputTokens: effectiveOutput });

  addUsage(result, currentChatId());
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