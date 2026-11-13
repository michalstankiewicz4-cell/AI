// Ikonka pliku: kartka z zagiętym rogiem i etykietą rodzaju (TXT, HTML, MD, wklejony tekst).

const KINDS = {
  text: { label: 'TXT', color: '#4f6fa8' },
  html: { label: 'HTML', color: '#d0702c' },
  markdown: { label: 'MD', color: '#2f8f6a' },
  docx: { label: 'DOCX', color: '#2b579a' },
  odt: { label: 'ODT', color: '#1f7a8c' },
  rtf: { label: 'RTF', color: '#6b6f80' },
  pdf: { label: 'PDF', color: '#c0392b' },
  obraz: { label: 'IMG', color: '#a2477f' },
  wklejony: { label: 'TEKST', color: '#7b5ab8' },
};

export function fileIcon(type) {
  const k = KINDS[type] || KINDS.text, s = document.createElement('span');
  s.className = 'fileicon'; s.title = { text: 'Plik tekstowy', html: 'Strona HTML', markdown: 'Plik Markdown', docx: 'Dokument Word', odt: 'Dokument OpenDocument (LibreOffice)', rtf: 'Dokument RTF', pdf: 'Plik PDF', obraz: 'Obraz (OCR)', wklejony: 'Wklejony tekst' }[type] || 'Plik';
  s.innerHTML = `<svg viewBox="0 0 34 40" width="34" height="40" aria-hidden="true">
    <path d="M3 2h20l9 9v26a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="var(--panel)" stroke="var(--line-2)" stroke-width="1.5"/>
    <path d="M23 2v8a1 1 0 0 0 1 1h8" fill="var(--panel-2)" stroke="var(--line-2)" stroke-width="1.5"/>
    <path d="M7 17h16M7 21h20M7 25h14" stroke="var(--line-2)" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="0" y="28" width="${k.label.length > 3 ? 34 : 26}" height="10" rx="2" fill="${k.color}"/>
    <text x="${k.label.length > 3 ? 17 : 13}" y="35.6" text-anchor="middle" font-family="system-ui,sans-serif" font-size="7" font-weight="700" fill="#fff">${k.label}</text></svg>`;
  return s;
}
