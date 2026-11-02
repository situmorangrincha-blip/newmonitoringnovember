// Penyimpanan per depo × tim × slot + login per tim.
// Cloud (Vercel Function + Blob) kalau backend ada; kalau tidak (dev lokal) pakai IndexedDB browser tanpa password.
export const DEPOTS = [
  { id: 'kebayoran', label: 'SP Kebayoran', short: 'Kebayoran' },
  { id: 'kapuk', label: 'Depo Kapuk', short: 'Kapuk' },
];
export const TEAMS = [
  { id: 'arjuna', label: 'Arjuna', desc: 'Snack' },
  { id: 'bima', label: 'Bima', desc: 'Beverages' },
];
export const depotLabel = (id) => DEPOTS.find((d) => d.id === id)?.label || id;
export const teamLabel = (id) => TEAMS.find((t) => t.id === id)?.label || id;
export const SLOTS = ['main', 'sku', 'prog'];

const DB = 'sales-monitor';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function localGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); });
}
async function localSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); if (v == null) tx.objectStore('kv').delete(k); else tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

const auth = { team: '', pass: '' };
export const setAuth = (a) => Object.assign(auth, a);
export const clearAuth = () => Object.assign(auth, { team: '', pass: '' });

export async function probe() {
  try {
    const r = await fetch('/api/data?action=ping');
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return { mode: 'cloud', info: await r.json() };
  } catch { /* backend tidak ada */ }
  return { mode: 'local', info: null };
}

export async function login(mode, team, pass) {
  if (mode === 'local') return { ok: true };
  const r = await fetch('/api/data?action=login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ team, pass }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Gagal login (${r.status})`);
  return j;
}

const hdr = () => ({ 'x-team': auth.team, 'x-pass': auth.pass });

export async function loadAll(mode, depot, team) {
  if (mode === 'local') {
    const o = {};
    for (const s of SLOTS) o[s] = await localGet(`${depot}/${team}/${s}`);
    o.skudb = await localGet(`${depot}/skudb`);
    if (!o.main && depot === 'kebayoran') o.main = (await localGet(team)) || (team === 'arjuna' ? await localGet('data') : null);
    return o;
  }
  const r = await fetch(`/api/data?depot=${depot}`, { headers: hdr() });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Gagal memuat data (${r.status})`);
  return j;
}

export async function saveSlot(mode, depot, team, slot, data) {
  if (mode === 'local') return localSet(slot === 'skudb' ? `${depot}/skudb` : `${depot}/${team}/${slot}`, data);
  const body = JSON.stringify(data);
  if (body.length > 4.3e6) throw new Error(`Data ${slot} terlalu besar (${(body.length / 1e6).toFixed(1)} MB, batas 4,3 MB). Pecah file atau kurangi baris yang tidak dipakai.`);
  const r = await fetch(`/api/data?depot=${depot}&slot=${slot}`, { method: 'PUT', headers: { ...hdr(), 'content-type': 'application/json' }, body });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Gagal simpan (${r.status})`);
}

export async function deleteSlot(mode, depot, team, slot) {
  if (mode === 'local') return localSet(slot === 'skudb' ? `${depot}/skudb` : `${depot}/${team}/${slot}`, null);
  const r = await fetch(`/api/data?depot=${depot}&slot=${slot}`, { method: 'DELETE', headers: hdr() });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Gagal hapus (${r.status})`);
}
