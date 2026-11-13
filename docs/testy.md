# Testy

## W Node (bez przeglądarki)

```
node tests/run.js
```

Wymaga Node 18+. Uruchamia wszystkie pliki `tests/*.test.js`:

| Plik | Co sprawdza |
|---|---|
| `cleaner.test.js` | reguły formatowania na typowym tekście z PDF (stopki, numery stron, przeniesienia, łączenie linii z zachowaniem struktury, zapis „art.”/„§”, cudzysłowy, ligatury, twarde spacje), ostrzeżenie o kodowaniu, formatowanie kwestii, odczyt rozmów wzorcowych z błędami |
| `engine.test.js` | silnik w izolowanym kontekście (jak wątek): nauka, zgodność szybkiego generowania (pamięć KV) z pełnym przejściem sieci, dostrajanie z maskowaniem, odpowiedź po dostrojeniu, błąd dla znacznika ze znakiem spoza słownika |
| `github.test.js` | publikacja na atrapie GitHub API: tylko zaznaczone pliki w commicie, nazwa pliku z wersją, ustawienia i wersje w pliku modelu, `index.json`, token nie trafia do plików |
| `help.test.js` | każda ikona [?] w kodzie i każde pole ustawień ma dział w Pomocy, przykłady reguł pokazują zmianę, odnośniki w Pomocy prowadzą do istniejących działów |
| `reader.test.js` | Word (.docx), OpenDocument (.odt), RTF (strona kodowa 1250, Unicode), rozpakowywanie ZIP |

## W przeglądarce (Playwright)

```
npm i -D playwright              # raz
node tests/e2e/panel.e2e.mjs     # cały panel
node tests/e2e/ocr.e2e.mjs       # PDF i OCR
```

Skrypty same uruchamiają serwer z plikami repo. Zmienne środowiskowe:
- `CHROME` – ścieżka do Chrome, jeśli Playwright nie ma własnej przeglądarki,
- `PLAYWRIGHT` – ścieżka do modułu Playwright, jeśli nie jest zainstalowany w repo.

Zrzuty ekranu trafiają do `tests/e2e/out/`, który git pomija.

| Plik | Co sprawdza |
|---|---|
| `panel.e2e.mjs` | wgranie pliku w Windows-1250 → statystyki → formatowanie → zatwierdzenie → [?] do Pomocy → nauka → wczytanie rozmów wzorcowych (z błędną) → dostrajanie → czat → ocena → rozmowa do zestawu → podgląd budowy → okno publikacji (wersja w nazwie, ostrzeżenie) → „Wczytaj z GitHub” na podstawionych plikach → dymki [?] na ekranie → motyw noc; brak błędów w konsoli |
| `ocr.e2e.mjs` | OCR strony prostej, do góry nogami, bokiem (90° i 270°), przekrzywionej o 4° (zmierzony kąt); PDF z warstwą tekstową (bez OCR) i PDF-skan do góry nogami (OCR + obrót) |

Przed wypchnięciem na `main` musi przechodzić `node tests/run.js`. Testy w przeglądarce uruchamia się po zmianach w panelu, odczycie plików albo silniku.
