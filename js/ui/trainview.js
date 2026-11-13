// Widok trwającej nauki (wspólny dla nauki na dokumentach i dostrajania): pasek postępu, wykres, liczby, próbka tekstu.

import { h, help, num, dec, dur, clear } from './dom.js';
import { drawLoss } from './chart.js';
import { state, onTraining, stop } from '../core/training.js';
import { bitsPerChar } from '../core/models.js';

export function trainView(kind, { onDone } = {}) {
  const bar = h('div.progress', h('div.fill')), status = h('p.status');
  const canvas = h('canvas.chart', { 'aria-label': 'Wykres błędu w trakcie nauki' });
  const metrics = h('dl.metrics'), sample = h('pre.sample'), extra = h('div');
  const stopBtn = h('button.ghost', { type: 'button', onclick: () => { stop(); stopBtn.disabled = true; } }, 'Zatrzymaj');
  const el = h('section.card.train',
    h('div.row', h('h2', 'Przebieg'), h('span.sp'), stopBtn), status, bar,
    h('div.learn', h('div.chartbox', canvas, h('div.legend', h('span.lt', 'błąd na tekście do nauki'), h('span.lv', 'błąd na tekście sprawdzającym'), help('Błąd = jak bardzo sieć jest zaskoczona prawdziwym następnym tokenem. Ma maleć. Gdy błąd sprawdzający rośnie, a do nauki dalej spada, sieć uczy się na pamięć — panel na końcu wróci wtedy do najlepszego momentu.', 'blad'))), metrics),
    h('h3', kind === 'base' ? 'Co pisze sieć' : 'Jak odpowiada', help(kind === 'base' ? 'Próbka tekstu pisanego przez sieć od zera, odświeżana co kilka sekund.' : 'Odpowiedź na pytanie z rozmowy odłożonej do sprawdzania (sieć jej nie widziała przy nauce).', 'probka')), sample, extra);

  const mine = () => (state.job && state.job.kind === kind) || (!state.job && state.result && state.result.kind === kind) || (!state.job && state.error && state.lastKind === kind);
  const render = () => {
    const active = state.job && state.job.kind === kind;
    el.hidden = !mine() && !active;
    if (el.hidden) return;
    stopBtn.hidden = !active; stopBtn.disabled = false;
    const m = state.last, cpt = state.data && state.data.cpt;
    bar.firstChild.style.width = m ? (100 * m.step / m.steps).toFixed(1) + '%' : '0%';
    if (state.error) status.textContent = 'Błąd: ' + state.error;
    else if (state.tok) status.textContent = `Buduję słownik tokenów: ${state.tok.r} z ${state.tok.n} sklejeń…`;
    else if (active && !m) status.textContent = 'Przygotowuję dane…';
    else if (active) { const eta = m.ms && m.steps > m.step ? (m.steps - m.step) * m.ms / 1000 : 0; status.textContent = `Krok ${num(m.step)} z ${num(m.steps)} · ${m.device}${eta ? ' · zostało ok. ' + dur(eta) : ''}`; }
    else if (state.result) status.textContent = `Gotowe: zapisano model „${state.result.name}”${state.result.metrics.restored ? ' (przywrócony z najlepszego momentu nauki)' : ''}${state.result.metrics.stopped ? ' · nauka zatrzymana przed końcem' : ''}.`;
    clear(metrics);
    if (m) {
      const row = (k, v, t, topic) => metrics.append(h('dt', k, t ? help(t, topic) : null), h('dd', v));
      row('Błąd sprawdzający', dec(m.val, 3)); row('Najlepszy', `${dec(m.bestVal, 3)} (krok ${num(m.bestStep)})`);
      row('Bity na znak', dec(bitsPerChar(m.val, cpt), 2), 'Ile informacji sieć traci na każdą literę tekstu sprawdzającego. Mniej = lepiej. Dla porównania: zgadywanie na ślepo to ok. 6 bitów, dobra mała sieć na polskim tekście schodzi w okolice 1,5–2.', 'bity-na-znak');
      row('Czas kroku', m.ms ? dec(m.ms, 0) + ' ms' : '–'); row('Parametry', num(m.params)); row('Upłynęło', dur(m.elapsed / 1000));
      if (m.ownVal === false) row('Uwaga', 'za mało danych na osobne sprawdzanie — błąd liczony na danych do nauki');
    }
    if (state.data) {
      const d = state.data;
      metrics.append(h('dt', 'Dane'), h('dd', d.conv != null ? `${num(d.conv)} rozmów (${num(d.val)} do sprawdzania), ${num(d.tokens)} tokenów` : `${num(d.tokens)} tokenów, słownik ${num(d.V)}`));
      const dropped = Object.entries(d.dropped || {});
      if (dropped.length) metrics.append(h('dt', 'Pominięte znaki', help('Znaki, których model nie zna (nie było ich w tekście, na którym powstał słownik). Zostały pominięte.', 'pominiete-znaki')), h('dd', dropped.slice(0, 20).map(([c, n]) => `${c} ×${n}`).join(' ')));
    }
    sample.textContent = state.sample || '…';
    clear(extra);
    if (state.warns.length) extra.append(...state.warns.map(w => h('p.warnline', w)));
    if (!active && state.result && state.result.kind === kind && onDone) extra.append(onDone(state.result));
    requestAnimationFrame(() => drawLoss(canvas, state.points, m ? m.steps : 1));
  };
  const off = onTraining(render);
  const ro = new ResizeObserver(() => !el.hidden && drawLoss(canvas, state.points, state.last ? state.last.steps : 1)); ro.observe(canvas);
  render();
  return { el, destroy: () => { off(); ro.disconnect(); } };
}
