// Wersje: jedno miejsce prawdy. Zasady podbijania w docs/wersjonowanie.md, historia w CHANGELOG.md.
//
// app         — cały program (panel + czat); widoczna obok nazwy w lewym górnym rogu.
// engine      — silnik sieci (js/engine). Zmiana budowy sieci = nowa wersja główna, stare modele się nie wczytają.
// cleaner     — reguły formatowania danych (js/cleaner). Zapisywana przy każdym dokumencie i rozmowie wzorcowej.
// modelFormat — format pliku modelu (eksport, GitHub). Podbijany, gdy zmienia się zawartość pliku.
// db          — schemat bazy w przeglądarce (IndexedDB). Podbijany przy nowych magazynach lub indeksach.

export const VERSIONS = {
  app: '0.15.1',
  engine: '1.0.0',
  cleaner: '1.1.0',
  modelFormat: 1,
  db: 3,
};

export const APP_NAME = 'AI';
