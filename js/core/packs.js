// Pakiety tematyczne: gotowe zestawy do jednej dziedziny – źródła do Researchu, lista aktów (ELI) i haseł Wikipedii (tekst ogólny).
// Nowy pakiet = nowy obiekt w PACKS (nic więcej nie trzeba zmieniać w panelu).
//
// pakiet: { id, name, description,
//   sources: [ jak w CATALOG (js/core/sources.js) ],
//   acts:    [ { eli, expect, note } ]   ← expect: słowo, które musi być w tytule aktu (inaczej akt jest pomijany)
//   wiki:    [ tytuł artykułu w polskiej Wikipedii ],
//   questions: [ typowe pytanie zadane potocznie ] }   ← szkielety rozmów wzorcowych (odpowiedź dopisuje człowiek)
// act.tj: fragment tytułu obwieszczenia o tekście jednolitym tego aktu (do szukania nowszej wersji); '-' = nie szukaj
// Numery tekstów jednolitych sprawdzone w listopadzie 2026 r. Nowy tekst jednolity to nowa pozycja w Dzienniku Ustaw –
// wychwyci ją źródło ELI z pakietu (filtr tytułów), a numer w pakiecie warto wtedy podmienić.

import { ELI_API } from './sources.js';
import { db } from './db.js';
import { log } from './log.js';

export const PACKS = [
  {
    id: 'prawo-pracy', name: 'Prawo pracy',
    description: 'Kodeks pracy z aktami wykonawczymi i najważniejszymi ustawami obok niego, nowe akty z Dziennika Ustaw, orzeczenia powołujące Kodeks pracy (SAOS) i hasła Wikipedii jako tekst ogólny.',
    sources: [
      { name: 'Prawo pracy – nowe akty (Dziennik Ustaw, ELI)', kind: 'eli', url: ELI_API, eli: { publisher: 'DU', years: '2025, 2026', filter: 'Kodeks pracy, pracownik, pracowni, urlop, wynagrodzeni, zatrudnieni, związk, układach zbiorowych, Inspekcji Pracy' }, description: 'Nowe i zmienione akty z zakresu prawa pracy, w tym nowe teksty jednolite.' },
      { name: 'Prawo pracy – orzeczenia powołujące Kodeks pracy (SAOS, API)', kind: 'api', url: 'https://www.saos.org.pl/api/search/judgments?pageSize=20&lawJournalEntryCode=1974/141&sortingField=JUDGMENT_DATE&sortingDirection=DESC', description: 'Najnowsze orzeczenia sądów, które powołują Kodeks pracy (Dz.U. 1974 nr 24 poz. 141).' },
      { name: 'ZUS – interpretacje (BIP)', kind: 'www', url: 'https://www.zus.pl/en/web/biuletyn-informacji-publicznej/inne/interpretacje', description: 'Pisemne interpretacje przepisów z zakresu ubezpieczeń społecznych; strona z wyszukiwarką – linki do dokumentów mogą pojawiać się dopiero po wyszukaniu.' },
    ],
    acts: [
      { eli: 'DU/2026/1245', expect: 'Kodeks pracy', tj: 'tekstu ustawy – Kodeks pracy', note: 'Kodeks pracy – tekst jednolity (2026)' },
      { eli: 'DU/1997/14', expect: 'urlop', tj: 'zasad udzielania urlopu wypoczynkowego', note: 'rozporządzenie urlopowe' },
      { eli: 'DU/2026/474', expect: 'dokumentacji pracowniczej', tj: 'w sprawie dokumentacji pracowniczej', note: 'dokumentacja pracownicza – tekst jednolity' },
      { eli: 'DU/2024/1016', expect: 'świadectwa pracy', tj: 'w sprawie świadectwa pracy', note: 'świadectwo pracy – tekst jednolity' },
      { eli: 'DU/2026/1195', expect: 'niedotyczących pracowników', tj: 'z przyczyn niedotyczących pracowników', note: 'zwolnienia grupowe – tekst jednolity (2026)' },
      { eli: 'DU/2024/1773', expect: 'minimalnym wynagrodzeniu', tj: 'o minimalnym wynagrodzeniu za pracę', note: 'minimalne wynagrodzenie – tekst jednolity' },
      { eli: 'DU/2025/1242', expect: 'minimalnego wynagrodzenia', tj: '-', note: 'płaca minimalna i stawka godzinowa na 2026 r.' },
      { eli: 'DU/2026/854', expect: 'choroby i macierzyństwa', tj: 'w razie choroby i macierzyństwa', note: 'ustawa zasiłkowa – tekst jednolity (2026)' },
      { eli: 'DU/2024/288', expect: 'funduszu świadczeń socjalnych', tj: 'o zakładowym funduszu świadczeń socjalnych', note: 'ZFŚS – tekst jednolity' },
      { eli: 'DU/2026/549', expect: 'związkach zawodowych', tj: 'o związkach zawodowych', note: 'związki zawodowe – tekst jednolity (2026)' },
      { eli: 'DU/2025/1661', expect: 'układach zbiorowych', tj: 'o układach zbiorowych pracy', note: 'układy zbiorowe pracy i porozumienia zbiorowe' },
      { eli: 'DU/2024/1712', expect: 'Inspekcji Pracy', tj: 'o Państwowej Inspekcji Pracy', note: 'Państwowa Inspekcja Pracy – tekst jednolity' },
    ],
    wiki: ['Prawo pracy', 'Kodeks pracy', 'Stosunek pracy', 'Umowa o pracę', 'Wypowiedzenie umowy o pracę', 'Okres wypowiedzenia',
      'Urlop wypoczynkowy', 'Urlop macierzyński', 'Urlop rodzicielski', 'Urlop wychowawczy', 'Urlop na żądanie', 'Czas pracy',
      'Praca w godzinach nadliczbowych', 'Płaca minimalna', 'Mobbing', 'Dyskryminacja w zatrudnieniu', 'Państwowa Inspekcja Pracy',
      'Związek zawodowy', 'Układ zbiorowy pracy', 'Zwolnienie grupowe', 'Świadectwo pracy', 'Bezpieczeństwo i higiena pracy',
      'Wypadek przy pracy', 'Zasiłek chorobowy', 'Zakładowy fundusz świadczeń socjalnych', 'Umowa zlecenia', 'Umowa o dzieło',
      'Telepraca', 'Praca zdalna', 'Strajk', 'Zakaz konkurencji', 'Sąd pracy'],
    questions: ['Ile dni urlopu mi przysługuje?', 'Czy szef może mi nie dać urlopu w terminie, który chcę?', 'Co to jest urlop na żądanie i ile mam takich dni?',
      'Jaki mam okres wypowiedzenia?', 'Czy pracodawca może mnie zwolnić na zwolnieniu lekarskim (L4)?', 'Czy należy mi się odprawa, jak mnie zwalniają?',
      'Ile wynosi płaca minimalna?', 'Czy szef musi płacić za nadgodziny?', 'Ile godzin mogę pracować w tygodniu?', 'Co zrobić, gdy pracodawca nie wypłaca pensji?',
      'Kiedy pracodawca musi wydać świadectwo pracy?', 'Czym się różni umowa o pracę od umowy zlecenia?', 'Ile razy można zawrzeć umowę na czas określony?',
      'Co zrobić, gdy w pracy jest mobbing?', 'Gdzie zgłosić pracodawcę, który łamie prawo pracy?', 'Ile wynosi zasiłek chorobowy?',
      'Czy mogę pracować zdalnie i kto płaci za prąd i internet?', 'Czy w ciąży można mnie zwolnić?', 'Ile trwa urlop macierzyński i rodzicielski?', 'Jak odwołać się od wypowiedzenia do sądu pracy?'],
  },
  {
    id: 'prawo-bankowe', name: 'Prawo bankowe i kredyty',
    description: 'Prawo cywilne i bankowe w sprawach kredytowych: umowy kredytu i pożyczki, kredyty walutowe (CHF), klauzule niedozwolone, sankcja kredytu darmowego, zwrot prowizji. Ustawy (Dziennik Ustaw), akty z Monitora Polskiego, rekomendacje KNF i orzeczenia z SAOS.',
    sources: [
      { name: 'Prawo bankowe i kredyty – nowe akty (Dziennik Ustaw, ELI)', kind: 'eli', url: ELI_API, eli: { publisher: 'DU', years: '2025, 2026', filter: 'Prawo bankowe, bankow, kredyt, Kodeks cywilny, konsument, rynku finansowego, Rzeczniku Finansowym, frankow, walutow' }, description: 'Nowe i zmienione akty: prawo bankowe, kredyty, Kodeks cywilny, ochrona konsumenta, rynek finansowy.', tags: ['Dziennik Ustaw'] },
      { name: 'Prawo bankowe i kredyty – Monitor Polski (ELI)', kind: 'eli', url: ELI_API, eli: { publisher: 'MP', years: '2025, 2026', filter: 'Narodowego Banku Polskiego, stóp procentowych, Komisji Nadzoru Finansowego, finansow, kredyt' }, description: 'Uchwały i obwieszczenia NBP, RPP i KNF ogłaszane w Monitorze Polskim.', tags: ['Monitor Polski'] },
      { name: 'KNF – rekomendacje dla banków', kind: 'www', url: 'https://www.knf.gov.pl/dla_rynku/regulacje_i_praktyka/rekomendacje_i_wytyczne/rekomendacje_dla_bankow', description: 'Rekomendacje KNF (m.in. S – ekspozycje kredytowe zabezpieczone hipotecznie, T – detaliczne ekspozycje kredytowe).', tags: ['KNF', 'rekomendacja'] },
      { name: 'KNF – Dziennik Urzędowy KNF', kind: 'www', url: 'https://dziennikurzedowy.knf.gov.pl/', description: 'Oficjalne teksty aktów KNF (rekomendacje, wytyczne, uchwały).', tags: ['KNF'] },
      { name: 'SAOS – orzeczenia: kredyty frankowe (CHF)', kind: 'api', url: 'https://www.saos.org.pl/api/search/judgments?pageSize=20&all=frank%20szwajcarski%20klauzule%20abuzywne&sortingField=JUDGMENT_DATE&sortingDirection=DESC', description: 'Najnowsze orzeczenia o kredytach indeksowanych i denominowanych do CHF (wyszukiwanie pełnotekstowe).', tags: ['orzeczenie', 'kredyty walutowe (CHF)'] },
      { name: 'SAOS – orzeczenia: sankcja kredytu darmowego', kind: 'api', url: 'https://www.saos.org.pl/api/search/judgments?pageSize=20&all=sankcja%20kredytu%20darmowego&sortingField=JUDGMENT_DATE&sortingDirection=DESC', description: 'Orzeczenia o sankcji kredytu darmowego (art. 45 ustawy o kredycie konsumenckim).', tags: ['orzeczenie', 'sankcja kredytu darmowego'] },
      { name: 'SAOS – orzeczenia: zwrot prowizji przy wcześniejszej spłacie', kind: 'api', url: 'https://www.saos.org.pl/api/search/judgments?pageSize=20&all=wcze%C5%9Bniejsza%20sp%C5%82ata%20kredytu%20zwrot%20prowizji&sortingField=JUDGMENT_DATE&sortingDirection=DESC', description: 'Orzeczenia o zwrocie prowizji i kosztów kredytu przy wcześniejszej spłacie (m.in. po wyroku TSUE w sprawie Lexitor).', tags: ['orzeczenie', 'zwrot prowizji'] },
      { name: 'SAOS – orzeczenia: umowa kredytu, Prawo bankowe', kind: 'api', url: 'https://www.saos.org.pl/api/search/judgments?pageSize=20&all=umowa%20kredytu%20prawo%20bankowe&sortingField=JUDGMENT_DATE&sortingDirection=DESC', description: 'Orzeczenia dotyczące umów kredytu (art. 69 Prawa bankowego).', tags: ['orzeczenie'] },
    ],
    acts: [
      { eli: 'DU/2026/795', expect: 'Kodeks cywilny', tj: 'tekstu ustawy – Kodeks cywilny', note: 'Kodeks cywilny – tekst jednolity (2026)' },
      { eli: 'DU/2026/38', expect: 'Prawo bankowe', tj: 'tekstu ustawy – Prawo bankowe', note: 'Prawo bankowe – tekst jednolity (2026)' },
      { eli: 'DU/2025/1362', expect: 'kredycie konsumenckim', tj: 'o kredycie konsumenckim', note: 'ustawa o kredycie konsumenckim – tekst jednolity' },
      { eli: 'DU/2025/720', expect: 'kredycie hipotecznym', tj: 'o kredycie hipotecznym', note: 'ustawa o kredycie hipotecznym – tekst jednolity' },
      { eli: 'DU/2026/468', expect: 'postępowania cywilnego', tj: 'tekstu ustawy – Kodeks postępowania cywilnego', note: 'Kodeks postępowania cywilnego – tekst jednolity (2026)' },
      { eli: 'DU/2026/823', expect: 'Rzeczniku Finansowym', tj: 'o Rzeczniku Finansowym', note: 'reklamacje i Rzecznik Finansowy – tekst jednolity (2026)' },
      { eli: 'DU/2025/146', expect: 'obsługujących kredyty', tj: 'o podmiotach obsługujących kredyty', note: 'podmioty obsługujące kredyty i nabywcy kredytów' },
    ],
    wiki: ['Prawo bankowe', 'Bank', 'Kredyt', 'Kredyt konsumencki', 'Kredyt hipoteczny', 'Umowa kredytu', 'Umowa pożyczki', 'Kredyt indeksowany',
      'Kredyty frankowe', 'Spread walutowy', 'Frank szwajcarski', 'Klauzula abuzywna', 'Niedozwolone postanowienia umowne', 'Sankcja kredytu darmowego',
      'Rzeczywista roczna stopa oprocentowania', 'WIBOR', 'WIRON', 'Odsetki', 'Bezpodstawne wzbogacenie', 'Nienależne świadczenie', 'Przedawnienie',
      'Konsument', 'Kodeks cywilny', 'Komisja Nadzoru Finansowego', 'Rzecznik Finansowy', 'Urząd Ochrony Konkurencji i Konsumentów',
      'Trybunał Sprawiedliwości Unii Europejskiej', 'Hipoteka', 'Weksel', 'Upadłość konsumencka'],
    questions: ['Czy mój kredyt we frankach można unieważnić?', 'Co to jest sankcja kredytu darmowego i kiedy mi przysługuje?', 'Czy bank musi oddać prowizję, jak wcześniej spłaciłem kredyt?',
      'Ile mam czasu, żeby pozwać bank? Kiedy roszczenie się przedawnia?', 'Co to jest klauzula abuzywna w umowie kredytu?', 'Co mi się należy, jeśli sąd unieważni umowę kredytu?',
      'Czy bank może żądać ode mnie wynagrodzenia za korzystanie z kapitału?', 'Jak złożyć reklamację do banku i ile bank ma czasu na odpowiedź?', 'Kiedy mogę zwrócić się do Rzecznika Finansowego?',
      'Czy mogę odstąpić od umowy kredytu konsumenckiego?', 'Czym się różni kredyt indeksowany od denominowanego?', 'Co to jest WIBOR i czy można podważyć kredyt z WIBOR-em?',
      'Czy bank może podnieść oprocentowanie kredytu w trakcie umowy?', 'Co zrobić, gdy bank wypowiedział mi umowę kredytu?', 'Czy mogę zawiesić spłatę kredytu na czas procesu z bankiem?',
      'Jakie dokumenty są potrzebne do pozwu przeciwko bankowi?', 'Ile kosztuje sprawa sądowa przeciwko bankowi?', 'Czy umowa pożyczki z firmą pozabankową może zawierać takie wysokie koszty?'],
  },
];

// ---------- pakiety użytkownika ----------
// Zapisane w bazie (kv „userPacks”). Pakiet o tym samym id co wbudowany zastępuje go (edycja wbudowanego);
// usunięcie takiej kopii przywraca wersję wbudowaną.
export const BUILTIN_IDS = new Set(PACKS.map(p => p.id));
const clone = o => JSON.parse(JSON.stringify(o));
export async function userPacks() { return (await db.kvGet('userPacks')) || []; }
export async function listPacks() {
  const own = await userPacks(), byId = new Map(own.map(p => [p.id, p]));
  return [...PACKS.map(p => byId.has(p.id) ? { ...byId.get(p.id), builtin: true, edited: true } : { ...clone(p), builtin: true }),
    ...own.filter(p => !BUILTIN_IDS.has(p.id))];
}
export const packById = async id => (await listPacks()).find(p => p.id === id);
export function normPack(p) {
  const s = v => String(v || '').trim();
  return { id: s(p.id) || 'pakiet-' + Date.now().toString(36), name: s(p.name) || 'Pakiet bez nazwy', description: s(p.description),
    sources: (p.sources || []).filter(x => x && x.url).map(x => ({ name: s(x.name) || x.url, kind: x.kind || 'www', url: s(x.url), description: s(x.description), general: !!x.general, tags: x.tags || [], eli: x.eli || null })),
    acts: (p.acts || []).filter(a => a && /^[A-Z]+\/\d{4}\/\d+$/.test(s(a.eli))).map(a => ({ eli: s(a.eli), expect: s(a.expect), note: s(a.note), tj: s(a.tj) })),
    wiki: [...new Set((p.wiki || []).map(s).filter(Boolean))],
    questions: [...new Set((p.questions || []).map(s).filter(Boolean))] };
}
export async function savePack(p) {
  const own = (await userPacks()).filter(x => x.id !== p.id); const n = normPack(p);
  own.push(n); await db.kvSet('userPacks', own); log('info', 'pakiety', `Zapisano pakiet „${n.name}”`); return n;
}
export async function deletePack(id) {
  const own = await userPacks(); const p = own.find(x => x.id === id); if (!p) return;
  await db.kvSet('userPacks', own.filter(x => x.id !== id)); log('info', 'pakiety', BUILTIN_IDS.has(id) ? `Przywrócono wbudowany pakiet „${p.name}”` : `Usunięto pakiet „${p.name}”`);
}
// plik pakietu: { format: 'ai-prawo-pakiet', version: 1, pack }
export const packToFile = p => ({ format: 'ai-prawo-pakiet', version: 1, exportedAt: new Date().toISOString(), pack: normPack(p) });
export function packFromFile(o) {
  if (!o || o.format !== 'ai-prawo-pakiet' || !o.pack) throw new Error('To nie jest plik pakietu (format ai-prawo-pakiet).');
  return normPack(o.pack);
}
