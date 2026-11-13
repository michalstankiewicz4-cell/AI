// Klient silnika: jeden wątek w tle (js/engine/worker.js) dla całego panelu i czatu.
//
// request(cmd, data)  → Promise z odpowiedzią (load, unload, reply, gpuinfo)
// startJob(cmd, data) → nauka/dostrajanie; postęp przez on('progress' | 'data' | 'tokprogress' | 'done' | 'error' | 'warn')
// ensureLoaded(id)    → wczytuje model z bazy do wątku, jeśli jeszcze go tam nie ma

import { db } from './db.js';

const worker = new Worker(new URL('../engine/worker.js', import.meta.url));
const pending = new Map(), handlers = {}, loaded = new Set();
let seq = 0, job = null;

worker.onmessage = e => {
  const m = e.data;
  if (m.reqId != null && pending.has(m.reqId)) {
    const p = pending.get(m.reqId); pending.delete(m.reqId);
    if (m.type === 'error') p.rej(new Error(m.msg)); else p.res(m);
    return;
  }
  if (m.type === 'done' || m.type === 'error') job = null;
  (handlers[m.type] || []).forEach(f => f(m));
};

export const on = (type, f) => { (handlers[type] ||= []).push(f); return () => handlers[type] = handlers[type].filter(x => x !== f); };
export function request(cmd, data = {}, transfer) {
  const reqId = ++seq;
  return new Promise((res, rej) => { pending.set(reqId, { res, rej }); worker.postMessage({ cmd, reqId, ...data }, transfer || []); });
}
export function startJob(cmd, data) {
  if (job) throw new Error('Trwa już nauka albo dostrajanie.');
  job = { cmd, jobId: 'j' + (++seq), startedAt: Date.now(), ...data };
  worker.postMessage({ cmd, jobId: job.jobId, ...data });
  (handlers.start || []).forEach(f => f(job));
  return job;
}
export const currentJob = () => job;
export const stopJob = () => worker.postMessage({ cmd: 'stop' });

export async function ensureLoaded(id) {
  if (loaded.has(id)) return;
  const rec = await db.get('models', id);
  if (!rec) throw new Error('Nie ma takiego modelu w bazie.');
  await request('load', { id, record: rec.record });
  loaded.add(id);
}
export function markLoaded(id) { loaded.add(id); }
export async function unload(id) { if (loaded.delete(id)) await request('unload', { id }); }

let gpu = null;
export async function gpuInfo() { if (!gpu) gpu = request('gpuinfo').catch(e => ({ ok: false, msg: e.message })); return gpu; }
