# Historia zmian

Format: wersja programu (`app`), data, zmiany. Wersje składowe w nawiasie, gdy się zmieniły. Zasady w [docs/wersjonowanie.md](docs/wersjonowanie.md).

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
