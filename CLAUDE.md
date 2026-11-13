# Zasady pracy w tym repo

- Projekt: AI do rozmów na tematy prawne, uczone w przeglądarce. Strona statyczna na GitHub Pages (workflow `.github/workflows/static.yml` publikuje całe repo z `main`).
- Interfejs i dokumentacja po polsku.
- Panel administracyjny bez logowania.
- Docelowo AI ma być zintegrowane z projektem Lexsalus/PiK. W tym repo jest tylko AI, bez serwisu PiK.
- Struktura: `js/engine` (silnik, wątek), `js/cleaner` (formatowanie), `js/core` (logika bez UI), `js/ui`, `js/panels`, `js/chat`, `css`, `docs`, `tests`. Opis w `docs/architektura.md`.
- **Wersjonowanie:** każda zmiana na `main` podbija wersję w `js/version.js` i dostaje wpis w `CHANGELOG.md`. Zasady w `docs/wersjonowanie.md`. Zmiana reguł formatowania podbija `cleaner`, zmiana budowy sieci podbija wersję główną `engine`.
- **Dokumentacja:** zmiana zachowania aktualizuje odpowiedni plik w `docs/` i README.
- **Testy:** `node tests/run.js` musi przechodzić przed wypchnięciem.
- Nowe ustawienie dodaje się w `SCHEMA` w `js/core/settings.js`; panel ustawień i formularze budują się z niego same.
- Nie dodawać funkcji spoza prośby właściciela. Pomysły tylko proponować.
- Token GitHub nigdy nie trafia do repo ani do plików modeli (tylko `localStorage`).
