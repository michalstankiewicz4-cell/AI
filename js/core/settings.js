// Ustawienia: wartości domyślne, opis każdego pola (do panelu „Ustawienia” i podpowiedzi [?]) oraz zapis.
//
// Panel ustawień i formularze w zakładkach nauki są budowane z SCHEMA, więc nowe ustawienie dodaje się
// w jednym miejscu: tutaj. Ustawienia trzymamy w IndexedDB (kv: 'settings'); token GitHub osobno
// w localStorage (patrz github.js), żeby nie trafił do eksportów.

import { db } from './db.js';
import { RULES } from '../cleaner/rules.js';
import { DEFAULT_PROMPT } from './ai-prompt.js';

const opt = (v, l) => [v, l];

export const SCHEMA = [
  { group: 'general', title: 'Ogólne', fields: [
    { id: 'name', label: 'Nazwa asystenta', type: 'text', def: 'Asystent prawny', help: 'Nazwa widoczna w nagłówku okna czatu.' },
    { id: 'userTag', label: 'Znacznik użytkownika', type: 'text', def: 'Ty:', help: 'Jak w rozmowach wzorcowych zaczyna się kwestia użytkownika. Wszystkie znaki znacznika muszą występować w dokumentach do nauki (inaczej model ich nie zna). Zmiana po dostrojeniu wymaga ponownego dostrojenia.' },
    { id: 'botTag', label: 'Znacznik AI', type: 'text', def: 'AI:', help: 'Jak zaczyna się kwestia AI. Te same zasady co przy znaczniku użytkownika.' },
  ] },
  { group: 'cleaner', title: 'Formatowanie danych', fields: [
    ...RULES.map(r => ({ id: 'rule_' + r.id, label: r.name, type: 'bool', def: true, help: r.desc })),
    { id: 'extraChars', label: 'Dodatkowe dozwolone znaki', type: 'text', def: '', help: 'Znaki, które mają zostać w tekście mimo reguły „Dozwolone znaki”, wpisane jeden po drugim (np. äöüé€). Raport przy dokumencie pokazuje, co zostało usunięte.' },
    { id: 'repeatMin', label: 'Nagłówek/stopka od', type: 'select', def: 4, opts: [opt(3, '3 powtórzeń'), opt(4, '4 powtórzeń'), opt(6, '6 powtórzeń'), opt(10, '10 powtórzeń')], help: 'Ile razy krótka linia musi się powtórzyć w dokumencie, żeby uznać ją za nagłówek lub stopkę strony i usunąć.' },
    { id: 'dedupeMin', label: 'Powtórzony akapit od', type: 'select', def: 40, opts: [opt(20, '20 znaków'), opt(40, '40 znaków'), opt(80, '80 znaków')], help: 'Od jakiej długości powtórzony akapit jest usuwany.' },
    { id: 'maxAnswer', label: 'Najdłuższa odpowiedź wzorcowa', type: 'select', def: 600, opts: [opt(300, '300 znaków'), opt(600, '600 znaków'), opt(1000, '1000 znaków'), opt(2000, '2000 znaków')], help: 'Dłuższe odpowiedzi w rozmowach wzorcowych są odrzucane: mała sieć i tak nie utrzyma tak długiej wypowiedzi, a długie przykłady zajmują okno.' },
  ] },
  { group: 'pretrain', title: 'Nauka na dokumentach', fields: [
    { id: 'unit', label: 'Jednostka tekstu', type: 'select', def: 'bpe1024', opts: [opt('char', 'litery'), opt('bpe512', 'tokeny BPE, 512 sklejeń'), opt('bpe1024', 'tokeny BPE, 1024 sklejenia'), opt('bpe2048', 'tokeny BPE, 2048 sklejeń')], help: 'Litery: najmniejszy słownik, ale sieć widzi krótszy tekst. Tokeny BPE: częste kawałki słów jako jedna jednostka, więc w to samo okno mieści się ok. 3× więcej tekstu. Przy dużych zbiorach dokumentów więcej sklejeń daje lepszy wynik.' },
    { id: 'layers', label: 'Warstwy', type: 'select', def: 4, opts: [2, 3, 4, 6, 8].map(v => opt(v, String(v))), help: 'Liczba bloków transformera. Więcej = sieć uczy się bardziej złożonych zależności, ale wolniej i potrzebuje więcej tekstu.' },
    { id: 'dim', label: 'Szerokość', type: 'select', def: 128, opts: [64, 96, 128, 192, 256].map(v => opt(v, String(v))), help: 'Ile liczb opisuje każdy token w sieci. Musi dzielić się przez liczbę głów, a wynik przez 4.' },
    { id: 'heads', label: 'Głowy uwagi', type: 'select', def: 4, opts: [2, 4, 8].map(v => opt(v, String(v))), help: 'Ile niezależnych „spojrzeń wstecz” ma każda warstwa.' },
    { id: 'ctx', label: 'Okno (pamięć)', type: 'select', def: 128, opts: [64, 128, 256, 512].map(v => opt(v, v + ' tokenów')), help: 'Ile tokenów sieć widzi naraz. Od tego zależy, ile poprzednich wymian rozmowy pamięta. Większe okno = wolniejsza nauka. Ustalane przy nauce od zera, potem się nie zmienia.' },
    { id: 'steps', label: 'Kroki nauki', type: 'select', def: 4000, opts: [500, 1000, 2000, 4000, 8000, 16000, 32000].map(v => opt(v, String(v))), help: 'Każdy krok to 16 losowych fragmentów tekstu. Więcej kroków = lepsza sieć, o ile tekstu jest dość (inaczej uczy się na pamięć; wtedy panel sam wraca do najlepszego momentu).' },
    { id: 'lr', label: 'Tempo nauki', type: 'select', def: .003, opts: [opt(.0003, '0,0003'), opt(.001, '0,001'), opt(.003, '0,003')], help: 'Wielkość kroku poprawiania wag. Za duże = nauka się rozjeżdża, za małe = trwa długo. Przy dalszej nauce istniejącego modelu lepiej mniejsze.' },
    { id: 'generalShare', label: 'Udział tekstu ogólnego', type: 'select', def: 20, opts: [0, 10, 20, 30, 40, 50].map(v => opt(v, v + '%')), help: 'Jaką część tekstu do nauki mogą stanowić dokumenty oznaczone jako „ogólne” (np. Wikipedia, stenogramy Sejmu). Uczą zwykłej polszczyzny, więc sieć lepiej rozumie potoczne pytania. Dokumenty prawnicze idą zawsze w całości; ogólnych bierze się tyle, żeby nie przekroczyć udziału. Mała sieć ma mało miejsca, więc rozsądnie 10–30%.' },
    { id: 'device', label: 'Liczy', type: 'select', def: 'gpu', opts: [opt('gpu', 'karta graficzna (GPU)'), opt('wasm', 'procesor, WASM SIMD'), opt('cpu', 'procesor, zwykły JS')], help: 'Karta graficzna jest najszybsza (wymaga przeglądarki z WebGPU, np. Chrome lub Edge). Gdy jej nie ma, panel liczy procesorem.' },
  ] },
  { group: 'finetune', title: 'Dostrajanie do rozmowy', fields: [
    { id: 'steps', label: 'Kroki dostrajania', type: 'select', def: 600, opts: [100, 300, 600, 1000, 2000, 4000].map(v => opt(v, String(v))), help: 'Zwykle dużo mniej niż przy nauce: sieć zna już język, uczy się tylko odpowiadać.' },
    { id: 'lr', label: 'Tempo dostrajania', type: 'select', def: .001, opts: [opt(.0003, '0,0003'), opt(.001, '0,001'), opt(.003, '0,003')], help: 'Mniejsze niż przy nauce, żeby sieć nie zapomniała języka.' },
    { id: 'mask', label: 'Błąd liczony na', type: 'select', def: 1, opts: [opt(1, 'tylko odpowiedziach AI'), opt(0, 'całej rozmowie')], help: 'Maskowanie: sieć uczy się odpowiadać, a nie mówić za użytkownika. Bez maski uczy się też pisać pytania.' },
    { id: 'valShare', label: 'Rozmowy do sprawdzania', type: 'select', def: .1, opts: [opt(.05, '5%'), opt(.1, '10%'), opt(.2, '20%')], help: 'Część rozmów wzorcowych odkładana na bok: sieć się na nich nie uczy, służą do zmierzenia, jak radzi sobie z rozmowami, których nie widziała.' },
    { id: 'device', label: 'Liczy', type: 'select', def: 'gpu', opts: [opt('gpu', 'karta graficzna (GPU)'), opt('wasm', 'procesor, WASM SIMD'), opt('cpu', 'procesor, zwykły JS')], help: 'Jak przy nauce.' },
  ] },
  { group: 'ai', title: 'Przygotowanie dla zewnętrznego AI', fields: [
    { id: 'prompt', label: 'Instrukcja dla AI (prompt systemowy)', type: 'textarea', rows: 12, def: DEFAULT_PROMPT, help: 'Tekst, który trafia na początek pliku „Przygotuj dla AI”. Mówi zewnętrznemu AI (np. Claude), jak ostatecznie sformatować dokumenty: struktura Markdown aktów, metadane, części orzeczeń, czego nie zmieniać. Możesz go dowolnie zmienić; „Przywróć domyślną” wraca do wersji z panelu.' },
    { id: 'partChars', label: 'Wielkość części pliku', type: 'select', def: 60000, opts: [20000, 40000, 60000, 100000, 200000].map(v => opt(v, (v / 1000) + ' tys. znaków')), help: 'Długie zestawy dzielą się na kilka plików, żeby zmieściły się w jednej wiadomości do AI. Dokument dłuższy niż część idzie sam.' },
  ] },
  { group: 'chat', title: 'Rozmowa', fields: [
    { id: 'temp', label: 'Temperatura', type: 'select', def: .6, opts: [.2, .4, .6, .8, 1].map(v => opt(v, String(v).replace('.', ','))), help: 'Niska = sieć wybiera najpewniejsze słowa (powtarzalnie, bezpieczniej). Wysoka = odważniej, ale więcej pomyłek.' },
    { id: 'maxTokens', label: 'Najdłuższa odpowiedź', type: 'select', def: 160, opts: [60, 120, 160, 250, 400].map(v => opt(v, v + ' tokenów')), help: 'Limit długości jednej odpowiedzi.' },
    { id: 'turns', label: 'Pamięć rozmowy', type: 'select', def: 2, opts: [opt(0, 'tylko bieżące pytanie'), opt(1, '1 poprzednia wymiana'), opt(2, '2 poprzednie wymiany'), opt(4, '4 poprzednie wymiany'), opt(8, '8 poprzednich wymian')], help: 'Ile wcześniejszych pytań i odpowiedzi dołączać do kontekstu. Ograniczenie: okno modelu — co się nie zmieści, sieć i tak odetnie.' },
    { id: 'refs', label: 'Fragmenty z biblioteki', type: 'select', def: 3, opts: [opt(0, 'nie pokazuj'), opt(1, '1 fragment'), opt(2, '2 fragmenty'), opt(3, '3 fragmenty'), opt(5, '5 fragmentów')], help: 'Pod odpowiedzią modelu czat pokazuje fragmenty zatwierdzonych dokumentów najlepiej pasujące do pytania (dokładny tekst przepisu ze źródłem). Mały model może pomylić liczby i terminy – fragment pokazuje, co mówi dokument.' },
    { id: 'save', label: 'Zapisuj rozmowy', type: 'bool', def: true, help: 'Rozmowy z czatu trafiają do zakładki „Historia rozmów”, gdzie można poprawić odpowiedzi i przenieść je do rozmów wzorcowych.' },
  ] },
  { group: 'github', title: 'GitHub', fields: [
    { id: 'repo', label: 'Repozytorium', type: 'text', def: 'michalstankiewicz4-cell/AI', help: 'Gdzie publikować modele (właściciel/nazwa). Modele trafiają do folderu models/ na gałęzi poniżej.' },
    { id: 'branch', label: 'Gałąź', type: 'text', def: 'main', help: 'Gałąź, z której publikuje się GitHub Pages.' },
  ] },
];

export function defaults() {
  const o = {};
  for (const g of SCHEMA) { o[g.group] = {}; for (const f of g.fields) o[g.group][f.id] = f.def; }
  return o;
}

let cur = null;
const listeners = new Set();

export async function loadSettings() {
  const saved = await db.kvGet('settings'), d = defaults();
  cur = d;
  if (saved) for (const g in d) Object.assign(cur[g], saved[g] || {});
  return cur;
}
export const settings = () => cur;
export async function saveSettings(next) { cur = next; await db.kvSet('settings', next); listeners.forEach(f => f(cur)); }
export const onSettings = f => { listeners.add(f); return () => listeners.delete(f); };

// Ustawienia formatowania w postaci, jakiej oczekują reguły (js/cleaner).
export function cleanerOpts(s = cur) {
  const c = s.cleaner, rules = {};
  for (const r of RULES) rules[r.id] = c['rule_' + r.id] !== false;
  return { rules, extraChars: c.extraChars, repeatMin: +c.repeatMin, dedupeMin: +c.dedupeMin, maxAnswer: +c.maxAnswer };
}
export const tags = (s = cur) => ({ user: s.general.userTag, bot: s.general.botTag });
