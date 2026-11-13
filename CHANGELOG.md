# Historia zmian

Format: wersja programu (`app`), data, zmiany. Wersje składowe w nawiasie, gdy się zmieniły. Zasady w [docs/wersjonowanie.md](docs/wersjonowanie.md).

## 0.5.0 – 2026-11-13

- **Nowe formaty dokumentów:** Word (.docx), OpenDocument (.odt), RTF, PDF i obrazy (.png, .jpg, .webp, .bmp, .gif). Stary .doc dostaje komunikat o zapisie jako .docx albo PDF.
- **OCR** (Tesseract.js, model polski, w `vendor/`) dla skanów i zdjęć oraz stron PDF bez warstwy tekstowej. Program rozpoznaje położenie strony: do góry nogami, bokiem (90°/270°) i pod kątem (mierzy kąt i prostuje). W raporcie jest linia „Odczyt”, przy mało pewnych stronach ostrzeżenie, a przy wgrywaniu pasek postępu strona po stronie.
- **Statystyki formatowania** po wgraniu, wklejeniu i każdym formatowaniu: suma zmian, znaki przed i po, akapity, wykres zmian według reguł, usunięte znaki, a przy ponownym formatowaniu informacja, czy wynik się zmienił. Przycisk „Statystyki” przy dokumencie.
- **Wczytaj z GitHub** (Modele i Ustawienia → GitHub): modele oraz dane (ustawienia, dokumenty, rozmowy wzorcowe, historia rozmów), z wyborem: pomiń albo zastąp istniejące. Publikacja wysyła teraz pełne rekordy (dokumenty z oryginałem, rozmowy wzorcowe także jako `.json`).
- **Pomoc:** schemat przykładowego modelu z warstwami, połączeniami i ponumerowanymi objaśnieniami; dział „PDF, skany i OCR”.
- **Porządek w strukturze:** `core/corpus.js` podzielony na `core/documents.js` i `core/dialogs.js`; odczyt plików w nowym folderze `js/reader/`; edytor rozmowy i okna (publikacja, wczytywanie, statystyki) w `js/ui/`; `css/admin.css` podzielony na `layout.css` i `css/panels/*`; nowy `core/sync.js`.
- **Testy:** odczyt docx/odt/rtf/zip w Node; testy w przeglądarce w repo (`tests/e2e/panel.e2e.mjs`, `tests/e2e/ocr.e2e.mjs`).
- **Dokumentacja:** nowe `docs/README.md`, `docs/panel.md`, `docs/testy.md`, `vendor/README.md`; uzupełnione README, architektura, dane, modele, wersjonowanie, CLAUDE.md.

## 0.4.0 – 2026-11-13

- **Publikacja na GitHub z wyborem zawartości** (checkboxy, jeden commit): model, oznaczenie jako aktualny, ustawienia i wersje (`data/ustawienia.json`), dokumenty zatwierdzone (`data/dokumenty.json`), rozmowy wzorcowe (`data/rozmowy-wzorcowe.txt`), historia rozmów (`data/historia-rozmow.json`). Ostrzeżenie, że repo jest publiczne, przy danych.
- Plik modelu zawiera ustawienia i wersje z chwili publikacji (`published`), a jego nazwa zawiera wersję programu, w której model powstał: `models/<nazwa>-v<wersja>-<id>.json` (tak samo przy pobieraniu pliku).
- **Przełącznik dzień/noc** w górnym pasku, zapamiętany w przeglądarce; domyślnie motyw systemu.
- Test publikacji na atrapie GitHub API.

## 0.3.0 – 2026-11-13

- **Konwerter dokumentów na dane do nauki.** Zakładka „Dokumenty” to biblioteka: każdy plik trafia do bazy z ikonką rodzaju (TXT, HTML, MD, wklejony tekst), nazwą, datą i polem opisu. Wgranie od razu formatuje dokument.
- **Nowa zakładka „Formatowanie”** (między Dokumenty a Nauka): sformatowane dokumenty do podglądu przed/po, raport zmian i ostrzeżenia, statusy *do sprawdzenia / zatwierdzony / odrzucony*, zatwierdzanie hurtowe, ponowne formatowanie wszystkich aktualnymi regułami. Do nauki trafiają tylko zatwierdzone. Dokumenty z wersji 0.1–0.2 są traktowane jako zatwierdzone.
- **Pomoc** w menu: działy z rozszerzonym opisem, przykładami „przed → po” (dla reguł formatowania liczonymi na żywo przez prawdziwą regułę) i tabelami porównań, w tym „Krok po kroku” i „Rozmowa wzorcowa a dostrajanie”. Kliknięcie [?] przenosi do odpowiedniego działu; najechanie pokazuje krótki opis.
- **Ustawienia tam, gdzie działają:** formatowanie w „Formatowaniu”, długość odpowiedzi wzorcowych w „Rozmowach wzorcowych”, rozmowa pod ⚙ w oknie czatu, nauka i dostrajanie w swoich zakładkach. W „Ustawieniach” zostały: nazwa, znaczniki, GitHub, dane, wersje.
- **Kolory etapów** w menu i na kafelkach pulpitu: etap 1 (dokumenty, formatowanie, nauka) i etap 2 (rozmowy wzorcowe, dostrajanie).
- Test: każda ikona [?] prowadzi do istniejącego działu Pomocy, przykłady reguł pokazują zmianę.

## 0.2.2 – 2026-11-13

- Dymki [?] dopasowują się do tekstu i zawsze mieszczą się na ekranie: nie przycinają ich ramki kart, tabel ani okien, przy krawędzi przesuwają się w bok, a gdy brak miejsca pod ikoną, pokazują się nad nią.

## 0.2.1 – 2026-11-13

- Dymki z podpowiedzią przy przyciskach (słownik w `js/ui/tips.js`, dodawane automatycznie) i nowe ikony [?]: raport formatowania, dane do nauki i dostrajania, pulpit, metryki modeli, oceny w historii, czat.

## 0.2.0 – 2026-11-13

- Podgląd budowy modelu (Modele → „Podgląd budowy”): warstwy jako kolumny neuronów połączone liniami z prawdziwych wag (kolor = znak wagi, grubość = siła). Najechanie na neuron podświetla jego połączenia.
- Poprawiona odmiana liczebników na pulpicie i w zakładkach, przyciski nie łamią się na dwie linie.

## 0.1.0 – 2026-11-13

Pierwsza wersja (silnik 1.0.0, reguły 1.0.0, format modelu 1, baza 1).

- Panel administracyjny bez logowania: Pulpit, Dokumenty, Nauka, Rozmowy wzorcowe, Dostrajanie, Historia rozmów, Modele, Ustawienia.
- Czat w prawym dolnym rogu z oceną odpowiedzi (✓ ✎ ✗) i poprawkami. Rozmowy trafiają do Historii, skąd przenosi się je do rozmów wzorcowych.
- Silnik z GameLaboratory (Laboratorium języka): transformer na tokenach BPE albo literach, nauka na GPU (WebGPU) albo procesorze (WASM SIMD, JS).
  - dostrajanie z maskowaniem także na GPU,
  - dalsza nauka modelu bazowego i kolejne rundy dostrajania od modelu dostrojonego,
  - szybkie odpowiedzi z pamięcią KV (kilkadziesiąt ms na odpowiedź),
  - słownik obejmuje wszystkie znaki dopuszczane przez formatowanie oraz znaki znaczników rozmowy.
- Formatowanie danych: 12 reguł (zapis liter, znaki niewidoczne, przeniesienia, numery stron i stopki, łączenie linii z zachowaniem struktury przepisów, cudzysłowy, myślniki, interpunkcja, oznaczenia prawne, dozwolone znaki, spacje, powtórzenia), raport z ostrzeżeniami, rozpoznawanie kodowania polskich plików, odczyt HTML i Markdown, sprawdzanie formatu rozmów wzorcowych.
- Modele: wersje z metrykami, aktywny model czatu, eksport/import pliku, publikacja na GitHub (`models/` + `models/index.json`) i wczytywanie opublikowanych.
- Dokumentacja (`docs/`), testy (`tests/`).
