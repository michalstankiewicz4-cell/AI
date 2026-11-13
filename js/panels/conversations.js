// Zakładka „Historia rozmów”: rozmowy z czatu, ocena i poprawianie odpowiedzi, przenoszenie do rozmów wzorcowych.
// To jest pętla uczenia z rozmów: rozmawiasz → poprawiasz → dodajesz do zestawu → dostrajasz ponownie.

import { h, help, toast, confirmBox, modal, num, date, clear, plural } from '../ui/dom.js';
import { settings, cleanerOpts } from '../core/settings.js';
import { cleanLine } from '../cleaner/cleaner.js';
import { listConversations, saveConversation, deleteConversation, unreviewed, toTurns, botText, onConversations } from '../core/conversations.js';
import { makeDialog, saveDialog } from '../core/corpus.js';
import { dialogEditor } from './dialogs.js';

export default {
  id: 'historia', title: 'Historia rozmów', icon: '🕘',
  render(root) {
    let filter = 'all';
    const listBox = h('div'), stats = h('p.note');
    root.append(
      h('header.ph', h('h1', 'Historia rozmów'),
        h('p', 'Rozmowy z czatu. Oceń odpowiedzi AI (✓ dobra, ✎ poprawiona, ✗ błędna), a rozmowę z dobrymi lub poprawionymi odpowiedziami dodaj do rozmów wzorcowych. Przy następnym dostrajaniu sieć nauczy się na nich.')),
      h('section.card',
        h('div.row', h('div.seg',
          ['all', 'todo', 'ready'].map(f => h('label', h('input', { type: 'radio', name: 'cf', checked: f === filter, onchange: () => { filter = f; draw(); } }), ' ', { all: 'Wszystkie', todo: 'Do oceny', ready: 'Gotowe do zestawu' }[f]))),
          help('„Gotowe do zestawu” — rozmowy, w których co najmniej pierwsza odpowiedź jest oceniona jako dobra albo poprawiona, a rozmowa nie trafiła jeszcze do zestawu.', 'gotowe-do-zestawu')),
        stats, listBox));

    async function draw() {
      const all = await listConversations();
      const shown = all.filter(c => filter === 'all' || (filter === 'todo' ? unreviewed(c) > 0 : (!c.dialogId && toTurns(c).length)));
      stats.textContent = all.length ? `${num(all.length)} ${plural(all.length, 'rozmowa', 'rozmowy', 'rozmów')}, ${num(all.reduce((a, c) => a + unreviewed(c), 0))} odpowiedzi do oceny.` : 'Brak zapisanych rozmów. Porozmawiaj z AI przez ikonę czatu w prawym dolnym rogu.';
      clear(listBox);
      listBox.append(...shown.slice(0, 200).map(c => {
        const bots = c.messages.filter(m => m.role === 'bot'), first = c.messages.find(m => m.role === 'user');
        const cnt = s => bots.filter(m => m.status === s).length;
        return h('article.conv',
          h('div.row', h('b', first ? first.text.slice(0, 120) : '(pusta)'), h('span.sp'), h('span.note', date(c.updatedAt))),
          h('div.row.wrap',
            h('span.badge', c.modelName || '?'), h('span.note', `${num(bots.length)} ${plural(bots.length, 'odpowiedź', 'odpowiedzi', 'odpowiedzi')}:`),
            h('span.badge.ok', { title: 'Dobre odpowiedzi' }, `✓ ${cnt('ok')}`), h('span.badge.corrected', { title: 'Poprawione odpowiedzi' }, `✎ ${cnt('corrected')}`), h('span.badge.wrong', { title: 'Błędne odpowiedzi' }, `✗ ${cnt('wrong')}`), h('span.badge', { title: 'Odpowiedzi jeszcze nieocenione' }, `bez oceny ${unreviewed(c)}`),
            c.dialogId ? h('span.badge.ok', 'w zestawie') : null, h('span.sp'),
            h('button.ghost.small', { type: 'button', onclick: () => open(c) }, 'Otwórz'),
            h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć rozmowę?', first ? first.text : '', 'Usuń', true)) { await deleteConversation(c.id); } } }, 'Usuń')));
      }));
    }

    function open(c) {
      const t = settings().general, body = h('div.convview');
      const drawBody = () => {
        clear(body);
        c.messages.forEach(m => {
          if (m.role === 'user') { body.append(h('p.turnline.user', h('b', t.userTag), ' ', m.text)); return; }
          const ta = h('textarea', { rows: 2, value: botText(m) });
          const setS = async (st, corr) => { m.status = st; if (corr != null) m.corrected = corr; await saveConversation(c); drawBody(); };
          body.append(h('div.turnbox.' + (m.status || 'none'),
            h('p.turnline.bot', h('b', t.botTag), ' ', m.status === 'corrected' ? [h('s.orig', m.text), ' → ', m.corrected] : m.text),
            h('div.row.wrap',
              h('button.small' + (m.status === 'ok' ? '' : '.ghost'), { type: 'button', onclick: () => setS('ok') }, '✓ dobra'),
              h('button.small' + (m.status === 'wrong' ? '' : '.ghost'), { type: 'button', onclick: () => setS('wrong') }, '✗ błędna'),
              h('details.inline', h('summary', '✎ popraw'), ta,
                h('button.small', { type: 'button', onclick: () => { const v = cleanLine(ta.value, cleanerOpts()).text; if (!v) return toast('Pusta poprawka.', 'error'); setS('corrected', v); } }, 'Zapisz poprawkę')))));
        });
        const turns = toTurns(c);
        body.append(h('div.row.end', c.dialogId ? h('span.note', 'Ta rozmowa jest już w zestawie (możesz dodać ją ponownie po zmianach).') : null,
          h('button', { type: 'button', disabled: !turns.length, title: turns.length ? '' : 'Oceń pierwszą odpowiedź jako dobrą albo ją popraw.', onclick: () => toSet(c, close) },
            turns.length ? `Dodaj do rozmów wzorcowych (${turns.length / 2} ${plural(turns.length / 2, 'wymiana', 'wymiany', 'wymian')})` : 'Dodaj do rozmów wzorcowych')));
      };
      drawBody();
      const close = modal(`Rozmowa z ${date(c.startedAt)} · ${c.modelName || ''}`, h('p.note', 'Do zestawu trafiają kolejne wymiany od początku rozmowy, dopóki odpowiedzi są ocenione jako dobre albo poprawione. Przed zapisem możesz je jeszcze edytować.'), body);
    }
    function toSet(c, closeParent) {
      const close = modal('Nowa rozmowa wzorcowa z czatu', dialogEditor(toTurns(c), async turns => {
        try {
          const d = makeDialog(turns, 'czat', { conversationId: c.id });
          await saveDialog(d); c.dialogId = d.id; await saveConversation(c);
          close(); closeParent(); toast('Dodano do rozmów wzorcowych.', 'ok');
        } catch (e) { toast(e.message, 'error'); }
      }));
    }
    const off = onConversations(draw);
    draw();
    return off;
  },
};
