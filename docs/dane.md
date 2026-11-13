# Dane i formatowanie

Formatowanie (`js/cleaner/`) pilnuje, żeby do nauki i dostrajania nie przedostały się błędy: zły zapis znaków, śmieci z PDF-ów, numery stron, powtórzenia. Każdą regułę można wyłączyć w *Ustawienia → Formatowanie danych*. Przy każdym pliku powstaje raport, a dokument trafia do nauki dopiero po zatwierdzeniu.

## Dokumenty

Obsługiwane pliki: `.txt`, `.md`, `.html`/`.htm`. Kodowanie (UTF-8, Windows-1250, ISO-8859-2) jest rozpoznawane samo. Z HTML usuwane są skrypty, style, menu, nagłówki i stopki strony; jeśli strona ma `<main>` albo `<article>`, brana jest tylko ta część.

### Reguły (w kolejności działania)

| Reguła | Co robi |
|---|---|
| Ujednolicenie zapisu liter | NFC (ą jako jeden znak), ligatury ﬁ ﬂ → fi fl |
| Znaki niewidoczne i sterujące | usuwa miękkie dzielenie, znaki zerowej szerokości, BOM i znaki sterujące; zamienia twarde spacje i tabulatory na spacje, a `\r\n` na `\n` |
| Wyrazy przeniesione | „przedawnie-⏎nia” → „przedawnienia” |
| Numery stron, nagłówki, stopki | usuwa linie typu „12”, „- 12 -”, „Strona 3 z 40”, „3/40” oraz krótkie linie powtarzające się co najmniej N razy |
| Łączenie złamanych linii | skleja linie złamane w połowie zdania; nigdy nie dokleja linii zaczynających się od „Art.”, „§”, „Rozdział”, „Dział”, „1)”, „a)”, „1.”, „–” |
| Cudzysłowy i apostrofy | wszystkie warianty cudzysłowów → „…”, apostrofy → ' |
| Myślniki i łączniki | między spacjami „ – ”, wewnątrz wyrazu „-” |
| Interpunkcja | „…” → „...”, bez spacji przed przecinkiem i kropką, „!!!” → „!”, spacja po przecinku |
| Zapis oznaczeń prawnych | „art.5” → „art. 5”, „§1” → „§ 1”, „ust.2” → „ust. 2”, „pkt. 3” → „pkt 3”, „lit.a” → „lit. a”, „Dz.U.” → „Dz. U.” |
| Dozwolone znaki | usuwa znaki spoza listy i wypisuje je w raporcie; dodatkowe znaki ustawisz w ustawieniach |
| Spacje i puste linie | jedna spacja, najwyżej jedna pusta linia między akapitami |
| Powtórzone akapity | usuwa akapit, który już wystąpił w dokumencie |

### Ostrzeżenia w raporcie

- podejrzenie źle odczytanego kodowania (np. „Ä…” zamiast „ą”),
- dużo usuniętych znaków (może brakować znaku w ustawieniach),
- bardzo krótki tekst,
- bardzo krótkie linie (tabela, spis treści),
- dużo cyfr (tabela, wykaz).

### Wersja reguł

Każdy dokument zapamiętuje wersję reguł (`VERSIONS.cleaner`), którą go sformatowano. Po zmianie reguł lista dokumentów oznacza starsze wersje, a „Formatuj ponownie” stosuje aktualne reguły do zapisanego surowego tekstu.

## Rozmowy wzorcowe

Plik `.txt`, każda kwestia w osobnej linii zaczynającej się znacznikiem, rozmowy oddzielone pustą linią:

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
- Rozmowa musi zaczynać się od użytkownika, kwestie muszą się przeplatać, a na końcu musi być odpowiedź AI.
- Odpowiedź dłuższa niż limit (ustawienia) jest odrzucana.
- Każda kwestia przechodzi przez reguły z zakresu „kwestia” i zostaje zapisana w jednej linii.
- Błędne rozmowy nie są dodawane; raport podaje numer linii i powód.

Kilka wymian w jednej rozmowie uczy sieć korzystać z kontekstu (nawiązywać do wcześniejszego pytania).

## Słownik modelu

Przy nauce od zera słownik obejmuje wszystkie znaki z dokumentów, a także wszystkie znaki dopuszczane przez formatowanie i znaki znaczników rozmowy. Dzięki temu każdy znak, który przejdzie formatowanie, model umie zapisać i przeczytać.
