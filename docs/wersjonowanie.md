# Wersjonowanie

Wszystkie wersje są w `js/version.js`. Historia zmian jest w [CHANGELOG.md](../CHANGELOG.md).

| Wersja | Kiedy podbijać |
|---|---|
| `app` (semver) | przy każdej zmianie wypychanej na `main`: poprawka → `0.1.x`, nowa funkcja → `0.x.0`, zmiana niezgodna z danymi lub modelami → `x.0.0` |
| `engine` (semver) | zmiana budowy sieci lub kolejności tensorów → wersja główna (stare modele przestają się wczytywać); zmiana nauki bez wpływu na plik → wersja pomocnicza; poprawka → ostatnia cyfra |
| `cleaner` (semver) | każda zmiana reguł formatowania, która zmienia wynik (panel oznacza dokumenty sformatowane starszą wersją) |
| `modelFormat` (liczba) | zmiana zawartości pliku modelu; odczyt starszych formatów trzeba zachować |
| `db` (liczba) | nowy magazyn lub indeks w IndexedDB (migracja w `core/db.js`, `onupgradeneeded`) |

Biblioteki w `vendor/` mają swoje wersje, opisane w `vendor/README.md`. Aktualizacja biblioteki to zmiana programu (`app`) z wpisem w CHANGELOG.

Zasady:
- Każda zmiana wypychana na `main` ma wpis w `CHANGELOG.md` pod nową wersją `app`.
- Wersja `app` jest widoczna obok nazwy w lewym górnym rogu panelu.
- Każdy model zapisuje wersje `app`, `engine` i `cleaner`, z którymi powstał.
