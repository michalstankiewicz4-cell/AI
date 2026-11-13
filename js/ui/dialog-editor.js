// Edytor rozmowy wzorcowej (naprzemienne kwestie użytkownika i AI). Używany w „Rozmowach wzorcowych” i „Historii rozmów”.

import { h, help, clear } from './dom.js';
import { settings } from '../core/settings.js';

// Edytor rozmowy: naprzemienne kwestie użytkownika i AI. onSave(turns) — turns: [{role, text}]
export function dialogEditor(turns, onSave) {
  const t = settings().general, rows = h('div.turns');
  let list = turns.length ? turns.map(x => ({ ...x })) : [{ role: 'user', text: '' }, { role: 'bot', text: '' }];
  const draw = () => {
    clear(rows);
    list.forEach((x, i) => rows.append(h('div.turn.' + x.role,
      h('span.who', x.role === 'user' ? t.userTag : t.botTag),
      h('textarea', { rows: 2, value: x.text, placeholder: x.role === 'user' ? 'Pytanie użytkownika' : 'Wzorcowa odpowiedź AI', oninput: e => { x.text = e.target.value; } }),
      i >= 2 && i % 2 === 0 ? h('button.ghost.small', { type: 'button', title: 'Usuń tę wymianę', onclick: () => { list.splice(i, 2); draw(); } }, '✕') : null)));
  };
  draw();
  return h('div.editor', rows,
    h('div.row', h('button.ghost.small', { type: 'button', onclick: () => { list.push({ role: 'user', text: '' }, { role: 'bot', text: '' }); draw(); } }, '+ kolejna wymiana'),
      help('Kilka wymian w jednej rozmowie uczy sieć korzystać z kontekstu (nawiązywać do wcześniejszych pytań).', 'wymiany'), h('span.sp'),
      h('button', { type: 'button', onclick: () => onSave(list.map(x => ({ role: x.role, text: x.text.trim() }))) }, 'Zapisz')));
}
