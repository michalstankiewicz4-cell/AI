// Zakładka „Logi”: zdarzenia i błędy z czasem, kolorem według ważności, filtrami i zapisem do pliku.

import { h, help, toast, confirmBox, download, num, clear, plural } from '../ui/dom.js';
import { LEVELS, MAX, listLogs, clearLogs, onLog, logsToText } from '../core/log.js';

const ORDER = ['error', 'warn', 'info', 'debug'];
const pad = n => String(n).padStart(2, '0');
const when = t => { const d = new Date(t); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };

export default {
  id: 'logi', title: 'Logi', icon: '📋',
  render(root) {
    let all = [], shown = 200;
    const on = { error: true, warn: true, info: true, debug: false };
    const chips = h('div.row.wrap.logchips'), list = h('div.loglist'), more = h('div'), summary = h('p.note');
    const area = h('select', { 'aria-label': 'Obszar', onchange: () => { shown = 200; draw(); } });
    const q = h('input', { type: 'search', placeholder: 'Szukaj w treści logów…', 'aria-label': 'Szukaj w logach', oninput: () => { shown = 200; draw(); } });
    root.append(
      h('header.ph', h('h1', 'Logi'),
        h('p', 'Co i kiedy działo się w panelu: start, dokumenty, sprawdzanie źródeł, nauka, publikacja, błędy. Dzięki temu widać, w którym momencie coś się popsuło. Kolor oznacza ważność. Logi są tylko w tej przeglądarce. ',
          help(`Ważność: ${ORDER.map(l => `${LEVELS[l].label} – ${LEVELS[l].desc}`).join('; ')}. Zapisywanych jest najwyżej ${num(MAX)} ostatnich wpisów.`, 'logi'))),
      h('section.card',
        h('div.row.wrap', chips, h('span.sp'), area, q),
        h('div.row.wrap', summary, h('span.sp'),
          h('button.ghost', { type: 'button', onclick: () => { const sel = filtered(); if (!sel.length) return toast('Brak logów do zapisania.', 'error', 3000, { log: false }); download(`logi-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.txt`, logsToText(sel), 'text/plain;charset=utf-8'); } }, 'Pobierz logi'),
          h('button.ghost.danger', { type: 'button', onclick: async () => { if (await confirmBox('Wyczyścić logi?', `Usunie ${num(all.length)} ${plural(all.length, 'wpis', 'wpisy', 'wpisów')} z tej przeglądarki. Dokumenty, modele i ustawienia zostają.`, 'Wyczyść', true)) { await clearLogs(); all = []; draw(); } } }, 'Wyczyść logi')),
        list, more));

    function filtered() {
      const a = area.value, s = q.value.trim().toLowerCase();
      return all.filter(e => on[e.level] && (!a || e.area === a) && (!s || (e.msg + ' ' + (e.details || '') + ' ' + e.area).toLowerCase().includes(s)));
    }
    function row(e) {
      return h('article.logrow.lv-' + e.level,
        h('div.row.wrap', h('span.logtime', when(e.at)), h('span.badge.lv-' + e.level, LEVELS[e.level].label), h('span.logarea', e.area), h('span.logmsg', e.msg), h('span.sp'), h('span.note', 'v' + e.app)),
        e.details ? h('details', h('summary', 'Szczegóły'), h('pre.logdet', e.details)) : null);
    }
    function draw() {
      const cnt = Object.fromEntries(ORDER.map(l => [l, all.filter(e => e.level === l).length]));
      clear(chips); chips.append(...ORDER.map(l => h('label.logchip.lv-' + l, h('input', { type: 'checkbox', checked: on[l], onchange: ev => { on[l] = ev.target.checked; shown = 200; draw(); } }), ` ${LEVELS[l].label} (${num(cnt[l])})`)));
      const areas = [...new Set(all.map(e => e.area))].sort(), cur = area.value;
      clear(area); area.append(h('option', { value: '' }, 'Wszystkie obszary'), ...areas.map(a => h('option', { value: a, selected: a === cur }, a)));
      const sel = filtered();
      summary.textContent = all.length ? `Pokazano ${num(Math.min(shown, sel.length))} z ${num(sel.length)} pasujących (wszystkich: ${num(all.length)}). Najnowsze na górze.` : '';
      clear(list); clear(more);
      if (!sel.length) list.append(h('p.note', all.length ? 'Żaden wpis nie pasuje do filtrów.' : 'Brak logów.'));
      list.append(...sel.slice(0, shown).map(row));
      if (sel.length > shown) more.append(h('button.ghost.small', { type: 'button', onclick: () => { shown += 500; draw(); } }, 'Pokaż starsze'));
    }
    const off = onLog(e => { all.unshift(e); draw(); });
    listLogs().then(l => { const ids = new Set(all.map(e => e.id)); all = [...all, ...l.filter(e => !ids.has(e.id))]; draw(); });
    return off;
  },
};
