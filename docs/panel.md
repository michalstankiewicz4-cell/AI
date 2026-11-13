# Panel administracyjny – zakładki

Panel jest bez logowania i ma postać jednej strony (`index.html`). Zakładki przełącza się przez adres `#zakładka` albo `#zakładka/argument`. Menu i kafelki pulpitu mają kolory etapów: **etap 1** (nauka języka) to Dokumenty, Formatowanie i Nauka, a **etap 2** (nauka odpowiadania) to Rozmowy wzorcowe i Dostrajanie. W prawym górnym rogu jest przełącznik dzień/noc, w prawym dolnym ikona czatu.

| Zakładka | Plik | Ustawienia w zakładce |
|---|---|---|
| Pulpit | `js/panels/dashboard.js` | – |
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
Sześć kafelków-kroków ze stanem: ile dokumentów, ile czeka na sprawdzenie, modele bazowe i dostrojone, rozmowy wzorcowe, odpowiedzi do oceny. Do tego aktywny model i informacje o komputerze (karta graficzna, trwająca nauka).

## Dokumenty
Biblioteka. Każdy plik ma ikonkę rodzaju (TXT, HTML, MD, DOCX, ODT, RTF, PDF, IMG, wklejony tekst), nazwę, datę, liczbę znaków, kodowanie lub sposób odczytu oraz edytowalne pole **opisu**. Wgranie odczytuje plik (przy PDF i obrazach z paskiem postępu OCR: strona, etap, procent), od razu go formatuje i pokazuje okno **statystyk formatowania**. Kliknięcie statusu otwiera dokument w zakładce Formatowanie.

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
