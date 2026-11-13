// Zakładka „Ustawienia”: wszystkie ustawienia AI w jednym miejscu (zapis automatyczny), token GitHub, wersje.

import { h, help, toast, confirmBox, num } from '../ui/dom.js';
import { fieldsForm } from '../ui/form.js';
import { SCHEMA, settings, saveSettings, defaults } from '../core/settings.js';
import { getToken, setToken, testAccess } from '../core/github.js';
import { db } from '../core/db.js';
import { VERSIONS } from '../version.js';

const GLOBAL = ['general', 'github'];   // reszta grup ma swoje miejsce w zakładkach (patrz SCHEMA → place)

export default {
  id: 'ustawienia', title: 'Ustawienia', icon: '⚙️',
  render(root, rerender) {
    const s = settings();
    let timer = null;
    const save = () => { clearTimeout(timer); timer = setTimeout(async () => { await saveSettings(s); toast('Zapisano ustawienia.', 'ok', 1500); }, 400); };
    const tokenIn = h('input', { type: 'password', autocomplete: 'off', placeholder: getToken() ? '•••••••• (zapisany)' : 'github_pat_…', 'aria-label': 'Token GitHub' });
    const ghLog = h('p.status');
    const counts = h('dl.metrics.inline');

    root.append(
      h('header.ph', h('h1', 'Ustawienia'), h('p', 'Ustawienia ogólne. Pozostałe są tam, gdzie działają: formatowanie w zakładce „Formatowanie”, nauka w „Nauce”, dostrajanie w „Dostrajaniu”, długość odpowiedzi wzorcowych w „Rozmowach wzorcowych”, a rozmowa pod ⚙ w oknie czatu. Zmiany zapisują się od razu.')),
      ...SCHEMA.filter(g => GLOBAL.includes(g.group)).map(g => h('section.card', h('h2', g.title), fieldsForm(g.group, s[g.group], { onChange: save }),
        g.group === 'github' ? h('div.fields',
          h('div.field', h('label', 'Token', help('Fine-grained personal access token: dostęp tylko do tego repo, uprawnienie Contents: Read and write. Utworzysz go na github.com/settings/personal-access-tokens/new. Zapisywany wyłącznie w tej przeglądarce (localStorage), nie trafia do plików modeli ani do repo.', 'token')), tokenIn),
          h('div.row',
            h('button', { type: 'button', onclick: () => { if (!tokenIn.value.trim()) return toast('Wpisz token.', 'error'); setToken(tokenIn.value); tokenIn.value = ''; tokenIn.placeholder = '•••••••• (zapisany)'; toast('Zapisano token.', 'ok'); } }, 'Zapisz token'),
            h('button.ghost', { type: 'button', onclick: async () => { ghLog.textContent = 'Sprawdzam…'; try { ghLog.textContent = `Dostęp w porządku: ${await testAccess(s.github)} (zapis na gałęzi ${s.github.branch}).`; } catch (e) { ghLog.textContent = 'Błąd: ' + e.message; } } }, 'Sprawdź dostęp'),
            h('button.ghost.danger', { type: 'button', onclick: () => { setToken(''); tokenIn.placeholder = 'github_pat_…'; toast('Usunięto token z tej przeglądarki.', 'ok'); } }, 'Usuń token')),
          ghLog) : null)),
      h('section.card', h('h2', 'Dane w tej przeglądarce', help('Dokumenty, rozmowy i modele są zapisane w bazie IndexedDB tej przeglądarki na tym komputerze. Wyczyszczenie danych strony w przeglądarce usuwa je. Modele można zabezpieczyć plikiem albo publikacją na GitHub.', 'dane-w-przegladarce')), counts),
      h('section.card', h('h2', 'Wersje'), h('dl.metrics.inline',
        h('dt', 'Program'), h('dd', VERSIONS.app), h('dt', 'Silnik sieci'), h('dd', VERSIONS.engine), h('dt', 'Reguły formatowania'), h('dd', VERSIONS.cleaner),
        h('dt', 'Format pliku modelu'), h('dd', String(VERSIONS.modelFormat)), h('dt', 'Schemat bazy'), h('dd', String(VERSIONS.db)))),
      h('section.card', h('div.row', h('span.note', 'Przywraca wartości domyślne wszystkich ustawień (token GitHub zostaje).'), h('span.sp'),
        h('button.ghost.danger', { type: 'button', onclick: async () => { if (await confirmBox('Przywrócić ustawienia domyślne?', 'Wszystkie ustawienia wrócą do wartości początkowych.', 'Przywróć', true)) { await saveSettings(defaults()); rerender(); } } }, 'Przywróć domyślne'))));

    (async () => {
      for (const [k, l] of [['documents', 'Dokumenty'], ['dialogs', 'Rozmowy wzorcowe'], ['conversations', 'Rozmowy z czatu'], ['models', 'Modele']]) counts.append(h('dt', l), h('dd', num(await db.count(k))));
      if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); counts.append(h('dt', 'Zajęte miejsce'), h('dd', `${num(Math.round(e.usage / 1e6))} MB z ok. ${num(Math.round(e.quota / 1e6))} MB`)); }
    })();
  },
};
