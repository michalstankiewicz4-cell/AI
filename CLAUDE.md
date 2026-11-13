# Zasady pracy w tym repo

- Projekt: AI do rozmów na tematy prawne, uczone w przeglądarce. Strona statyczna na GitHub Pages (workflow `.github/workflows/static.yml` publikuje całe repo z `main`).
- Interfejs i dokumentacja po polsku.
- Panel administracyjny bez logowania.
- Docelowo AI ma być zintegrowane z projektem Lexsalus/PiK. W tym repo jest tylko AI, bez serwisu PiK.
- Struktura: `js/engine` (silnik, wątek), `js/reader` (odczyt plików, OCR), `js/cleaner` (formatowanie), `js/core` (logika bez UI), `js/ui` (+ `ui/modals`), `js/panels`, `js/chat`, `js/help`, `css` (+ `css/panels`), `vendor` (biblioteki zewnętrzne), `docs`, `tests` (+ `tests/e2e`). Opis każdego pliku w `docs/architektura.md`; nowy plik = wpis tam.
- Biblioteki zewnętrzne tylko w `vendor/` z licencją i wpisem w `vendor/README.md` (bez CDN).
- **Wersjonowanie:** każda zmiana na `main` podbija wersję w `js/version.js` i dostaje wpis w `CHANGELOG.md`. Zasady w `docs/wersjonowanie.md`. Zmiana reguł formatowania podbija `cleaner`, zmiana budowy sieci podbija wersję główną `engine`.
- **Dokumentacja:** zmiana zachowania aktualizuje odpowiedni plik w `docs/` i README.
- **Testy:** `node tests/run.js` musi przechodzić przed wypchnięciem; po zmianach w panelu, odczycie plików albo silniku także `tests/e2e/*.e2e.mjs` (opis w `docs/testy.md`).
- Nowe ustawienie dodaje się w `SCHEMA` w `js/core/settings.js` i pokazuje w zakładce, której dotyczy (`fieldsForm`); w „Ustawieniach” są tylko ustawienia ogólne.
- Każda nowa ikona [?] dostaje temat (`help(tekst, temat)`) z działem w `js/help/content.js`; nowa funkcja = opis w Pomocy.
- Nowy przycisk = podpowiedź w `js/ui/tips.js`.
- Nie dodawać funkcji spoza prośby właściciela. Pomysły tylko proponować.
- Token GitHub nigdy nie trafia do repo ani do plików modeli (tylko `localStorage`).
