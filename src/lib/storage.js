function pad(n) {
  return String(n).padStart(2, '0');
}

// Local calendar date, not UTC, so "today" rolls over at the user's midnight.
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function add(total, val) {
  total.energyWh += val.energyWh;
  total.waterMl += val.waterMl;
  total.carbonG += val.carbonG || 0;
}

const zero = () => ({ energyWh: 0, waterMl: 0, carbonG: 0 });

// Every exchange is added to the day's total and, when we know which chat it
// happened in, to that chat's own running total.
export async function addUsage(result, chatId) {
  // Never store a broken number: one NaN would wipe that day's running total.
  if (!Number.isFinite(result.energyWh) || !Number.isFinite(result.waterMl)) return;
  const dayKey = `usage:${localDateStr()}`;
  const stored = await chrome.storage.local.get(dayKey);
  const day = stored[dayKey] || { ...zero(), messages: 0 };
  day.energyWh += result.energyWh;
  day.waterMl += result.waterMl;
  day.carbonG = (day.carbonG || 0) + (result.carbonG || 0);
  day.messages += 1;
  const updates = { [dayKey]: day };

  if (chatId) {
    const chatKey = `chat:${chatId}`;
    const chat = (await chrome.storage.local.get(chatKey))[chatKey] || zero();
    add(chat, result);
    updates[chatKey] = chat;
  }
  await chrome.storage.local.set(updates);
}

export async function getChatTotal(chatId) {
  const key = `chat:${chatId}`;
  const stored = await chrome.storage.local.get(key);
  return stored[key] || zero();
}

export async function getTotals() {
  const all = await chrome.storage.local.get(null);
  const days = Object.entries(all).filter(([k]) => k.startsWith('usage:'));

  const todayStr = localDateStr();
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - 6);

  const today = zero();
  const week = zero();
  const allTime = zero();

  for (const [key, val] of days) {
    const dateStr = key.replace('usage:', '');
    const [y, m, d] = dateStr.split('-').map(Number);
    add(allTime, val);
    if (dateStr === todayStr) add(today, val);
    if (new Date(y, m - 1, d) >= weekStart) add(week, val);
  }
  return { today, week, allTime };
}