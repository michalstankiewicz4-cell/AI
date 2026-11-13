# Historia zmian

Format: wersja programu (`app`), data, zmiany. Wersje składowe w nawiasie, gdy się zmieniły. Zasady w [docs/wersjonowanie.md](docs/wersjonowanie.md).

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
