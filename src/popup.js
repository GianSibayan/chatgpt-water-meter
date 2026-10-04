import { getTotals } from './lib/storage.js';

const methodSelect = document.getElementById('method');

chrome.storage.local.get('method').then((r) => {
  methodSelect.value = r.method || 'jegham';
});

methodSelect.addEventListener('change', () => {
  chrome.storage.local.set({ method: methodSelect.value });
});

function fmt(v) {
  return `${v.waterMl.toFixed(2)} mL / ${v.energyWh.toFixed(3)} Wh`;
}

async function render() {
  const { today, week, allTime } = await getTotals();
  document.getElementById('today').textContent = fmt(today);
  document.getElementById('week').textContent = fmt(week);
  document.getElementById('all').textContent = fmt(allTime);
}

render();
