# Nauka, dostrajanie i uczenie z rozmów

## 1. Nauka na dokumentach (pretraining)

Sieć dostaje tekst dokumentów i uczy się przewidywać następny token. 90% tekstu służy do nauki, ostatnie 10% do sprawdzania. Co ok. 1,5 s liczony jest błąd na tekście sprawdzającym. Najlepszy moment jest zapamiętywany i jeśli na końcu błąd sprawdzający wyraźnie wzrósł (sieć zaczęła uczyć się na pamięć), wagi wracają do najlepszego momentu.

- **Od zera** – nowy słownik (BPE albo litery) i nowa sieć.
- **Dalsza nauka modelu** – ten sam słownik i budowa, nauka na aktualnym zbiorze dokumentów. Znaki spoza słownika są pomijane i wypisywane w przebiegu.

**Tekst ogólny.** Dokumenty oznaczone jako ogólne (np. Wikipedia, stenogramy Sejmu) uczą zwykłej polszczyzny. Ustawienie *Udział tekstu ogólnego* (domyślnie 20%) mówi, jaką część całego tekstu mogą stanowić: dokumenty prawnicze idą w całości, ogólne – od najstarszych – aż do limitu (ostatni przycięty na końcu linii). Bez dokumentów prawniczych idą wszystkie ogólne; 0% wyłącza tekst ogólny. Funkcja `mixCorpus` w `js/core/documents.js`.

Tempo nauki przez pierwsze 70% kroków to wartość z ustawień, potem 1/5 tej wartości.

### Ustawienia budowy

Schemat modelu z objaśnieniem każdego elementu (neuron, połączenie, embedding, uwaga, MLP, połączenie omijające, warstwa) jest w Pomocy: *Jak zbudowany jest model (schemat)*. Budowę wytrenowanego modelu z prawdziwymi wagami pokazuje *Modele → Podgląd budowy* ([modele.md](modele.md#podgląd-budowy)).


| | domyślnie | wpływ |
|---|---|---|
| Jednostka | BPE 1024 | tokeny BPE mieszczą ok. 3× więcej tekstu w tym samym oknie |
| Warstwy | 4 | głębokość sieci |
| Szerokość | 128 | liczb na token; musi dzielić się przez głowy, a wynik przez 4 |
| Głowy | 4 | równoległe „spojrzenia” uwagi |
| Okno | 128 | ile tokenów sieć widzi naraz = jak długą rozmowę pamięta |

Domyślna sieć ma ok. 1 mln parametrów; plik modelu zajmuje ok. 6 MB.

Ile tekstu? Mała sieć zaczyna sensownie pisać od ok. 300–500 tys. znaków. Przy większej sieci (więcej warstw, większa szerokość) potrzeba więcej tekstu, inaczej szybko uczy się na pamięć.

## 2. Dostrajanie do rozmowy (finetuning)

Kopia wybranego modelu uczy się na rozmowach wzorcowych. Przy maskowaniu (domyślnie) błąd liczy się tylko na odpowiedziach AI, razem z końcem linii, więc sieć uczy się też kończyć odpowiedź. Część rozmów (domyślnie 10%, losowo) jest odkładana do sprawdzania. Liczba „bity na znak” po dostrajaniu mówi, jak sieć radzi sobie z rozmowami, których nie widziała.

Dostrajać można:
- model bazowy (po nauce na dokumentach),
- model już dostrojony – kolejna runda po dodaniu nowych rozmów.

Przy kolejnej rundzie ucz na **całym** zestawie (stare i nowe rozmowy), a nie tylko na nowych, bo inaczej sieć zapomina wcześniejsze odpowiedzi. Panel domyślnie bierze wszystkie włączone rozmowy.

### Czego się spodziewać

Dostrajanie uczy przede wszystkim formy odpowiedzi; treść pochodzi z dokumentów i z przykładów. Na pytania podobne do wzorcowych mała sieć odpowiada zwykle dobrze. Na pytania o rzeczy obecne tylko w dokumentach odpowiada „w temacie”, ale szczegóły mogą być błędne. Na pytania spoza danych wymyśla. Nie trzeba uczyć wszystkich możliwych pytań, ale im więcej różnorodnych przykładów z danego tematu, tym lepiej.

## 3. Uczenie z rozmów

1. Rozmawiasz w czacie (ikona w prawym dolnym rogu).
2. Oceniasz odpowiedzi: ✓ dobra, ✎ popraw (wpisujesz poprawną), ✗ błędna.
3. W *Historii rozmów* dodajesz rozmowę do rozmów wzorcowych. Trafiają tam kolejne wymiany od początku rozmowy, dopóki odpowiedzi są dobre albo poprawione. Przed zapisem można je jeszcze edytować.
4. Dostrajasz ponownie.

W kontekście kolejnych pytań czat używa poprawionej odpowiedzi zamiast oryginalnej.

## Sprzęt

- **Nauka:** karta graficzna (WebGPU) jest wielokrotnie szybsza od procesora. Bez niej panel liczy procesorem (WASM SIMD). Nauka trwa w karcie przeglądarki, której nie wolno zamykać; można przechodzić między zakładkami.
- **Rozmowa:** nie wymaga mocnego komputera. Odpowiedź liczy się z pamięcią KV (`js/engine/infer.js`) w kilkadziesiąt milisekund.
