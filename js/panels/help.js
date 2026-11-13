// Zakładka „Pomoc”: rozszerzone opisy z przykładami i porównaniami. Ikona [?] w panelu prowadzi tu
// pod adres #pomoc/<temat> — strona przewija się do działu i go podświetla.

import { h, clear } from '../ui/dom.js';
import { SECTIONS, TOPIC } from '../help/content.js';
import { RULES } from '../cleaner/rules.js';
import { go } from '../main.js';
import { modelDiagram, LEGEND } from '../help/diagram.js';

const RULE = Object.fromEntries(RULES.map(r => [r.id, r]));
const html = s => { const e = h('span'); e.innerHTML = s; return e; };   // treść pomocy jest nasza (content.js), nie od użytkownika
const visible = s => s.replace(/ /g, '·').replace(/ /g, '⍽').replace(/\t/g, '⇥').replace(/[­​]/g, '¤');

function block(b) {
  const [t, a, c, d] = b;
  if (t === 'p') return h('p', html(a));
  if (t === 'list') return h('ul', a.map(x => h('li', html(x))));
  if (t === 'steps') return h('ol.hsteps', a.map(([ti, tx]) => h('li', h('b', ti), h('span', html(tx)))));
  if (t === 'tip') return h('p.htip', html(a));
  if (t === 'code') return h('pre.hcode', a);
  if (t === 'link') return h('p', h('a', { href: '#pomoc/' + a }, c));
  if (t === 'table') return h('div.tablebox', h('table.htable', h('thead', h('tr', a.map(x => h('th', x)))), h('tbody', c.map(r => h('tr', r.map(x => h('td', html(x))))))));
  if (t === 'ex') return h('div.hex', h('div', h('span.hlab', 'przed'), h('pre', a)), h('span.harrow', '→'), h('div', h('span.hlab', 'po'), h('pre', c)), d ? h('p.note', d) : null);
  if (t === 'diagram') return h('figure.hfig', h('div.hdiagbox', modelDiagram()),
    h('figcaption', h('ol.hlegend', LEGEND.map(([ti, tx]) => h('li', h('b', ti), ' – ', tx)))));
  if (t === 'rule') {
    // przykład liczony na żywo przez prawdziwą regułę — zawsze zgodny z kodem
    const rep = { removed: {} }, r = RULE[a].apply(c, { repeatMin: 4, dedupeMin: 40 }, rep);
    const removed = Object.entries(rep.removed);
    return h('div.hex', h('div', h('span.hlab', 'przed'), h('pre', visible(c))), h('span.harrow', '→'), h('div', h('span.hlab', 'po'), h('pre', visible(r.text))),
      h('p.note', `Zmian: ${r.n}.` + (removed.length ? ` Usunięte znaki: ${removed.map(([ch, n]) => `${ch} ×${n}`).join(', ')}.` : '') + ' Spacje pokazane jako ·, twarda spacja ⍽, tabulator ⇥, znaki niewidoczne ¤. Przykład liczony na żywo przez regułę.'));
  }
  return null;
}

export default {
  id: 'pomoc', title: 'Pomoc', icon: '❓',
  render(root, _r, topic) {
    const groups = [...new Set(SECTIONS.map(s => s.group))];
    const toc = h('nav.htoc', { 'aria-label': 'Spis treści pomocy' }, groups.map(g => h('div', h('b', g), SECTIONS.filter(s => s.group === g).map(s =>
      h('a', { href: '#pomoc/' + s.id, dataset: { id: s.id } }, s.title)))));
    const body = h('div.hbody', SECTIONS.map(s => h('section.card.hsec', { id: 'h-' + s.id }, h('h2', s.title), s.body.map(block))));
    root.append(h('header.ph', h('h1', 'Pomoc'), h('p', 'Opisy funkcji z przykładami i porównaniami. Ikona [?] w panelu prowadzi do odpowiedniego działu. Zacznij od „Krok po kroku”.')),
      h('div.hlayout', toc, body));
    const id = TOPIC[topic] || (topic && SECTIONS.find(s => s.id === topic) ? topic : null);
    if (id) {
      const el = body.querySelector('#h-' + CSS.escape(id));
      toc.querySelectorAll('a').forEach(a => a.classList.toggle('on', a.dataset.id === id));
      requestAnimationFrame(() => { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); });
    }
  },
};
export const openHelp = topic => go('pomoc/' + topic);
