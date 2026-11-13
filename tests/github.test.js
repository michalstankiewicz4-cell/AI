// Publikacja na GitHub na atrapie API: jakie pliki trafiają do commita i jak wygląda models/index.json.
export default async function (t) {
  const store = { 'ai-prawo.githubToken': 'test' };
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; }, removeItem: k => { delete store[k]; } };
  const blobs = {}, calls = []; let tree = null, n = 0;
  globalThis.fetch = async (url, o = {}) => {
    const path = url.replace('https://api.github.com', ''), body = o.body ? JSON.parse(o.body) : null; calls.push((o.method || 'GET') + ' ' + path);
    const ok = j => ({ ok: true, status: 200, json: async () => j });
    if (path.includes('/git/ref/heads/')) return ok({ object: { sha: 'head' } });
    if (path.includes('/git/commits/head')) return ok({ tree: { sha: 'tree0' } });
    if (path.includes('/contents/models/index.json')) return { ok: false, status: 404, json: async () => ({}) };
    if (path.endsWith('/git/blobs')) { const sha = 'b' + (++n); blobs[sha] = Buffer.from(body.content, 'base64').toString('utf8'); return ok({ sha }); }
    if (path.endsWith('/git/trees')) { tree = body; return ok({ sha: 'tree1' }); }
    if (path.endsWith('/git/commits')) return ok({ sha: 'c1', html_url: 'https://github.com/x/y/commit/c1' });
    if (path.includes('/git/refs/heads/')) return ok({});
    throw new Error('nieoczekiwane ' + path);
  };
  const { publish, modelFileName, slug } = await import('../js/core/github.js');
  t.eq(slug('Rozmowa 3 – łódź Żółć'), 'rozmowa-3-lodz-zolc', 'nazwa pliku bez polskich znaków');
  const model = { id: 'c_ab12', name: 'Rozmowa 3', kind: 'chat', createdAt: 1, versions: { app: '0.4.0', engine: '1.0.0', cleaner: '1.0.0' }, hp: { layers: 2 }, metrics: { bpc: 1 },
    record: { hp: { layers: 2 }, chars: ['a'], tok: null, params: 4, tensors: [new Float32Array([1, 2, 3, 4])] } };
  t.eq(modelFileName(model), 'models/rozmowa-3-v0.4.0-c_ab12.json', 'wersja w nazwie pliku modelu');
  const data = { settings: { general: { name: 'X' } }, versions: { app: '0.4.0' }, documents: [{ name: 'd', text: 't' }], dialogs: [{ id: 'r_1', turns: [] }], dialogsText: 'Ty: a\nAI: b\n', conversations: [] };
  const r = await publish(model, { repo: 'o/r', branch: 'main' }, { model: true, active: true, settings: true, documents: false, dialogs: true, conversations: false }, data);
  t.eq(tree.tree.map(f => f.path).sort().join(','), 'data/rozmowy-wzorcowe.json,data/rozmowy-wzorcowe.txt,data/ustawienia.json,models/index.json,models/rozmowa-3-v0.4.0-c_ab12.json', 'do commita trafia tylko to, co zaznaczone');
  const file = JSON.parse(blobs[tree.tree.find(f => f.path.startsWith('models/rozmowa')).sha]);
  t.ok(file.published && file.published.settings.general.name === 'X' && file.published.versions.app === '0.4.0', 'plik modelu zawiera ustawienia i wersje');
  t.eq(file.format, 'ai-prawo-model', 'format pliku modelu');
  const index = JSON.parse(blobs[tree.tree.find(f => f.path === 'models/index.json').sha]);
  t.ok(index.active === 'c_ab12' && index.models[0].file === 'models/rozmowa-3-v0.4.0-c_ab12.json', 'index.json: aktualny model i plik');
  t.ok(!JSON.stringify(blobs).includes('"test"'), 'token nie trafia do żadnego pliku');
  t.eq(r.files.length, 5, 'wynik wymienia wysłane pliki (rozmowy wzorcowe: .json do wczytania i .txt do czytania)');
  let err = null; try { await publish(model, { repo: 'o/r', branch: 'main' }, {}, data); } catch (e) { err = e.message; }
  t.ok(err && err.includes('Nic nie zaznaczono'), 'pusty wybór zgłasza błąd');
}
