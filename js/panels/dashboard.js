// Zakładka „Pulpit”: stan całości i droga od dokumentów do rozmowy.

import { h, help, num, dec, date, plural } from '../ui/dom.js';
import { db } from '../core/db.js';
import { corpusText, listDocs } from '../core/documents.js';
import { trainingDialogs } from '../core/dialogs.js';
import { listMeta, getActive } from '../core/models.js';
import { listConversations, unreviewed } from '../core/conversations.js';
import { gpuInfo } from '../core/ai.js';
import { state } from '../core/training.js';
import { openChat } from '../chat/widget.js';
import { go } from '../main.js';
import { listSources } from '../core/sources.js';

export default {
  id: 'pulpit', title: 'Pulpit', icon: '🏠',
  async render(root) {
    root.append(h('header.ph', h('h1', 'Pulpit'), h('p', 'AI uczone w przeglądarce: najpierw czyta dokumenty prawne, potem uczy się odpowiadać na rozmowach wzorcowych, a z każdej rozmowy w czacie możesz je dalej uczyć. ', h('a', { href: '#pomoc/krok-po-kroku' }, 'Krok po kroku w Pomocy →'))));
    const [c, ds, models, active, convs, g, docs] = await Promise.all([corpusText(), trainingDialogs(), listMeta(), getActive(), listConversations(), gpuInfo(), listDocs()]);
    const srcs = await listSources(), checked = srcs.filter(s => s.last);
    // nowe dokumenty znalezione przy ostatnim sprawdzeniu źródeł (linki na stronach + akty z API, nowe i zmienione)
    const found = checked.reduce((a, s) => a + (s.last.links ? s.last.links.filter(l => !l.have).length : 0) + (s.last.acts ? s.last.acts.filter(x => !x.have || x.changed).length : 0), 0);
    const broken = checked.filter(s => !s.last.ok).length;
    const toCheck = docs.filter(d => d.status === 'do-sprawdzenia').length;
    const am = models.find(m => m.id === active), todo = convs.reduce((a, x) => a + unreviewed(x), 0);
    const ready = convs.filter(x => !x.dialogId && x.messages.some(m => m.role === 'bot' && (m.status === 'ok' || m.status === 'corrected'))).length;
    const step = (n, title, text, done, btn, target, stage) => h('article.step' + (done ? '.done' : '') + (stage ? '.stage' + stage : ''), { title: { 2: 'Dokumenty, formatowanie i nauka języka', 3: 'Rozmowy wzorcowe i nauka odpowiadania' }[stage] || null },
      h('span.num', done ? '✓' : n), h('div', h('h3', title), h('p', text)), h('button' + (done ? '.ghost' : ''), { type: 'button', onclick: () => target === 'chat' ? openChat() : go(target) }, btn));
    root.append(
      h('div.stagelegend', h('span', 'Źródła'), h('span.stage2', 'Dokumenty, formatowanie i nauka'), h('span.stage3', 'Rozmowy i dostrajanie'), h('span', 'Rozmowa i douczanie')),
      h('section.steps',
        step(1, 'Research', srcs.length ? `${num(srcs.length)} ${plural(srcs.length, 'źródło', 'źródła', 'źródeł')}` + (checked.length ? `; do pobrania: ${num(found)}` + (broken ? `, niedostępne: ${num(broken)}` : '') : '; jeszcze nie sprawdzane') : 'Źródła dokumentów: strony www, API aktów prawnych.', srcs.length > 0 && checked.length > 0 && !found, 'Research', 'research'),
        step(2, 'Dokumenty', docs.length ? `${num(docs.length)} ${plural(docs.length, 'dokument', 'dokumenty', 'dokumentów')} w bibliotece` : 'Wgraj ustawy, kodeksy, artykuły.', docs.length > 0, 'Dokumenty', 'dokumenty', 2),
        step(3, 'Formatowanie', toCheck ? `${num(toCheck)} do sprawdzenia; w nauce ${num(c.docs)} (${num(c.chars)} znaków)` : c.docs ? `w nauce ${num(c.docs)} ${plural(c.docs, 'dokument', 'dokumenty', 'dokumentów')}, ${num(c.chars)} znaków` : 'Sprawdź i zatwierdź dane do nauki.', c.docs > 0 && !toCheck, 'Formatowanie', 'formatowanie', 2),
        step(4, 'Nauka', models.some(m => m.kind === 'base') ? (n => `${num(n)} ${plural(n, 'model bazowy', 'modele bazowe', 'modeli bazowych')}`)(models.filter(m => m.kind === 'base').length) : 'Sieć uczy się języka prawnego.', models.some(m => m.kind === 'base'), 'Nauka', 'nauka', 2),
        step(5, 'Rozmowy wzorcowe', ds.length ? `${num(ds.length)} ${plural(ds.length, 'rozmowa', 'rozmowy', 'rozmów')} do dostrajania` : 'Pytania i poprawne odpowiedzi.', ds.length > 0, 'Rozmowy wzorcowe', 'rozmowy-wzorcowe', 3),
        step(6, 'Dostrajanie', models.some(m => m.kind === 'chat') ? (n => `${num(n)} ${plural(n, 'model dostrojony', 'modele dostrojone', 'modeli dostrojonych')}`)(models.filter(m => m.kind === 'chat').length) : 'Sieć uczy się odpowiadać.', models.some(m => m.kind === 'chat'), 'Dostrajanie', 'dostrajanie', 3),
        step(7, 'Rozmowa i poprawki', todo ? `${num(todo)} ${plural(todo, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} do oceny, gotowe do zestawu: ${num(ready)}` : 'Rozmawiaj, oceniaj, poprawiaj.', false, 'Otwórz czat', 'chat')),
      h('div.grid2',
        h('section.card', h('h2', 'Aktywny model', help('Model, który odpowiada w czacie. Zmienisz go w zakładce „Modele”.', 'aktywny-model')), am
          ? h('dl.metrics.inline', h('dt', 'Nazwa'), h('dd', am.name), h('dt', 'Rodzaj'), h('dd', am.kind === 'base' ? 'bazowy' : 'dostrojony'), h('dt', 'Bity na znak', help('Ile informacji sieć traci na każdą literę tekstu sprawdzającego. Mniej = lepiej.', 'bity-na-znak')), h('dd', dec(am.metrics.bpc, 2)), h('dt', 'Parametry'), h('dd', num(am.params)), h('dt', 'Utworzony'), h('dd', date(am.createdAt)))
          : h('p.note', 'Brak. Ustawisz go w zakładce „Modele”.')),
        h('section.card', h('h2', 'Komputer', help('Karta graficzna przyspiesza naukę i dostrajanie. Rozmowa liczy się na procesorze i nie wymaga karty.', 'komputer')), h('dl.metrics.inline',
          h('dt', 'Karta graficzna'), h('dd', g.ok ? g.name : 'niedostępna — nauka na procesorze'),
          h('dt', 'Nauka w toku'), h('dd', state.job ? `${state.job.kind === 'base' ? 'nauka na dokumentach' : 'dostrajanie'}${state.last ? `, krok ${num(state.last.step)} z ${num(state.last.steps)}` : ''}` : 'nie'),
          h('dt', 'Rozmowy z czatu'), h('dd', num(convs.length)), h('dt', 'Modele'), h('dd', num(await db.count('models')))))));
  },
};
