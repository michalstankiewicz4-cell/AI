// Formularz z opisu ustawień (SCHEMA w js/core/settings.js): etykieta, pole i podpowiedź [?] przy każdym.

import { h, help } from './dom.js';
import { SCHEMA } from '../core/settings.js';

// values: obiekt grupy ustawień (zmieniany na miejscu); onChange(id, value) po każdej zmianie
export function fieldsForm(group, values, { only, onChange, disabled } = {}) {
  const g = SCHEMA.find(x => x.group === group);
  const box = h('div.fields');
  for (const f of g.fields) {
    if (only && !only.includes(f.id)) continue;
    const id = `f-${group}-${f.id}`;
    let input;
    const set = v => { values[f.id] = v; onChange && onChange(f.id, v); };
    if (f.type === 'bool') input = h('input', { type: 'checkbox', id, checked: !!values[f.id], onchange: e => set(e.target.checked) });
    else if (f.type === 'select') {
      input = h('select', { id, onchange: e => { const o = f.opts[e.target.selectedIndex]; set(o[0]); } },
        f.opts.map(([v, l]) => h('option', { value: String(v), selected: String(v) === String(values[f.id]) }, l)));
    } else input = h('input', { type: f.type === 'password' ? 'password' : 'text', id, value: values[f.id] ?? '', oninput: e => set(e.target.value) });
    if (disabled && disabled.includes(f.id)) input.disabled = true;
    box.append(h('div.field' + (f.type === 'bool' ? '.check' : ''), f.type === 'bool'
      ? [input, h('label', { htmlFor: id }, f.label), help(f.help, `${group}.${f.id}`)]
      : [h('label', { htmlFor: id }, f.label, help(f.help, `${group}.${f.id}`)), input]));
  }
  return box;
}
