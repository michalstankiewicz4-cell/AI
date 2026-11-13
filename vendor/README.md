# Biblioteki zewnętrzne

Skopiowane do repo, żeby panel działał bez zewnętrznych serwerów (także na GitHub Pages). Ładowane dopiero przy pierwszym wgraniu PDF albo obrazu.

| Folder | Biblioteka | Wersja | Licencja | Do czego |
|---|---|---|---|---|
| `tesseract/` | [Tesseract.js](https://github.com/naptha/tesseract.js) (`tesseract.min.js`, `worker.min.js`) | 7.0.0 | Apache-2.0 | OCR – rozpoznawanie tekstu ze skanów i zdjęć |
| `tesseract/core/` | [tesseract.js-core](https://github.com/naptha/tesseract.js-core) (wersje LSTM: bez SIMD, SIMD, relaxed SIMD — Tesseract wybiera sam według przeglądarki) | 7.0.0 | Apache-2.0 | silnik Tesseract w WebAssembly |
| `tesseract/lang/` | [@tesseract.js-data/pol](https://www.npmjs.com/package/@tesseract.js-data/pol) `4.0.0_best_int` | 1.0.0 | Apache-2.0 | model języka polskiego |
| `pdfjs/` | [pdf.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`: `pdf.min.mjs`, `pdf.worker.min.mjs`, `standard_fonts/`, `wasm/`) | 5.7.284 | Apache-2.0 | odczyt PDF: warstwa tekstowa i obraz strony do OCR |

Aktualizacja: `npm i tesseract.js tesseract.js-core pdfjs-dist @tesseract.js-data/pol` w osobnym folderze i skopiowanie tych samych plików. Po aktualizacji sprawdź `tests/e2e/ocr.e2e.mjs`.
