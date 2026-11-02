// Vercel Function: login per tim + simpan/ambil data per depo × tim × slot di Vercel Blob.
// Env: PASS_RINCHA (tim Arjuna; DASH_PASSWORD lama juga dikenali), PASS_ECI (tim Bima), BLOB_READ_WRITE_TOKEN.
import { put, list, del } from '@vercel/blob';
import { timingSafeEqual } from 'node:crypto';

const PREFIX = 'sales-data/';
const TEAMS = ['arjuna', 'bima'];
const DEPOTS = ['kebayoran', 'kapuk'];
const SLOTS = ['main', 'sku', 'prog'];

const passFor = (team) => (team === 'arjuna' ? process.env.PASS_RINCHA || process.env.DASH_PASSWORD || '' : team === 'bima' ? process.env.PASS_ECI || '' : '');
function authOk(team, pass) {
  const want = passFor(team);
  if (!want) return false;
  const a = Buffer.from(String(pass || ''));
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const config = { api: { bodyParser: { sizeLimit: '4.4mb' } } };

// nama file: sales-data/<depo>/<tim>/<slot>-<acak>.json | sales-data/<depo>/skudb-<acak>.json | data lama: sales-data/<tim>-<acak>.json (= Kebayoran, slot main)
function classify(pathname) {
  const p = pathname.replace(PREFIX, '');
  const parts = p.split('/');
  if (parts.length === 3) return { depot: parts[0], team: parts[1], slot: parts[2].split('-')[0].replace('.json', '') };
  if (parts.length === 2 && parts[1].startsWith('skudb')) return { depot: parts[0], team: '*', slot: 'skudb' };
  const legacy = TEAMS.find((t) => parts[0].startsWith(t)) || (parts[0].startsWith('data') ? 'arjuna' : null);
  return legacy ? { depot: 'kebayoran', team: legacy, slot: 'main', legacy: true } : null;
}

const latest = (arr) => [...arr].sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))[0];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const q = req.query || {};
  try {
    if (q.action === 'ping') {
      return res.status(200).json({ ok: true, configured: { arjuna: !!passFor('arjuna'), bima: !!passFor('bima') } });
    }
    if (q.action === 'login') {
      const { team, pass } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      if (!TEAMS.includes(team)) return res.status(400).json({ error: 'Tim tidak dikenal' });
      if (!passFor(team)) return res.status(500).json({ error: team === 'bima' ? 'Env PASS_ECI belum di-set di Vercel' : 'Env PASS_RINCHA (atau DASH_PASSWORD) belum di-set di Vercel' });
      if (!authOk(team, pass)) return res.status(401).json({ error: 'Password salah' });
      return res.status(200).json({ ok: true, team });
    }

    const team = String(req.headers['x-team'] || '');
    const pass = String(req.headers['x-pass'] || '');
    const depot = String(q.depot || '');
    if (!TEAMS.includes(team)) return res.status(401).json({ error: 'Belum login' });
    if (!passFor(team)) return res.status(500).json({ error: 'Password tim ini belum di-set di Vercel' });
    if (!authOk(team, pass)) return res.status(401).json({ error: 'Password salah' });
    if (!DEPOTS.includes(depot)) return res.status(400).json({ error: 'Depo tidak valid' });

    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: PREFIX });
      const mine = blobs.map((b) => ({ b, c: classify(b.pathname) })).filter((x) => x.c && x.c.depot === depot);
      const out = { main: null, sku: null, prog: null, skudb: null };
      for (const slot of [...SLOTS, 'skudb']) {
        const cands = mine.filter((x) => x.c.slot === slot && (slot === 'skudb' || x.c.team === team));
        if (!cands.length) continue;
        const r = await fetch(latest(cands.map((x) => x.b)).url, { cache: 'no-store' });
        out[slot] = await r.json();
      }
      return res.status(200).json(out);
    }

    if (req.method === 'PUT' || req.method === 'POST' || req.method === 'DELETE') {
      const slot = String(q.slot || '');
      if (![...SLOTS, 'skudb'].includes(slot)) return res.status(400).json({ error: 'Slot tidak valid' });
      const dir = slot === 'skudb' ? `${PREFIX}${depot}/` : `${PREFIX}${depot}/${team}/`;
      const match = (c) => c && c.depot === depot && c.slot === slot && (slot === 'skudb' || c.team === team);

      if (req.method === 'DELETE') {
        const { blobs } = await list({ prefix: PREFIX });
        const old = blobs.filter((b) => match(classify(b.pathname))).map((b) => b.url);
        if (old.length) await del(old);
        return res.status(200).json({ ok: true });
      }
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      if (!body || body.length < 20) return res.status(400).json({ error: 'Data kosong' });
      const saved = await put(`${dir}${slot}.json`, body, { access: 'public', addRandomSuffix: true, contentType: 'application/json' });
      const { blobs } = await list({ prefix: PREFIX });
      const old = blobs.filter((b) => b.url !== saved.url && match(classify(b.pathname))).map((b) => b.url);
      if (old.length) await del(old);
      return res.status(200).json({ ok: true, bytes: body.length });
    }
    return res.status(405).json({ error: 'Method tidak didukung' });
  } catch (e) {
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
