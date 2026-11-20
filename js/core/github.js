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
import { log } from './log.js';

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

// Nazwa pliku modelu: nazwa (bez polskich znaków) + wersja programu, w której powstał + id, np. rozmowa-3-v0.4.0-c_abc12.json
export const slug = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
export const modelFileName = m => `models/${slug(m.name)}-v${(m.versions && m.versions.app) || '0'}-${m.id}.json`;

// Publikacja jednym commitem. what: { model, active, settings, documents, dialogs, conversations } — co wysłać;
// data: { settings, versions, documents, dialogs, dialogsText, conversations } — treść plików (zbiera core/sync.js → collect()).
export async function publish(model, cfg, what, data, onStep = () => {}) {
  try {
    const r = await publishRaw(model, cfg, what, data, onStep);
    log('info', 'github', `Opublikowano w ${cfg.repo} (${cfg.branch}): ${r.files.length} plików`, r.files.join('\n'));
    return r;
  } catch (e) { log('error', 'github', 'Publikacja nieudana: ' + e.message, `${cfg.repo} (${cfg.branch})`); throw e; }
}
async function publishRaw(model, { repo, branch }, what, data, onStep) {
  onStep('Sprawdzam repozytorium…');
  const ref = await gh(`/repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const head = await gh(`/repos/${repo}/git/commits/${ref.object.sha}`);
  const files = [], at = new Date().toISOString(), blob = async (path, text) => {
    onStep(`Wysyłam ${path}…`);
    const b = await gh(`/repos/${repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: utf8b64(text), encoding: 'base64' }) });
    files.push({ path, mode: '100644', type: 'blob', sha: b.sha });
  };
  let file = null;
  if (what.model && model) {
    file = modelFileName(model);
    // plik modelu zawiera też ustawienia i wersje z chwili publikacji
    await blob(file, JSON.stringify({ ...toFile(model), published: { at, settings: data.settings, versions: data.versions } }));
    const cur = await gh(`/repos/${repo}/contents/models/index.json?ref=${encodeURIComponent(branch)}`, { allow404: true });
    const index = cur ? JSON.parse(b64utf8(cur.content)) : { models: [], active: null };
    const entry = { id: model.id, name: model.name, kind: model.kind, file, createdAt: model.createdAt, publishedAt: at, versions: model.versions, publishedWith: data.versions, hp: model.hp, metrics: model.metrics, params: model.record.params };
    index.models = [entry, ...index.models.filter(m => m.id !== model.id)];
    if (what.active) index.active = model.id;
    index.updatedAt = at;
    await blob('models/index.json', JSON.stringify(index, null, 2) + '\n');
  }
  const meta = { publishedAt: at, versions: data.versions };
  if (what.settings) await blob('data/ustawienia.json', JSON.stringify({ ...meta, settings: data.settings }, null, 2) + '\n');
  if (what.documents) await blob('data/dokumenty.json', JSON.stringify({ ...meta, documents: data.documents }, null, 2) + '\n');
  if (what.dialogs) { await blob('data/rozmowy-wzorcowe.json', JSON.stringify({ ...meta, dialogs: data.dialogs }, null, 2) + '\n'); await blob('data/rozmowy-wzorcowe.txt', data.dialogsText); }
  if (what.conversations) await blob('data/historia-rozmow.json', JSON.stringify({ ...meta, conversations: data.conversations }, null, 2) + '\n');
  if (what.sources) await blob('data/zrodla.json', JSON.stringify({ ...meta, sources: data.sources }, null, 2) + '\n');
  if (what.packs) await blob('data/pakiety.json', JSON.stringify({ ...meta, packs: data.packs }, null, 2) + '\n');
  if (what.profiles) await blob('data/profile.json', JSON.stringify({ ...meta, profiles: data.profiles }, null, 2) + '\n');
  if (what.tagGroups) await blob('data/grupy-kategorii.json', JSON.stringify({ ...meta, tagGroups: data.tagGroups }, null, 2) + '\n');
  if (!files.length) throw new Error('Nic nie zaznaczono do wysłania.');
  onStep('Tworzę commit…');
  const parts = [what.model && model ? `model ${model.name}${what.active ? ' (aktualny)' : ''}` : null, what.settings && 'ustawienia', what.documents && 'dokumenty', what.dialogs && 'rozmowy wzorcowe', what.conversations && 'historia rozmów', what.sources && 'źródła', what.packs && 'pakiety', what.profiles && 'profile', what.tagGroups && 'grupy kategorii'].filter(Boolean);
  const tree = await gh(`/repos/${repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree: files }) });
  const commit = await gh(`/repos/${repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: `Publikacja z panelu AI ${data.versions.app}: ${parts.join(', ')}`, tree: tree.sha, parents: [ref.object.sha] }) });
  await gh(`/repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
  return { commit: commit.sha, file, files: files.map(f => f.path), url: commit.html_url };
}

// Czy repo jest publiczne (do ostrzeżenia przy wysyłaniu danych)
export async function repoInfo({ repo }) { const r = await gh(`/repos/${repo}`); return { private: r.private, name: r.full_name }; }

// Odczyt opublikowanych plików bez tokenu: najpierw z tej samej strony (GitHub Pages), potem z raw.githubusercontent.com.
// optional: brak pliku (404) daje null zamiast błędu.
export async function fetchPublished(path, { repo, branch }, { optional = false, text = false } = {}) {
  const urls = [new URL(path, location.href).href, `https://raw.githubusercontent.com/${repo}/${branch}/${path}`];
  let last, missing = 0;
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: 'no-store' });
      if (r.ok) return text ? await r.text() : await r.json();
      if (r.status === 404) missing++;
      last = new Error(`${u}: ${r.status}`);
    } catch (e) { last = e; }
  }
  if (optional && missing) return null;
  throw new Error('Nie udało się pobrać ' + path + (last ? ` (${last.message})` : ''));
}
export const publishedIndex = cfg => fetchPublished('models/index.json', cfg);
export async function downloadPublished(entry, cfg) { return fromFile(await fetchPublished(entry.file, cfg)); }
