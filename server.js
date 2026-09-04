const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', true);
app.use(express.json());

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || null;

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'visits.json');
const MAX_CLICKS_PER_VISIT = 50;

/* ---------- storage (in-memory, persisted to a JSON file) ---------- */
const visits = new Map();

function loadVisits() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    JSON.parse(raw).forEach((v) => visits.set(v.id, v));
  } catch (err) {
    // no data file yet — start empty
  }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify([...visits.values()]));
    } catch (err) {
      console.error('visits.json yazılamadı:', err.message);
    }
  }, 2000);
}

loadVisits();

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress || 'bilinmiyor';
}

/* ---------- tracking API (public — called from script.js) ---------- */
app.post('/api/visit', (req, res) => {
  const id = crypto.randomUUID();
  const now = Date.now();
  visits.set(id, {
    id,
    ip: getClientIp(req),
    userAgent: (req.get('user-agent') || '').slice(0, 300),
    startedAt: now,
    lastSeenAt: now,
    clicks: [],
  });
  scheduleSave();
  res.json({ id });
});

app.post('/api/heartbeat', (req, res) => {
  const v = req.body && visits.get(req.body.id);
  if (v) {
    v.lastSeenAt = Date.now();
    scheduleSave();
  }
  res.status(204).end();
});

app.post('/api/click', (req, res) => {
  const { id, label } = req.body || {};
  const v = id && visits.get(id);
  if (v && label && v.clicks.length < MAX_CLICKS_PER_VISIT) {
    v.clicks.push({ label: String(label).slice(0, 200), at: Date.now() });
    v.lastSeenAt = Date.now();
    scheduleSave();
  }
  res.status(204).end();
});

/* ---------- admin panel (Basic Auth protected, not linked anywhere) ---------- */
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    res.status(503).send('Admin paneli henüz yapılandırılmadı: Railway değişkenlerine ADMIN_PASSWORD ekleyin.');
    return;
  }
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const user = sep === -1 ? decoded : decoded.slice(0, sep);
    const pass = sep === -1 ? '' : decoded.slice(sep + 1);
    if (safeCompare(user, ADMIN_USER) && safeCompare(pass, ADMIN_PASSWORD)) {
      return next();
    }
  }
  res.set('WWW-Authenticate', 'Basic realm="Fortify Admin"');
  res.status(401).send('Yetkisiz erişim.');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m} dk ${s} sn` : `${s} sn`;
}

function formatDate(ts) {
  return new Date(ts).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });
}

app.get('/admin', requireAdminAuth, (req, res) => {
  const rows = [...visits.values()].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  const totalClicks = rows.reduce((sum, v) => sum + v.clicks.length, 0);

  const tableRows = rows.map((v) => {
    const clicksHtml = v.clicks.length
      ? v.clicks.map((c) => `<span class="pill">${escapeHtml(c.label)}</span>`).join(' ')
      : '<span class="muted">—</span>';
    return `<tr>
      <td class="mono">${escapeHtml(v.ip)}</td>
      <td>${formatDate(v.startedAt)}</td>
      <td>${formatDate(v.lastSeenAt)}</td>
      <td>${formatDuration(v.lastSeenAt - v.startedAt)}</td>
      <td>${clicksHtml}</td>
    </tr>`;
  }).join('');

  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Fortify — Ziyaretçi Paneli</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px 24px 80px; background: #050506; color: #fff; font-family: system-ui, -apple-system, sans-serif; }
  h1 { font-size: 1.5rem; margin: 0 0 6px; }
  .sub { color: rgba(255,255,255,0.5); font-size: 0.9rem; margin-bottom: 28px; }
  .stats { display: flex; gap: 14px; margin-bottom: 28px; flex-wrap: wrap; }
  .stat { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 16px 22px; min-width: 140px; }
  .stat strong { display: block; font-size: 1.6rem; font-weight: 700; }
  .stat span { font-size: 0.8rem; color: rgba(255,255,255,0.5); }
  table { width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; overflow: hidden; }
  th, td { text-align: left; padding: 12px 16px; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.08); vertical-align: top; }
  th { text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.72rem; color: rgba(255,255,255,0.45); background: rgba(255,255,255,0.03); }
  tr:last-child td { border-bottom: none; }
  .mono { font-family: ui-monospace, Consolas, monospace; }
  .muted { color: rgba(255,255,255,0.3); }
  .pill { display: inline-block; background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.35); color: #93c5fd; border-radius: 999px; padding: 3px 10px; font-size: 0.76rem; margin: 2px 3px 2px 0; }
  .table-wrap { overflow-x: auto; }
  a.refresh { color: #93c5fd; font-size: 0.85rem; text-decoration: none; }
  a.refresh:hover { text-decoration: underline; }
</style>
</head>
<body>
  <h1>Fortify — Ziyaretçi Paneli</h1>
  <p class="sub">Bu sayfa herkese açık değildir ve siteden hiçbir yere bağlanmaz. <a class="refresh" href="/admin">Yenile</a></p>
  <div class="stats">
    <div class="stat"><strong>${rows.length}</strong><span>Toplam ziyaret</span></div>
    <div class="stat"><strong>${totalClicks}</strong><span>Toplam buton tıklaması</span></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>IP Adresi</th><th>İlk Görülme</th><th>Son Aktivite</th><th>Sitede Kalma Süresi</th><th>Tıkladığı Butonlar</th></tr></thead>
      <tbody>${tableRows || '<tr><td colspan="5" class="muted">Henüz ziyaretçi yok.</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`);
});

/* ---------- static site ---------- */
app.use(express.static(PUBLIC_DIR, { index: 'index.html' }));

app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Fortify sunucusu ${PORT} portunda çalışıyor.`);
});
