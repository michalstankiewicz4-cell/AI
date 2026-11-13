// Minimalny odczyt archiwów ZIP (pliki .docx i .odt to ZIP z plikami XML). Bez bibliotek:
// spis plików z katalogu centralnego, rozpakowanie przez wbudowane DecompressionStream('deflate-raw').

const u16 = (b, o) => b[o] | (b[o + 1] << 8), u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

export function zipEntries(buf) {
  const b = new Uint8Array(buf);
  let e = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (u32(b, i) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('To nie jest poprawny plik (brak struktury ZIP).');
  const n = u16(b, e + 10), out = new Map(); let p = u32(b, e + 16);
  for (let k = 0; k < n; k++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('Uszkodzony plik (katalog ZIP).');
    const method = u16(b, p + 10), csize = u32(b, p + 20), nlen = u16(b, p + 28), xlen = u16(b, p + 30), clen = u16(b, p + 32), local = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nlen));
    out.set(name, { method, csize, local });
    p += 46 + nlen + xlen + clen;
  }
  return { b, entries: out };
}

export async function zipText(zip, name) {
  const e = zip.entries.get(name);
  if (!e) return null;
  const b = zip.b, o = e.local, start = o + 30 + u16(b, o + 26) + u16(b, o + 28), data = b.subarray(start, start + e.csize);
  let raw;
  if (e.method === 0) raw = data;
  else if (e.method === 8) raw = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  else throw new Error(`Nieobsługiwana kompresja w pliku (${e.method}).`);
  return new TextDecoder('utf-8').decode(raw);
}
