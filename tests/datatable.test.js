// Widok „Tabela”: wiersze przepisów i rozmów, wykrywanie problemów, sortowanie, filtr.
import { provisionRows, dialogRows, sortRows, filterRows, problemCounts } from '../js/core/datatable.js';

export default function (T) {
  const t = (msg, f) => T.ok(f(), msg);
  const kc = { id: 'kc', name: 'Kodeks cywilny', license: 'dokument urzędowy (art. 4 pr. aut.)', text: 'Art. 1.\nTekst pierwszy artykułu jakiś dłuższy.\n\nArt. 2. § 1. Zob. art. 99 k.c. oraz art. 1.\n§ 2.\n\nArt. 3. Tekst pierwszy artykułu jakiś dłuższy.\n\nArt. 10. Zob. art. 5 Prawa bankowego.\n\nArt. 9. Dziewiąty.' };
  const bez = { id: 'x', name: 'Ustawa bez licencji', license: '', text: 'Art. 1. A jeden.\n\nArt. 2. B dwa.\n\nArt. 3. C trzy.' };
  const rows = provisionRows([kc, bez]);
  const by = l => rows.find(r => r.label === l), has = (l, id) => by(l).problems.some(p => p.id === id);

  t('przepisy: wiersz na paragraf, podpis ze skrótem aktu', () => rows.length === 9 && !!by('art. 2 § 1 k.c.') && !!by('art. 2 § 2 k.c.'));
  t('pusty tekst: paragraf bez treści', () => has('art. 2 § 2 k.c.', 'empty') && !has('art. 1 k.c.', 'empty'));
  t('duplikat: ten sam tekst w dwóch artykułach, z listą', () => has('art. 1 k.c.', 'dup') && has('art. 3 k.c.', 'dup') && by('art. 1 k.c.').problems.find(p => p.id === 'dup').info.includes('art. 3 k.c.'));
  t('zły odnośnik: brak artykułu w akcie z biblioteki; ten sam akt bez nazwy działa', () => has('art. 2 § 1 k.c.', 'ref') && by('art. 2 § 1 k.c.').problems.find(p => p.id === 'ref').info.includes('art. 99'));
  t('odnośnik do aktu spoza biblioteki nie jest błędem', () => !has('art. 10 k.c.', 'ref'));
  t('brak licencji tylko w dokumencie bez licencji', () => rows.filter(r => r.docId === 'x').every(r => r.problems.some(p => p.id === 'license')) && !has('art. 1 k.c.', 'license'));
  t('sortowanie po przepisie zachowuje kolejność w akcie; po problemach malejąco', () => {
    const s = sortRows(rows.filter(r => r.docId === 'kc'), 'label').map(r => r.label).join(',');
    const p = sortRows(rows, 'problems', -1);
    return s === 'art. 1 k.c.,art. 2 § 1 k.c.,art. 2 § 2 k.c.,art. 3 k.c.,art. 10 k.c.,art. 9 k.c.' && p[0].problems.length >= p[p.length - 1].problems.length;
  });
  t('sortowanie tekstu: liczby jak liczby', () => sortRows([{ x: 'art. 10' }, { x: 'art. 9' }], 'x').map(r => r.x).join() === 'art. 9,art. 10');
  t('filtr: problem i tekst', () => filterRows(rows, '', 'ref').length === 1 && filterRows(rows, 'dziewiąty').length === 1 && filterRows(rows, '', 'any').length === rows.filter(r => r.problems.length).length);
  t('liczniki problemów', () => { const c = problemCounts(rows); return c.empty === 1 && c.dup === 2 && c.ref === 1 && c.license === 3; });

  const ds = dialogRows([
    { id: 'a', enabled: true, turns: [{ role: 'user', text: 'Czy bank może zmienić kurs?' }, { role: 'bot', text: 'Zob. art. 99 k.c. i art. 1 k.c.' }] },
    { id: 'b', draft: true, turns: [{ role: 'user', text: 'czy bank  może zmienić kurs?' }, { role: 'bot', text: '' }] },
  ], [kc]);
  t('rozmowy: stan, pusty tekst, duplikat pytania, zły odnośnik', () => ds[0].status === 'w dostrajaniu' && ds[1].status === 'do uzupełnienia'
    && ds[1].problems.some(p => p.id === 'empty') && ds[0].problems.some(p => p.id === 'dup') && ds[0].problems.find(p => p.id === 'ref')?.info === 'Brak w bibliotece: art. 99 k.c.');
}
