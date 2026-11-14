// Pakiety tematyczne: gotowe zestawy do jednej dziedziny – źródła do Researchu, lista aktów (ELI) i haseł Wikipedii (tekst ogólny).
// Nowy pakiet = nowy obiekt w PACKS (nic więcej nie trzeba zmieniać w panelu).
//
// pakiet: { id, name, description,
//   sources: [ jak w CATALOG (js/core/sources.js) ],
//   acts:    [ { eli, expect, note } ]   ← expect: słowo, które musi być w tytule aktu (inaczej akt jest pomijany)
//   wiki:    [ tytuł artykułu w polskiej Wikipedii ] }
// Numery tekstów jednolitych sprawdzone w listopadzie 2026 r. Nowy tekst jednolity to nowa pozycja w Dzienniku Ustaw –
// wychwyci ją źródło ELI z pakietu (filtr tytułów), a numer w pakiecie warto wtedy podmienić.

import { ELI_API } from './sources.js';

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
      { eli: 'DU/2026/1245', expect: 'Kodeks pracy', note: 'Kodeks pracy – tekst jednolity (2026)' },
      { eli: 'DU/1997/14', expect: 'urlop', note: 'rozporządzenie urlopowe' },
      { eli: 'DU/2026/474', expect: 'dokumentacji pracowniczej', note: 'dokumentacja pracownicza – tekst jednolity' },
      { eli: 'DU/2024/1016', expect: 'świadectwa pracy', note: 'świadectwo pracy – tekst jednolity' },
      { eli: 'DU/2026/1195', expect: 'niedotyczących pracowników', note: 'zwolnienia grupowe – tekst jednolity (2026)' },
      { eli: 'DU/2024/1773', expect: 'minimalnym wynagrodzeniu', note: 'minimalne wynagrodzenie – tekst jednolity' },
      { eli: 'DU/2025/1242', expect: 'minimalnego wynagrodzenia', note: 'płaca minimalna i stawka godzinowa na 2026 r.' },
      { eli: 'DU/2026/854', expect: 'choroby i macierzyństwa', note: 'ustawa zasiłkowa – tekst jednolity (2026)' },
      { eli: 'DU/2024/288', expect: 'funduszu świadczeń socjalnych', note: 'ZFŚS – tekst jednolity' },
      { eli: 'DU/2026/549', expect: 'związkach zawodowych', note: 'związki zawodowe – tekst jednolity (2026)' },
      { eli: 'DU/2025/1661', expect: 'układach zbiorowych', note: 'układy zbiorowe pracy i porozumienia zbiorowe' },
      { eli: 'DU/2024/1712', expect: 'Inspekcji Pracy', note: 'Państwowa Inspekcja Pracy – tekst jednolity' },
    ],
    wiki: ['Prawo pracy', 'Kodeks pracy', 'Stosunek pracy', 'Umowa o pracę', 'Wypowiedzenie umowy o pracę', 'Okres wypowiedzenia',
      'Urlop wypoczynkowy', 'Urlop macierzyński', 'Urlop rodzicielski', 'Urlop wychowawczy', 'Urlop na żądanie', 'Czas pracy',
      'Praca w godzinach nadliczbowych', 'Płaca minimalna', 'Mobbing', 'Dyskryminacja w zatrudnieniu', 'Państwowa Inspekcja Pracy',
      'Związek zawodowy', 'Układ zbiorowy pracy', 'Zwolnienie grupowe', 'Świadectwo pracy', 'Bezpieczeństwo i higiena pracy',
      'Wypadek przy pracy', 'Zasiłek chorobowy', 'Zakładowy fundusz świadczeń socjalnych', 'Umowa zlecenia', 'Umowa o dzieło',
      'Telepraca', 'Praca zdalna', 'Strajk', 'Zakaz konkurencji', 'Sąd pracy'],
  },
];

export const packById = id => PACKS.find(p => p.id === id);
