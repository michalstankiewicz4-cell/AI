// Okno publikacji na GitHub: checkboxy z tym, co ma trafić do repo (jednym commitem).
// Plik modelu zawsze zawiera ustawienia i wersje z chwili publikacji.

import { h, help, toast, modal, num } from '../dom.js';
import { settings } from '../../core/settings.js';
import { saveModel } from '../../core/models.js';
import { getToken, publish, modelFileName, repoInfo } from '../../core/github.js';
import { collect } from '../../core/sync.js';
import { db } from '../../core/db.js';

export async function publishModal(m) {
  const gh = settings().github;
  if (!getToken()) return toast('Brak tokenu GitHub. Wpisz go w Ustawienia → GitHub.', 'error');
  const data = await collect();
  const pub = h('p.warnline', { hidden: true }, 'Repozytorium jest publiczne: dokumenty i rozmowy będą widoczne dla każdego, także w historii repo (nie da się ich potem łatwo usunąć). Nie wysyłaj danych osobowych ani poufnych.');
  const box = (id, label, checked, note, sensitive) => {
    const i = h('input', { type: 'checkbox', id: 'pub-' + id, checked, onchange: upd });
    i.dataset.sensitive = sensitive ? '1' : '';
    return { id, i, el: h('div.field.check', i, h('label', { htmlFor: 'pub-' + id }, label, note ? h('span.note', ' — ' + note) : null)) };
  };
  const items = [
    box('model', `Model „${m.name}”`, true, `plik ${modelFileName(m)}, razem z ustawieniami i wersjami`),
    box('active', 'Oznacz jako aktualny model (index.json → active)', true, 'inne aplikacje (np. PiK) biorą domyślnie aktualny'),
    box('settings', 'Ustawienia i wersje', true, 'data/ustawienia.json (bez tokenu)'),
    box('documents', `Dokumenty (${num(data.documents.length)})`, false, 'data/dokumenty.json: oryginał, opis, status, tekst po formatowaniu', true),
    box('dialogs', `Rozmowy wzorcowe (${num(data.dialogs.length)})`, false, 'data/rozmowy-wzorcowe.json + .txt do czytania', true),
    box('conversations', `Historia rozmów z czatu (${num(data.conversations.length)})`, false, 'data/historia-rozmow.json', true),
    box('sources', `Źródła Researchu (${num(data.sources.length)})`, false, 'data/zrodla.json: adresy, ustawienia, kategorie, wynik ostatniego sprawdzenia'),
    box('packs', `Własne pakiety (${num(data.packs.length)})`, false, 'data/pakiety.json'),
    box('profiles', `Profile (${num(data.profiles.length)})`, false, 'data/profile.json: nazwa, kategorie, szablon, ustawienia nauki'),
    box('tagGroups', `Grupy kategorii (${num(data.tagGroups.length)})`, false, 'data/grupy-kategorii.json'),
  ];
  const log = h('p.status');
  function upd() { pub.hidden = !items.some(x => x.i.dataset.sensitive && x.i.checked); items[1].i.disabled = !items[0].i.checked; }
  const btn = h('button', { type: 'button', onclick: async () => {
    const what = Object.fromEntries(items.map(x => [x.id, x.i.checked && !x.i.disabled]));
    btn.disabled = true;
    try {
      const full = await db.get('models', m.id);
      const r = await publish(full, gh, what, data, st => { log.textContent = st; });
      if (r.file) { full.published = { at: Date.now(), commit: r.commit, file: r.file }; await saveModel(full); }
      log.textContent = ''; log.append('Opublikowano: ', r.files.join(', '), '. ', h('a', { href: r.url, target: '_blank', rel: 'noopener' }, 'Zobacz commit'), '. GitHub Pages zaktualizuje się za około minutę.');
    } catch (e) { log.textContent = 'Błąd: ' + e.message; btn.disabled = false; }
  } }, 'Opublikuj');
  modal(`Publikacja na GitHub: ${m.name}`,
    h('p', `Repo ${gh.repo}, gałąź ${gh.branch}. Zaznacz, co wysłać — wszystko trafi jednym commitem.`, help('Plik modelu ma w nazwie wersję programu, w której powstał. Ustawienia i wersje są zawsze zapisane w pliku modelu; zaznaczenie „Ustawienia i wersje” dodaje je też jako osobny plik.', 'publikacja')),
    items.map(x => x.el), pub, log, h('div.row.end', btn));
  repoInfo(gh).then(r => { if (r.private) pub.textContent = 'Repozytorium jest prywatne — dane zobaczą tylko osoby z dostępem (uwaga: GitHub Pages dla prywatnego repo wymaga płatnego planu).'; }).catch(() => {});
  upd();
}
