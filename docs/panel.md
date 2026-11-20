# Panel administracyjny – zakładki

Panel jest bez logowania i ma postać jednej strony (`index.html`). Zakładki przełącza się przez adres `#zakładka` albo `#zakładka/argument`. Menu i kafelki pulpitu mają dwie grupy kolorów: **fioletowy** – Dokumenty, Formatowanie i Nauka, **zielony** – Rozmowy wzorcowe i Dostrajanie; pozostałe zakładki są bez koloru.

| Zakładka | Plik | Ustawienia w zakładce |
|---|---|---|
| Pulpit | `js/panels/dashboard.js` | – |
| Research | `js/panels/research.js` | ustawienia każdego źródła (rodzaj, adres, opis, tekst ogólny; przy ELI wydawnictwo, lata, filtr tytułów) |
| Dokumenty | `js/panels/documents.js` | – |
| Formatowanie | `js/panels/formatting.js` | Ustawienia formatowania (reguły, dodatkowe znaki, progi) |
| Nauka | `js/panels/pretrain.js` | budowa sieci, kroki, tempo, udział tekstu ogólnego, urządzenie |
| Rozmowy wzorcowe | `js/panels/dialogs.js` | najdłuższa odpowiedź wzorcowa |
| Dostrajanie | `js/panels/finetune.js` | kroki, tempo, maska, rozmowy do sprawdzania, urządzenie |
| Historia rozmów | `js/panels/conversations.js` | – |
| Modele | `js/panels/models.js` | – |
| Ustawienia | `js/panels/settings.js` | nazwa, znaczniki rozmowy, GitHub (repo, gałąź, token) |
| Logi | `js/panels/logs.js` | – |
| Pomoc | `js/panels/help.js` | – |
| czat (okno) | `js/chat/widget.js` | ⚙: temperatura, długość odpowiedzi, pamięć rozmowy, zapisywanie |

## Pulpit
Na górze karta **Profil**: wybór profilu albo „Wszystkie profile”, *Nowy profil* / *Edytuj profil* / *Usuń profil* (nazwa, kategorie dokumentów, tekst ogólny, szablon sieci: mała, średnia, duża). Przy wybranym profilu Dokumenty, Formatowanie, Rozmowy wzorcowe i Modele pokazują jego zawartość (pasek „Profil: …” z *Pokaż wszystko*), Nauka i Dostrajanie używają jego danych i ustawień, a nowe dokumenty, rozmowy i modele należą do niego same; nazwa profilu jest w górnym pasku. Niżej siedem ponumerowanych kafelków-kroków (1 Research, 2 Dokumenty, 3 Formatowanie, 4 Nauka, 5 Rozmowy wzorcowe, 6 Dostrajanie, 7 Rozmowa i poprawki) ze stanem: źródła w Researchu (ile, ile dokumentów do pobrania po ostatnim sprawdzeniu, ile niedostępnych), ile dokumentów, ile czeka na sprawdzenie, modele bazowe i dostrojone, rozmowy wzorcowe, odpowiedzi do oceny. Do tego aktywny model i informacje o komputerze (karta graficzna, trwająca nauka).

## Research
Źródła dokumentów (przed Dokumentami, bez koloru):
- **Czy dokument był już pobrany?** – adres → wynik „już pobrany” (po adresie albo po treści, z odnośnikiem do dokumentu) albo „nie ma” z przyciskiem *Pobierz do dokumentów*.
- **Źródła** – strona www, API aktów prawnych Sejmu (ELI), inne API zwracające JSON, stenogramy Sejmu albo Wikipedia; źródło może mieć plakietkę **ogólny** (tekst ogólny, dokumenty z niego dostają to oznaczenie). Przy każdym: liczba pobranych z niego dokumentów, wynik ostatniego sprawdzenia (działa z czasem odpowiedzi / błąd HTTP / niedostępne – CORS), informacja o zmianach od poprzedniego sprawdzenia, a pod spodem:
  - strona www: tabela linków do dokumentów (nowy / już pobrany) z przyciskami *Pobierz* i *Pobierz wszystkie nowe*;
  - API ELI: akty z wybranych lat po filtrze tytułów, widoki *Nowe / Zmienione / Wszystkie*, *Pobierz* i *Pobierz nową wersję*;
  - stenogramy Sejmu: dni posiedzeń, które już się odbyły (najnowsze 20), PDF stenogramu z *Pobierz* / *Pobierz wszystkie nowe*;
  - Wikipedia: liczba artykułów, wybór ile losowych artykułów pobrać, *Pobierz losowe artykuły*;
  - API (JSON): czy działa, liczba pozycji (i wszystkich), pierwsze pozycje, zmiana od poprzedniego sprawdzenia.
- **Znane źródła do dodania** – wbudowany katalog (ELI DU/MP, UOKiK, UODO, KNF, ZUS, KIS/EUREKA, SAOS, API Sejmu: druki, procesy legislacyjne, interpelacje; ogólne: stenogramy Sejmu, Wikipedia) z przyciskami *Dodaj* i *Dodaj wszystkie*; dodane znikają z katalogu.
- **Pakiety tematyczne** – gotowe zestawy do dziedziny (wbudowane: Prawo pracy, Prawo bankowe i kredyty): *Dodaj źródła pakietu*, *Pobierz akty pakietu* (po ELI, ze sprawdzeniem tytułu), *Pobierz hasła Wikipedii* (tekst ogólny), *Dodaj pytania do rozmów wzorcowych* (szkielety do uzupełnienia), *Sprawdź nowe teksty jednolite* (z podmianą w pakiecie i oznaczeniem starej wersji jako „nieaktualny”); wynik przy każdej pozycji, licznik „Brakuje”, już pobrane pomijane. Własne pakiety: *Nowy pakiet*, *Edytuj pakiet* (także wbudowany – kopia; *Przywróć wbudowany*), *Zapisz pakiet do pliku*, *Wczytaj pakiet z pliku*.
- **SAOS** – przy źródle API z saos.org.pl lista orzeczeń z *Pobierz* i *Pobierz wszystkie nowe orzeczenia* (pełna treść do biblioteki, kategoria *orzeczenie*).
- **Kategorie źródła** (w *Edytuj*) – dostaje je każdy dokument pobrany z tego źródła.
- **Domeny z dokumentów** bez źródła – *Dodaj jako źródło*.
- **Dokumenty z adresem źródła** – *Sprawdź zmiany u źródła*, przy zmienionych *Dodaj nową wersję*.

Pobrany dokument przechodzi zwykłą drogą: Formatowanie → zatwierdzenie → nauka.

## Dokumenty
Biblioteka. Każdy plik ma ikonkę rodzaju (TXT, HTML, MD, DOCX, ODT, RTF, PDF, IMG, wklejony tekst), nazwę, datę, liczbę znaków, kodowanie lub sposób odczytu oraz edytowalne pole **opisu**. Wgranie odczytuje plik (przy PDF i obrazach z paskiem postępu OCR: strona, etap, procent), od razu go formatuje i pokazuje okno **statystyk formatowania**. Kliknięcie statusu otwiera dokument w zakładce Formatowanie. Pod opisem jest pole **Adres źródła** (skąd pobrano dokument; Research wypełnia je sam). Przy wgraniu dokumentu o treści identycznej z już istniejącym panel pyta, czy dodać go mimo to. Pod opisem są **kategorie** (plakietki w kolorze swojej grupy, pole „+ kategoria”), a nad listą filtr kategorii z liczbami, w wierszach według grup (kilka zaznaczonych = wszystkie naraz); *Grupy kategorii* otwiera edycję grup (nazwa, kolor, kategorie); czerwona *nieaktualny* pojawia się sama przy nowszej wersji aktu. Pole **tekst ogólny** oznacza dokument jako ogólny (nie prawniczy) – ma wtedy plakietkę „ogólny” i w nauce idzie tylko do ustalonego udziału.

## Formatowanie
Wynik konwertera. Widoki: do sprawdzenia, zatwierdzone, odrzucone, wszystkie. Każdy dokument ma:
- podgląd po formatowaniu i przed nim,
- linię **Odczyt** (PDF i OCR: strony z warstwą tekstową, przez OCR, obrócone, wyprostowane, pewność),
- ostrzeżenia, zmiany według reguł i usunięte znaki,
- przyciski: Zatwierdź do nauki, Odrzuć, Cofnij zatwierdzenie, Formatuj ponownie (statystyki oraz sekcja „Czy to coś dało?” z porównaniem z poprzednim wynikiem), Statystyki,
- pole „używaj w nauce” dla zatwierdzonych.

Na górze są przyciski „Zatwierdź bez ostrzeżeń” i „Formatuj wszystkie ponownie” (z sumą statystyk) oraz zwijane Ustawienia formatowania.

Na górze Formatowania karta **Przygotowanie dla zewnętrznego AI**: instrukcja (prompt systemowy) i wielkość części; nad listą *Przygotuj dla AI* (plik .md z instrukcją i dokumentami z bieżącej listy) i *Wczytaj wynik od AI* (wklejenie odpowiedzi albo pliku – podmiana tekstu po znacznikach); przy dokumencie z wersją od AI *Usuń wersję od AI*.

Przy dokumencie **Struktura** (akty z co najmniej 3 artykułami): spis artykułów z wyszukiwaniem, treść, klikalne odnośniki do przepisów (także w innych aktach biblioteki), „Cytowany przez”, „← Wstecz”, „Pobierz JSONL”. Przy orzeczeniu **Kazus do rozmów wzorcowych**. Nad listą także *Tabela* (przepisy albo rozmowy wzorcowe w wierszach: sortowanie, szukanie, filtr i podświetlone problemy – pusty tekst, duplikat, brak licencji, zły odnośnik; kliknięcie wiersza otwiera przepis albo rozmowę), *Kazusy z orzeczeń (n)* i *Eksport JSONL (n)* dla bieżącej listy.

## Nauka
Dane (zatwierdzone i włączone dokumenty; przy dokumentach ogólnych podział: prawnicze w całości, ogólne użyte do limitu udziału), dostępność karty graficznej, rodzaj nauki (od zera albo dalsza nauka modelu bazowego), ustawienia z szacunkiem liczby parametrów i rozmiaru pliku. W czasie nauki widać przebieg: pasek postępu, wykres błędu, liczby (błąd, najlepszy moment, bity na znak, czas kroku), próbkę tekstu i pominięte znaki. Po zakończeniu model zapisuje się sam.

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

## Logi
Zdarzenia i błędy z czasem (do sekundy), ważnością, obszarem i wersją panelu, najnowsze na górze. Kolor według ważności: czerwony – błąd, złoty – ostrzeżenie, niebieski – informacja, szary – szczegóły (domyślnie ukryte). Filtry ważności z licznikami, wybór obszaru (np. nauka, research, github, zakładka …), wyszukiwanie, rozwijane szczegóły, *Pobierz logi* (.txt z widocznymi wpisami), *Wyczyść logi*. Nowe wpisy dochodzą na żywo. Logi są tylko w tej przeglądarce (najwyżej 5000).

## Pomoc
Działy z opisem, przykładami „przed → po” (dla reguł formatowania liczonymi na żywo przez prawdziwą regułę), tabelami porównań i schematem modelu z ponumerowanymi objaśnieniami. Adres `#pomoc/<temat>`. Ikona [?] w panelu prowadzi do odpowiedniego działu.

## Czat
Ikona w prawym dolnym rogu. Odpowiada aktywny model. Wiadomość przechodzi przez to samo formatowanie co dane do nauki. Pod każdą odpowiedzią są oceny: ✓ dobra, ✎ popraw (wpisujesz poprawną), ✗ błędna. ⚙ otwiera ustawienia rozmowy, ＋ zaczyna nową rozmowę.
