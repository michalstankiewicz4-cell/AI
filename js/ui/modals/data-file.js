// Okna „Zapisz dane do pliku” i „Wczytaj dane z pliku” (przeniesienie pracy bez GitHub, np. do innej przeglądarki).

import { h, toast, confirmBox, modal, download, pickFiles, num } from '../dom.js';
import { PARTS, collect, exportData, dataFromFile, restore } from '../../core/sync.js';

const count = (k, v) => k === 'settings' ? '' : ` (${num((v || []).length)})`;

export async function exportDataModal() {
  const d = await collect();
  const boxes = Object.entries(PARTS).map(([k, p]) => ({ k, i: h('input', { type: 'checkbox', id: 'exp-' + k, checked: k !== 'conversations' }), label: p.label + count(k, d[k]) }));
  const close = modal('Zapisz dane do pliku',
    h('p.note', 'Plik .json z wybranymi częściami – do przeniesienia na inny komputer lub do innej przeglądarki („Wczytaj dane z pliku”), albo jako kopia zapasowa. Token GitHub nie trafia do pliku. Modele zapisujesz osobno w zakładce „Modele”.'),
    ...boxes.map(b => h('div.field.check', b.i, h('label', { htmlFor: b.i.id }, b.label))),
    h('div.row.end', h('button', { type: 'button', onclick: async () => {
      const what = Object.fromEntries(boxes.map(b => [b.k, b.i.checked]));
      if (!Object.values(what).some(Boolean)) return toast('Zaznacz coś do zapisania.', 'error', 3000, { log: false });
      const out = await exportData(what);
      download(`ai-dane-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out));
      close(); toast('Zapisano plik z danymi.', 'ok');
    } }, 'Zapisz plik')));
}

export async function importDataModal(onDone = () => {}) {
  const [f] = await pickFiles('.json,application/json', false); if (!f) return;
  let pub;
  try { pub = dataFromFile(JSON.parse(await f.text())); } catch (e) { return toast(`${f.name}: ${e.message}`, 'error', 8000); }
  const avail = Object.keys(PARTS).filter(k => pub[k]);
  if (!avail.length) return toast('Plik nie zawiera danych do wczytania.', 'error');
  const boxes = avail.map(k => ({ k, i: h('input', { type: 'checkbox', id: 'imp-' + k, checked: k !== 'settings' }), label: PARTS[k].label + count(k, pub[k][k]) }));
  const mode = h('select', h('option', { value: 'add' }, 'dodaj brakujące (istniejące zostają)'), h('option', { value: 'replace' }, 'zastąp istniejące o tym samym id'));
  const log = h('p.status');
  const close = modal(`Wczytaj dane z pliku: ${f.name}`,
    h('p.note', `Zapisano: ${new Date(pub[avail[0]].publishedAt).toLocaleString('pl-PL')}. Wybierz, co wczytać do tej przeglądarki.`),
    ...boxes.map(b => h('div.field.check', b.i, h('label', { htmlFor: b.i.id }, b.label))),
    h('div.field', h('label', 'Gdy rekord już jest'), mode), log,
    h('div.row.end', h('button', { type: 'button', onclick: async () => {
      const what = Object.fromEntries(boxes.map(b => [b.k, b.i.checked]));
      if (what.settings && !await confirmBox('Zastąpić ustawienia?', 'Obecne ustawienia zostaną zastąpione tymi z pliku (token GitHub zostaje).', 'Zastąp')) return;
      try {
        const r = await restore(pub, what, { replace: mode.value === 'replace', from: 'plik' });
        log.textContent = 'Wczytano. ' + Object.entries(r).map(([k, v]) => k === 'settings' ? 'ustawienia: zastąpione' : `${PARTS[k].label.toLowerCase()}: dodano ${v.added}, zastąpiono ${v.replaced}, pominięto ${v.skipped}`).join('; ') + '.';
        toast('Wczytano dane z pliku.', 'ok');
        setTimeout(() => { close(); onDone(); }, 2500);
      } catch (e) { log.textContent = 'Błąd: ' + e.message; }
    } }, 'Wczytaj')));
}
