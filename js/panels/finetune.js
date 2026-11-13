// Zakładka „Dostrajanie”: uczenie modelu odpowiadania na rozmowach wzorcowych.
// Można dostrajać model bazowy albo już dostrojony (kolejne rundy po dodaniu nowych rozmów).

import { h, help, toast, num, clear, plural } from '../ui/dom.js';
import { fieldsForm } from '../ui/form.js';
import { trainView } from '../ui/trainview.js';
import { settings, saveSettings, tags } from '../core/settings.js';
import { trainingDialogs } from '../core/corpus.js';
import { listMeta, setActive, getActive } from '../core/models.js';
import { ensureLoaded, gpuInfo } from '../core/ai.js';
import { start, busy, onTraining } from '../core/training.js';
import { openChat } from '../chat/widget.js';

// tasowanie rozmów przed podziałem na naukę i sprawdzanie (żeby do sprawdzania nie trafiały same najnowsze)
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export default {
  id: 'dostrajanie', title: 'Dostrajanie', icon: '🎯',
  render(root) {
    const s = settings(), hp = s.finetune;
    let fromId = null;
    const info = h('p'), fromBox = h('div');
    const startBtn = h('button', { type: 'button', onclick: run }, 'Rozpocznij dostrajanie');
    const tv = trainView('chat', { onDone: m => h('div.row',
      h('button', { type: 'button', onclick: async () => { await setActive(m.id); toast(`„${m.name}” odpowiada teraz w czacie.`, 'ok'); openChat(); } }, 'Ustaw jako aktywny i otwórz czat'),
      h('span.note', 'Porównaj z poprzednim modelem w zakładce „Modele”.')) });

    root.append(
      h('header.ph', h('h1', 'Dostrajanie do rozmowy'),
        h('p', 'Krok 2. Model uczy się odpowiadać na rozmowach wzorcowych. Można powtarzać: po dodaniu nowych rozmów (np. poprawionych z historii czatu) dostrój ponownie — od modelu bazowego albo od ostatniego dostrojonego. Najlepiej na całym zestawie, nie tylko na nowych rozmowach, żeby sieć nie zapomniała wcześniejszych odpowiedzi.')),
      h('section.card', h('h2', 'Dane', help('Włączone rozmowy wzorcowe. Przed dostrajaniem są tasowane, a część (ustawienie „Rozmowy do sprawdzania”) odkładana do pomiaru.')), info),
      h('section.card', h('h2', 'Od którego modelu', help('Model bazowy (po nauce na dokumentach) albo już dostrojony. Budowa sieci i słownik zostają takie jak w wybranym modelu.')), fromBox,
        fieldsForm('finetune', hp, { onChange: () => saveSettings(s) }),
        h('div.row', startBtn)),
      tv.el);

    async function draw() {
      const ds = await trainingDialogs(), turns = ds.reduce((a, d) => a + d.turns.length / 2, 0);
      info.textContent = ds.length ? `${num(ds.length)} ${plural(ds.length, 'rozmowa', 'rozmowy', 'rozmów')} do dostrajania (${num(turns)} par pytanie–odpowiedź).` + (ds.length < 50 ? ' Na początek wystarczy, ale sieć zacznie dobrze uogólniać przy kilkuset przykładach.' : '') : 'Brak rozmów wzorcowych. Dodaj je w zakładce „Rozmowy wzorcowe”.';
      const models = await listMeta(), active = await getActive();
      clear(fromBox);
      if (!models.length) { fromBox.append(h('p.warnline', 'Nie ma jeszcze modelu. Najpierw naucz sieć na dokumentach (zakładka „Nauka”).')); startBtn.disabled = true; return; }
      if (!models.some(m => m.id === fromId)) fromId = (models.find(m => m.id === active) || models.find(m => m.kind === 'base') || models[0]).id;
      fromBox.append(h('div.field', h('label', 'Model'), h('select', { onchange: e => { fromId = e.target.value; } },
        models.map(m => h('option', { value: m.id, selected: m.id === fromId }, `${m.name} · ${m.kind === 'base' ? 'bazowy' : 'dostrojony'}${m.id === active ? ' · aktywny' : ''}`)))));
      startBtn.disabled = busy();
    }
    async function run() {
      try {
        const ds = await trainingDialogs();
        if (ds.length < 2) return toast('Potrzeba co najmniej 2 rozmów wzorcowych.', 'error');
        await ensureLoaded(fromId);
        const g = await gpuInfo(), device = hp.device === 'gpu' && !g.ok ? 'wasm' : hp.device;
        start('finetune', 'chat', { from: fromId, dialogs: shuffle(ds.map(d => d.turns)), tags: tags(), hp: { ...hp, device, batch: 16 } },
          { dialogs: ds.length, tags: tags() });
        startBtn.disabled = true;
      } catch (e) { toast(e.message, 'error'); }
    }
    const off = onTraining(() => { startBtn.disabled = busy(); });
    draw();
    return () => { tv.destroy(); off(); };
  },
};
