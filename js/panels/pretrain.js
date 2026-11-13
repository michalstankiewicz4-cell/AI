// Zakładka „Nauka”: pretraining — sieć uczy się języka prawnego z zatwierdzonych dokumentów.
// Od zera (nowy słownik i budowa sieci) albo dalsza nauka istniejącego modelu na nowym/powiększonym zbiorze.

import { h, help, toast, num, clear, plural } from '../ui/dom.js';
import { fieldsForm } from '../ui/form.js';
import { trainView } from '../ui/trainview.js';
import { settings, saveSettings, tags } from '../core/settings.js';
import { BASE_CHARS } from '../cleaner/rules.js';
import { corpusText } from '../core/documents.js';
import { listMeta } from '../core/models.js';
import { ensureLoaded, gpuInfo } from '../core/ai.js';
import { start, busy, onTraining } from '../core/training.js';
import { go } from '../main.js';

const ARCH = ['unit', 'layers', 'dim', 'heads', 'ctx'];

export default {
  id: 'nauka', title: 'Nauka', stage: 1, icon: '🧠',
  render(root) {
    const s = settings(), hp = s.pretrain;
    let mode = 'new', fromId = null;
    const corpusInfo = h('p'), gpuLine = h('p.note'), estimate = h('p.note'), formBox = h('div'), fromBox = h('div');
    const startBtn = h('button', { type: 'button', onclick: run }, 'Rozpocznij naukę');
    const tv = trainView('base', { onDone: m => h('div.row', h('span.note', 'Następny krok: dostrojenie do rozmowy.'), h('button.ghost', { type: 'button', onclick: () => go('dostrajanie') }, 'Przejdź do dostrajania')) });

    root.append(
      h('header.ph', h('h1', 'Nauka na dokumentach'),
        h('p', 'Krok 1. Sieć czyta zatwierdzone dokumenty i uczy się przewidywać kolejny kawałek tekstu. Tak poznaje słownictwo, składnię i strukturę przepisów. Nie umie jeszcze rozmawiać — tego uczy dostrajanie (krok 2).')),
      h('section.card', h('h2', 'Dane', help('Włączone dokumenty z zakładki „Dokumenty”. 90% tekstu służy do nauki, 10% do sprawdzania postępów.', 'nauka-dane')), corpusInfo, gpuLine),
      h('section.card',
        h('h2', 'Rodzaj nauki'),
        h('div.seg', { role: 'radiogroup' },
          h('label', h('input', { type: 'radio', name: 'mode', value: 'new', checked: true, onchange: () => { mode = 'new'; draw(); } }), ' Od zera ', help('Nowy słownik tokenów i nowa sieć. Wybierz przy pierwszej nauce albo gdy zmieniasz budowę sieci.', 'od-zera')),
          h('label', h('input', { type: 'radio', name: 'mode', value: 'continue', onchange: () => { mode = 'continue'; draw(); } }), ' Dalsza nauka modelu ', help('Sieć uczy się dalej od miejsca, w którym skończyła: ten sam słownik i budowa. Dobre po dodaniu nowych dokumentów. Znaki, których model nie zna, zostaną pominięte (lista pojawi się w przebiegu).', 'dalsza-nauka'))),
        fromBox, formBox, estimate,
        h('div.row', startBtn, h('span.note', 'Nauka liczy się w tej karcie przeglądarki: nie zamykaj jej do końca. Możesz w tym czasie przechodzić między zakładkami.'))),
      tv.el);

    async function draw() {
      const c = await corpusText();
      corpusInfo.textContent = c.docs ? `${num(c.docs)} ${plural(c.docs, 'włączony dokument', 'włączone dokumenty', 'włączonych dokumentów')}, ${num(c.chars)} znaków.` : 'Brak zatwierdzonych dokumentów. Wgraj je w zakładce „Dokumenty” i zatwierdź w „Formatowaniu”.';
      const g = await gpuInfo();
      gpuLine.textContent = g.ok ? `Karta graficzna dostępna: ${g.name}.` : `Karta graficzna niedostępna (${g.msg}) — nauka na procesorze.`;
      clear(fromBox); clear(formBox);
      let disabled = [];
      if (mode === 'continue') {
        const bases = (await listMeta()).filter(m => m.kind === 'base');
        if (!bases.length) { fromBox.append(h('p.warnline', 'Nie ma jeszcze żadnego modelu bazowego. Zacznij od nauki od zera.')); startBtn.disabled = true; return; }
        if (!bases.some(b => b.id === fromId)) fromId = bases[0].id;
        fromBox.append(h('div.field', h('label', 'Model'), h('select', { onchange: e => { fromId = e.target.value; draw(); } }, bases.map(b => h('option', { value: b.id, selected: b.id === fromId }, `${b.name} · ${num(b.params)} parametrów`)))));
        const b = bases.find(x => x.id === fromId); Object.assign(hp, Object.fromEntries(ARCH.map(k => [k, b.hp[k] ?? hp[k]])));
        disabled = ARCH;
      }
      startBtn.disabled = busy();
      formBox.append(fieldsForm('pretrain', hp, { disabled, onChange: () => { saveSettings(s); estimateParams(); } }));
      estimateParams();
    }
    function estimateParams() {
      const V = hp.unit === 'char' ? 120 : 120 + +String(hp.unit).replace('bpe', ''), d = +hp.dim, L = +hp.layers, T = +hp.ctx;
      const p = 2 * V * d + V + T * d + L * (12 * d * d + 13 * d) + 2 * d;
      const ok = d % hp.heads === 0 && (d / hp.heads) % 4 === 0;
      estimate.textContent = ok ? `Sieć będzie miała ok. ${num(Math.round(p / 1000) * 1000)} parametrów (plik modelu ok. ${Math.max(1, Math.round(p * 4 * 1.37 / 1e6))} MB).` : 'Szerokość musi dzielić się przez liczbę głów, a wynik przez 4.';
      estimate.classList.toggle('warnline', !ok);
    }
    async function run() {
      try {
        const c = await corpusText();
        if (!c.docs) return toast('Najpierw wgraj dokumenty i zatwierdź je w zakładce „Formatowanie”.', 'error');
        const g = await gpuInfo(), device = hp.device === 'gpu' && !g.ok ? 'wasm' : hp.device;
        if (mode === 'continue') await ensureLoaded(fromId);
        const t = tags();
        start('pretrain', 'base', { text: c.text, vocabChars: BASE_CHARS + (s.cleaner.extraChars || '') + t.user + t.bot, from: mode === 'continue' ? fromId : null, hp: { ...hp, device, batch: 16 } },
          { docs: c.docs, chars: c.chars, unit: hp.unit, mode });
        startBtn.disabled = true;
      } catch (e) { toast(e.message, 'error'); }
    }
    const off = onTraining(() => { startBtn.disabled = busy(); });
    draw();
    return () => { tv.destroy(); off(); };
  },
};
