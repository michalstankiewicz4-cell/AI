# Architektura

## Warstwy

```
panels/ + chat/  ──►  core/  ──►  engine/worker.js (wątek w tle)
     │                  │
     └──► ui/           └──► cleaner/   (formatowanie, czyste funkcje)
                        └──► IndexedDB (core/db.js)
```

- **`js/engine/`** – silnik sieci. Klasyczne skrypty ładowane w wątku przez `importScripts`. Nie zna panelu ani bazy: dostaje polecenia i odpowiada wiadomościami.
- **`js/cleaner/`** – formatowanie danych. Czyste funkcje bez DOM (poza `extract.js`, który parsuje HTML). Testowane w Node.
- **`js/core/`** – logika aplikacji bez interfejsu: baza (`db.js`), ustawienia (`settings.js`), klient wątku (`ai.js`), stan nauki (`training.js`), modele (`models.js`), korpus (`corpus.js`), rozmowy z czatu (`conversations.js`), GitHub (`github.js`).
- **`js/ui/`** – elementy interfejsu wielokrotnego użytku. Dymki przycisków są w `ui/tips.js` (według napisu na przycisku); `h()` dodaje je sama.
- **`js/panels/`** – zakładki. Każda eksportuje `{ id, title, icon, render(root, rerender) }`, a `render` może zwrócić funkcję sprzątającą.
- **`js/chat/widget.js`** – okno czatu, niezależne od zakładek (ustawienia rozmowy pod ⚙).
- **`js/help/content.js`** – treść Pomocy. Dział ma `id` i `topics`; `help(tekst, temat)` w panelu prowadzi do `#pomoc/<temat>`. Pola ustawień mają temat `grupa.pole`. Test `tests/help.test.js` pilnuje, żeby każdy temat miał dział.

Adresy: `#zakładka` albo `#zakładka/argument` (np. `#pomoc/formatowanie`, `#formatowanie/<id dokumentu>`). Zakładka dostaje argument jako trzeci parametr `render`. Pole `stage` (1 lub 2) koloruje zakładkę w menu.

Integracja z innym serwisem (np. PiK) powinna korzystać z `core/` i `engine/` bez `panels/`. Panel jest tylko jednym z klientów.

## Silnik

Pochodzi z GameLaboratory `labs/lang` (pliki `engine.js`, `wasm.js`, `gpu.js` i `bpe.js` skopiowane). Zmiany:

| Plik | Zmiana |
|---|---|
| `gpu.js` | Maskowanie celów w błędzie (cel < 0 → bez błędu i gradientu), więc dostrajanie też może liczyć się na GPU. `lastLoss` uśrednia tylko oceniane pozycje. |
| `worker.js` | Napisany od nowa: tylko transformer, nauka i dostrajanie na wspólnej pętli (GPU albo procesor), kilka modeli w pamięci według id, dalsza nauka istniejącego modelu, dostrajanie od dostrojonego, sprawdzanie znaczników, słownik poszerzony o znaki dopuszczane przez formatowanie. |
| `infer.js` | Nowy: generowanie z pamięcią kluczy i wartości uwagi (KV cache). Jeden token to ok. 12·d²·L mnożeń zamiast przeliczania całego okna. Wynik zgodny z pełnym przejściem (test w `tests/engine.test.js`). |

### Protokół wątku

Polecenia (`postMessage({cmd, …})`):

| cmd | dane | odpowiedź |
|---|---|---|
| `load` | `reqId, id, record` | `loaded` |
| `unload` | `reqId, id` | `unloaded` |
| `pretrain` | `jobId, newId, text, vocabChars, from?, hp` | `tokprogress`, `data`, `progress`…, `done` |
| `finetune` | `jobId, newId, from, dialogs, tags, hp` | `data`, `progress`…, `done` |
| `stop` | – | (nauka kończy się wiadomością `done` z `stopped: true`) |
| `reply` | `reqId, id, history, tags, temp, maxTokens, turns` | `reply {text, ms}` |
| `complete` | `reqId, id, prompt, temp, maxTokens` | `complete {text}` |
| `gpuinfo` | `reqId` | `gpuinfo {ok, name | msg}` |

Błędy wracają jako `error {msg, reqId?, jobId?}`.

`done.record` = `{ hp, chars, tok: {merges, nBase} | null, tensors: Float32Array[], params }` – to samo, co później przyjmuje `load`.

## Dane w przeglądarce

IndexedDB `ai-prawo`, magazyny: `documents`, `dialogs`, `conversations`, `models` i `kv` (ustawienia, aktywny model). Schemat ma wersję `VERSIONS.db`. Token GitHub jest osobno w `localStorage` (`ai-prawo.githubToken`).

## Rozmowa

Kontekst odpowiedzi to ostatnie `turns` wymian oraz bieżące pytanie, w formacie:

```
Ty: pytanie 1
AI: odpowiedź 1
Ty: bieżące pytanie
AI:
```

Sieć generuje do końca linii. Wiadomość użytkownika przechodzi przez to samo formatowanie co dane do nauki (`cleanLine`). Gdy kontekst nie mieści się w oknie, liczone jest ostatnie 3/4 okna.
