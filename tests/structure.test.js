// Struktura aktów (artykuły, paragrafy, ustępy), odnośniki, graf powiązań, JSONL, kazusy z orzeczeń, licencje.
import { parseStructure, findRefs, unitLabel, buildGraph, toJSONL, actShort } from '../js/core/structure.js';
import { judgmentSections, caseFromJudgment } from '../js/core/dialogs.js';
import { autoLicense, licenseProblems } from '../js/core/documents.js';
import { docChunks } from '../js/core/search.js';

export default async function (t) {
  const kc = { id: 'kc', name: 'DU 2026 795 – Kodeks cywilny', text: 'KSIĘGA TRZECIA\nZobowiązania\nArt. 385.\nUmowa.\nArt. 385¹. § 1. Postanowienia umowy niedozwolone, zob. art. 385 i art. 69 Prawa bankowego.\n§ 2. Strony są związane umową w pozostałym zakresie.\nArt. 405. Kto bez podstawy prawnej uzyskał korzyść majątkową, zob. art. 385¹ § 1.\nArt. 410. § 1. Przepisy art. 405 stosuje się do nienależnego świadczenia.', tags: [] };
  const pb = { id: 'pb', name: 'DU 2026 38 – Prawo bankowe', text: '### Art. 1.\nUstawa.\n### Art. 2.\nBank.\n### Art. 69. 1. Przez umowę kredytu bank zobowiązuje się oddać do dyspozycji kwotę, zob. art. 385¹ k.c.\n2. Umowa powinna być zawarta na piśmie.', tags: [] };
  const s = parseStructure(kc.text);
  t.eq(s.articles.map(a => a.art).join(','), '385,385^1,405,410', 'artykuły z indeksem górnym');
  t.eq(s.articles[1].chapter, 'KSIĘGA TRZECIA', 'rozdział / księga przy artykule');
  t.eq(s.units.filter(u => u.art === '385^1').map(u => unitLabel(u, 'k.c.')).join(' | '), 'art. 385¹ § 1 k.c. | art. 385¹ § 2 k.c.', 'paragrafy i podpisy');
  t.eq(parseStructure(pb.text).units.filter(u => u.art === '69').map(u => unitLabel(u, 'pr. bank.')).join(' | '), 'art. 69 ust. 1 pr. bank. | art. 69 ust. 2 pr. bank.', 'ustępy (Markdown od AI)');
  const refs = findRefs('zob. art. 69 ust. 1 Prawa bankowego, art. 385¹ k.c. i art. 5 § 2');
  t.eq(refs.map(r => `${r.art}|${r.part}|${r.short}`).join(' ; '), '69|ust. 1|pr. bank. ; 385^1|null|k.c. ; 5|§ 2|null', 'odnośniki: akt, ustęp, paragraf, indeks górny');
  t.eq(actShort('ustawa o kredycie konsumenckim'), 'u.k.k.', 'skrót aktu');
  const g = buildGraph([kc, pb]);
  t.eq(g.resolve(findRefs('art. 69 Prawa bankowego')[0], kc).doc.id, 'pb', 'odnośnik do innego aktu z biblioteki');
  t.eq(g.resolve(findRefs('art. 405')[0], kc).art, '405', 'odnośnik bez aktu = ten sam akt');
  const inc = g.incoming(kc, '385^1').map(x => `${x.doc.id}:${x.art}`).sort().join(',');
  t.eq(inc, 'kc:405,pb:69', 'cytowany przez: art. 405 k.c. i art. 69 pr. bank.');
  const lines = toJSONL([kc]).trim().split('\n').map(l => JSON.parse(l));
  t.ok(lines.length === 5 && lines.find(l => l.przepis === 'art. 385¹ § 1 k.c.').odnosniki.some(o => o.akt === 'pr. bank.'), `JSONL: ${lines.length} przepisów z podpisem i odnośnikami`);
  t.ok(docChunks(kc).some(c => c.label === 'art. 385¹ k.c.'), 'wyszukiwanie: fragmenty po artykułach z podpisem');
  const j = '## Sygnatura i sąd\nI C 1/26\n## Stan faktyczny\nKredyt w CHF z 2008 r.\n## Analiza prawna\nKlauzule abuzywne.\n## Rozstrzygnięcie\nUmowa nieważna.';
  t.eq(Object.keys(judgmentSections(j)).sort().join(','), 'analiza,fakty,wynik', 'części orzeczenia');
  const c = caseFromJudgment({ text: j });
  t.ok(c.question.startsWith('Kredyt w CHF') && c.answer.startsWith('Umowa nieważna. Uzasadnienie: Klauzule'), 'kazus: pytanie ze stanu faktycznego, odpowiedź z rozstrzygnięcia i analizy');
  t.ok(caseFromJudgment({ text: 'bez części' }).error, 'orzeczenie bez części – pominięte z powodem');
  t.eq(autoLicense({ eli: 'DU/2026/1', name: 'x' }), 'dokument urzędowy (art. 4 pr. aut.)', 'licencja: akt = dokument urzędowy');
  t.eq(licenseProblems([{ tags: ['komentarz'], license: '' }, { tags: ['komentarz'], license: 'własne opracowanie' }, { tags: ['akt prawny'], license: '' }]).length, 1, 'licencja: komentarz bez wolnej licencji zgłoszony');
}
