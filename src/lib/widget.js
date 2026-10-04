// The tank fills on a log scale: the first few mL visibly move it, and a full
// liter bottle (1000 mL) reads as nearly full. It never drains as usage grows.
const FULL_ML = 1000;
const MIN_LEVEL = 0.1;
const MAX_LEVEL = 0.92;

export function fmtMl(ml) {
  if (ml >= 1000) return `~${(ml / 1000).toFixed(2)} L`;
  if (ml >= 100) return `~${Math.round(ml)} mL`;
  if (ml >= 10) return `~${ml.toFixed(1)} mL`;
  return `~${ml.toFixed(2)} mL`;
}

export function levelFor(ml) {
  const frac = Math.min(1, Math.log10(1 + Math.max(0, ml)) / Math.log10(1 + FULL_ML));
  return MIN_LEVEL + (MAX_LEVEL - MIN_LEVEL) * frac;
}

// One wave period is 100 units, two periods across 200, so sliding the svg by
// exactly half its width loops seamlessly.
const WAVE_FRONT = 'M0 6 Q25 -2 50 6 T100 6 T150 6 T200 6 V12 H0 Z';
const WAVE_BACK = 'M0 6 Q25 10 50 6 T100 6 T150 6 T200 6 V12 H0 Z';

function waveSvg(cls, d) {
  return `<svg class="wm-wave ${cls}" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path d="${d}"/></svg>`;
}

export function mountWidget() {
  if (document.getElementById('water-meter-widget')) return;
  const el = document.createElement('div');
  el.id = 'water-meter-widget';
  el.innerHTML = `
    <div class="wm-card">
      <div class="wm-water">${waveSvg('wm-wave-back', WAVE_BACK)}${waveSvg('wm-wave-front', WAVE_FRONT)}</div>
      <div class="wm-content">
        <div class="wm-header">Water Meter</div>
        <div class="wm-row"><span>This chat</span><strong id="wm-chat">-</strong></div>
        <div class="wm-row"><span>All chats today</span><strong id="wm-today">-</strong></div>
        <div class="wm-extra" id="wm-extra"></div>
      </div>
    </div>
    <div class="wm-credit">@euginini06_</div>
  `;
  el.style.setProperty('--wm-level', `${(levelFor(0) * 100).toFixed(1)}%`);
  document.body.appendChild(el);
  layoutWidget();
}

export function setChat(ml) {
  const chat = document.getElementById('wm-chat');
  if (chat) chat.textContent = ml == null ? '-' : fmtMl(ml);
}

export function setToday(today) {
  const el = document.getElementById('wm-today');
  if (el) el.textContent = fmtMl(today.waterMl);
  const extra = document.getElementById('wm-extra');
  if (extra) {
    if (today.waterMl > 0) {
      const carbon = today.carbonG > 0 ? `, ~${today.carbonG.toFixed(2)} g CO2e` : '';
      extra.textContent = `~${today.energyWh.toFixed(2)} Wh energy${carbon}`;
    } else {
      extra.textContent = '';
    }
  }
  const widget = document.getElementById('water-meter-widget');
  if (widget) widget.style.setProperty('--wm-level', `${(levelFor(today.waterMl) * 100).toFixed(1)}%`);
}

function findComposer() {
  const input = document.querySelector('#prompt-textarea');
  return (input && input.closest('form')) || document.querySelector('form');
}

// ChatGPT's sidebar changes how much free space sits right of the message box.
// Measure that gutter: roomy gutter means a full-size tank beside the box,
// tight gutter means a compact tank parked just above it. Never on top of it.
export function layoutWidget() {
  const el = document.getElementById('water-meter-widget');
  if (!el) return;
  const RIGHT = 32;
  const BOTTOM = 10;
  const GAP = 14;
  const composer = findComposer();
  const r = composer && composer.getBoundingClientRect();
  if (!r || r.width === 0) {
    el.classList.add('wm-compact');
    el.style.width = '';
    el.style.bottom = `${BOTTOM}px`;
    return;
  }
  const gutter = window.innerWidth - r.right - RIGHT - GAP;
  if (gutter >= 190) {
    el.classList.remove('wm-compact');
    el.style.width = `${Math.min(gutter, 260)}px`;
    el.style.bottom = `${BOTTOM}px`;
  } else {
    el.classList.add('wm-compact');
    el.style.width = '';
    el.style.bottom = `${window.innerHeight - r.top + 10}px`;
  }
}