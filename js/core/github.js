// Publikacja modeli na GitHub i wczytywanie opublikowanych.
//
// Publikacja = jeden commit w repo (ustawienia → GitHub) przez Git Data API:
//   models/<id>.json   — plik modelu (format jak przy eksporcie, js/core/models.js)
//   models/index.json  — lista opublikowanych modeli i który jest aktualny („active”)
// Po wdrożeniu GitHub Pages model jest dostępny pod adresem strony, np. …/AI/models/index.json,
// skąd może go pobrać inna aplikacja (np. PiK) albo ten panel na innym komputerze.
//
// Token (fine-grained, tylko to repo, Contents: Read and write) trzymamy wyłącznie w localStorage tej przeglądarki.

import { toFile, fromFile } from './models.js';

const TOKEN_KEY = 'ai-prawo.githubToken';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; } };
export const setToken = t => { try { t ? localStorage.setItem(TOKEN_KEY, t.trim()) : localStorage.removeItem(TOKEN_KEY); } catch (_) { /* brak localStorage */ } };

async function gh(path, opts = {}) {
  const token = getToken();
  if (!token) throw new Error('Brak tokenu GitHub. Wpisz go w Ustawienia → GitHub.');
  const r = await fetch('https://api.github.com' + path, {
    ...opts, headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (r.status === 404 && opts.allow404) return null;
  if (!r.ok) {
    let msg = ''; try { msg = (await r.json()).message; } catch (_) { /* bez treści */ }
    if (r.status === 401) throw new Error('GitHub odrzucił token (401). Sprawdź, czy jest poprawny i nie wygasł.');
    if (r.status === 403 || r.status === 404) throw new Error(`GitHub: brak dostępu (${r.status}${msg ? ': ' + msg : ''}). Token musi mieć dostęp do tego repo z uprawnieniem Contents: Read and write.`);
    throw new Error(`GitHub ${r.status}: ${msg || r.statusText}`);
  }
  return r.json();
}
const utf8b64 = s => { const u = new TextEncoder().encode(s); let b = ''; for (let i = 0; i < u.length; i += 0x8000) b += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(b); };
const b64utf8 = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));

// Sprawdzenie tokenu i repo bez zmieniania czegokolwiek.
export async function testAccess({ repo, branch }) {
  const info = await gh(`/repos/${repo}`);
  if (!info.permissions || !info.permissions.push) throw new Error('Token widzi repo, ale nie może do niego zapisywać (brak uprawnienia Contents: Read and write).');
  await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  return info.full_name;
}

export async function publishModel(model, { repo, branch }, { makeActive = true, onStep = () => {} } = {}) {
  onStep('Sprawdzam repozytorium…');
  const ref = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const head = await gh(`/repos/${repo}/git/commits/${ref.object.sha}`);
  const cur = await gh(`/repos/${repo}/contents/models/index.json?ref=${encodeURIComponent(branch)}`, { allow404: true });
  const index = cur ? JSON.parse(b64utf8(cur.content)) : { models: [], active: null };
  const file = `models/${model.id}.json`, publishedAt = new Date().toISOString();
  onStep('Wysyłam plik modelu…');
  const blob = await gh(`/repos/${repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: utf8b64(JSON.stringify(toFile(model))), encoding: 'base64' }) });
  const entry = { id: model.id, name: model.name, kind: model.kind, file, createdAt: model.createdAt, publishedAt, versions: model.versions, metrics: model.metrics, params: model.record.params };
  index.models = [entry, ...index.models.filter(m => m.id !== model.id)];
  if (makeActive) index.active = model.id;
  index.updatedAt = publishedAt;
  const iblob = await gh(`/repos/${repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: utf8b64(JSON.stringify(index, null, 2) + '\n'), encoding: 'base64' }) });
  onStep('Tworzę commit…');
  const tree = await gh(`/repos/${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree: [
    { path: file, mode: '100644', type: 'blob', sha: blob.sha }, { path: 'models/index.json', mode: '100644', type: 'blob', sha: iblob.sha }] }) });
  const commit = await gh(`/repos/${repo}/git/commits`, { method: 'POST', body: JSON.stringify({
    message: `Model: ${model.name} (${model.kind === 'base' ? 'nauka na dokumentach' : 'dostrojony do rozmowy'})${makeActive ? ', aktualny' : ''}`, tree: tree.sha, parents: [ref.object.sha] }) });
  await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  return { commit: commit.sha, file, url: commit.html_url };
}

// Odczyt opublikowanych modeli bez tokenu: najpierw z tej samej strony (GitHub Pages), potem z raw.githubusercontent.com.
async function fetchPublished(path, { repo, branch }) {
  const urls = [new URL(path, location.href).href, `https://raw.githubusercontent.com/${repo}/${branch}/${path}`];
  let last;
  for (const u of urls) {
    try { const r = await fetch(u, { cache: 'no-store' }); if (r.ok) return await r.json(); last = new Error(`${u}: ${r.status}`); } catch (e) { last = e; }
  }
  throw new Error('Nie udało się pobrać ' + path + (last ? ` (${last.message})` : ''));
}
export const publishedIndex = cfg => fetchPublished('models/index.json', cfg);
export async function downloadPublished(entry, cfg) { return fromFile(await fetchPublished(entry.file, cfg)); }
