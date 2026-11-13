// Testy silnika (js/engine): nauka, szybkie generowanie, dostrajanie z maskowaniem, odpowiedź.
// Wątek uruchamiany w Node w izolowanym kontekście (vm), tak jak w przeglądarce (importScripts).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../js/engine/', import.meta.url);
function workerContext() {
  const msgs = [];
  const ctx = { console, performance, setTimeout, WebAssembly, TextDecoder, msgs,
    atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64') };
  ctx.self = ctx; ctx.postMessage = m => msgs.push(m);
  ctx.importScripts = (...f) => f.forEach(x => vm.runInContext(readFileSync(new URL(x, dir), 'utf8'), ctx, { filename: x }));
  vm.createContext(ctx);
  vm.runInContext(readFileSync(new URL('worker.js', dir), 'utf8'), ctx, { filename: 'worker.js' });
  const send = c => ctx.onmessage({ data: c });
  const wait = pred => new Promise((res, rej) => { const t0 = Date.now(); const iv = setInterval(() => { const m = msgs.find(pred); if (m) { clearInterval(iv); res(m); } else if (Date.now() - t0 > 240000) { clearInterval(iv); rej(new Error('timeout')); } }, 20); });
  return { ctx, send, wait };
}

export default async function (t) {
  const W = workerContext(), tags = { user: 'Ty:', bot: 'AI:' };
  let text = ''; for (let i = 0; i < 60; i++) text += `Art. ${i}. Kodeks reguluje stosunki cywilnoprawne. § 1. Umowa zostaje zawarta, gdy strony złożą zgodne oświadczenia woli. Termin przedawnienia wynosi sześć lat.\n`;
  W.send({ cmd: 'pretrain', jobId: 'p', newId: 'b', text, vocabChars: 'AITy:', hp: { unit: 'bpe256', layers: 2, dim: 32, heads: 4, ctx: 32, steps: 120, lr: .003, device: 'wasm', batch: 16 } });
  const p = await W.wait(m => (m.type === 'done' && m.jobId === 'p') || m.type === 'error');
  t.eq(p.type, 'done', 'nauka kończy się bez błędu ' + (p.msg || ''));
  t.ok(p.val < 1.5, 'błąd sprawdzający spada: ' + p.val);
  t.eq(p.record.tensors.length, 2 + 2 * 12 + 4, 'liczba tensorów modelu');

  // szybkie generowanie (pamięć KV) liczy to samo co pełne przejście sieci
  const diff = vm.runInContext(`(() => { const m = models.get('b').m, net = inferenceNet(m), ids = m.tok.encode('Art. 2. Umowa zostaje');
    let lg; for (const t of ids) lg = net.step(t); const full = m.forward(Int32Array.from(ids), 1, ids.length).d, V = m.chars.length, o = (ids.length - 1) * V;
    let mx = 0; for (let j = 0; j < V; j++) mx = Math.max(mx, Math.abs(full[o + j] - lg[j])); return mx; })()`, W.ctx);
  t.ok(diff < 1e-4, 'generowanie z pamięcią KV = pełne przejście (różnica ' + diff + ')');

  const dialogs = Array.from({ length: 20 }, () => [{ role: 'user', text: 'Ile wynosi termin przedawnienia?' }, { role: 'bot', text: 'Termin przedawnienia wynosi sześć lat.' }]);
  W.send({ cmd: 'finetune', jobId: 'f', newId: 'c', from: 'b', dialogs, tags, hp: { steps: 100, lr: .001, device: 'wasm', mask: 1, batch: 16 } });
  const f = await W.wait(m => (m.type === 'done' && m.jobId === 'f') || (m.type === 'error' && m.jobId === 'f'));
  t.eq(f.type, 'done', 'dostrajanie kończy się bez błędu ' + (f.msg || ''));
  t.ok(f.val < .3, 'błąd na odpowiedziach po dostrojeniu: ' + f.val);

  W.send({ cmd: 'reply', reqId: 1, id: 'c', history: [{ role: 'user', text: 'Ile wynosi termin przedawnienia?' }], tags, temp: .3, maxTokens: 60, turns: 2 });
  const r = await W.wait(m => m.type === 'reply' || (m.type === 'error' && m.reqId === 1));
  t.eq(r.text, 'Termin przedawnienia wynosi sześć lat.', 'odpowiedź po dostrojeniu');

  // znacznik ze znakiem spoza słownika: czytelny błąd zamiast cichego zepsucia maski
  W.send({ cmd: 'finetune', jobId: 'g', newId: 'd', from: 'b', dialogs, tags: { user: 'Pytanie→', bot: 'AI:' }, hp: { steps: 10, lr: .001, device: 'wasm', mask: 1 } });
  const g = await W.wait(m => m.jobId === 'g' && (m.type === 'error' || m.type === 'done'));
  t.ok(g.type === 'error' && g.msg.includes('Znacznik'), 'nieznany znak w znaczniku zgłaszany');
}
