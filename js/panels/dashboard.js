// Zakładka „Pulpit”: stan całości i droga od dokumentów do rozmowy.

import { h, num, dec, date, plural } from '../ui/dom.js';
import { db } from '../core/db.js';
import { corpusText, trainingDialogs } from '../core/corpus.js';
import { listMeta, getActive } from '../core/models.js';
import { listConversations, unreviewed } from '../core/conversations.js';
import { gpuInfo } from '../core/ai.js';
import { state } from '../core/training.js';
import { openChat } from '../chat/widget.js';
import { go } from '../main.js';

export default {
  id: 'pulpit', title: 'Pulpit', icon: '🏠',
  async render(root) {
    root.append(h('header.ph', h('h1', 'Pulpit'), h('p', 'AI uczone w przeglądarce: najpierw czyta dokumenty prawne, potem uczy się odpowiadać na rozmowach wzorcowych, a z każdej rozmowy w czacie możesz je dalej uczyć.')));
    const [c, ds, models, active, convs, g] = await Promise.all([corpusText(), trainingDialogs(), listMeta(), getActive(), listConversations(), gpuInfo()]);
    const am = models.find(m => m.id === active), todo = convs.reduce((a, x) => a + unreviewed(x), 0);
    const ready = convs.filter(x => !x.dialogId && x.messages.some(m => m.role === 'bot' && (m.status === 'ok' || m.status === 'corrected'))).length;
    const step = (n, title, text, done, btn, target) => h('article.step' + (done ? '.done' : ''),
      h('span.num', done ? '✓' : n), h('div', h('h3', title), h('p', text)), h('button' + (done ? '.ghost' : ''), { type: 'button', onclick: () => target === 'chat' ? openChat() : go(target) }, btn));
    root.append(
      h('section.steps',
        step(1, 'Dokumenty', c.docs ? `${num(c.docs)} ${plural(c.docs, 'dokument', 'dokumenty', 'dokumentów')}, ${num(c.chars)} znaków` : 'Wgraj ustawy, kodeksy, artykuły.', c.docs > 0, 'Dokumenty', 'dokumenty'),
        step(2, 'Nauka', models.some(m => m.kind === 'base') ? (n => `${num(n)} ${plural(n, 'model bazowy', 'modele bazowe', 'modeli bazowych')}`)(models.filter(m => m.kind === 'base').length) : 'Sieć uczy się języka prawnego.', models.some(m => m.kind === 'base'), 'Nauka', 'nauka'),
        step(3, 'Rozmowy wzorcowe', ds.length ? `${num(ds.length)} ${plural(ds.length, 'rozmowa', 'rozmowy', 'rozmów')} do dostrajania` : 'Pytania i poprawne odpowiedzi.', ds.length > 0, 'Rozmowy wzorcowe', 'rozmowy-wzorcowe'),
        step(4, 'Dostrajanie', models.some(m => m.kind === 'chat') ? (n => `${num(n)} ${plural(n, 'model dostrojony', 'modele dostrojone', 'modeli dostrojonych')}`)(models.filter(m => m.kind === 'chat').length) : 'Sieć uczy się odpowiadać.', models.some(m => m.kind === 'chat'), 'Dostrajanie', 'dostrajanie'),
        step(5, 'Rozmowa i poprawki', todo ? `${num(todo)} ${plural(todo, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')} do oceny, gotowe do zestawu: ${num(ready)}` : 'Rozmawiaj, oceniaj, poprawiaj.', false, 'Otwórz czat', 'chat')),
      h('div.grid2',
        h('section.card', h('h2', 'Aktywny model'), am
          ? h('dl.metrics.inline', h('dt', 'Nazwa'), h('dd', am.name), h('dt', 'Rodzaj'), h('dd', am.kind === 'base' ? 'bazowy' : 'dostrojony'), h('dt', 'Bity na znak'), h('dd', dec(am.metrics.bpc, 2)), h('dt', 'Parametry'), h('dd', num(am.params)), h('dt', 'Utworzony'), h('dd', date(am.createdAt)))
          : h('p.note', 'Brak. Ustawisz go w zakładce „Modele”.')),
        h('section.card', h('h2', 'Komputer'), h('dl.metrics.inline',
          h('dt', 'Karta graficzna'), h('dd', g.ok ? g.name : 'niedostępna — nauka na procesorze'),
          h('dt', 'Nauka w toku'), h('dd', state.job ? `${state.job.kind === 'base' ? 'nauka na dokumentach' : 'dostrajanie'}${state.last ? `, krok ${num(state.last.step)} z ${num(state.last.steps)}` : ''}` : 'nie'),
          h('dt', 'Rozmowy z czatu'), h('dd', num(convs.length)), h('dt', 'Modele'), h('dd', num(await db.count('models')))))));
  },
};
