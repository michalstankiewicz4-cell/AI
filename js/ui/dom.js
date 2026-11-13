// Drobne narzędzia interfejsu: tworzenie elementów, podpowiedzi [?], powiadomienia, okna potwierdzenia, pliki.

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
  return el;
}

// Ikona [?] z opisem po najechaniu / kliknięciu
export function help(text) {
  const b = h('button.help', { type: 'button', 'aria-label': 'Pomoc: ' + text, title: '' }, '?');
  const tip = h('span.tip', { role: 'tooltip' }, text);
  b.append(tip);
  b.addEventListener('click', e => { e.stopPropagation(); b.classList.toggle('open'); });
  return b;
}
document.addEventListener('click', () => document.querySelectorAll('.help.open').forEach(b => b.classList.remove('open')));

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
