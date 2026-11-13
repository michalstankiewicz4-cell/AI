# Panel administracyjny – zakładki

Panel jest bez logowania i ma postać jednej strony (`index.html`). Zakładki przełącza się przez adres `#zakładka` albo `#zakładka/argument`. Menu i kafelki pulpitu mają dwie grupy kolorów: **fioletowy** – Dokumenty, Formatowanie i Nauka, **zielony** – Rozmowy wzorcowe i Dostrajanie; pozostałe zakładki są bez koloru.

| Zakładka | Plik | Ustawienia w zakładce |
|---|---|---|
| Pulpit | `js/panels/dashboard.js` | – |
| Research | `js/panels/research.js` | ustawienia każdego źródła (rodzaj, adres, wydawnictwo, lata, filtr tytułów) |
| Dokumenty | `js/panels/documents.js` | – |
| Formatowanie | `js/panels/formatting.js` | Ustawienia formatowania (reguły, dodatkowe znaki, progi) |
| Nauka | `js/panels/pretrain.js` | budowa sieci, kroki, tempo, urządzenie |
| Rozmowy wzorcowe | `js/panels/dialogs.js` | najdłuższa odpowiedź wzorcowa |
| Dostrajanie | `js/panels/finetune.js` | kroki, tempo, maska, rozmowy do sprawdzania, urządzenie |
| Historia rozmów | `js/panels/conversations.js` | – |
| Modele | `js/panels/models.js` | – |
| Ustawienia | `js/panels/settings.js` | nazwa, znaczniki rozmowy, GitHub (repo, gałąź, token) |
| Pomoc | `js/panels/help.js` | – |
| czat (okno) | `js/chat/widget.js` | ⚙: temperatura, długość odpowiedzi, pamięć rozmowy, zapisywanie |

## Pulpit
Siedem kafelków-kroków ze stanem: źródła w Researchu (ile, ile dokumentów do pobrania po ostatnim sprawdzeniu, ile niedostępnych), ile dokumentów, ile czeka na sprawdzenie, modele bazowe i dostrojone, rozmowy wzorcowe, odpowiedzi do oceny. Do tego aktywny model i informacje o komputerze (karta graficzna, trwająca nauka).

## Research
Źródła dokumentów (przed Dokumentami, bez koloru):
- **Czy dokument był już pobrany?** – adres → wynik „już pobrany” (po adresie albo po treści, z odnośnikiem do dokumentu) albo „nie ma” z przyciskiem *Pobierz do dokumentów*.
- **Źródła** – strona www albo API aktów prawnych Sejmu (ELI). Przy każdym: liczba pobranych z niego dokumentów, wynik ostatniego sprawdzenia (działa z czasem odpowiedzi / błąd HTTP / niedostępne – CORS), informacja o zmianach od poprzedniego sprawdzenia, a pod spodem:
  - strona www: tabela linków do dokumentów (nowy / już pobrany) z przyciskami *Pobierz* i *Pobierz wszystkie nowe*;
  - API ELI: akty z wybranych lat po filtrze tytułów, widoki *Nowe / Zmienione / Wszystkie*, *Pobierz* i *Pobierz nową wersję*.
- **Domeny z dokumentów** bez źródła – *Dodaj jako źródło*.
- **Dokumenty z adresem źródła** – *Sprawdź zmiany u źródła*, przy zmienionych *Dodaj nową wersję*.

Pobrany dokument przechodzi zwykłą drogą: Formatowanie → zatwierdzenie → nauka.

## Dokumenty
Biblioteka. Każdy plik ma ikonkę rodzaju (TXT, HTML, MD, DOCX, ODT, RTF, PDF, IMG, wklejony tekst), nazwę, datę, liczbę znaków, kodowanie lub sposób odczytu oraz edytowalne pole **opisu**. Wgranie odczytuje plik (przy PDF i obrazach z paskiem postępu OCR: strona, etap, procent), od razu go formatuje i pokazuje okno **statystyk formatowania**. Kliknięcie statusu otwiera dokument w zakładce Formatowanie. Pod opisem jest pole **Adres źródła** (skąd pobrano dokument; Research wypełnia je sam). Przy wgraniu dokumentu o treści identycznej z już istniejącym panel pyta, czy dodać go mimo to.

## Formatowanie
Wynik konwertera. Widoki: do sprawdzenia, zatwierdzone, odrzucone, wszystkie. Każdy dokument ma:
- podgląd po formatowaniu i przed nim,
- linię **Odczyt** (PDF i OCR: strony z warstwą tekstową, przez OCR, obrócone, wyprostowane, pewność),
- ostrzeżenia, zmiany według reguł i usunięte znaki,
- przyciski: Zatwierdź do nauki, Odrzuć, Cofnij zatwierdzenie, Formatuj ponownie (statystyki oraz sekcja „Czy to coś dało?” z porównaniem z poprzednim wynikiem), Statystyki,
- pole „używaj w nauce” dla zatwierdzonych.

Na górze są przyciski „Zatwierdź bez ostrzeżeń” i „Formatuj wszystkie ponownie” (z sumą statystyk) oraz zwijane Ustawienia formatowania.

## Nauka
Dane (zatwierdzone i włączone dokumenty), dostępność karty graficznej, rodzaj nauki (od zera albo dalsza nauka modelu bazowego), ustawienia z szacunkiem liczby parametrów i rozmiaru pliku. W czasie nauki widać przebieg: pasek postępu, wykres błędu, liczby (błąd, najlepszy moment, bity na znak, czas kroku), próbkę tekstu i pominięte znaki. Po zakończeniu model zapisuje się sam.

## Rozmowy wzorcowe
Zestaw do dostrajania: dodawanie ręczne (edytor wymian), wczytywanie z pliku `.txt` (z raportem błędnych rozmów), pobieranie jako plik, wyszukiwanie, edycja, włączanie i wyłączanie.

## Dostrajanie
Wybór modelu startowego (bazowy albo dostrojony), ustawienia, przebieg jak przy nauce. Na końcu przycisk „Ustaw jako aktywny i otwórz czat”.

## Historia rozmów
Rozmowy z czatu z ocenami. Filtry: wszystkie, do oceny, gotowe do zestawu. W oknie rozmowy można ocenić i poprawić odpowiedzi oraz dodać rozmowę do rozmów wzorcowych (kolejne wymiany od początku, dopóki odpowiedzi są dobre albo poprawione).

## Modele
Lista wersji z metrykami, budową, danymi i wersjami programu. Przyciski: ustaw jako aktywny, podgląd budowy (warstwy jako kolumny neuronów połączone prawdziwymi wagami), pobierz plik, opublikuj na GitHub (okno z checkboxami), zmień nazwę, usuń. Na górze „Wczytaj z pliku” i „Wczytaj z GitHub” (modele i dane).

## Ustawienia
Ustawienia ogólne (nazwa asystenta, znaczniki rozmowy), GitHub (repo, gałąź, token, sprawdzenie dostępu, wczytaj z GitHub), dane w tej przeglądarce (liczby rekordów, zajęte miejsce), wersje, przywracanie ustawień domyślnych.

## Pomoc
Działy z opisem, przykładami „przed → po” (dla reguł formatowania liczonymi na żywo przez prawdziwą regułę), tabelami porównań i schematem modelu z ponumerowanymi objaśnieniami. Adres `#pomoc/<temat>`. Ikona [?] w panelu prowadzi do odpowiedniego działu.

## Czat
Ikona w prawym dolnym rogu. Odpowiada aktywny model. Wiadomość przechodzi przez to samo formatowanie co dane do nauki. Pod każdą odpowiedzią są oceny: ✓ dobra, ✎ popraw (wpisujesz poprawną), ✗ błędna. ⚙ otwiera ustawienia rozmowy, ＋ zaczyna nową rozmowę.
