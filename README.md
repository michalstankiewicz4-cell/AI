# AI – asystent prawny uczony w przeglądarce

Własna sieć neuronowa (transformer), która uczy się języka prawnego z dokumentów, a potem odpowiadania na pytania z rozmów wzorcowych. Wszystko dzieje się w przeglądarce: nie potrzeba serwera ani zewnętrznego API. Panel administracyjny jest bez logowania i zawiera wszystkie ustawienia. Czat otwiera się ikoną w prawym dolnym rogu.

**Strona:** https://michalstankiewicz4-cell.github.io/AI/
**Wersja:** patrz `js/version.js` i [CHANGELOG.md](CHANGELOG.md).

## Jak to działa

1. **Dokumenty** – biblioteka: wgrywasz ustawy, kodeksy, orzeczenia, artykuły (.txt, .md, .html) z opisem. Każdy plik od razu przechodzi przez konwerter na dane do nauki.
2. **Formatowanie** – podgląd przed/po i raport [formatowania](docs/dane.md); do nauki trafiają tylko zatwierdzone dokumenty.
3. **Nauka** (pretraining) – sieć uczy się przewidywać kolejny fragment tekstu, a przez to poznaje słownictwo i strukturę przepisów.
4. **Rozmowy wzorcowe** – pytania i poprawne odpowiedzi w formacie `Ty: … / AI: …`.
5. **Dostrajanie** (finetuning) – sieć uczy się odpowiadać. Błąd liczony jest tylko na odpowiedziach AI (maskowanie).
6. **Czat i poprawki** – rozmawiasz, oceniasz odpowiedzi (✓ ✎ ✗) i przenosisz poprawione rozmowy do zestawu wzorcowego. Potem dostrajasz ponownie. Tak AI uczy się z rozmów.
7. **Modele** – każda nauka zapisuje nową wersję, a jej budowę widać w podglądzie (warstwy z neuronami połączonymi według wag). Model można pobrać jako plik albo opublikować na GitHub (`models/`), skąd jest dostępny przez GitHub Pages.

Kroki 1–3 to etap 1 (nauka języka), 4–5 to etap 2 (nauka odpowiadania); w menu i na pulpicie mają osobne kolory. Opis każdej funkcji z przykładami jest w zakładce **Pomoc** (ikona [?] przy funkcji prowadzi do odpowiedniego działu). Szczegóły techniczne: [docs/nauka.md](docs/nauka.md).

## Wymagania

- **Rozmowa** działa na każdym komputerze, nawet słabym, i na telefonie: jedna odpowiedź to kilkadziesiąt milisekund.
- **Nauka** idzie najszybciej na karcie graficznej (WebGPU: Chrome, Edge). Bez niej liczy procesor (WASM SIMD), wolniej.
- Dane (dokumenty, rozmowy, modele) są w bazie IndexedDB przeglądarki na tym komputerze.

## Struktura

```
index.html            panel administracyjny (jedyna strona)
css/                  style: base (zmienne, przyciski), admin (panel), chat (okno czatu)
js/
  main.js             układ panelu i przełączanie zakładek
  version.js          wersje programu, silnika, reguł, formatu modelu i bazy
  core/               logika bez interfejsu: baza, ustawienia, klient silnika, modele, korpus, rozmowy, GitHub
  cleaner/            formatowanie danych: reguły, raport, odczyt plików, rozmowy wzorcowe
  engine/             silnik sieci (wątek w tle): transformer, BPE, GPU, szybkie generowanie
  panels/             zakładki panelu
  help/               treść zakładki Pomoc (działy, przykłady, porównania)
  chat/               okno czatu w prawym dolnym rogu
  ui/                 elementy interfejsu: DOM, formularze, wykres, widok nauki
docs/                 dokumentacja
tests/                testy (node tests/run.js)
models/               opublikowane modele (tworzony przy pierwszej publikacji)
```

Opis architektury: [docs/architektura.md](docs/architektura.md).

## Uruchomienie lokalne

Strona używa modułów ES i wątku w tle, więc trzeba ją otworzyć przez serwer HTTP, a nie z pliku:

```
python -m http.server 8000      # potem http://localhost:8000
```

Testy (Node 18+): `node tests/run.js`

## Pochodzenie silnika

Silnik pochodzi z [GameLaboratory – Laboratorium języka](https://michalstankiewicz4-cell.github.io/GameLaboratory/labs/lang.html) (kroki 4 „Transformer” i 5 „Rozmowa”). Zmiany opisuje [docs/architektura.md](docs/architektura.md#silnik).
