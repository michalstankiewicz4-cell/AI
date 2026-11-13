// Odczyt plików biurowych (docx, odt, rtf) i archiwów ZIP — bez przeglądarki.
import { deflateRawSync } from 'node:zlib';
import { zipEntries, zipText } from '../js/reader/zip.js';
import { docxXmlToText, odtXmlToText, rtfToText } from '../js/reader/office.js';

// najprostszy ZIP z jednym plikiem (kompresja deflate), jak w .docx
function makeZip(name, text) {
  const data = Buffer.from(text, 'utf8'), comp = deflateRawSync(data), nb = Buffer.from(name);
  const loc = Buffer.alloc(30); loc.writeUInt32LE(0x04034b50, 0); loc.writeUInt16LE(8, 8); loc.writeUInt32LE(comp.length, 18); loc.writeUInt32LE(data.length, 22); loc.writeUInt16LE(nb.length, 26);
  const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24); cen.writeUInt16LE(nb.length, 28); cen.writeUInt32LE(0, 42);
  const body = Buffer.concat([loc, nb, comp]), cd = Buffer.concat([cen, nb]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, cd, end]);
}

export default async function (t) {
  const docx = '<w:document><w:body><w:p><w:r><w:t>Art. 1. § 1. Umowa zostaje</w:t></w:r><w:r><w:t xml:space="preserve"> zawarta &amp; podpisana.</w:t></w:r></w:p><w:p><w:r><w:t>Druga</w:t><w:tab/><w:t>linia</w:t></w:r></w:p></w:body></w:document>';
  t.eq(docxXmlToText(docx), 'Art. 1. § 1. Umowa zostaje zawarta & podpisana.\nDruga\tlinia', 'Word: akapity, tabulator, encje');
  const zip = zipEntries(makeZip('word/document.xml', docx));
  t.eq(docxXmlToText(await zipText(zip, 'word/document.xml')), 'Art. 1. § 1. Umowa zostaje zawarta & podpisana.\nDruga\tlinia', 'ZIP: rozpakowanie deflate');
  t.eq(await zipText(zip, 'brak.xml'), null, 'ZIP: brak pliku');
  const odt = '<office:text><text:h>Rozdział 1</text:h><text:p>Art.<text:s/>2.<text:s text:c="2"/>Treść<text:note><text:p>przypis</text:p></text:note> przepisu.</text:p></office:text>';
  t.eq(odtXmlToText(odt), 'Rozdział 1\nArt. 2.  Treść przepisu.', 'OpenDocument: nagłówek, spacje, bez przypisów');
  const rtf = "{\\rtf1\\ansi\\ansicpg1250{\\fonttbl{\\f0 Arial;}}{\\*\\generator X;}\\f0 Art. 3. Termin przedawnienia wynosi sze\\'9c\\'e6 lat.\\par Zdanie \\u322?\\u261?cznie.\\par}";
  t.eq(rtfToText(rtf).trim(), 'Art. 3. Termin przedawnienia wynosi sześć lat.\nZdanie łącznie.', 'RTF: strona kodowa 1250, Unicode, bez tabel czcionek');
}
