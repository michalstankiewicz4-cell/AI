// Dokumenty biurowe: Word (.docx), OpenDocument (.odt) i RTF → zwykły tekst, akapit w linii.
// Automatyczna numeracja list z Worda („1)”, „a)”) nie jest zapisana w treści pliku, więc jej nie ma w odczycie;
// numery wpisane ręcznie zostają. Stary format .doc (Word 97–2003) nie jest obsługiwany: zapisz go jako .docx albo PDF.

import { zipEntries, zipText } from './zip.js';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'' };
const unxml = s => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m);

// Word: akapity <w:p>, tekst w <w:t>, tabulator <w:tab/>, łamanie wiersza <w:br/>, komórki tabel jak akapity
export function docxXmlToText(xml) {
  const body = (xml.match(/<w:body[\s\S]*<\/w:body>/) || [xml])[0];
  const paras = body.match(/<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g) || [];
  return paras.map(p => {
    if (/<w:pStyle w:val="(TOC|Spistreci)/i.test(p)) return '';                      // spis treści pomijamy
    let t = '';
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:(tab|br|cr)\b[^>]*\/>/g)) t += m[1] != null ? unxml(m[1]) : m[2] === 'tab' ? '\t' : '\n';
    return t;
  }).join('\n');
}

// OpenDocument: akapity <text:p>, nagłówki <text:h>, spacje <text:s text:c="n"/>, tabulator, łamanie wiersza
export function odtXmlToText(xml) {
  const body = (xml.match(/<office:text[\s\S]*<\/office:text>/) || [xml])[0]
    .replace(/<text:note\b[\s\S]*?<\/text:note>/g, '');                              // przypisy (mają własne akapity) pomijamy
  const blocks = body.match(/<text:(p|h)\b[^>]*?(\/>|>[\s\S]*?<\/text:\1>)/g) || [];
  return blocks.map(b => unxml(b
    .replace(/<text:s(?:\s+text:c="(\d+)")?\s*\/>/g, (_, n) => ' '.repeat(+(n || 1)))
    .replace(/<text:tab\s*\/>/g, '\t').replace(/<text:line-break\s*\/>/g, '\n')
    .replace(/<[^>]+>/g, ''))).join('\n');
}

// RTF: tekst bez poleceń formatowania; \'xx w stronie kodowej z \ansicpg (domyślnie Windows-1250), \uN — Unicode
export function rtfToText(rtf) {
  const cp = (rtf.match(/\\ansicpg(\d+)/) || [])[1] || '1250';
  let dec; try { dec = new TextDecoder('windows-' + cp); } catch (_) { dec = new TextDecoder('windows-1250'); }
  const SKIP = /^(fonttbl|colortbl|stylesheet|info|pict|object|header|footer|headerl|headerr|footerl|footerr|listtable|listoverridetable|rsidtbl|generator|themedata|colorschememapping|datastore|latentstyles|xmlnstbl|\*)$/;
  let out = '', i = 0, depth = 0, skipDepth = -1, uc = 1, bytes = [];
  const flush = () => { if (bytes.length) { out += dec.decode(new Uint8Array(bytes)); bytes = []; } };
  while (i < rtf.length) {
    const c = rtf[i];
    if (c === '{') { depth++; i++; continue; }
    if (c === '}') { if (skipDepth === depth) skipDepth = -1; depth--; i++; continue; }
    if (c === '\\') {
      const m = /^\\([a-z]+)(-?\d+)? ?|^\\'([0-9a-f]{2})|^\\([^a-z])/i.exec(rtf.slice(i, i + 40));
      if (!m) { i++; continue; }
      i += m[0].length;
      if (skipDepth >= 0) continue;
      if (m[3]) { bytes.push(parseInt(m[3], 16)); continue; }
      flush();
      if (m[4]) { if (m[4] === '*') skipDepth = depth; else if (m[4] === '~') out += ' '; else if (m[4] === '_') out += '-'; else if ('\\{}'.includes(m[4])) out += m[4]; continue; }
      const w = m[1], n = m[2];
      if (SKIP.test(w) && rtf[i - m[0].length - 1] === '{') { skipDepth = depth; continue; }
      if (w === 'par' || w === 'line' || w === 'row') out += '\n';
      else if (w === 'tab' || w === 'cell') out += '\t';
      else if (w === 'uc') uc = +n;
      else if (w === 'u') { out += String.fromCharCode(n < 0 ? +n + 65536 : +n); for (let k = 0; k < uc && i < rtf.length; k++) i += rtf[i] === '\\' && rtf[i + 1] === '\'' ? 4 : 1; }
      continue;
    }
    if (skipDepth >= 0 || c === '\r' || c === '\n') { i++; continue; }
    flush(); out += c; i++;
  }
  flush();
  return out;
}

export async function readOffice(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (ext === 'doc') throw new Error('Stary format Word (.doc) nie jest obsługiwany. Otwórz plik w Wordzie albo LibreOffice i zapisz jako .docx (albo PDF), potem wgraj ponownie.');
  if (ext === 'rtf') return { name: file.name, type: 'rtf', encoding: 'RTF', raw: rtfToText(new TextDecoder('latin1').decode(await file.arrayBuffer())), size: file.size };
  const zip = zipEntries(await file.arrayBuffer());
  if (ext === 'docx') {
    const xml = await zipText(zip, 'word/document.xml');
    if (!xml) throw new Error('W pliku nie ma treści dokumentu Word (word/document.xml).');
    // przypisy dolne i końcowe pomijamy (zwykle odnośniki, nie treść przepisów)
    return { name: file.name, type: 'docx', encoding: 'Word', raw: docxXmlToText(xml), size: file.size };
  }
  const xml = await zipText(zip, 'content.xml');
  if (!xml) throw new Error('W pliku nie ma treści dokumentu OpenDocument (content.xml).');
  return { name: file.name, type: 'odt', encoding: 'OpenDocument', raw: odtXmlToText(xml), size: file.size };
}
