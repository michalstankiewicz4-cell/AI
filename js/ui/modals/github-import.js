// Okno „Wczytaj z GitHub”: opublikowane modele oraz dane (ustawienia, dokumenty, rozmowy wzorcowe, historia rozmów).
// Działa bez tokenu (GitHub Pages albo raw.githubusercontent.com). Przenosi pracę na inny komputer.

import { h, help, toast, confirmBox, modal, num, dec, date, clear } from '../dom.js';
import { settings } from '../../core/settings.js';
import { saveModel } from '../../core/models.js';
import { unload } from '../../core/ai.js';
import { publishedIndex, downloadPublished } from '../../core/github.js';
import { PARTS, fetchPublishedData, restore } from '../../core/sync.js';
import { db } from '../../core/db.js';

// Dodanie modelu z pliku albo z GitHub; pyta, jeśli model o tym id już jest
export async function addModelConfirm(m, from) {
  if (await db.get('models', m.id) && !await confirmBox('Model już istnieje', `Model „${m.name}” jest już w bazie. Zastąpić go?`, 'Zastąp')) return false;
  await unload(m.id); await saveModel(m); toast(`Wczytano „${m.name}” (${from}).`, 'ok');
  return true;
}

export function githubImportModal() {
  const gh = settings().github, modelsBox = h('div', h('p.status', 'Pobieram listę modeli…')), dataBox = h('div', h('p.status', 'Sprawdzam opublikowane dane…'));
  let changed = false;
  modal('Wczytaj z GitHub',
    h('p.note', `Repo ${gh.repo}, gałąź ${gh.branch}. Wczytanie dodaje do tej przeglądarki to, czego tu jeszcze nie ma.`),
    h('h3', 'Modele', help('Każdy model wczytujesz osobno. Jeśli model o tym samym id już jest, panel zapyta, czy go zastąpić.', 'wczytaj-z-github')), modelsBox,
    h('h3', 'Dane', help('Ustawienia zastępują obecne w całości (token zostaje). Dokumenty, rozmowy wzorcowe i historia: dodawane są rekordy, których tu nie ma; istniejące (to samo id) są pomijane albo zastępowane — do wyboru.', 'wczytaj-z-github')), dataBox);
  // po zamknięciu okna odśwież zakładkę, jeśli coś wczytano
  const dlg = [...document.querySelectorAll('dialog.modal[open]')].pop();
  dlg.addEventListener('close', () => { if (changed) window.dispatchEvent(new Event('datachange')); });

  publishedIndex(gh).then(idx => {
    clear(modelsBox);
    if (!idx.models || !idx.models.length) { modelsBox.append(h('p.note', 'Brak opublikowanych modeli.')); return; }
    modelsBox.append(...idx.models.map(e => h('div.row.wrap.pubrow',
      h('b', e.name), h('span.badge', e.kind === 'base' ? 'bazowy' : 'dostrojony'), e.id === idx.active ? h('span.badge.ok', 'aktualny') : null,
      h('span.note', `${date(e.publishedAt)} · ${num(e.params)} parametrów · bity/znak ${dec(e.metrics && e.metrics.bpc, 2)} · ${e.file.replace('models/', '')}`), h('span.sp'),
      h('button.small', { type: 'button', onclick: async ev => {
        const b = ev.currentTarget; b.disabled = true; b.textContent = 'Pobieram…';
        try { if (await addModelConfirm(await downloadPublished(e, gh), 'GitHub')) { b.textContent = 'Wczytano'; changed = true; } else { b.disabled = false; b.textContent = 'Wczytaj'; } }
        catch (err) { toast(err.message, 'error'); b.disabled = false; b.textContent = 'Wczytaj'; }
      } }, 'Wczytaj'))));
  }).catch(e => { clear(modelsBox); modelsBox.append(h('p.note', e.message.includes('404') || e.message.includes('index.json') ? 'Brak opublikowanych modeli (models/index.json).' : e.message)); });

  fetchPublishedData(gh).then(pub => {
    clear(dataBox);
    const avail = Object.entries(PARTS).filter(([k]) => pub[k]);
    if (!avail.length) { dataBox.append(h('p.note', 'Brak opublikowanych danych (folder data/ w repo).')); return; }
    const count = k => k === 'settings' ? null : (pub[k][k] || []).length;
    const boxes = avail.map(([k, p]) => {
      const i = h('input', { type: 'checkbox', id: 'imp-' + k, checked: true });
      return { k, i, el: h('div.field.check', i, h('label', { htmlFor: 'imp-' + k }, p.label, count(k) != null ? ` (${num(count(k))})` : '', h('span.note', ` — opublikowane ${date(pub[k].publishedAt)}${pub[k].versions ? `, program ${pub[k].versions.app}` : ''}`))) };
    });
    const mode = h('select', { 'aria-label': 'Istniejące rekordy' }, h('option', { value: 'skip' }, 'pomiń (zostaw te z tej przeglądarki)'), h('option', { value: 'replace' }, 'zastąp wersją z GitHub'));
    const log = h('p.status');
    const btn = h('button', { type: 'button', onclick: async () => {
      const what = Object.fromEntries(boxes.map(b => [b.k, b.i.checked]));
      if (!Object.values(what).some(Boolean)) return toast('Nic nie zaznaczono.', 'error');
      if (what.settings && !await confirmBox('Zastąpić ustawienia?', 'Obecne ustawienia zostaną zastąpione opublikowanymi (token GitHub zostaje).', 'Zastąp')) return;
      btn.disabled = true;
      try {
        const r = await restore(pub, what, { replace: mode.value === 'replace' });
        log.textContent = 'Wczytano. ' + Object.entries(r).map(([k, v]) => k === 'settings' ? 'ustawienia: zastąpione' : `${PARTS[k].label.toLowerCase()}: dodano ${v.added}, zastąpiono ${v.replaced}, pominięto ${v.skipped}`).join('; ') + '.';
        toast('Wczytano dane z GitHub.', 'ok'); changed = true;
      } catch (e) { log.textContent = 'Błąd: ' + e.message; btn.disabled = false; }
    } }, 'Wczytaj zaznaczone');
    dataBox.append(...boxes.map(b => b.el), h('div.field', h('label', 'Rekord, który już jest w tej przeglądarce (to samo id)'), mode), log, h('div.row.end', btn));
  });
}
