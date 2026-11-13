// Podpowiedzi (dymki po najechaniu) dla przycisków, według ich napisu. h() z dom.js dodaje je sama,
// gdy przycisk nie ma własnego title. Nowy przycisk = nowy wpis tutaj.

export const TIPS = {
  'Wgraj pliki': 'Wybierz pliki .txt, .md albo .html. Każdy przejdzie przez formatowanie i pojawi się do zatwierdzenia.',
  'Wklej tekst': 'Wklej tekst skopiowany ze strony albo dokumentu. Przejdzie przez formatowanie jak plik.',
  'Zatwierdź do nauki': 'Zapisz dokument po formatowaniu. Od teraz będzie brał udział w nauce.',
  'Odrzuć': 'Nie dodawaj tego dokumentu. Nic nie zostanie zapisane.',
  'Podgląd': 'Pokaż tekst dokumentu po formatowaniu.',
  'Sprawdź adres': 'Sprawdź, czy dokument spod tego adresu jest już w bibliotece (po adresie albo po identycznej treści).',
  'Pobierz do dokumentów': 'Pobierz plik, odczytaj go i dodaj do biblioteki z adresem źródła.',
  'Dodaj źródło': 'Dodaj stronę www z dokumentami albo API aktów prawnych Sejmu (ELI).',
  'Sprawdź wszystkie': 'Sprawdź po kolei wszystkie źródła: czy działają, czy są zmiany i nowe dokumenty.',
  'Sprawdź': 'Sprawdź źródło: czy działa, czy coś się zmieniło, które dokumenty są nowe.',
  'Pobierz': 'Pobierz dokument do biblioteki (z adresem źródła).',
  'Pobierz nową wersję': 'Pobierz aktualny tekst aktu; poprzednia wersja zostaje w bibliotece.',
  'Dodaj nową wersję': 'Dodaj aktualny tekst ze źródła jako nowy dokument; poprzedni zostaje.',
  'Dodaj jako źródło': 'Dodaj tę domenę do listy źródeł.',
  'Sprawdź zmiany u źródła': 'Pobierz ponownie dokumenty z adresem źródła i porównaj treść z tą w bibliotece.',
  'Research': 'Źródła dokumentów: sprawdzanie i pobieranie.',
  'Statystyki': 'Pokaż statystyki formatowania: zmiany według reguł, znaki przed i po, usunięte znaki.',
  'Formatuj ponownie': 'Zastosuj aktualne reguły formatowania do zapisanego surowego tekstu (np. po zmianie ustawień).',
  'Usuń': 'Usuń na stałe.',
  'Formatuj': 'Sformatuj wklejony tekst i pokaż raport do zatwierdzenia.',
  'Pokaż przed formatowaniem': 'Przełącz podgląd na tekst przed formatowaniem, żeby porównać.',
  'Rozpocznij naukę': 'Uruchom naukę na włączonych dokumentach z ustawieniami powyżej. Model zapisze się sam po zakończeniu.',
  'Rozpocznij dostrajanie': 'Uruchom dostrajanie wybranego modelu na włączonych rozmowach wzorcowych.',
  'Zatrzymaj': 'Zakończ naukę teraz. Model z dotychczasowym (najlepszym) stanem i tak zostanie zapisany.',
  'Przejdź do dostrajania': 'Następny krok: naucz model odpowiadać na rozmowach wzorcowych.',
  'Przejdź do nauki': 'Naucz pierwszy model na dokumentach.',
  'Dodaj rozmowę': 'Wpisz ręcznie pytanie i wzorcową odpowiedź (można kilka wymian).',
  'Wczytaj z pliku': 'Wczytaj plik z dysku. Przed dodaniem zobaczysz raport.',
  'Pobierz jako plik': 'Zapisz cały zestaw rozmów wzorcowych jako plik .txt (ten sam format co przy wczytywaniu).',
  'Edytuj': 'Zmień treść rozmowy. Zostanie ponownie sformatowana i sprawdzona.',
  'Zapisz': 'Zapisz zmiany.',
  '+ kolejna wymiana': 'Dodaj następne pytanie i odpowiedź do tej rozmowy.',
  'Ustaw jako aktywny': 'Ten model będzie odpowiadał w czacie.',
  'Ustaw jako aktywny i otwórz czat': 'Ustaw nowy model w czacie i od razu go wypróbuj.',
  'Pobierz plik': 'Zapisz model jako plik .json (kopia zapasowa albo przeniesienie na inny komputer).',
  'Opublikuj na GitHub': 'Wyślij model do repo na GitHub (folder models/). Wymaga tokenu w ustawieniach.',
  'Opublikuj': 'Utwórz commit z modelem i listą modeli w repo.',
  'Wczytaj z GitHub': 'Pobierz opublikowane modele i dane (ustawienia, dokumenty, rozmowy) bez tokenu – np. na innym komputerze.',
  'Wczytaj zaznaczone': 'Dodaj zaznaczone dane z GitHub do tej przeglądarki.',
  'Wczytaj': 'Pobierz ten model do panelu.',
  'Zmień nazwę': 'Nadaj modelowi własną nazwę.',
  'Podgląd budowy': 'Zobacz warstwy sieci jako neurony połączone według wag modelu.',
  'Otwórz': 'Pokaż rozmowę, oceń i popraw odpowiedzi.',
  'Otwórz czat': 'Porozmawiaj z aktywnym modelem.',
  'Zapisz token': 'Zapisz token GitHub w tej przeglądarce (localStorage).',
  'Sprawdź dostęp': 'Sprawdź, czy token może zapisywać do repo i czy gałąź istnieje. Niczego nie zmienia.',
  'Usuń token': 'Usuń token GitHub z tej przeglądarki.',
  'Przywróć domyślne': 'Ustaw wszystkie ustawienia na wartości początkowe.',
  'Zapisz poprawkę': 'Zapisz poprawną odpowiedź. Trafi do rozmowy wzorcowej zamiast odpowiedzi sieci.',
  'Anuluj': 'Zamknij bez zmian.',
  '✓ dobra': 'Odpowiedź jest poprawna: może trafić do rozmów wzorcowych bez zmian.',
  '✗ błędna': 'Odpowiedź jest zła. Rozmowa trafi do zestawu tylko do tego miejsca (albo popraw odpowiedź).',
  'Dokumenty': 'Przejdź do biblioteki dokumentów.', 'Formatowanie': 'Sprawdź i zatwierdź dokumenty po konwersji na dane do nauki.',
  'Cofnij zatwierdzenie': 'Dokument wróci do sprawdzenia i nie będzie brał udziału w nauce.', 'Nauka': 'Przejdź do nauki na dokumentach.',
  'Rozmowy wzorcowe': 'Przejdź do rozmów wzorcowych.', 'Dostrajanie': 'Przejdź do dostrajania.',
};

export function tipFor(label) {
  if (TIPS[label]) return TIPS[label];
  if (/^Pobierz wszystkie nowe/.test(label)) return 'Pobierz do biblioteki wszystkie dokumenty, których jeszcze nie masz.';
  if (/^Formatuj wszystkie ponownie/.test(label)) return 'Sformatuj wszystkie dokumenty od nowa aktualnymi regułami (z oryginałów). Zatwierdzone, których wynik się zmieni, wrócą do sprawdzenia.';
  if (/^Zatwierdź bez ostrzeżeń/.test(label)) return 'Zatwierdź tylko dokumenty, przy których formatowanie nie zgłosiło ostrzeżeń.';
  if (/^Dodaj \d/.test(label)) return 'Dodaj poprawne rozmowy do zestawu. Błędne zostaną pominięte.';
  if (/^Dodaj do rozmów wzorcowych/.test(label)) return 'Przenieś ocenione wymiany do rozmów wzorcowych. Przed zapisem możesz je edytować.';
  return null;
}
