// Okno profilu: nazwa, opis, kategorie dokumentów, tekst ogólny, szablon sieci (jeszcze niewyuczonej).

import { h, help, toast, modal } from '../dom.js';
import { TEMPLATES, saveProfile, applyTemplate } from '../../core/profiles.js';
import { listDocs, tagCounts, mergeTags } from '../../core/documents.js';
import { listPacks } from '../../core/packs.js';

export async function profileEditor(p, onSaved) {
  const known = mergeTags(tagCounts(await listDocs()).map(([t]) => t), (await listPacks()).map(x => x.name));
  const name = h('input', { type: 'text', value: p ? p.name : '', placeholder: 'np. Prawo pracy' });
  const desc = h('input', { type: 'text', value: p ? p.description : '', placeholder: 'czego dotyczy (opcjonalnie)' });
  const sel = new Set(p ? p.tags : []), tagBox = h('div.row.wrap.tagpick');
  const extra = h('input', { type: 'text', placeholder: 'inna kategoria, Enter', size: 18, onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); const v = extra.value.trim(); if (v) { sel.add(v); if (!known.includes(v)) known.push(v); extra.value = ''; drawTags(); } } } });
  const drawTags = () => { tagBox.replaceChildren(...known.map(t => h('button.tagbtn' + (sel.has(t) ? '.on' : ''), { type: 'button', 'aria-pressed': sel.has(t) ? 'true' : 'false', onclick: () => { sel.has(t) ? sel.delete(t) : sel.add(t); drawTags(); } }, t)), extra); };
  drawTags();
  const gen = h('input', { type: 'checkbox', checked: p ? p.general !== false : true });
  const tpl = p ? p.template : 'mala';
  const radios = Object.entries(TEMPLATES).map(([k, t]) => h('label.tplopt', h('input', { type: 'radio', name: 'tpl', value: k, checked: k === tpl }), h('b', ' ' + t.label), h('span.note', ` – ${t.pretrain.layers} warstw, szerokość ${t.pretrain.dim}, okno ${t.pretrain.ctx}, ${t.pretrain.steps} kroków; ${t.note}`)));
  const close = modal(p ? `Profil: ${p.name}` : 'Nowy profil',
    h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Opis'), desc),
    h('div.field', h('label', 'Kategorie dokumentów profilu ', help('Do profilu należą dokumenty i rozmowy wzorcowe, które mają choć jedną z tych kategorii. Nowe dokumenty i rozmowy dodane przy wybranym profilu dostają jego kategorie same.', 'profile')), tagBox),
    h('div.field.check', gen, h('label', ' tekst ogólny (np. Wikipedia) też należy do profilu')),
    h('div.field', h('label', 'Szablon sieci ', help('Gotowa budowa sieci (jeszcze niewyuczonej) i liczba kroków nauki. Zmienisz ją też później w Nauce – ustawienia nauki i dostrajania każdy profil ma swoje.', 'profile')), ...radios),
    h('div.row.end', h('button', { type: 'button', onclick: async () => {
      if (!name.value.trim()) return toast('Podaj nazwę profilu.', 'error', 3000, { log: false });
      if (!sel.size) return toast('Wybierz co najmniej jedną kategorię.', 'error', 3000, { log: false });
      const template = radios.map(r => r.querySelector('input')).find(i => i.checked).value;
      const saved = await saveProfile({ ...(p || {}), name: name.value, description: desc.value, tags: [...sel], general: gen.checked, template: p ? p.template : template, settings: p ? p.settings : null });
      if (p && template !== p.template) await applyTemplate(saved.id, template);
      close(); toast(`Zapisano profil „${saved.name}”.`, 'ok'); onSaved(saved, !p);
    } }, 'Zapisz profil')));
}
