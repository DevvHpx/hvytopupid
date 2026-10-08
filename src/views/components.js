// ============================================================
// Reusable UI fragments.
// ============================================================
import { esc, rupiah, formatDateTime } from '../utils/helpers.js';
import { statusMeta, STATUS } from '../services/orders.js';

const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4.5 13.5H11l-1 8.5 9-12h-6.5z"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></svg>',
  headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="2" y="13" width="4" height="7" rx="1.5"/><rect x="18" y="13" width="4" height="7" rx="1.5"/><path d="M20 20a3 3 0 0 1-3 3h-3"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12l-8 8-9-9V4h7z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 13 4 4 10-11"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

export function icon(name) { return ICONS[name] || ''; }

// ---------- Game card ----------
export function gameCard(g, { eager = false } = {}) {
  const from = g.min_price ? `Mulai <b>${rupiah(g.min_price)}</b>` : 'Lihat harga';
  const loading = eager ? 'eager' : 'lazy';
  const prio = eager ? ' fetchpriority="high"' : '';
  return `<a class="game-card" href="/game/${esc(g.slug)}">
    <div class="thumb">
      ${g.popular ? '<span class="tag-pop">POPULER</span>' : ''}
      ${g.category_name ? `<span class="tag-cat">${esc(g.category_name)}</span>` : ''}
      <img src="${esc(g.logo)}" alt="Logo ${esc(g.name)}" width="256" height="256" loading="${loading}"${prio} decoding="async">
    </div>
    <div class="body">
      <h3>${esc(g.name)}</h3>
      <div class="pub">${esc(g.publisher || '')}</div>
      <div class="price-from">${from}</div>
    </div>
  </a>`;
}

// ---------- Status pill ----------
export function statusPill(status) {
  const m = statusMeta(status);
  return `<span class="status-pill ${m.tone}">${m.icon} ${esc(m.label)}</span>`;
}

// ---------- Progress steps ----------
export function stepsBar(status) {
  const m = statusMeta(status);
  const labels = [STATUS.pending_payment, STATUS.paid, STATUS.processing, STATUS.success];
  const isErr = status === 'failed' || status === 'refund';
  return `<div class="steps" aria-hidden="true">${labels.map((_, i) => {
    const on = m.step >= i + 1;
    const err = isErr && i === 3;
    return `<span class="s ${on ? 'on' : ''} ${err ? 'err' : ''}"></span>`;
  }).join('')}</div>`;
}

// ---------- Timeline from order_events ----------
export function timeline(events) {
  if (!events.length) return '';
  return `<div class="timeline">${events.map((e, i) => {
    const m = statusMeta(e.status);
    const last = i === events.length - 1;
    return `<div class="tl-item ${last ? 'current' : 'done'}">
      <div class="tl-dot">${last ? m.icon : '✓'}</div>
      <div class="tl-body">
        <div class="t">${esc(m.label)}</div>
        ${e.message ? `<div class="m">${esc(e.message)}</div>` : ''}
        <div class="time">${esc(formatDateTime(e.created_at))}</div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

// ---------- Section header ----------
export function sectionHead(title, sub = '', more = '') {
  return `<div class="section-head">
    <div><h2 class="silver-text">${esc(title)}</h2>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</div>
    ${more}
  </div>`;
}

// ---------- Notice ----------
export function notice(text, tone = 'info', ic = 'ℹ️') {
  return `<div class="notice ${tone}"><span class="ic">${ic}</span><span>${text}</span></div>`;
}
