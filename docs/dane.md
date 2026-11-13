# Dane: dokumenty, odczyt, formatowanie, rozmowy wzorcowe

Formatowanie (`js/cleaner/`) pilnuje, żeby do nauki i dostrajania nie przedostały się błędy: zły zapis znaków, śmieci z PDF-ów, numery stron, powtórzenia. Wgrany dokument (zakładka *Dokumenty*) od razu przechodzi przez odczyt i formatowanie. Wynik z raportem czeka w zakładce *Formatowanie* na zatwierdzenie, a do nauki trafiają tylko zatwierdzone. Każdą regułę można wyłączyć w zakładce *Formatowanie → Ustawienia formatowania*.

## Dokumenty

Zakładka *Dokumenty* to biblioteka: każdy plik ma ikonkę rodzaju, nazwę, datę, opis i oryginalny tekst, więc formatowanie można powtórzyć. Statusy w zakładce *Formatowanie*:
- **do sprawdzenia** – po wgraniu albo gdy ponowne formatowanie zmieniło wynik zatwierdzonego dokumentu,
- **zatwierdzony** – bierze udział w nauce i można go chwilowo wyłączyć,
- **odrzucony**.

### Odczyt plików (`js/reader/`)

| Rodzaj | Rozszerzenia | Jak |
|---|---|---|
| tekst | .txt | kodowanie rozpoznawane samo: UTF-8, a przy „krzaczkach” Windows-1250 albo ISO-8859-2 (to, które daje najwięcej polskich liter) |
| strona | .html, .htm | bez skryptów, stylów, menu, nagłówków i stopek; jeśli strona ma `<main>` albo `<article>`, brana jest tylko ta część |
| Markdown | .md | bez znaczników, linki zostają jako tekst |
| Word | .docx | akapity, tabulatory, łamania wierszy; spis treści i przypisy pominięte; **automatyczna numeracja list nie jest zapisana w treści pliku**, więc jej nie ma |
| OpenDocument | .odt | akapity i nagłówki, przypisy pominięte |
| RTF | .rtf | tekst bez formatowania, strona kodowa z pliku (domyślnie 1250), znaki Unicode |
| stary Word | .doc | nieobsługiwany: komunikat o zapisie jako .docx albo PDF |
| PDF | .pdf | warstwa tekstowa; strona, która ma mniej niż 30 znaków tekstu, jest renderowana (skala 2) i czytana przez OCR |
| obraz | .png, .jpg, .jpeg, .webp, .bmp, .gif | OCR; orientacja EXIF zdjęć z telefonu uwzględniana |

### OCR i położenie strony

Tesseract.js z modelem polskim (`vendor/tesseract`), tylko silnik LSTM.
1. **Bokiem czy nie:** odczyt pomniejszonej strony (ok. 1000 px) z ramkami linii tekstu. Jeśli linie są w sumie wyższe niż szersze, strona leży bokiem.
2. **Który obrót:** dla strony bokiem porównywane są 90° i 270°, dla pozostałych 0° i 180°. Wygrywa obrót z największą liczbą poprawnych słów (min. 3 litery) przy najwyższej pewności, bo tekst do góry nogami daje same błędy. Gdy 0° jest pewne (≥ 80%, ≥ 15 słów), 180° nie jest sprawdzane.
3. **Pod kątem:** właściwy odczyt w pełnej rozdzielczości z `rotateAuto`. Tesseract mierzy nachylenie linii i prostuje obraz, a zmierzony kąt trafia do raportu.

Raport ma linię **Odczyt** (np. „12 stron · z warstwy tekstowej: 10 · OCR: 2 (średnia pewność 91%) · obrócone: str. 7 o 180° · wyprostowane: str. 8 o −3,5°”). Strona z pewnością poniżej 60% dostaje ostrzeżenie. Test: `tests/e2e/ocr.e2e.mjs`.

### Reguły formatowania (w kolejności działania)

| Reguła | Co robi |
|---|---|
| Ujednolicenie zapisu liter | NFC (ą jako jeden znak), ligatury ﬁ ﬂ → fi fl |
| Znaki niewidoczne i sterujące | usuwa miękkie dzielenie, znaki zerowej szerokości, BOM i znaki sterujące; twarde spacje i tabulatory → spacje, `\r\n` → `\n` |
| Wyrazy przeniesione | „przedawnie-⏎nia” → „przedawnienia” |
| Numery stron, nagłówki, stopki | linie typu „12”, „- 12 -”, „Strona 3 z 40”, „3/40” i krótkie linie powtarzające się co najmniej N razy |
| Łączenie złamanych linii | skleja linie złamane w połowie zdania; nigdy nie dokleja linii zaczynających się od „Art.”, „§”, „Rozdział”, „Dział”, „Tytuł”, „Księga”, „Oddział”, „Załącznik”, „1)”, „a)”, „1.”, „–” |
| Cudzysłowy i apostrofy | wszystkie warianty → „…”, apostrofy → ' |
| Myślniki i łączniki | między spacjami „ – ”, wewnątrz wyrazu „-” |
| Interpunkcja | „…” → „...”, bez spacji przed przecinkiem i kropką, „!!!” → „!”, spacja po przecinku |
| Zapis oznaczeń prawnych | „art.5” → „art. 5”, „§1” → „§ 1”, „ust.2” → „ust. 2”, „pkt. 3” → „pkt 3”, „lit.a” → „lit. a”, „Dz.U.” → „Dz. U.” |
| Dozwolone znaki | usuwa znaki spoza listy i wypisuje je w raporcie |
| Spacje i puste linie | jedna spacja, najwyżej jedna pusta linia |
| Powtórzone akapity | usuwa akapit, który już wystąpił w dokumencie |

Dozwolone znaki: litery polskie i łacińskie, cyfry, spacja, koniec linii oraz `. , ; : ! ? ( ) [ ] „ ” ' - – § % / & * + = < > @ # °`. Dodatkowe dopisuje się w *Ustawieniach formatowania*.

### Raport i statystyki

Raport: zmiany według reguł, usunięte znaki (z kodem Unicode w dymku), ostrzeżenia:
- podejrzenie złego kodowania („Ä…” zamiast „ą”),
- dużo usuniętych znaków,
- bardzo krótki tekst,
- bardzo krótkie linie (tabela, spis treści),
- dużo cyfr (tabela, wykaz),
- mało pewny OCR.

Po wgraniu, wklejeniu i każdym formatowaniu pojawia się okno **statystyk** (`ui/modals/format-stats.js`): suma zmian, znaki przed i po (z procentem skrócenia), akapity, wykres zmian według reguł, usunięte znaki, ostrzeżenia. Przy wielu dokumentach jest suma i lista dokumentów.

**Formatuj ponownie** (jeden dokument albo wszystkie) dodaje sekcję **„Czy to coś dało?”**, czyli porównanie z poprzednim wynikiem:
- werdykt: „Dało efekt” (ile linii nowych i usuniętych, zmiana liczby ostrzeżeń, czy zatwierdzony dokument wrócił do sprawdzenia) albo „Bez efektu: wynik identyczny jak poprzednio”,
- tabela *poprzednio / teraz / różnica*: znaki po formatowaniu, akapity, zmiany reguł, usunięte znaki, ostrzeżenia,
- reguły, które zadziałały inaczej (z oznaczeniem *włączona*/*wyłączona*),
- informacja, jeśli poprzednio użyto starszej wersji reguł,
- przykłady zmienionych linii jako pary *było/jest* z wyróżnionym zmienionym fragmentem; pary dobierane są po najdłuższym wspólnym początku.

### Wersja reguł

Każdy dokument zapamiętuje wersję reguł (`VERSIONS.cleaner`), którą go sformatowano. Po zmianie reguł starsze są oznaczone, a „Formatuj wszystkie ponownie” stosuje aktualne reguły do oryginałów.

## Rozmowy wzorcowe

Plik `.txt`, każda kwestia w osobnej linii ze znacznikiem na początku, rozmowy oddzielone pustą linią:

```
Ty: Ile wynosi podstawowy termin przedawnienia?
AI: Sześć lat, a dla świadczeń okresowych i roszczeń związanych z działalnością gospodarczą trzy lata.
Ty: Od kiedy biegnie?
AI: Od dnia, w którym roszczenie stało się wymagalne.

Ty: Następna rozmowa…
AI: …
```

- Znaczniki ustawisz w *Ustawienia → Ogólne* (domyślnie `Ty:` i `AI:`).
- Linia bez znacznika jest doklejana do poprzedniej kwestii.
- Rozmowa zaczyna się od użytkownika, kwestie się przeplatają, a na końcu jest odpowiedź AI.
- Odpowiedź dłuższa niż limit (*Rozmowy wzorcowe → Ustawienia*) jest odrzucana.
- Każda kwestia przechodzi przez reguły z zakresu „kwestia” i zapisuje się w jednej linii.
- Błędne rozmowy nie są dodawane; raport podaje numer linii i powód.

Kilka wymian w jednej rozmowie uczy sieć korzystać z kontekstu.

## Słownik modelu

Przy nauce od zera słownik obejmuje znaki z dokumentów oraz wszystkie znaki dopuszczane przez formatowanie i znaki znaczników rozmowy. Każdy znak, który przejdzie formatowanie, model umie więc zapisać i przeczytać.
