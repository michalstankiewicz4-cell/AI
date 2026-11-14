# AI – asystent prawny uczony w przeglądarce

Własna sieć neuronowa (transformer), która najpierw uczy się języka prawnego z dokumentów, a potem odpowiadania na pytania z rozmów wzorcowych. Wszystko dzieje się w przeglądarce: nie trzeba serwera ani zewnętrznego API. Panel administracyjny działa bez logowania i ma wszystkie ustawienia. Czat otwiera się ikoną w prawym dolnym rogu. Docelowo AI ma zostać zintegrowane z projektem PiK. To repo zawiera tylko samo AI.

- **Strona:** https://michalstankiewicz4-cell.github.io/AI/
- **Wersja:** `js/version.js`, historia zmian w [CHANGELOG.md](CHANGELOG.md)
- **Dokumentacja:** [docs/](docs/README.md), a dla użytkownika zakładka **Pomoc** w panelu (ikona [?] przy każdej funkcji prowadzi do odpowiedniego działu)

## Jak to działa

| Etap | Krok | Zakładka | Co się dzieje |
|---|---|---|---|
| 1 – nauka języka | 1 | Research | źródła dokumentów (strony www, API aktów prawnych Sejmu, inne API JSON; katalog znanych źródeł: UOKiK, UODO, KNF, ZUS, KIS, SAOS, Sejm…; tekst ogólny: stenogramy Sejmu, Wikipedia; pakiety tematyczne, np. Prawo pracy – także własne; pełne orzeczenia z SAOS): czy działają, co nowe i zmienione, czy dokument był już pobrany; pobieranie do biblioteki |
| | 2 | Dokumenty | biblioteka z kategoriami (filtr, „nieaktualny”): wgrywasz ustawy, kodeksy, orzeczenia, artykuły (Word, OpenDocument, RTF, PDF, skany i zdjęcia przez OCR, .txt, .md, .html) z opisem; tekst ogólny (nie prawniczy) oznaczony plakietką „ogólny” |
| | 3 | Formatowanie | konwerter na dane do nauki: podgląd przed/po, statystyki zmian, ostrzeżenia; do nauki trafiają tylko zatwierdzone dokumenty |
| | 4 | Nauka | sieć uczy się przewidywać dalszy ciąg tekstu (tekst ogólny do ustalonego udziału, domyślnie 20%), wynik to **model bazowy** |
| 2 – nauka odpowiadania | 5 | Rozmowy wzorcowe | pytania i poprawne odpowiedzi (`Ty: … / AI: …`) |
| | 6 | Dostrajanie | sieć uczy się odpowiadać, wynik to **model dostrojony** |
| douczanie | 7 | Czat | rozmowa z aktywnym modelem, ocena odpowiedzi ✓ ✎ ✗, pod odpowiedzią fragmenty z biblioteki (dokładny tekst przepisu) |
| | 7 | Historia rozmów | poprawione rozmowy wracają do rozmów wzorcowych → ponowne dostrajanie |
| | – | Modele | wersje, podgląd budowy, plik, publikacja na GitHub i wczytywanie z GitHub |
| | – | Logi | co i kiedy się działo, błędy w kolorach według ważności – do szukania, w którym momencie coś się popsuło |

Numery kroków są takie jak na kafelkach pulpitu (krok 7 „Rozmowa i poprawki” to czat razem z historią rozmów). W menu i na pulpicie są dwie grupy kolorów: fioletowy – Dokumenty, Formatowanie i Nauka, zielony – Rozmowy wzorcowe i Dostrajanie; Research i pozostałe zakładki są bez koloru.

Szczegóły: [docs/panel.md](docs/panel.md), [docs/dane.md](docs/dane.md), [docs/nauka.md](docs/nauka.md), [docs/modele.md](docs/modele.md). Ograniczenie: przeglądarka pobiera dane z innego serwisu tylko wtedy, gdy ten na to pozwala (CORS) – Research pokazuje to przy każdym źródle.

## Wymagania

- **Rozmowa** działa na każdym komputerze, nawet słabym, i na telefonie. Odpowiedź liczy się w kilkadziesiąt milisekund.
- **Nauka** jest najszybsza na karcie graficznej (WebGPU w Chrome i Edge). Bez karty liczy procesor (WASM SIMD), wolniej.
- **OCR** przy pierwszym użyciu pobiera ok. 7 MB (silnik i model języka polskiego z `vendor/`).
- **Dane:** wszystko (dokumenty, rozmowy, ustawienia, modele) jest zapisane lokalnie w bazie IndexedDB przeglądarki. Na GitHub trafia tylko to, co zaznaczysz przy publikacji. Repo jest publiczne.
- **Motyw** dzień/noc przełączasz w górnym pasku.

## Struktura

```
index.html              panel administracyjny (jedyna strona)
favicon.svg, package.json
css/                    base (zmienne, motywy, przyciski), layout (pasek, menu, karty), chat, panels/ (style zakładek)
js/
  main.js               układ panelu, adresy #zakładka/argument, przełącznik dzień/noc
  version.js            wersje: program, silnik, reguły formatowania, format modelu, schemat bazy
  core/                 logika bez interfejsu: baza, ustawienia, klient silnika, stan nauki, modele,
                        dokumenty (z mieszaniem tekstu ogólnego), rozmowy wzorcowe, historia rozmów, GitHub,
                        przenoszenie danych (sync), źródła Researchu (sources), logi (log)
  reader/               odczyt plików: tekst/HTML/MD, Word/ODT/RTF (+ ZIP), PDF, OCR z wykrywaniem położenia
  cleaner/              formatowanie: reguły, raport, rozmowy wzorcowe
  engine/               silnik sieci w wątku w tle: transformer, BPE, GPU, szybkie generowanie
  panels/               zakładki panelu
  chat/                 okno czatu w prawym dolnym rogu
  help/                 treść Pomocy i schemat modelu
  ui/                   elementy interfejsu, modals/ (publikacja, wczytywanie z GitHub, statystyki)
vendor/                 Tesseract.js (OCR) i pdf.js – biblioteki zewnętrzne z licencjami
docs/                   dokumentacja techniczna
tests/                  testy Node (node tests/run.js) i w przeglądarce (tests/e2e/)
models/, data/          tworzone przy publikacji na GitHub
```

Opis modułów: [docs/architektura.md](docs/architektura.md).

## Uruchomienie lokalne

Strona używa modułów ES i wątku w tle, więc trzeba ją otworzyć przez serwer HTTP, a nie bezpośrednio z pliku:

```
python -m http.server 8000      # potem http://localhost:8000
```

Testy: [docs/testy.md](docs/testy.md). W skrócie: `node tests/run.js` (Node 18+) oraz `node tests/e2e/panel.e2e.mjs`, `ocr.e2e.mjs` i `research.e2e.mjs` (Playwright).

## Pochodzenie

- Silnik sieci: [GameLaboratory – Laboratorium języka](https://michalstankiewicz4-cell.github.io/GameLaboratory/labs/lang.html) (krok 4 „Transformer” i krok 5 „Rozmowa”), zmiany opisane w [docs/architektura.md](docs/architektura.md#silnik).
- OCR: [Tesseract.js](https://github.com/naptha/tesseract.js); PDF: [pdf.js](https://github.com/mozilla/pdf.js). Wersje i licencje są w [vendor/README.md](vendor/README.md).
