// Testy formatowania danych: node tests/run.js
import { cleanDocument, cleanLine } from '../js/cleaner/cleaner.js';
import { parseDialogs } from '../js/cleaner/dialogs.js';

export default function (t) {
  const pdf = '﻿Kodeks cywilny\n©Kancelaria Sejmu\ns. 1/3\nArt.117. § 1. Z zastrzeżeniem wyjątków w ustawie przewi-\ndzianych, roszczenia majątkowe ulegają\nprzedawnieniu.\n©Kancelaria Sejmu\ns. 2/3\nArt. 118. Jeżeli przepis szczególny nie stanowi inaczej , termin\nprzedawnienia wynosi sześć lat,a dla roszczeń o świadczenia okresowe — trzy lata.\n1) pkt.2 ust.3 “cytat” ﬁrma x\n©Kancelaria Sejmu\ns. 3/3\n©Kancelaria Sejmu\nZnak ✓ dziwny 😀';
  const r = cleanDocument(pdf, { repeatMin: 3 });
  const out = r.text;
  t.ok(!out.includes('Kancelaria'), 'stopka usunięta');
  t.ok(!/s\. \d\/3/.test(out), 'numery stron usunięte');
  t.ok(out.includes('ustawie przewidzianych, roszczenia majątkowe ulegają przedawnieniu.'), 'przeniesienie i łączenie linii: ' + out);
  t.ok(out.includes('Art. 117. § 1.'), 'zapis art. i §');
  t.ok(out.includes('nie stanowi inaczej, termin przedawnienia'), 'spacja przed przecinkiem + łączenie');
  t.ok(out.includes('sześć lat, a dla'), 'spacja po przecinku');
  t.ok(out.includes('okresowe – trzy'), 'myślnik');
  t.ok(out.includes('1) pkt 2 ust. 3 „cytat” firma x'), 'pkt, ust, cudzysłów, ligatura, twarda spacja: ' + out.split('\n').find(l => l.startsWith('1)')));
  t.ok(out.split('\n')[0] === 'Kodeks cywilny', 'BOM usunięty');
  t.eq(r.report.removed['✓'], 1, 'usunięty znak w raporcie');
  t.ok(out.includes('\nArt. 118.') && out.includes('\n1) '), 'struktura przepisu zachowana');

  const moji = cleanDocument('Kodeks cywilny okreĹ›la zasady. To jest zĹ‚y tekst Ä…Ä™. '.repeat(3));
  t.ok(moji.report.warnings.some(w => w.includes('kodowanie')), 'ostrzeżenie o kodowaniu');

  t.eq(cleanLine('  Ile  wynosi\nart.5 ?? ').text, 'Ile wynosi art. 5?', 'kwestia w jednej linii');

  const tags = { user: 'Ty:', bot: 'AI:' };
  const d = parseDialogs('Ty: Pytanie pierwsze?\nAI: Odpowiedź\nciąg dalszy.\nTy: A drugie?\nAI: Też.\n\nAI: Zła rozmowa\n\nTy: Bez odpowiedzi?\n\nTy: a\nTy: b\nAI: c', tags, { maxAnswer: 600 });
  t.eq(d.dialogs.length, 1, 'jedna dobra rozmowa');
  t.eq(d.dialogs[0][1].text, 'Odpowiedź ciąg dalszy.', 'linia bez znacznika doklejona');
  t.eq(d.errors.length, 3, 'trzy błędne rozmowy: ' + d.errors.map(e => e.msg).join(' | '));
}
