// Formatowanie danych · reguły.
//
// Każda reguła dostaje tekst i ustawienia, zwraca poprawiony tekst i liczbę zmian (do raportu).
// Reguły działają w ustalonej kolejności (kolejność tablicy). `scope` mówi, gdzie reguła ma sens:
//   doc  — dokumenty do nauki (całe strony, ustawy, artykuły),
//   line — pojedyncza kwestia: rozmowa wzorcowa albo wiadomość w czacie.
// Wersja reguł (CLEANER_VERSION w js/version.js) trafia do każdego dokumentu: gdy reguły się zmienią,
// panel pokaże, które dokumenty sformatowano starszą wersją.

// Zamiana z liczeniem: liczy się tylko miejsce, w którym tekst faktycznie się zmienił.
const replaceCount = (s, re, fn) => {
  let n = 0;
  const out = s.replace(re, (...a) => {
    const m = a[0], groups = a.slice(1, -2);
    const r = typeof fn === 'function' ? fn(...a) : fn.replace(/\$(\d)/g, (_, i) => groups[i - 1] ?? '');
    if (r !== m) n++; return r;
  });
  return { text: out, n };
};

// Początek linii, który zawsze zaczyna nową jednostkę tekstu prawnego (nie wolno go doklejać do poprzedniej linii).
export const STRUCT_START = /^(Art\.|§|Rozdział|ROZDZIAŁ|Dział|DZIAŁ|Tytuł|TYTUŁ|Księga|KSIĘGA|Oddział|ODDZIAŁ|Załącznik|ZAŁĄCZNIK|\d+[a-z]?\)|\d+[a-z]?\.\s|[a-z]\)|[–•*-]\s)/u;

// Znaki dozwolone zawsze; resztę można dopisać w zakładce Formatowanie → Ustawienia formatowania („Dodatkowe dozwolone znaki”).
export const BASE_CHARS = 'aąbcćdeęfghijklłmnńoópqrsśtuvwxyzźżAĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ0123456789 \n.,;:!?()[]„”\'-–§%/&*+=<>@#°';

const LIGATURES = { 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };

export const RULES = [
  { id: 'unicode', name: 'Ujednolicenie zapisu liter', scope: ['doc', 'line'],
    desc: 'Litery z ogonkami zapisane jako dwa znaki (np. „a” + ogonek) zamienia na jeden znak „ą”; ligatury z PDF-ów (ﬁ, ﬂ) na zwykłe litery. Bez tego ta sama litera miałaby w słowniku sieci dwa różne zapisy.',
    apply(t) { const a = t.normalize('NFC'); let n = a === t ? 0 : 1; const r = replaceCount(a, /[ﬀ-ﬆ]/g, c => LIGATURES[c] || c); return { text: r.text, n: n + r.n }; } },

  { id: 'invisible', name: 'Znaki niewidoczne i sterujące', scope: ['doc', 'line'],
    desc: 'Usuwa znaki, których nie widać, a które psują naukę: miękkie dzielenie wyrazów, znaki zerowej szerokości, BOM, znaki sterujące. Twarde spacje i tabulatory zamienia na zwykłe spacje, końce linii Windows na zwykłe.',
    apply(t) {
      let n = 0;
      let r = replaceCount(t, /\r\n?/g, '\n'); n += r.n; t = r.text;
      r = replaceCount(t, /[­​-‍⁠﻿]/g, ''); n += r.n; t = r.text;
      r = replaceCount(t, /[\t  -   　]/g, ' '); n += r.n; t = r.text;
      r = replaceCount(t, /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g, ''); n += r.n; t = r.text;
      return { text: t, n };
    } },

  { id: 'hyphenation', name: 'Wyrazy przeniesione do nowej linii', scope: ['doc'],
    desc: 'Skleja wyrazy rozdzielone myślnikiem na końcu linii: „przedawnie-” + „nia” → „przedawnienia”. Typowe w tekstach skopiowanych z PDF.',
    apply(t) { return replaceCount(t, /(\p{Ll})-[ ]*\n[ ]*(\p{Ll})/gu, (_, a, b) => a + b); } },

  { id: 'pageNoise', name: 'Numery stron, nagłówki i stopki', scope: ['doc'],
    desc: 'Usuwa linie będące samym numerem strony („12”, „- 12 -”, „Strona 3 z 40”, „3/40”) oraz krótkie linie powtarzające się wiele razy (nagłówki i stopki stron, np. „©Kancelaria Sejmu”). Próg powtórzeń ustawisz w ustawieniach.',
    apply(t, o) {
      const lines = t.split('\n'), freq = new Map();
      for (const l of lines) { const k = l.trim(); if (k && k.length <= 80 && !STRUCT_START.test(k)) freq.set(k, (freq.get(k) || 0) + 1); }
      const pageNo = /^(\d{1,4}|[-–]\s*\d{1,4}\s*[-–]|(strona|str\.|s\.)\s*\d{1,4}(\s*(z|\/)\s*\d{1,4})?|\d{1,4}\s*\/\s*\d{1,4})$/i;
      let n = 0; const out = [];
      for (const l of lines) { const k = l.trim(); if (k && (pageNo.test(k) || (freq.get(k) || 0) >= (o.repeatMin || 4))) { n++; continue; } out.push(l); }
      return { text: out.join('\n'), n };
    } },

  { id: 'lineJoin', name: 'Łączenie złamanych linii w akapity', scope: ['doc'],
    desc: 'Tekst z PDF-ów i stron ma linie złamane w połowie zdania. Linia jest doklejana do poprzedniej, gdy poprzednia nie kończy się kropką, dwukropkiem, średnikiem, wykrzyknikiem ani pytajnikiem albo gdy linia zaczyna się małą literą. Nigdy nie dokleja linii zaczynających się od „Art.”, „§”, „Rozdział”, „1)”, „a)”, „1.” itp. — struktura przepisu zostaje.',
    apply(t) {
      const lines = t.split('\n'), out = []; let n = 0;
      for (const raw of lines) {
        const l = raw.trim(), prev = out.length ? out[out.length - 1] : '';
        if (l && prev && !STRUCT_START.test(l) && (!/[.:;!?]$/.test(prev) || /^\p{Ll}/u.test(l))) { out[out.length - 1] = prev + ' ' + l; n++; }
        else out.push(l);
      }
      return { text: out.join('\n'), n };
    } },

  { id: 'quotes', name: 'Cudzysłowy i apostrofy', scope: ['doc', 'line'],
    desc: 'Wszystkie rodzaje cudzysłowów ("…", “…”, «…», ″) zamienia na polskie „…”, a apostrofy (’ ‘ ` ´) na jeden znak \'. Mniej odmian tego samego znaku = sieć szybciej się uczy.',
    apply(t) {
      let r = replaceCount(t, /["“”«»‟″〝〞]/g, (c, off, s) => (off === 0 || /[\s(\[\/–-]/.test(s[off - 1])) ? '„' : '”');
      const r2 = replaceCount(r.text, /[’‘‚`´′]/g, '\'');
      return { text: r2.text, n: r.n + r2.n };
    } },

  { id: 'dashes', name: 'Myślniki i łączniki', scope: ['doc', 'line'],
    desc: 'Różne kreski (—, ‒, −, ‐, ‑ i łącznik ze spacjami) ujednolica: między spacjami półpauza „ – ”, wewnątrz wyrazu zwykły łącznik „-” (np. „cywilno-prawny”).',
    apply(t) {
      let n = 0;
      let r = replaceCount(t, /[‐‑‒—―−]/g, '–'); n += r.n; t = r.text;
      r = replaceCount(t, /(\S)–(\S)/g, (_, a, b) => a + '-' + b); n += r.n; t = r.text;
      r = replaceCount(t, / - /g, ' – '); n += r.n; t = r.text;
      return { text: t, n };
    } },

  { id: 'punctuation', name: 'Interpunkcja', scope: ['doc', 'line'],
    desc: 'Wielokropek „…” zapisuje jako trzy kropki, usuwa spacje przed przecinkiem i kropką oraz po nawiasie otwierającym, powtórzone „!!!” i „???” skraca do jednego znaku, dodaje brakującą spację po przecinku przed słowem.',
    apply(t) {
      let n = 0, r;
      r = replaceCount(t, /…/g, '...'); n += r.n; t = r.text;
      r = replaceCount(t, /[ ]+([,.;:!?)\]])/g, '$1'); n += r.n; t = r.text;
      r = replaceCount(t, /([(\[])[ ]+/g, '$1'); n += r.n; t = r.text;
      r = replaceCount(t, /([!?])\1+/g, '$1'); n += r.n; t = r.text;
      r = replaceCount(t, /,(\p{L})/gu, ', $1'); n += r.n; t = r.text;
      return { text: t, n };
    } },

  { id: 'legalNotation', name: 'Zapis oznaczeń prawnych', scope: ['doc', 'line'],
    desc: 'Ujednolica zapis jednostek przepisów: „art.5” → „art. 5”, „§1” → „§ 1”, „ust.2” → „ust. 2”, „pkt. 3” → „pkt 3”, „lit.a” → „lit. a”, „Dz.U.” → „Dz. U.”. Ten sam przepis zapisany na kilka sposobów to dla sieci kilka różnych słów.',
    apply(t) {
      let n = 0, r;
      r = replaceCount(t, /\b(art|Art|ust|poz|nr|Nr)\.?[ ]*(?=\d)/g, (m, w) => w + '. '); n += r.n; t = r.text;
      r = replaceCount(t, /\bpkt\.?[ ]*(?=\d)/g, 'pkt '); n += r.n; t = r.text;
      r = replaceCount(t, /\blit\.?[ ]*(?=\p{Ll}\b)/gu, 'lit. '); n += r.n; t = r.text;
      r = replaceCount(t, /§[ ]*(?=\d)/g, '§ '); n += r.n; t = r.text;
      r = replaceCount(t, /Dz\.[ ]*U\./g, 'Dz. U.'); n += r.n; t = r.text;
      return { text: t, n };
    } },

  { id: 'charset', name: 'Dozwolone znaki', scope: ['doc', 'line'],
    desc: 'Usuwa każdy znak spoza listy dozwolonych (litery polskie i łacińskie, cyfry, typowa interpunkcja, §, % itp.). Usunięte znaki są wypisane w raporcie z liczbą wystąpień, więc widać, co odpadło. Brakujące znaki dopiszesz w ustawieniach.',
    apply(t, o, rep) {
      const ok = new Set([...BASE_CHARS, ...(o.extraChars || '')]); let n = 0, out = '';
      for (const ch of t) { if (ok.has(ch)) out += ch; else { n++; if (rep) rep.removed[ch] = (rep.removed[ch] || 0) + 1; } }
      return { text: out, n };
    } },

  { id: 'spaces', name: 'Spacje i puste linie', scope: ['doc', 'line'],
    desc: 'Zamienia wiele spacji na jedną, usuwa spacje na początku i końcu linii, zostawia najwyżej jedną pustą linię między akapitami.',
    apply(t) {
      let n = 0, r;
      r = replaceCount(t, /[ ]{2,}/g, ' '); n += r.n; t = r.text;
      r = replaceCount(t, /^[ ]+|[ ]+$/gm, ''); n += r.n; t = r.text;
      r = replaceCount(t, /\n{3,}/g, '\n\n'); n += r.n; t = r.text;
      return { text: t.trim(), n };
    } },

  { id: 'dedupe', name: 'Powtórzone akapity', scope: ['doc'],
    desc: 'Usuwa akapit, który wystąpił już wcześniej w tym samym dokumencie (od ustawionej długości wzwyż). Powtórzenia uczą sieć na pamięć zamiast języka.',
    apply(t, o) {
      const seen = new Set(), out = []; let n = 0;
      for (const l of t.split('\n')) { const k = l.trim(); if (k.length >= (o.dedupeMin || 40) && seen.has(k)) { n++; continue; } if (k) seen.add(k); out.push(l); }
      return { text: out.join('\n'), n };
    } },
];

export const RULE_IDS = RULES.map(r => r.id);
