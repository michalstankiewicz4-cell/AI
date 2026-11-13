// Stan nauki i dostrajania, niezależny od zakładek: można przełączać zakładki w trakcie nauki,
// a po powrocie wykres i próbka są na miejscu. Po zakończeniu zapisuje model w bazie.

import { on, startJob, stopJob, currentJob, markLoaded } from './ai.js';
import { saveModel, nextName, bitsPerChar } from './models.js';
import { VERSIONS } from '../version.js';
import { uid } from './db.js';
import { log } from './log.js';

const NAME = { base: 'nauka', chat: 'dostrajanie' }, area = () => NAME[state.lastKind] || 'nauka';

export const state = { job: null, points: [], last: null, data: null, tok: null, sample: '', result: null, error: null, warns: [] };
const listeners = new Set();
export const onTraining = f => { listeners.add(f); return () => listeners.delete(f); };
const emit = () => listeners.forEach(f => f(state));

on('start', j => { Object.assign(state, { job: j, points: [], last: null, data: null, tok: null, sample: '', result: null, error: null, warns: [], _errToast: false }); emit(); });
on('tokprogress', m => { state.tok = m; emit(); });
on('data', m => { state.data = m; state.tok = null; emit(); });
on('warn', m => { state.warns.push(m.msg); log('warn', area(), m.msg); emit(); });
on('progress', m => {
  state.last = m;
  if (m.train != null || m.val != null) state.points.push({ step: m.step, train: m.train, val: m.val });
  if (m.sample != null) state.sample = m.sample;
  emit();
});
on('error', m => { if (m.jobId && state.job && m.jobId === state.job.jobId) { log('error', area(), 'Przerwano błędem: ' + m.msg, { krok: state.last && state.last.step, dane: state.data && { tokeny: state.data.tokens, V: state.data.V } }); state.error = m.msg; state.job = null; emit(); } });
on('done', async m => {
  const j = state.job; if (!j) return;
  state.sample = m.sample; state.last = m;
  const cpt = m.cpt || (state.data && state.data.cpt) || 1;
  const model = {
    id: j.newId, name: await nextName(j.kind), kind: j.kind, parent: j.from || null, createdAt: Date.now(),
    versions: { app: VERSIONS.app, engine: VERSIONS.engine, cleaner: VERSIONS.cleaner },
    hp: m.record.hp,
    metrics: { val: m.val, train: m.train, bpc: bitsPerChar(m.val, cpt), cpt, steps: m.step, bestStep: m.bestStep, restored: m.restored, stopped: m.stopped, device: m.device, ms: m.ms, seconds: Math.round(m.elapsed / 1000), ownVal: m.ownVal },
    data: { ...j.summary, tokens: state.data && state.data.tokens, V: state.data && state.data.V },
    sample: m.sample,
    record: m.record,
  };
  await saveModel(model);
  log(m.stopped ? 'warn' : 'info', area(), `${m.stopped ? 'Zatrzymano' : 'Zakończono'}: zapisano model „${model.name}” (krok ${m.step}, błąd sprawdzający ${m.val != null ? m.val.toFixed(3) : '–'}${m.restored ? ', przywrócono najlepszy moment' : ''})`, { metryki: model.metrics, dane: model.data });
  markLoaded(model.id);               // wątek trzyma już ten model w pamięci
  state.result = model; state.job = null;
  emit();
});

// kind: 'base' (nauka na dokumentach) albo 'chat' (dostrajanie); data: to, co dostaje wątek; summary: opis danych do metadanych modelu
export function start(cmd, kind, data, summary) {
  state.lastKind = kind;
  const newId = uid(kind === 'base' ? 'b_' : 'c_');
  const j = startJob(cmd, { ...data, newId, kind, summary });
  log('info', area(), `Start: ${kind === 'base' ? 'nauka' : 'dostrajanie'}${data.from ? ' od modelu ' + data.from : ' od zera'}`, { ustawienia: data.hp, dane: summary });
  return j;
}
export const stop = () => stopJob();
export const busy = () => !!currentJob();
