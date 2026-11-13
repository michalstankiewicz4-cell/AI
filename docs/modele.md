# Modele: plik, publikacja na GitHub, odczyt przez inne aplikacje

## Plik modelu (`formatVersion` 1)

```json
{
  "format": "ai-prawo-model",
  "formatVersion": 1,
  "id": "c_…", "name": "Rozmowa 3", "kind": "base | chat", "parent": "b_… | null",
  "createdAt": 1763050000000,
  "versions": { "app": "0.1.0", "engine": "1.0.0", "cleaner": "1.0.0" },
  "hp": { "layers": 4, "dim": 128, "heads": 4, "ctx": 128, "unit": "bpe1024", "steps": 4000, "lr": 0.003, "device": "gpu" },
  "metrics": { "val": 1.23, "bpc": 1.9, "steps": 4000, "…": "…" },
  "data": { "docs": 12, "chars": 900000, "dialogs": 0, "tags": { "user": "Ty:", "bot": "AI:" } },
  "sample": "…",
  "record": {
    "hp": { "…": "…" },
    "chars": ["\n", " ", "…"],
    "tok": { "merges": [[12, 40], "…"], "nBase": 118 } ,
    "tensors": ["<base64 Float32 little-endian>", "…"],
    "params": 1012345
  }
}
```

Kolejność tensorów: `Emb [V,d]`, `Pos [T,d]`, a dla każdej warstwy `g1, b1, Wqkv [d,3d], bqkv, Wp [d,d], bp, g2, b2, W1 [d,4d], c1, W2 [4d,d], c2`, na końcu `gf, bf, Wo [d,V], bo`. Model z innej wersji głównej silnika nie zostanie wczytany.

Model dostrojony zapamiętuje znaczniki rozmowy, na których go uczono (`data.tags`). Czat używa tych znaczników, nawet jeśli w ustawieniach są już inne.

## Podgląd budowy

*Modele → Podgląd budowy* (`js/ui/netview.js`) rysuje kolumny: tokeny → embedding → dla każdej warstwy uwaga, MLP i wyjście warstwy → następny token. W każdej kolumnie pokazanych jest 12 najważniejszych neuronów (o największej sumie wag wchodzących), a pozostałe opisuje podpis „+ N”. Linie pochodzą z prawdziwych wag: Emb, część wartości Wqkv, W1, W2 i Wo. Kolor oznacza znak wagi, grubość jej siłę. Linia przerywana u góry to połączenie omijające (residual).

## Publikacja na GitHub

Wszystko (dokumenty, rozmowy, historia, ustawienia, modele) jest zapisane lokalnie w przeglądarce. Na GitHub trafia tylko to, co zaznaczysz w oknie *Modele → Opublikuj na GitHub*. Wszystko idzie jednym commitem do repo z ustawień (domyślnie `michalstankiewicz4-cell/AI`, gałąź `main`):

| Checkbox | Plik | Zawartość |
|---|---|---|
| Model | `models/<nazwa>-v<wersja>-<id>.json` | plik modelu + `published: { at, settings, versions }` (ustawienia i wersje z chwili publikacji) |
| | `models/index.json` | lista opublikowanych modeli |
| Oznacz jako aktualny | `models/index.json` → `active` | model brany domyślnie przez inne aplikacje |
| Ustawienia i wersje | `data/ustawienia.json` | `{ publishedAt, versions, settings }`, bez tokenu |
| Dokumenty zatwierdzone | `data/dokumenty.json` | nazwa, opis, rodzaj, data, tekst po formatowaniu |
| Rozmowy wzorcowe | `data/rozmowy-wzorcowe.txt` | format do wczytania (`Ty: … / AI: …`) |
| Historia rozmów | `data/historia-rozmow.json` | rozmowy z czatu z ocenami i poprawkami |

`<wersja>` w nazwie pliku to wersja programu, w której model powstał (np. `models/rozmowa-3-v0.4.0-c_ab12.json`). Plik pobrany przyciskiem „Pobierz plik” ma tę samą nazwę.

**Uwaga:** repo AI jest publiczne (GitHub Pages w darmowym planie), więc dokumenty i rozmowy po wysłaniu są widoczne dla każdego, także w historii repo.

`models/index.json`:

```json
{
  "active": "c_…",
  "updatedAt": "2026-11-13T18:00:00.000Z",
  "models": [ { "id": "c_…", "name": "Rozmowa 3", "kind": "chat", "file": "models/rozmowa-3-v0.4.0-c_….json", "publishedAt": "…", "versions": {}, "publishedWith": {}, "hp": {}, "metrics": {}, "params": 1012345 } ]
}
```

### Token

Fine-grained personal access token: https://github.com/settings/personal-access-tokens/new

- *Repository access*: tylko repo AI,
- *Repository permissions → Contents*: Read and write.

Wpisuje się go w *Ustawienia → GitHub*. Jest zapisany wyłącznie w `localStorage` tej przeglądarki i nie trafia do plików modeli ani do repo.

## Odczyt przez inną aplikację

Po wdrożeniu GitHub Pages (około minuty po commicie):

```
https://michalstankiewicz4-cell.github.io/AI/models/index.json
https://michalstankiewicz4-cell.github.io/AI/models/<id>.json
```

Do uruchomienia modelu wystarczą pliki `js/engine/*` (wątek) i rekord z pliku z tensorami zdekodowanymi z base64 do `Float32Array`. Wątkowi wysyła się `load`, a potem `reply` (patrz [architektura.md](architektura.md#protokół-wątku)).
