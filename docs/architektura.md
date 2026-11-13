# Architektura

## Warstwy

```
panels/ + chat/ + ui/  ──►  core/  ──►  engine/worker.js (wątek w tle)
        │                     │
        │                     ├──► reader/   (odczyt plików: tekst, Word/ODT/RTF, PDF, OCR)
        │                     ├──► cleaner/  (formatowanie: czyste funkcje)
        │                     └──► IndexedDB (core/db.js), GitHub (core/github.js)
        └──► help/ (treść Pomocy)
```

- Interfejs (`panels/`, `chat/`, `ui/`) korzysta z `core/` i nie rozmawia bezpośrednio z bazą ani z silnikiem.
- `core/` nie tworzy elementów strony, więc integracja z innym serwisem (np. PiK) może używać `core/`, `reader/`, `cleaner/` i `engine/` bez panelu.
- `engine/` to klasyczne skrypty ładowane w wątku przez `importScripts`. Nie znają panelu ani bazy: dostają polecenia i odpowiadają wiadomościami.
- `cleaner/` i większość `reader/` to czyste funkcje bez DOM, testowane w Node. Wyjątki korzystają z API przeglądarki: `reader/text.js` (HTML przez DOMParser), `reader/ocr.js` i `reader/pdf.js` (płótno, Tesseract, pdf.js).

## Moduły

### `js/`
| Plik | Rola |
|---|---|
| `main.js` | układ panelu, menu, adresy `#zakładka/argument`, przełącznik dzień/noc, odświeżanie po zmianie danych (`datachange`) |
| `version.js` | wersje: `app`, `engine`, `cleaner`, `modelFormat`, `db` |

### `js/core/` – logika bez interfejsu
| Plik | Rola |
|---|---|
| `db.js` | IndexedDB: `documents`, `dialogs`, `conversations`, `models`, `sources`, `logs`, `kv` |
| `settings.js` | `SCHEMA` (pola, opisy, wartości domyślne), zapis, opcje formatowania, znaczniki |
| `ai.js` | klient wątku silnika: zapytania, zadania nauki, wczytywanie modeli do wątku |
| `training.js` | stan nauki niezależny od zakładek; po zakończeniu zapisuje model |
| `models.js` | modele w bazie, aktywny model, plik modelu (eksport/import), bity na znak |
| `documents.js` | biblioteka dokumentów, formatowanie, statusy, tekst do nauki (mieszanie z tekstem ogólnym: `mixCorpus`), skrót treści (`textHash`), wyszukiwanie duplikatów (adres, ELI, treść) |
| `dialogs.js` | rozmowy wzorcowe |
| `conversations.js` | rozmowy z czatu, oceny, zamiana na rozmowę wzorcową |
| `github.js` | publikacja jednym commitem (Git Data API), nazwy plików, odczyt opublikowanych plików bez tokenu |
| `sync.js` | zbieranie danych do publikacji i przywracanie opublikowanych (dodaj brakujące / zastąp) |
| `log.js` | logi: `log(ważność, obszar, treść, szczegóły)`, poziomy `LEVELS` (błąd, ostrzeżenie, informacja, szczegóły), zapis w magazynie `logs` (najwyżej `MAX`), słuchacze na żywo, eksport do tekstu |
| `sources.js` | Research: źródła (www, API ELI, API JSON), katalog znanych źródeł (`CATALOG`), stenogramy Sejmu (`checkSteno`), Wikipedia (`checkWiki`, `downloadWiki`), sprawdzanie (`probe`: działa / kod HTTP / brak CORS), linki do dokumentów, akty z API, pobieranie do biblioteki, „czy już pobrany”, zmiany u źródła |

### `js/reader/` – odczyt plików
| Plik | Rola |
|---|---|
| `index.js` | wybór sposobu odczytu według rodzaju pliku, `ACCEPT`, opis odczytu OCR do raportu |
| `text.js` | .txt/.md/.html: rozpoznawanie kodowania (UTF-8, Windows-1250, ISO-8859-2), HTML → tekst, Markdown → tekst |
| `office.js` | Word (.docx), OpenDocument (.odt), RTF; .doc → komunikat o zapisie jako .docx |
| `zip.js` | minimalny odczyt ZIP (`DecompressionStream`) dla .docx/.odt |
| `pdf.js` | pdf.js: warstwa tekstowa, a strony bez tekstu renderowane i czytane przez OCR |
| `ocr.js` | Tesseract.js: wykrywanie położenia (kształt linii → bokiem; wybór obrotu po jakości odczytu), prostowanie przekrzywienia (`rotateAuto`) |

### `js/cleaner/` – formatowanie
| Plik | Rola |
|---|---|
| `rules.js` | reguły (id, nazwa, opis, zakres `doc`/`line`, funkcja) i lista dozwolonych znaków |
| `cleaner.js` | przebieg reguł, raport (zmiany, usunięte znaki, ostrzeżenia) |
| `dialogs.js` | format pliku rozmów wzorcowych: odczyt, sprawdzenie, zapis |

### `js/engine/` – silnik sieci (wątek)
| Plik | Rola |
|---|---|
| `worker.js` | polecenia: wczytanie modelu, nauka, dostrajanie, odpowiedź, karta graficzna |
| `engine.js` | tensory z autogradem, Adam (z GameLaboratory) |
| `wasm.js` | mnożenie macierzy w WASM SIMD (z GameLaboratory) |
| `gpu.js` | nauka transformera na WebGPU (z GameLaboratory + maskowanie) |
| `bpe.js` | tokenizer BPE (z GameLaboratory) |
| `infer.js` | szybkie generowanie z pamięcią KV |

### `js/panels/` – zakładki
Każda zakładka to obiekt `{ id, title, stage?, icon, render(root, rerender, arg) }`; `render` może zwrócić funkcję sprzątającą. `stage` koloruje zakładkę w menu i kafelek na pulpicie: 2 – fioletowy (Dokumenty, Formatowanie, Nauka), 3 – zielony (Rozmowy wzorcowe, Dostrajanie); 1 – niebieski jest zdefiniowany w CSS, obecnie nieużywany.

| Plik | Zakładka |
|---|---|
| `dashboard.js` | Pulpit: kafelki kroków 1–7 ze stanem, aktywny model, komputer |
| `research.js` | Research: „czy już pobrany”, źródła (www, ELI, API JSON, stenogramy, Wikipedia), katalog znanych źródeł, domeny z dokumentów, zmiany u źródła |
| `documents.js` | Dokumenty: biblioteka (ikonka, opis, adres źródła, tekst ogólny), wgrywanie i wklejanie |
| `formatting.js` | Formatowanie: podgląd przed/po, raport, zatwierdzanie, formatowanie ponowne, ustawienia formatowania |
| `pretrain.js` | Nauka: dane (z podziałem prawnicze/ogólne), rodzaj nauki, ustawienia, przebieg |
| `dialogs.js` | Rozmowy wzorcowe: edytor, wczytywanie i zapis pliku |
| `finetune.js` | Dostrajanie: model startowy, ustawienia, przebieg |
| `conversations.js` | Historia rozmów: oceny, poprawki, przeniesienie do rozmów wzorcowych |
| `models.js` | Modele: lista, aktywny, podgląd budowy, plik, publikacja i wczytywanie z GitHub |
| `settings.js` | Ustawienia ogólne, GitHub i token, dane w przeglądarce, wersje |
| `logs.js` | Logi: filtry ważności i obszaru, wyszukiwanie, szczegóły, pobieranie, czyszczenie |
| `help.js` | Pomoc: spis działów, dział `#pomoc/<temat>` |

### `js/chat/`, `js/ui/`, `js/help/`
| Plik | Rola |
|---|---|
| `chat/widget.js` | okno czatu, ustawienia rozmowy pod ⚙ |
| `ui/dom.js` | `h()` (tworzenie elementów; przyciski dostają dymki z `tips.js`), `help(tekst, temat)`, powiadomienia, okna, pliki, formaty liczb |
| `ui/form.js` | formularz z `SCHEMA` (pole + [?] z tematem `grupa.pole`) |
| `ui/tips.js` | dymki przycisków według napisu |
| `ui/chart.js` | wykres błędu |
| `ui/trainview.js` | widok przebiegu nauki i dostrajania |
| `ui/netview.js` | podgląd budowy modelu z prawdziwych wag |
| `ui/fileicon.js` | ikonka rodzaju pliku |
| `ui/dialog-editor.js` | edytor rozmowy wzorcowej (osadzany w zakładkach i oknach) |
| `ui/modals/publish.js` | okno publikacji na GitHub (checkboxy) |
| `ui/modals/github-import.js` | okno „Wczytaj z GitHub” (modele i dane) |
| `ui/modals/format-stats.js` | statystyki formatowania i porównanie „Czy to coś dało?” |
| `help/content.js` | działy Pomocy: `id`, `topics`, bloki treści (akapit, kroki, tabela, przykład, przykład reguły na żywo, schemat) |
| `help/diagram.js` | schemat przykładowego modelu z objaśnieniami |

### `css/`
| Plik | Rola |
|---|---|
| `base.css` | zmienne kolorów, motyw jasny i ciemny (`data-theme`), przyciski, pola, plakietki, dymki, okna, paski przewijania |
| `layout.css` | pasek, menu, karty, formularze, tabele, kolory etapów w menu i na kafelkach |
| `chat.css` | okno czatu |
| `panels/dashboard.css` | Pulpit |
| `panels/research.css` | Research |
| `panels/documents.css` | Dokumenty, Formatowanie, statystyki i porównania |
| `panels/training.css` | Nauka, Dostrajanie, przebieg nauki |
| `panels/dialogs.css` | Rozmowy wzorcowe, Historia rozmów |
| `panels/models.css` | Modele |
| `panels/logs.css` | Logi (kolory ważności) |
| `panels/help.css` | Pomoc |

### Pozostałe
| Plik / folder | Rola |
|---|---|
| `index.html` | jedyna strona: style, motyw ustawiany przed wczytaniem (bez mignięcia), `js/main.js` |
| `favicon.svg` | ikonka karty |
| `package.json` | moduły ES, skrót `npm test` |
| `docs/` | dokumentacja techniczna (spis w [README.md](README.md)) |
| `tests/` | testy Node (`*.test.js`, `run.js`) i w przeglądarce (`e2e/*.e2e.mjs`); opis w [testy.md](testy.md) |
| `models/`, `data/` | nie ma ich w kodzie – tworzy je publikacja na GitHub (pliki modeli, `index.json`, dane) |

### `vendor/`
Tesseract.js (OCR, model polski) i pdf.js, ładowane dopiero przy pierwszym PDF albo obrazie. Szczegóły w [vendor/README.md](../vendor/README.md).

## Silnik

Pochodzi z GameLaboratory `labs/lang`, skąd pliki `engine.js`, `wasm.js`, `gpu.js` i `bpe.js` zostały skopiowane. Zmiany:

| Plik | Zmiana |
|---|---|
| `gpu.js` | maskowanie celów w błędzie (cel < 0 → bez błędu i gradientu), więc dostrajanie też może liczyć się na GPU; `lastLoss` uśrednia tylko oceniane pozycje |
| `worker.js` | napisany od nowa: tylko transformer, wspólna pętla nauki (GPU albo procesor), kilka modeli w pamięci według id, dalsza nauka modelu, dostrajanie od dostrojonego, sprawdzanie znaczników, słownik poszerzony o znaki dopuszczane przez formatowanie |
| `infer.js` | nowy: generowanie z pamięcią kluczy i wartości uwagi (KV cache), ok. 12·d²·L mnożeń na token zamiast przeliczania całego okna; wynik zgodny z pełnym przejściem (test) |

### Protokół wątku

Polecenia (`postMessage({cmd, …})`):

| cmd | dane | odpowiedź |
|---|---|---|
| `load` | `reqId, id, record` | `loaded` |
| `unload` | `reqId, id` | `unloaded` |
| `pretrain` | `jobId, newId, text, vocabChars, from?, hp` | `tokprogress`, `data`, `progress`…, `done` |
| `finetune` | `jobId, newId, from, dialogs, tags, hp` | `data`, `progress`…, `done` |
| `stop` | – | nauka kończy się wiadomością `done` z `stopped: true` |
| `reply` | `reqId, id, history, tags, temp, maxTokens, turns` | `reply {text, ms}` |
| `complete` | `reqId, id, prompt, temp, maxTokens` | `complete {text}` |
| `gpuinfo` | `reqId` | `gpuinfo {ok, name | msg}` |

Błędy wracają jako `error {msg, reqId?, jobId?}`. `done.record` = `{ hp, chars, tok: {merges, nBase} | null, tensors: Float32Array[], params }`, czyli to samo, co później przyjmuje `load`.

## Dane

IndexedDB `ai-prawo` (schemat w wersji `VERSIONS.db`, od 0.6.0 – 2, od 0.8.0 – 3), magazyny: `documents`, `dialogs`, `conversations`, `models`, `sources` (od schematu 2), `logs` (od schematu 3) i `kv` (ustawienia, aktywny model). Nowy magazyn tworzy `onupgradeneeded` w `db.js`; istniejące dane zostają. W `localStorage` są tylko token GitHub (`ai-prawo.githubToken`) i motyw (`ai-prawo.theme`). Dokumenty z wersji 0.1–0.2 (bez statusu) są przy odczycie traktowane jako zatwierdzone.

## Rozmowa

Kontekst odpowiedzi to ostatnie `turns` wymian oraz bieżące pytanie:

```
Ty: pytanie 1
AI: odpowiedź 1
Ty: bieżące pytanie
AI:
```

Sieć generuje do końca linii. Wiadomość użytkownika przechodzi przez to samo formatowanie co dane do nauki (`cleanLine`). Gdy kontekst nie mieści się w oknie, liczone jest ostatnie 3/4 okna. Model dostrojony pamięta swoje znaczniki (`data.tags`) i czat ich używa.

## Pomoc

Każdy dział w `help/content.js` ma `id` (adres `#pomoc/<id>`) i `topics`. `help(tekst, temat)` w panelu pokazuje krótki dymek, a kliknięcie prowadzi do działu. Pola ustawień mają temat `grupa.pole`. Test `tests/help.test.js` pilnuje, żeby każdy temat miał dział i żeby przykłady reguł pokazywały zmianę.

## Logi

`core/log.js` zapisuje zdarzenia w magazynie `logs`. Logują same moduły `core/` (dokumenty, źródła, nauka, GitHub, modele), `ui/dom.js` (każde powiadomienie o błędzie lub ostrzeżeniu, z nazwą zakładki; `toast(…, { log: false })` gdy zdarzenie jest już zalogowane), `main.js` (start panelu, `error` i `unhandledrejection`) i `core/ai.js` (błąd wątku, wczytanie modelu). Bez IndexedDB (testy w Node) `log` niczego nie zapisuje i nie zgłasza błędu. Token GitHub nigdy nie trafia do logów.
