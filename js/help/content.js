// Treść zakładki „Pomoc”. Każdy dział ma id (adres #pomoc/<id>) i listę `topics` — identyfikatorów, którymi
// odsyłają do niego ikony [?] w panelu (help(tekst, temat)). Pola ustawień odsyłają tematem „grupa.pole”.
//
// Bloki treści:
//   ['p', tekst]                 akapit (może zawierać <b>, <i>, <code>)
//   ['steps', [[tytuł, opis], …]] ponumerowane kroki
//   ['list', [tekst, …]]          lista
//   ['ex', przed, po, opis?]      przykład „przed → po”
//   ['rule', idReguły, przykład]  przykład liczony na żywo przez regułę formatowania (zawsze zgodny z kodem)
//   ['table', [nagłówki], [[…], …]]  porównanie
//   ['code', tekst]               fragment pliku / formatu
//   ['tip', tekst]                wskazówka w ramce
//   ['link', idDziału, napis]     odnośnik do innego działu

import { RULES } from '../cleaner/rules.js';

const R = Object.fromEntries(RULES.map(r => [r.id, r]));
const ruleSection = (id, example, extra = []) => ({
  id: 'regula-' + id, group: 'Formatowanie', title: R[id].name, topics: ['cleaner.rule_' + id],
  body: [['p', R[id].desc], ['rule', id, example], ...extra],
});

export const SECTIONS = [
  { id: 'krok-po-kroku', group: 'Start', title: 'Krok po kroku', topics: ['start', 'pulpit'], body: [
    ['p', 'AI uczy się w dwóch etapach: najpierw <b>języka</b> (z dokumentów), potem <b>odpowiadania</b> (z rozmów wzorcowych). Dalej uczy się z rozmów w czacie, które poprawiasz.'],
    ['steps', [
      ['Dokumenty', 'Wgraj ustawy, kodeksy, orzeczenia, artykuły (.txt, .md, .html) i dopisz do nich opis. Każdy plik trafia do bazy z ikonką, nazwą i datą.'],
      ['Formatowanie', 'Każdy wgrany dokument jest od razu przerabiany na dane do nauki. Obejrzyj wynik i raport zmian, a potem zatwierdź albo odrzuć. Do nauki trafiają tylko zatwierdzone.'],
      ['Nauka', 'Sieć czyta zatwierdzone dokumenty i uczy się przewidywać dalszy ciąg tekstu. Tak poznaje słownictwo i budowę przepisów. Wynik to <b>model bazowy</b>, który pisze „po prawniczemu”, ale nie umie jeszcze odpowiadać na pytania.'],
      ['Rozmowy wzorcowe', 'Dopisz albo wczytaj z pliku przykłady: pytanie i poprawna odpowiedź. Im więcej i bardziej różnorodnych, tym lepiej.'],
      ['Dostrajanie', 'Model bazowy uczy się na rozmowach wzorcowych odpowiadać. Wynik to <b>model dostrojony</b>. Ustaw go jako aktywny.'],
      ['Czat', 'Rozmawiaj przez ikonę w prawym dolnym rogu. Oceniaj odpowiedzi: ✓ dobra, ✎ popraw, ✗ błędna.'],
      ['Historia rozmów', 'Rozmowy z dobrymi i poprawionymi odpowiedziami przenieś do rozmów wzorcowych. Potem wróć do kroku 5 i dostrój ponownie. Ta pętla to <b>uczenie z rozmów</b>.'],
      ['Modele', 'Każda nauka zapisuje nową wersję modelu. Porównaj je, wybierz aktywny, zobacz budowę, pobierz plik albo opublikuj na GitHub.'],
    ]],
    ['tip', 'Kroki 1–3 robisz rzadko (gdy przybywa dokumentów). Kroki 4–7 powtarzasz często: to codzienne douczanie.'],
  ] },
  { id: 'porownanie-etapow', group: 'Start', title: 'Rozmowa wzorcowa a dostrajanie (i nauka)', topics: ['etapy'], body: [
    ['p', '<b>Rozmowa wzorcowa to dane, dostrajanie to proces.</b> Tak samo dokument to dane, a nauka to proces.'],
    ['table', ['', 'Dane (co dajesz)', 'Proces (co robi sieć)', 'Wynik'], [
      ['Etap 1', 'Dokumenty (po formatowaniu)', 'Nauka', 'model bazowy: zna język prawny'],
      ['Etap 2', 'Rozmowy wzorcowe', 'Dostrajanie', 'model dostrojony: umie odpowiadać'],
    ]],
    ['p', 'Porównanie ze szkołą: dokumenty to podręcznik, a nauka to czytanie podręcznika. Rozmowy wzorcowe to zbiór zadań z rozwiązaniami, a dostrajanie to przerabianie tego zbioru. Dopisanie zadania do zbioru niczego jeszcze nie uczy; sieć nauczy się go dopiero przy następnym dostrajaniu.'],
    ['ex', 'Rozmowa wzorcowa (dane):\nTy: Ile wynosi podstawowy termin przedawnienia?\nAI: Sześć lat.', 'Dostrajanie (proces):\nsieć setki razy próbuje przewidzieć słowa odpowiedzi „Sześć lat.” i poprawia swoje wagi, aż zacznie tak odpowiadać.'],
  ] },

  { id: 'dokumenty', group: 'Dane', title: 'Dokumenty', topics: ['dokumenty', 'opis-dokumentu', 'kodowanie', 'biblioteka'], body: [
    ['p', 'Zakładka „Dokumenty” to biblioteka wgranych plików. Każdy ma ikonkę rodzaju (TXT, HTML, MD, wklejony tekst), nazwę, datę dodania i pole <b>opisu</b>, w którym możesz zapisać, co to jest i skąd pochodzi (np. „Kodeks cywilny, tekst jednolity pobrany z ISAP 13.11.2026”).'],
    ['list', [
      '<b>.txt</b> – zwykły tekst. Kodowanie polskie (UTF-8, Windows-1250, ISO-8859-2) rozpoznawane samo: program wybiera to, które daje najwięcej polskich liter bez „krzaczków”.',
      '<b>.html</b> – strona zapisana z przeglądarki. Usuwane są menu, nagłówki, stopki i skrypty; jeśli strona ma część główną (&lt;main&gt;/&lt;article&gt;), brana jest tylko ona.',
      '<b>.md</b> – Markdown: usuwane są znaczniki (#, **, linki zostają jako sam tekst).',
      '<b>Wklej tekst</b> – gdy kopiujesz ze strony albo PDF-a.',
    ]],
    ['p', 'Po wgraniu dokument od razu przechodzi przez formatowanie i czeka w zakładce „Formatowanie” na sprawdzenie. Oryginał zostaje w bazie, więc formatowanie można zawsze powtórzyć (np. po zmianie reguł).'],
    ['tip', 'Ile tekstu? Mała sieć zaczyna sensownie pisać od ok. 300–500 tys. znaków. Jedna ustawa to zwykle 50–500 tys., kodeks cywilny ok. 1 mln.'],
  ] },
  { id: 'formatowanie', group: 'Formatowanie', title: 'Formatowanie (konwerter na dane do nauki)', topics: ['formatowanie', 'raport', 'zmiany', 'ostrzezenia', 'do-sprawdzenia'], body: [
    ['p', 'Formatowanie zamienia dokument na czysty tekst do nauki: usuwa śmieci (numery stron, stopki, znaki niewidoczne), skleja to, co się rozpadło (wyrazy przeniesione, złamane linie) i ujednolica zapis (cudzysłowy, myślniki, „art. 5”, „§ 1”).'],
    ['p', 'Dlaczego to ważne? Sieć uczy się dokładnie tego, co widzi. Jeśli „§1”, „§ 1” i „§ 1” (z twardą spacją) występują w tekście, dla sieci to trzy różne rzeczy, a ona ma ograniczoną pojemność. Każdy numer strony w środku zdania uczy ją, że w zdaniach pojawiają się przypadkowe liczby.'],
    ['ex', 'Art.117. § 1. Z zastrzeżeniem wyjątków w ustawie przewi-\ndzianych, roszczenia majątkowe ulegają\n©Kancelaria Sejmu\ns. 41/512\nprzedawnieniu.', 'Art. 117. § 1. Z zastrzeżeniem wyjątków w ustawie przewidzianych, roszczenia majątkowe ulegają przedawnieniu.', 'typowy fragment skopiowany z PDF-a'],
    ['p', '<b>Raport</b> przy dokumencie pokazuje, ile zmian zrobiła każda reguła, jakie znaki usunięto i ostrzeżenia. Ostrzeżenie nie blokuje zatwierdzenia, ale warto zajrzeć do podglądu:'],
    ['table', ['Ostrzeżenie', 'Co zwykle znaczy', 'Co zrobić'], [
      ['złe kodowanie znaków', 'plik zapisany w innym kodowaniu, „Ä…” zamiast „ą”', 'zapisz plik jako UTF-8 i wgraj ponownie'],
      ['dużo usuniętych znaków', 'w tekście są znaki spoza listy (np. € albo litery obce)', 'dopisz je w Formatowanie → Ustawienia formatowania → „Dodatkowe dozwolone znaki”, potem „Formatuj ponownie”'],
      ['bardzo krótkie linie', 'tabela, spis treści, wykaz', 'jeśli to tabela – odrzuć albo wytnij ją z tekstu'],
      ['dużo cyfr', 'tabela liczb, załącznik', 'zwykle odrzuć: mało uczy języka'],
    ]],
    ['p', 'Statusy: <b>do sprawdzenia</b> (po formatowaniu), <b>zatwierdzony</b> (bierze udział w nauce, można go chwilowo wyłączyć), <b>odrzucony</b> (zostaje w bibliotece, ale nie uczy).'],
    ['link', 'regula-unicode', 'Opis każdej reguły z przykładem →'],
  ] },
  ruleSection('unicode', 'litery z ogonkiem zapisane jako dwa znaki: a\u0328 e\u0328 · ligatura: ﬁrma'),
  ruleSection('invisible', 'roszczenie majątkowe­owe​\tulega'),
  ruleSection('hyphenation', 'w ustawie przewi-\ndzianych'),
  ruleSection('pageNoise', 'Art. 1. Treść.\n©Kancelaria Sejmu\ns. 1/3\nArt. 2. Treść.\n©Kancelaria Sejmu\n- 2 -\nArt. 3. Treść.\n©Kancelaria Sejmu\n©Kancelaria Sejmu', [['p', 'Próg powtórzeń (domyślnie 4) ustawisz w „Nagłówek/stopka od”. W przykładzie stopka „©Kancelaria Sejmu” powtarza się 4 razy.']]),
  ruleSection('lineJoin', 'Art. 118. Jeżeli przepis szczególny nie\nstanowi inaczej, termin przedawnienia wynosi\nsześć lat.\n§ 2. Dla świadczeń okresowych\n– trzy lata;\n1) pierwszy punkt;\n2) drugi punkt.'),
  ruleSection('quotes', 'tzw. "umowa przedwstępna", czyli “zobowiązanie” i «pacta» ‘z góry’'),
  ruleSection('dashes', 'okresowe — trzy lata, cywilno‐prawny, 2020−2025, strona - druga'),
  ruleSection('punctuation', 'Czy to możliwe ?? Tak , oczywiście…( z wyjątkami )'),
  ruleSection('legalNotation', 'art.5 ust.2 pkt.3 lit.a §1 Dz.U. z 2024 r.'),
  ruleSection('charset', 'Opłata 100 € → zob. ✓ art. 5 😀', [['p', 'Lista dozwolonych: litery polskie i łacińskie, cyfry, spacja, koniec linii oraz <code>. , ; : ! ? ( ) [ ] „ ” \' - – § % / & * + = &lt; &gt; @ # °</code>. Dodatkowe znaki dopiszesz w Formatowanie → Ustawienia formatowania.']]),
  ruleSection('spaces', 'Art.  1.   Treść   przepisu.  \n\n\n\nArt. 2.'),
  ruleSection('dedupe', 'Przepis ogólny dotyczący wszystkich umów nazwanych.\nArt. 2.\nPrzepis ogólny dotyczący wszystkich umów nazwanych.'),
  { id: 'dozwolone-znaki', group: 'Formatowanie', title: 'Dodatkowe dozwolone znaki', topics: ['cleaner.extraChars', 'usuniete-znaki'], body: [
    ['p', 'Reguła „Dozwolone znaki” usuwa wszystko spoza listy. Jeśli raport pokazuje, że usunięto znak potrzebny (np. „€”, „ö” w nazwisku), dopisz go w zakładce Formatowanie → Ustawienia formatowania, jeden po drugim, bez spacji: <code>€öüé</code>. Potem kliknij „Formatuj wszystkie ponownie”.'],
    ['tip', 'Znaki dopisane tu trafiają też do słownika nowego modelu (przy nauce od zera), więc sieć będzie umiała je zapisać.'],
  ] },
  { id: 'progi', group: 'Formatowanie', title: 'Progi: nagłówki, powtórzenia, długość odpowiedzi', topics: ['cleaner.repeatMin', 'cleaner.dedupeMin', 'cleaner.maxAnswer'], body: [
    ['p', 'Progi nagłówków i powtórzeń ustawisz w Formatowanie → Ustawienia formatowania, a najdłuższą odpowiedź wzorcową w Rozmowy wzorcowe → Ustawienia rozmów wzorcowych.'],
    ['table', ['Ustawienie', 'Za mało', 'Za dużo'], [
      ['Nagłówek/stopka od N powtórzeń', 'usuwa prawdziwe zdania, które się powtarzają (np. „(uchylony)”)', 'nagłówki i stopki zostają w tekście'],
      ['Powtórzony akapit od N znaków', 'usuwa krótkie, ale potrzebne powtórzenia', 'długie powtórzone akapity uczą sieć na pamięć'],
      ['Najdłuższa odpowiedź wzorcowa', 'odrzuca dobre, rozbudowane odpowiedzi', 'długie odpowiedzi zajmują całe okno sieci i słabo się uczą'],
    ]],
  ] },

  { id: 'nauka', group: 'Nauka', title: 'Nauka na dokumentach', topics: ['nauka', 'nauka-dane', 'od-zera', 'dalsza-nauka'], body: [
    ['p', 'Sieć dostaje zatwierdzone dokumenty i w kółko zgaduje następny kawałek tekstu, poprawiając wagi po każdej pomyłce. 90% tekstu służy do nauki, 10% (koniec) do sprawdzania – na nim mierzy się postęp na tekście, którego sieć nie widziała.'],
    ['table', ['', 'Od zera', 'Dalsza nauka modelu'], [
      ['słownik tokenów', 'nowy, z aktualnych dokumentów', 'ten sam co w modelu'],
      ['budowa sieci', 'z ustawień', 'z modelu (nie da się zmienić)'],
      ['kiedy', 'pierwszy raz, zmiana budowy, dużo nowych dokumentów', 'doszło trochę dokumentów, chcesz douczyć'],
      ['tempo nauki', '0,003', 'lepiej mniejsze: 0,001'],
    ]],
    ['p', 'Na koniec, jeśli sieć zaczęła „uczyć się na pamięć” (błąd sprawdzający wzrósł), wagi wracają do najlepszego momentu.'],
    ['tip', 'Nauka liczy się w otwartej karcie przeglądarki. Możesz przechodzić między zakładkami, ale nie zamykaj karty.'],
  ] },
  { id: 'jednostka', group: 'Nauka', title: 'Jednostka tekstu: litery czy tokeny BPE', topics: ['pretrain.unit'], body: [
    ['p', 'Sieć nie widzi słów, tylko numery jednostek. Jednostką może być pojedyncza litera albo token BPE – częsty kawałek słowa zbudowany z dokumentów.'],
    ['ex', 'przedawnienia', 'przykładowo:\nlitery: p · r · z · e · d · a · w · n · i · e · n · i · a  (13 jednostek)\nBPE:    ·przed · awni · enia  (3 jednostki)'],
    ['table', ['', 'Litery', 'BPE 1024', 'BPE 2048'], [
      ['słownik', 'ok. 120', 'ok. 1150', 'ok. 2150'],
      ['tekstu w oknie 128', 'ok. 128 znaków', 'ok. 400 znaków', 'ok. 450 znaków'],
      ['kiedy', 'mało tekstu', 'domyślnie', 'dużo dokumentów (miliony znaków)'],
    ]],
  ] },
  { id: 'budowa-sieci', group: 'Nauka', title: 'Budowa sieci: warstwy, szerokość, głowy, okno', topics: ['pretrain.layers', 'pretrain.dim', 'pretrain.heads', 'pretrain.ctx', 'budowa', 'parametry'], body: [
    ['p', 'Transformer to stos jednakowych <b>warstw</b>. Każda ma <b>uwagę</b> (patrzy na wcześniejsze tokeny i wybiera, które są ważne) i małą sieć <b>MLP</b> (przetwarza to, co uwaga zebrała).'],
    ['table', ['Ustawienie', 'Co oznacza', 'Porównanie'], [
      ['Warstwy', 'ile razy tekst jest „przemyślany”', 'kolejne czytania tekstu – każde głębiej'],
      ['Szerokość', 'ile liczb opisuje każdy token', 'rozdzielczość: 64 to szkic, 256 to szczegóły'],
      ['Głowy uwagi', 'ile niezależnych spojrzeń wstecz ma warstwa', 'kilku czytelników: jeden śledzi podmiot, inny numer artykułu'],
      ['Okno', 'ile tokenów sieć widzi naraz', 'pamięć krótkotrwała: tyle tekstu (i rozmowy) ma przed oczami'],
    ]],
    ['p', '<b>Parametry</b> to liczba wag sieci. Domyślnie (4 warstwy × 128, BPE 1024) ok. 1 mln. Większa sieć potrafi więcej, ale potrzebuje więcej tekstu i czasu. Reguła kciuka: im więcej parametrów, tym więcej tekstu – przy zbyt małej ilości tekstu duża sieć szybko uczy się na pamięć (widać to na wykresie).'],
    ['table', ['Karta graficzna RTX 3050 6 GB', 'Rozsądnie', 'Uwagi'], [
      ['mało tekstu (< 1 mln znaków)', '4 × 128, okno 128', 'domyślne'],
      ['średnio (1–5 mln)', '6 × 192, okno 256', 'dłuższa pamięć rozmowy'],
      ['dużo (> 5 mln)', '8 × 256, okno 256–512', 'nauka trwa godziny'],
    ]],
    ['link', 'podglad-budowy', 'Podgląd budowy modelu →'],
  ] },
  { id: 'kroki-i-tempo', group: 'Nauka', title: 'Kroki i tempo nauki', topics: ['pretrain.steps', 'pretrain.lr', 'finetune.steps', 'finetune.lr'], body: [
    ['p', '<b>Krok</b> = sieć ogląda 16 losowych fragmentów tekstu i raz poprawia wagi. <b>Tempo</b> = jak mocno poprawia je po każdym kroku. Przez ostatnie 30% kroków tempo jest 5× mniejsze, żeby dopracować szczegóły.'],
    ['table', ['', 'Za małe', 'Za duże'], [
      ['Kroki', 'sieć nie zdąży się nauczyć (błąd wciąż spada)', 'uczy się na pamięć (błąd sprawdzający rośnie) – panel wróci do najlepszego momentu'],
      ['Tempo', 'nauka bardzo wolna', 'błąd skacze albo rośnie, sieć „zapomina” – szczególnie groźne przy dostrajaniu'],
    ]],
    ['tip', 'Patrz na wykres: jeśli pod koniec obie linie jeszcze wyraźnie spadają – zwiększ kroki. Jeśli złota (sprawdzająca) zaczyna rosnąć – kroków jest za dużo albo tekstu za mało.'],
  ] },
  { id: 'urzadzenie', group: 'Nauka', title: 'Karta graficzna czy procesor', topics: ['pretrain.device', 'finetune.device', 'komputer'], body: [
    ['table', ['', 'Karta graficzna (GPU)', 'Procesor WASM SIMD', 'Procesor JS'], [
      ['szybkość nauki', 'najszybciej (kilka–kilkadziesiąt razy)', 'średnio', 'najwolniej'],
      ['wymaga', 'Chrome/Edge z WebGPU', 'nowoczesnej przeglądarki', 'niczego'],
      ['wynik', 'ten sam', 'ten sam', 'ten sam'],
    ]],
    ['p', 'Rozmowa w czacie zawsze liczy się na procesorze: jedna odpowiedź to kilkadziesiąt milisekund, więc karta nie jest potrzebna. Gdy karty nie ma, panel sam przełącza naukę na procesor.'],
  ] },
  { id: 'wykres-bledu', group: 'Nauka', title: 'Przebieg: wykres błędu, próbka, pominięte znaki', topics: ['blad', 'przebieg', 'probka', 'pominiete-znaki'], body: [
    ['p', '<b>Błąd</b> mówi, jak bardzo sieć jest zaskoczona prawdziwym następnym tokenem. Niebieska linia: tekst do nauki. Złota: tekst sprawdzający (sieć go nie widzi przy nauce).'],
    ['table', ['Obraz na wykresie', 'Znaczenie'], [
      ['obie linie spadają razem', 'dobrze – sieć się uczy'],
      ['niebieska spada, złota stoi lub rośnie', 'uczenie na pamięć: za mało tekstu albo za duża sieć'],
      ['obie wyraźnie spadają do samego końca', 'można dać więcej kroków'],
      ['linie skaczą w górę', 'za duże tempo nauki'],
    ]],
    ['p', '<b>Próbka</b> to tekst pisany przez sieć co kilka sekund – najprostszy sposób, żeby zobaczyć postęp. Na początku to losowe znaki, potem słowa, potem zdania w stylu przepisów.'],
    ['p', '<b>Pominięte znaki</b> to znaki, których model nie zna (przy dalszej nauce albo dostrajaniu, gdy w nowych danych są znaki spoza słownika). Są po prostu pomijane.'],
  ] },
  { id: 'bity-na-znak', group: 'Nauka', title: 'Bity na znak', topics: ['bity-na-znak'], body: [
    ['p', 'Ile informacji sieć „traci” na każdą literę tekstu sprawdzającego. Mniej = lepiej. W odróżnieniu od samego błędu pozwala porównać modele z różnym słownikiem (litery i BPE).'],
    ['table', ['Bity na znak', 'Co to znaczy'], [
      ['ok. 6', 'zgadywanie na ślepo'], ['3–4', 'sieć zna częstotliwość liter i krótkie słowa'], ['2', 'pisze poprawne słowa i proste zdania'], ['1,2–1,6', 'dobra mała sieć: zdania w stylu dokumentów'], ['< 0,5', 'zwykle uczenie na pamięć (powtarzalne dane)'],
    ]],
  ] },

  { id: 'rozmowy-wzorcowe', group: 'Rozmowa', title: 'Rozmowy wzorcowe', topics: ['rozmowy-wzorcowe', 'format-pliku', 'wymiany'], body: [
    ['p', 'Przykłady pytań i poprawnych odpowiedzi. Na nich sieć uczy się formy odpowiedzi; wiedzę bierze z dokumentów i z samych przykładów.'],
    ['code', 'Ty: Ile wynosi podstawowy termin przedawnienia?\nAI: Sześć lat, a dla świadczeń okresowych trzy lata.\nTy: Od kiedy biegnie?\nAI: Od dnia, w którym roszczenie stało się wymagalne.\n\nTy: Czy najemca może wypowiedzieć umowę?\nAI: Tak, z zachowaniem terminów wypowiedzenia.'],
    ['list', ['każda kwestia w osobnej linii, ze znacznikiem na początku', 'rozmowy oddzielone pustą linią', 'zaczyna użytkownik, kończy AI, kwestie na przemian', 'linia bez znacznika dokleja się do poprzedniej kwestii']],
    ['p', '<b>Kilka wymian w jednej rozmowie</b> uczy sieć korzystać z kontekstu – drugie pytanie wyżej („Od kiedy biegnie?”) ma sens tylko po pierwszym.'],
    ['tip', 'Nie trzeba opisać wszystkich możliwych pytań. Lepiej 10 różnych sformułowań tego samego pytania niż 10 razy identyczne.'],
    ['link', 'porownanie-etapow', 'Czym rozmowa wzorcowa różni się od dostrajania →'],
  ] },
  { id: 'dostrajanie', group: 'Rozmowa', title: 'Dostrajanie', topics: ['dostrajanie', 'finetune-dane', 'od-ktorego-modelu', 'finetune.mask', 'finetune.valShare'], body: [
    ['p', 'Kopia wybranego modelu uczy się na rozmowach wzorcowych odpowiadać. Rozmowy są tasowane, a część (domyślnie 10%) odkładana do sprawdzania: na nich mierzymy, jak sieć radzi sobie z rozmowami, których nie widziała.'],
    ['table', ['Błąd liczony na', 'Czego uczy się sieć'], [['tylko odpowiedziach AI (maska)', 'odpowiadać – zalecane'], ['całej rozmowie', 'odpowiadać, ale też pisać pytania za użytkownika']]],
    ['table', ['Dostrajasz od', 'Kiedy'], [['modelu bazowego', 'pierwszy raz albo po nowej nauce na dokumentach'], ['modelu dostrojonego', 'kolejna runda po dodaniu nowych rozmów (np. z historii czatu)']]],
    ['tip', 'Przy kolejnej rundzie ucz na całym zestawie (starych i nowych rozmowach), nie tylko na nowych – inaczej sieć zapomni wcześniejsze odpowiedzi.'],
  ] },
  { id: 'czat', group: 'Rozmowa', title: 'Czat i jego ustawienia', topics: ['czat', 'oceny', 'chat.temp', 'chat.maxTokens', 'chat.turns', 'chat.save'], body: [
    ['p', 'Ikona w prawym dolnym rogu. Odpowiada aktywny model. Ustawienia rozmowy (temperatura, długość odpowiedzi, pamięć) są pod ⚙ w nagłówku okna czatu. Pod każdą odpowiedzią: <b>✓</b> dobra, <b>✎</b> popraw (wpisujesz poprawną), <b>✗</b> błędna.'],
    ['table', ['Temperatura', 'Zachowanie'], [['0,2', 'zawsze najpewniejsze słowa: powtarzalnie, czasem w kółko to samo'], ['0,6', 'domyślnie: pewnie, ale z odrobiną swobody'], ['1,0', 'odważnie: ciekawiej, ale więcej pomyłek']]],
    ['p', '<b>Pamięć rozmowy</b>: ile poprzednich wymian dołączać do pytania. Ograniczeniem jest okno modelu – przy oknie 128 tokenów zmieszczą się zwykle 1–2 wymiany.'],
    ['p', '<b>Najdłuższa odpowiedź</b>: limit tokenów jednej odpowiedzi (token BPE to średnio ok. 3 znaki).'],
  ] },
  { id: 'historia', group: 'Rozmowa', title: 'Historia rozmów i uczenie z rozmów', topics: ['historia', 'uczenie-z-rozmow', 'gotowe-do-zestawu'], body: [
    ['steps', [['Oceń', 'W czacie albo tutaj oznacz odpowiedzi jako dobre, popraw je albo oznacz jako błędne.'], ['Dodaj do zestawu', 'Do rozmowy wzorcowej trafiają kolejne wymiany od początku, dopóki odpowiedzi są dobre albo poprawione. Przed zapisem możesz je edytować.'], ['Dostrój ponownie', 'Nowa runda dostrajania nauczy sieć tych odpowiedzi.']]],
    ['ex', 'Ty: Ile wynosi termin?\nAI: Trzy lata.  ✎ → Sześć lat.\nTy: A dla okresowych?\nAI: Trzy lata.  ✓\nTy: A dla najmu?\nAI: Rok.  ✗', 'Do zestawu trafią dwie pierwsze wymiany\n(z poprawką „Sześć lat.”); trzecia nie, bo jest błędna.'],
  ] },

  { id: 'modele', group: 'Modele', title: 'Modele', topics: ['modele', 'aktywny-model', 'wersje-modelu', 'nauka-modelu'], body: [
    ['p', 'Każda nauka i każde dostrajanie zapisuje nowy model z wynikami (bity na znak, błąd), budową, danymi, z których powstał, i wersjami programu. <b>Aktywny</b> model odpowiada w czacie.'],
    ['tip', 'Porównuj bity na znak tylko między modelami tego samego rodzaju (bazowy z bazowym, dostrojony z dostrojonym), bo sprawdza się je na innym tekście.'],
  ] },
  { id: 'podglad-budowy', group: 'Modele', title: 'Podgląd budowy', topics: ['podglad-budowy'], body: [
    ['p', 'Kolumny to kolejne etapy przetwarzania tokenu: tokeny → embedding → (uwaga → MLP → wyjście) w każdej warstwie → następny token. Kółka to neurony – pokazane 12 najważniejszych w kolumnie. Linie to wagi: niebieskie dodatnie, złote ujemne, grubsze silniejsze.'],
    ['p', 'Najechanie na kółko podświetla jego połączenia. Linia przerywana u góry to połączenie omijające (residual): każda warstwa dopisuje swój wynik do wspólnego strumienia, zamiast go zastępować.'],
  ] },
  { id: 'github', group: 'Modele', title: 'GitHub: publikacja i wczytywanie', topics: ['github', 'github.repo', 'github.branch', 'token', 'publikacja', 'wczytaj-z-github', 'aktualny'], body: [
    ['steps', [
      ['Token', 'Utwórz go na github.com/settings/personal-access-tokens/new: dostęp tylko do repo AI, uprawnienie Contents: Read and write. Wpisz w Ustawienia → GitHub → Token i kliknij „Sprawdź dostęp”.'],
      ['Opublikuj', 'Modele → „Opublikuj na GitHub”. Powstaje jeden commit: plik models/&lt;id&gt;.json i lista models/index.json.'],
      ['Gotowe', 'Po ok. minucie model jest pod adresem GitHub Pages, np. …/AI/models/index.json – stamtąd pobierze go inna aplikacja (np. PiK) albo ten panel na innym komputerze („Wczytaj z GitHub”).'],
    ]],
    ['p', '<b>Aktualny</b> (index.json → active) to model, który inne aplikacje powinny brać domyślnie.'],
    ['tip', 'Token jest zapisany tylko w tej przeglądarce. Nie trafia do repo ani do plików modeli.'],
  ] },
  { id: 'gdzie-ustawienia', group: 'Ustawienia', title: 'Gdzie są ustawienia', topics: ['ustawienia'], body: [
    ['p', 'Każde ustawienie jest tam, gdzie działa:'],
    ['table', ['Ustawienia', 'Miejsce'], [['reguły formatowania, dodatkowe znaki, progi', 'Formatowanie → Ustawienia formatowania'], ['budowa sieci, kroki, tempo, karta graficzna', 'Nauka'], ['kroki, tempo, maska, rozmowy do sprawdzania', 'Dostrajanie'], ['najdłuższa odpowiedź wzorcowa', 'Rozmowy wzorcowe → Ustawienia rozmów wzorcowych'], ['temperatura, długość odpowiedzi, pamięć rozmowy, zapisywanie', '⚙ w oknie czatu'], ['nazwa asystenta, znaczniki rozmowy, GitHub', 'Ustawienia']]],
  ] },
  { id: 'ustawienia-ogolne', group: 'Ustawienia', title: 'Nazwa i znaczniki rozmowy', topics: ['general.name', 'general.userTag', 'general.botTag'], body: [
    ['p', 'Znaczniki to początek każdej kwestii w rozmowach wzorcowych i w kontekście czatu (domyślnie „Ty:” i „AI:”). Sieć po nich rozpoznaje, kto mówi, i wie, że po „AI:” ma odpowiedzieć.'],
    ['tip', 'Po zmianie znaczników trzeba dostroić model ponownie. Model dostrojony pamięta znaczniki, na których go uczono, i czat ich używa.'],
  ] },
  { id: 'dane-w-przegladarce', group: 'Ustawienia', title: 'Dane w tej przeglądarce i wersje', topics: ['dane-w-przegladarce', 'wersje'], body: [
    ['p', 'Dokumenty, rozmowy i modele są zapisane w bazie IndexedDB tej przeglądarki na tym komputerze. Wyczyszczenie danych strony w przeglądarce je usuwa. Modele zabezpieczysz plikiem albo publikacją na GitHub.'],
    ['p', 'Wersje: <b>program</b> (widoczna obok nazwy), <b>silnik</b> (budowa sieci – modele z innej wersji głównej się nie wczytają), <b>reguły formatowania</b> (zapisywana przy każdym dokumencie), <b>format pliku modelu</b>, <b>schemat bazy</b>.'],
  ] },
];

// temat → id działu
export const TOPIC = {};
for (const s of SECTIONS) { TOPIC[s.id] = s.id; (s.topics || []).forEach(t => { TOPIC[t] = s.id; }); }
