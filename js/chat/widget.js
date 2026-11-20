// Czat z AI: ikona w prawym dolnym rogu panelu, okno rozmowy z aktywnym modelem.
// Pod każdą odpowiedzią: ✓ dobra, ✎ popraw, ✗ błędna. Oceny i poprawki trafiają do „Historii rozmów”,
// skąd jednym kliknięciem przenosi się rozmowę do rozmów wzorcowych (uczenie z rozmów).

import { h, clear, toast } from '../ui/dom.js';
import { structureView } from '../ui/modals/structure-view.js';
import { searchLibrary } from '../core/search.js';
import { logDebug } from '../core/log.js';
import { fieldsForm } from '../ui/form.js';
import { saveSettings } from '../core/settings.js';
import { settings, cleanerOpts, tags as settingsTags, onSettings } from '../core/settings.js';
import { cleanLine } from '../cleaner/cleaner.js';
import { getActive, onModels } from '../core/models.js';
import { db, uid } from '../core/db.js';
import { ensureLoaded, request } from '../core/ai.js';
import { saveConversation, botText, onConversations } from '../core/conversations.js';

let ui = null, conv = null, model = null, busy = false;

const newConv = () => ({ id: uid('k_'), startedAt: Date.now(), updatedAt: Date.now(), modelId: model && model.id, modelName: model && model.name, messages: [] });

async function loadModel() {
  const id = await getActive();
  if (!id) { model = null; return; }
  const m = await db.get('models', id);
  model = m ? { id: m.id, name: m.name, kind: m.kind, tags: (m.data && m.data.tags) || null } : null;
}

function build() {
  const log = h('div.chat-log', { 'aria-live': 'polite' });
  const input = h('textarea.chat-input', { rows: 1, placeholder: 'Zadaj pytanie…', 'aria-label': 'Wiadomość', title: 'Enter – wyślij, Shift+Enter – nowa linia',
    onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } },
    oninput: e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; } });
  const sendBtn = h('button.chat-send', { type: 'button', 'aria-label': 'Wyślij', onclick: () => send() }, '➤');
  const title = h('b'), sub = h('span.chat-sub');
  const opts = h('div.chat-opts', { hidden: true });
  const panel = h('section.chat-panel', { hidden: true, role: 'dialog', 'aria-label': 'Czat z AI' },
    h('header.chat-head', h('div', title, sub), h('span.sp'),
      h('button.chat-hbtn', { type: 'button', title: 'Ustawienia rozmowy (temperatura, długość odpowiedzi, pamięć)', 'aria-expanded': 'false', onclick: e => toggleOpts(e.currentTarget) }, '⚙'),
      h('button.chat-hbtn', { type: 'button', title: 'Nowa rozmowa', onclick: () => { conv = newConv(); draw(); input.focus(); } }, '＋'),
      h('button.chat-hbtn', { type: 'button', title: 'Zamknij', onclick: () => toggle(false) }, '✕')),
    opts, log, h('div.chat-foot', input, sendBtn));
  const toggleOpts = btn => {
    opts.hidden = !opts.hidden; btn.setAttribute('aria-expanded', String(!opts.hidden));
    if (!opts.hidden) { const s = settings(); clear(opts); opts.append(fieldsForm('chat', s.chat, { onChange: () => saveSettings(s) })); }
  };
  const fab = h('button.chat-fab', { type: 'button', 'aria-label': 'Otwórz czat z AI', title: 'Czat z AI', onclick: () => toggle() },
    h('span.ico', { innerHTML: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm3 6.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>' }));
  document.body.append(panel, fab);
  return { panel, fab, log, input, sendBtn, title, sub };
}

function toggle(open = ui.panel.hidden) {
  ui.panel.hidden = !open; ui.fab.classList.toggle('open', open);
  if (open) { draw(); ui.input.focus(); }
}
export function openChat() { toggle(true); }

function draw() {
  const s = settings().general;
  ui.title.textContent = s.name;
  ui.sub.textContent = model ? ` · ${model.name}` : '';
  ui.sub.title = model ? 'Aktywny model. Zmienisz go w zakładce „Modele”.' : '';
  clear(ui.log);
  if (!model) {
    ui.log.append(h('div.chat-empty', h('p', 'Brak aktywnego modelu.'), h('p.note', 'Naucz sieć na dokumentach, dostrój ją do rozmowy i ustaw model jako aktywny (zakładka „Modele”).')));
  } else if (!conv.messages.length) {
    ui.log.append(h('div.chat-empty', h('p', 'Zadaj pytanie z zakresu prawa.'), h('p.note', model.kind === 'base' ? 'Uwaga: aktywny jest model bazowy (niedostrojony) — będzie raczej dopisywał tekst niż odpowiadał.' : 'Oceniaj odpowiedzi: ✓ dobra, ✎ popraw, ✗ błędna. Poprawione rozmowy przeniesiesz do nauki w „Historii rozmów”.')));
  }
  conv.messages.forEach((m, i) => ui.log.append(m.role === 'user' ? h('div.msg.me', m.text) : botMsg(m, i)));
  if (busy) ui.log.append(h('div.msg.ai.typing', h('span'), h('span'), h('span')));
  ui.sendBtn.disabled = busy || !model; ui.input.disabled = !model;
  ui.log.scrollTop = ui.log.scrollHeight;
}

function botMsg(m, i) {
  const set = async (status, corrected) => { m.status = m.status === status && status !== 'corrected' ? undefined : status; if (corrected != null) m.corrected = corrected; await persist(); draw(); };
  const body = m.status === 'corrected'
    ? h('div', h('div.corr', m.corrected), h('div.orig', h('s', m.text)))
    : h('div', m.text || '(brak odpowiedzi)');
  const edit = () => {
    const ta = h('textarea', { rows: 3, value: botText(m) });
    const box = h('div.msg.ai.editing', ta, h('div.row.end',
      h('button.ghost.small', { type: 'button', onclick: () => draw() }, 'Anuluj'),
      h('button.small', { type: 'button', onclick: () => { const t = cleanLine(ta.value, cleanerOpts()).text; if (!t) return toast('Pusta poprawka.', 'error'); set('corrected', t); } }, 'Zapisz poprawkę')));
    ui.log.children[i] ? ui.log.replaceChild(box, ui.log.children[i]) : ui.log.append(box);
    ta.focus();
  };
  return h('div.msg.ai' + (m.status ? '.' + m.status : ''), body,
    h('div.rate',
      h('button', { type: 'button', title: 'Dobra odpowiedź', 'aria-pressed': m.status === 'ok', onclick: () => set('ok') }, '✓'),
      h('button', { type: 'button', title: 'Popraw odpowiedź', 'aria-pressed': m.status === 'corrected', onclick: edit }, '✎'),
      h('button', { type: 'button', title: 'Błędna odpowiedź', 'aria-pressed': m.status === 'wrong', onclick: () => set('wrong') }, '✗'),
      m.ms != null ? h('span.ms', { title: 'Czas liczenia odpowiedzi' }, `${Math.round(m.ms)} ms`) : null),
    m.refs && m.refs.length ? h('details.refs', h('summary', `Z biblioteki (${m.refs.length})`),
      h('p.note', 'Fragmenty dokumentów pasujące do pytania – to tekst dokumentu, nie odpowiedź modelu.'),
      m.refs.map(r => h('div.ref', r.art ? h('a', { href: '#', title: 'Pokaż przepis w strukturze aktu (z powiązaniami)', onclick: e => { e.preventDefault(); structureView(r.docId, r.art); } }, `${r.label} – ${r.name}`) : h('a', { href: '#formatowanie/' + r.docId, title: 'Pokaż dokument w zakładce „Formatowanie”' }, r.name), r.outdated ? h('span.tag.old', 'nieaktualny') : null, r.general ? h('span.badge.gen', 'ogólny') : null,
        h('div.reftext', r.text.length > 600 ? r.text.slice(0, 600) + '…' : r.text)))) : null);
}

async function persist() { if (settings().chat.save && conv.messages.length) await saveConversation(conv); }

async function send() {
  const raw = ui.input.value;
  if (busy || !model || !raw.trim()) return;
  const text = cleanLine(raw, cleanerOpts()).text;   // to samo formatowanie co dane do nauki: ujednolicone znaki
  if (!text) return;
  ui.input.value = ''; ui.input.style.height = 'auto';
  if (!conv.modelId) Object.assign(conv, { modelId: model.id, modelName: model.name });
  conv.messages.push({ role: 'user', text, ts: Date.now() });
  busy = true; draw();
  const c = settings().chat;
  try {
    await ensureLoaded(model.id);
    const history = conv.messages.map(m => ({ role: m.role, text: m.role === 'bot' ? botText(m) : m.text }));
    const r = await request('reply', { id: model.id, history, tags: model.tags || settingsTags(), temp: +c.temp, maxTokens: +c.maxTokens, turns: +c.turns });
    let refs = [];
    if (+c.refs > 0) { try { refs = (await searchLibrary(text, +c.refs)).map(x => ({ docId: x.docId, art: x.art, label: x.label, name: x.name, eli: x.eli, text: x.text, outdated: x.tags.includes('nieaktualny'), general: x.general })); } catch (e) { logDebug('czat', 'Wyszukiwanie w bibliotece nieudane: ' + e.message); } }
    conv.messages.push({ role: 'bot', text: r.text, ts: Date.now(), ms: r.ms, refs });
    logDebug('czat', `Odpowiedź modelu „${model.name}” w ${r.ms} ms (${r.text.length} znaków)`);
  } catch (e) { toast(e.message, 'error'); conv.messages.pop(); ui.input.value = raw; }
  busy = false; await persist(); draw(); ui.input.focus();
}

export async function initChat() {
  ui = build();
  await loadModel(); conv = newConv();
  onModels(async () => { const prev = model && model.id; await loadModel(); if ((model && model.id) !== prev) conv = newConv(); if (!ui.panel.hidden) draw(); });
  onSettings(() => !ui.panel.hidden && draw());
  // zmiana ocen w Historii rozmów: odśwież bieżącą rozmowę, jeśli to ta sama
  onConversations(async () => { if (busy) return; const fresh = await db.get('conversations', conv.id); if (fresh && !busy) { conv = fresh; if (!ui.panel.hidden) draw(); } });
}
