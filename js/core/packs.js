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
