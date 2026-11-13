// Wykres błędu w trakcie nauki: błąd na tekście do nauki i na tekście sprawdzającym, oś X = kroki.

export function drawLoss(canvas, points, steps) {
  const dpr = window.devicePixelRatio || 1, W = canvas.clientWidth || 600, H = canvas.clientHeight || 220;
  if (canvas.width !== W * dpr || canvas.height !== H * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
  const c = canvas.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
  const css = getComputedStyle(canvas), ink = css.getPropertyValue('--ink-3') || '#888', grid = css.getPropertyValue('--line') || '#ddd';
  const cT = css.getPropertyValue('--accent') || '#36c', cV = css.getPropertyValue('--gold') || '#c90';
  const L = 44, R = 10, T = 10, B = 24, pw = W - L - R, ph = H - T - B;
  const vals = points.flatMap(p => [p.train, p.val]).filter(v => v != null && isFinite(v));
  c.font = '11px system-ui, sans-serif'; c.fillStyle = ink;
  if (!vals.length) { c.fillText('Wykres pojawi się po rozpoczęciu nauki.', L, T + ph / 2); return; }
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < .05) { hi += .05; lo -= .05; }
  const pad = (hi - lo) * .08; lo = Math.max(0, lo - pad); hi += pad;
  const sx = s => L + pw * (s / Math.max(1, steps)), sy = v => T + ph * (1 - (v - lo) / (hi - lo));
  c.strokeStyle = grid; c.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const v = lo + (hi - lo) * i / 4, y = sy(v); c.beginPath(); c.moveTo(L, y); c.lineTo(W - R, y); c.stroke(); c.fillText(v.toFixed(2).replace('.', ','), 4, y + 4); }
  for (let i = 0; i <= 4; i++) { const s = Math.round(steps * i / 4), x = sx(s); c.fillText(String(s), Math.min(x - 8, W - R - 30), H - 6); }
  const line = (key, col, w) => {
    c.strokeStyle = col.trim(); c.lineWidth = w; c.beginPath(); let started = false;
    for (const p of points) { const v = p[key]; if (v == null) continue; const x = sx(p.step), y = sy(v); started ? c.lineTo(x, y) : c.moveTo(x, y); started = true; }
    c.stroke();
  };
  line('train', cT, 1.5); line('val', cV, 2);
}
