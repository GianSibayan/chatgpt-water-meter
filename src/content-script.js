import constants from './constants.js';
import { countTokens } from './lib/tokenizer.js';
import { calculate as calcOpenAI } from './methodology/openai-disclosed.js';
import { calculate as calcGoogle } from './methodology/google-fullstack.js';
import { calculate as calcFlops } from './methodology/flops-based.js';
import { calculate as calcJegham } from './methodology/jegham-benchmark.js';
import { addUsage, getTotals, getChatTotal } from './lib/storage.js';
import { scanWorkLabels, scanGeneratedImages, hiddenWorkUsage, imageUsage } from './lib/worktime.js';
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
const imagesCounted = new Set(); // generated image ids already counted

// Only things that appear after you press send are counted. Everything already
// on screen (an old chat opening, older messages or images loading late) is
// history and is just recorded so it never counts. Pressing send marks the chat
// "active"; opening a different chat ends that, except for a brand new chat
// ("/") turning into "/c/..." right after you send its first message.
const ACTIVE_MS = 15 * 60 * 1000;
let active = false;
let activeUntil = 0;
let lastSendAt = 0;
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
// except a label like "Worked for 29s" in the turn. The label can appear after
// the reply is first seen, so we track seconds already counted per turn and
// only add the difference.
function scanWork() {
  const found = new Map();
  const root = document.querySelector('main') || document.body;
  for (const { idPart, seconds } of scanWorkLabels(root)) {
    const key = `${currentChatId() || 'new'}|${idPart}`;
    found.set(key, (found.get(key) || 0) + seconds);
  }
  return found;
}

function scanImages() {
  return scanGeneratedImages(document.querySelector('main') || document.body);
}

function snapshot() {
  return { messages: extractMessages(), work: scanWork(), images: scanImages() };
}

function baselineWith(snap) {
  for (const m of snap.messages) seen.add(m.id);
  for (const [key, secs] of snap.work) workCounted.set(key, secs);
  for (const im of snap.images) imagesCounted.add(im.id);
}

// Opening a different chat ends the "active" state. Going from a new chat ("/")
// into "/c/..." right after sending its first message does not.
function syncPath() {
  if (location.pathname === lastPath) return;
  const newChatStarted = active && !lastPath.includes('/c/') && location.pathname.includes('/c/');
  if (!newChatStarted) active = false;
  lastPath = location.pathname;
}

function onSend() {
  syncPath();
  const now = Date.now();
  // Enter fires several events at once; only the first one may snapshot, before
  // the new message reaches the page.
  if (now - lastSendAt > 1500) baselineWith(snapshot());
  lastSendAt = now;
  active = true;
  activeUntil = now + ACTIVE_MS;
}

document.addEventListener('submit', onSend, true);
document.addEventListener(
  'keydown',
  (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.target.closest && e.target.closest('#prompt-textarea, form')) onSend();
  },
  true
);
document.addEventListener(
  'click',
  (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b) return;
    const label = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-testid') || ''} ${b.id || ''}`;
    if (/send|submit|regenerate|retry|try again|resend/i.test(label)) onSend();
  },
  true
);

function processConversation() {
  syncPath();
  const { messages, work, images } = snapshot();

  if (!active || Date.now() > activeUntil) {
    baselineWith({ messages, work, images });
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

  // Images are counted at a flat estimate, and a turn with an image is not also
  // counted by its time label, so the same work is never counted twice.
  let newImages = 0;
  const imageTurns = new Set();
  for (const im of images) {
    imageTurns.add(`${currentChatId() || 'new'}|${im.idPart}`);
    if (!imagesCounted.has(im.id)) {
      imagesCounted.add(im.id);
      newImages++;
    }
  }

  let hiddenSeconds = 0;
  for (const [key, secs] of work) {
    if (imageTurns.has(key)) continue;
    const before = workCounted.get(key) || 0;
    if (secs > before) {
      hiddenSeconds += secs - before;
      workCounted.set(key, secs);
    }
  }

  if (inputTokens === 0 && outputTokens === 0 && hiddenSeconds === 0 && newImages === 0) return;

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
  if (newImages > 0) addTo(imageUsage(newImages, calc));

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
  syncPath();
  layoutWidget();
  if (location.pathname !== shownPath) {
    shownPath = location.pathname;
    refreshTotals();
  }
}, 500);