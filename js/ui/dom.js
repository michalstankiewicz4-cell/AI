// Drobne narzędzia interfejsu: tworzenie elementów, podpowiedzi [?], powiadomienia, okna potwierdzenia, pliki.

import { tipFor } from './tips.js';

// h('button.ghost#id', { onclick, title }, 'tekst', dziecko, …) — element z klasami, atrybutami i dziećmi
export function h(sel, attrs, ...kids) {
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) { kids.unshift(attrs); attrs = {}; }
  const [, tag = 'div', rest = ''] = sel.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(tag || 'div');
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) m[1] === '.' ? el.classList.add(m[2]) : el.id = m[2];
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  const add = c => { if (c == null || c === false) return; if (Array.isArray(c)) c.forEach(add); else el.append(c instanceof Node ? c : String(c)); };
  kids.forEach(add);
  // dymek z podpowiedzią dla przycisku bez własnego title (słownik w tips.js)
  if (el.tagName === 'BUTTON' && !el.title && !el.classList.contains('help')) { const t = tipFor(el.textContent.trim()); if (t) el.title = t; }
  return el;
}

// Ikona [?] z opisem po najechaniu, fokusie albo kliknięciu.
// Dymek jest jeden, przypięty do strony (position: fixed): nie przycinają go ramki kart, tabel ani okien,
// dopasowuje się do tekstu i zawsze mieści na ekranie (przesuwa się od krawędzi, a gdy brak miejsca pod ikoną — pokazuje nad nią).
let tipEl = null, tipOwner = null, tipPinned = false;
function showTip(b, text) {
  if (!tipEl) { tipEl = h('div.tipfloat', { role: 'tooltip', id: 'tipfloat' }); }
  const host = b.closest('dialog[open]') || document.body;          // w otwartym oknie dymek musi być w jego warstwie
  if (tipEl.parentNode !== host) host.append(tipEl);
  tipEl.textContent = text; tipEl.hidden = false; tipOwner = b; b.setAttribute('aria-describedby', 'tipfloat');
  const m = 8, vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  tipEl.style.maxWidth = Math.min(340, vw - 2 * m) + 'px'; tipEl.style.left = '0px'; tipEl.style.top = '0px';
  const r = b.getBoundingClientRect(), t = tipEl.getBoundingClientRect();
  const left = Math.max(m, Math.min(r.left + r.width / 2 - t.width / 2, vw - t.width - m));
  const below = r.bottom + 6, above = r.top - 6 - t.height;
  const top = below + t.height <= vh - m || above < m ? Math.min(below, Math.max(m, vh - t.height - m)) : above;
  tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
  tipEl.style.setProperty('--arrow', Math.max(10, Math.min(t.width - 10, r.left + r.width / 2 - left)) + 'px');
  tipEl.classList.toggle('up', top < r.top);
}
function hideTip() { if (tipEl) tipEl.hidden = true; if (tipOwner) tipOwner.removeAttribute('aria-describedby'); tipOwner = null; tipPinned = false; }
// topic: dział Pomocy (js/help/content.js → topics). Z tematem kliknięcie przenosi do Pomocy, bez tematu przypina dymek.
export function help(text, topic) {
  const full = topic ? text + '\n\nKliknij [?], aby przeczytać więcej w Pomocy.' : text;
  const b = h('button.help', { type: 'button', 'aria-label': 'Pomoc: ' + text }, '?');
  b.addEventListener('mouseenter', () => { if (!tipPinned) showTip(b, full); });
  b.addEventListener('mouseleave', () => { if (!tipPinned) hideTip(); });
  b.addEventListener('focus', () => showTip(b, full));
  b.addEventListener('blur', () => { if (!tipPinned) hideTip(); });
  b.addEventListener('click', e => {
    e.stopPropagation();
    if (topic) { hideTip(); location.hash = 'pomoc/' + topic; return; }
    if (tipPinned && tipOwner === b) hideTip(); else { showTip(b, full); tipPinned = true; }
  });
  return b;
}
document.addEventListener('click', () => tipPinned && hideTip());
document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
window.addEventListener('scroll', () => tipOwner && hideTip(), true);
window.addEventListener('resize', () => tipOwner && hideTip());

let toastBox = null;
export function toast(msg, kind = 'info', ms = 4000) {
  if (!toastBox) { toastBox = h('div.toasts', { 'aria-live': 'polite' }); document.body.append(toastBox); }
  const t = h('div.toast.' + kind, msg);
  toastBox.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

// Okno potwierdzenia; zwraca Promise<boolean>
export function confirmBox(title, text, okLabel = 'Tak', danger = false) {
  return new Promise(res => {
    const close = v => { dlg.close(); dlg.remove(); res(v); };
    const dlg = h('dialog.modal', h('h3', title), h('p', text),
      h('div.row.end', h('button.ghost', { type: 'button', onclick: () => close(false) }, 'Anuluj'),
        h('button' + (danger ? '.danger' : ''), { type: 'button', onclick: () => close(true) }, okLabel)));
    dlg.addEventListener('cancel', () => res(false));
    document.body.append(dlg); dlg.showModal();
  });
}
// Okno z dowolną treścią; zwraca funkcję zamykającą
export function modal(title, ...body) {
  const dlg = h('dialog.modal.wide', h('div.row', h('h3', title), h('span.sp'), h('button.ghost.icon', { type: 'button', 'aria-label': 'Zamknij', onclick: () => close() }, '✕')), ...body);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg); dlg.showModal();
  return close;
}

export function download(name, data, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = h('a', { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function pickFiles(accept, multiple = true) {
  return new Promise(res => {
    const i = h('input', { type: 'file', accept, multiple, style: { display: 'none' }, onchange: () => { res([...i.files]); i.remove(); } });
    document.body.append(i); i.click();
  });
}

const nf = new Intl.NumberFormat('pl-PL');
export const num = v => v == null ? '–' : nf.format(v);
export const dec = (v, d = 2) => v == null ? '–' : v.toFixed(d).replace('.', ',');
export const date = t => t ? new Date(t).toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }) : '–';
export const dur = s => { s = Math.round(s); if (s < 60) return s + ' s'; const m = Math.floor(s / 60); if (m < 60) return `${m} min ${s % 60} s`; return `${Math.floor(m / 60)} h ${m % 60} min`; };
export const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return n === 1 ? one : (b >= 2 && b <= 4 && (a < 12 || a > 14)) ? few : many; };
export const clear = el => { el.replaceChildren(); return el; };
