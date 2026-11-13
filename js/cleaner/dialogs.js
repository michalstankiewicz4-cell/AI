// Formatowanie danych · rozmowy wzorcowe (do dostrajania): odczyt, sprawdzenie i zapis w formacie tekstowym.
//
// Format pliku (znaczniki ustawisz w panelu, domyślnie „Ty:” i „AI:”):
//
//   Ty: Ile wynosi termin przedawnienia roszczeń?
//   AI: Podstawowy termin przedawnienia wynosi sześć lat.
//   Ty: A dla świadczeń okresowych?
//   AI: Trzy lata.
//
//   Ty: (następna rozmowa po pustej linii)
//   AI: …
//
// Linia bez znacznika jest dalszym ciągiem poprzedniej kwestii. Każda kwestia przechodzi przez formatowanie
// (cleanLine). Rozmowa jest przyjmowana tylko wtedy, gdy zaczyna się od użytkownika, kwestie się przeplatają
// i kończy się odpowiedzią AI. Błędne rozmowy wracają w raporcie z numerem linii, nie trafiają do zestawu.

import { cleanLine } from './cleaner.js';

export function parseDialogs(text, tags, o = {}) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n'), dialogs = [], errors = [], notes = [];
  let cur = null, start = 0;
  const flush = () => {
    if (!cur) return;
    const err = checkDialog(cur.turns, o);
    if (err) errors.push({ line: start + 1, msg: err, text: cur.src.join('\n') });
    else dialogs.push(cur.turns.map(t => ({ role: t.role, text: cleanLine(t.text, o).text })));
    cur = null;
  };
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l) { flush(); return; }
    if (!cur) { cur = { turns: [], src: [] }; start = i; }
    cur.src.push(raw);
    const role = l.startsWith(tags.user) ? 'user' : l.startsWith(tags.bot) ? 'bot' : null;
    if (role) cur.turns.push({ role, text: l.slice((role === 'user' ? tags.user : tags.bot).length).trim(), line: i + 1 });
    else if (cur.turns.length) { cur.turns[cur.turns.length - 1].text += ' ' + l; notes.push(`Linia ${i + 1}: bez znacznika, doklejona do poprzedniej kwestii.`); }
    else cur.turns.push({ role: null, text: l, line: i + 1 });
  });
  flush();
  return { dialogs, errors, notes };
}

// Sprawdzenie jednej rozmowy (tablica {role, text}); zwraca opis błędu albo null.
export function checkDialog(turns, o = {}) {
  if (!turns.length) return 'Pusta rozmowa.';
  if (turns.some(t => !t.role)) return 'Linia nie zaczyna się od znacznika użytkownika ani AI.';
  if (turns[0].role !== 'user') return 'Rozmowa musi zaczynać się od pytania użytkownika.';
  for (let i = 1; i < turns.length; i++) if (turns[i].role === turns[i - 1].role) return `Dwie kwestie ${turns[i].role === 'user' ? 'użytkownika' : 'AI'} pod rząd${turns[i].line ? ` (linia ${turns[i].line})` : ''}: kwestie muszą się przeplatać.`;
  if (turns[turns.length - 1].role !== 'bot') return 'Rozmowa musi kończyć się odpowiedzią AI.';
  for (const t of turns) {
    const c = cleanLine(t.text, o).text;
    if (!c) return `Pusta kwestia${t.line ? ` (linia ${t.line})` : ''}.`;
    if (t.role === 'bot' && o.maxAnswer && c.length > o.maxAnswer) return `Odpowiedź AI ma ${c.length} znaków, limit to ${o.maxAnswer}${t.line ? ` (linia ${t.line})` : ''}.`;
  }
  return null;
}

export function dialogToText(turns, tags) {
  return turns.map(t => `${t.role === 'user' ? tags.user : tags.bot} ${t.text}`).join('\n');
}
