// Formatowanie danych · odczyt plików: kodowanie znaków i wyciąganie tekstu z HTML i Markdown.
//
// Polskie pliki .txt bywają zapisane w Windows-1250 albo ISO-8859-2. Najpierw próbujemy UTF-8;
// jeśli wyjdą znaki zastępcze (�), próbujemy kodowań polskich i bierzemy to, które daje najwięcej polskich liter.

export const ACCEPT = '.txt,.md,.markdown,.html,.htm,text/plain,text/markdown,text/html';

const PL = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
function decode(buf) {
  const utf = new TextDecoder('utf-8').decode(buf);
  const bad = (utf.match(/�/g) || []).length;
  if (!bad) return { text: utf, encoding: 'UTF-8' };
  let best = { text: utf, encoding: 'UTF-8', score: (utf.match(PL) || []).length - bad * 5 };
  for (const enc of ['windows-1250', 'iso-8859-2']) {
    try { const t = new TextDecoder(enc).decode(buf), s = (t.match(PL) || []).length; if (s > best.score) best = { text: t, encoding: enc, score: s }; } catch (_) { /* przeglądarka nie zna kodowania */ }
  }
  return { text: best.text, encoding: best.encoding };
}

// HTML → tekst: bez skryptów, stylów, menu i stopek; bloki (akapity, nagłówki, punkty list) w osobnych liniach.
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button').forEach(e => e.remove());
  const root = doc.querySelector('main, article') || doc.body;
  const BLOCK = /^(P|DIV|H[1-6]|LI|TR|BR|SECTION|ARTICLE|BLOCKQUOTE|PRE|DT|DD|TABLE|UL|OL)$/;
  const out = [];
  const walk = n => {
    if (n.nodeType === 3) { out.push(n.nodeValue.replace(/\s+/g, ' ')); return; }
    if (n.nodeType !== 1) return;
    const block = BLOCK.test(n.tagName);
    if (block) out.push('\n');
    n.childNodes.forEach(walk);
    if (block) out.push('\n');
  };
  walk(root);
  return out.join('').replace(/[ ]*\n[ ]*/g, '\n').replace(/\n{3,}/g, '\n\n');
}

// Markdown → tekst: bez znaczników formatowania, linki zostają jako sam opis.
export function markdownToText(md) {
  return md
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^*])\*(?!\s)([^*\n]+)\*/g, '$1$2')
    .replace(/^\s*[-*+]\s+/gm, '– ')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '');
}

export async function readFile(file) {
  const buf = await file.arrayBuffer();
  const { text, encoding } = decode(buf);
  const name = file.name, ext = (name.split('.').pop() || '').toLowerCase();
  const type = /^html?$/.test(ext) || /^\s*<(!doctype|html)/i.test(text) ? 'html' : /^(md|markdown)$/.test(ext) ? 'markdown' : 'text';
  const plain = type === 'html' ? htmlToText(text) : type === 'markdown' ? markdownToText(text) : text;
  return { name, type, encoding, raw: plain, size: file.size };
}
