// Semua hitungan turunan: timegone, ACV, gap, laju vs Sep/L3M, CA, pareto, kategori fokus, riwayat harian.

export const DAY_NAMES = ['', 'SEN', 'SEL', 'RAB', 'KAM', 'JUM', 'SAB'];
export const SIZES = ['SMALL', 'MEDIUM', 'BIG', 'SUPERBIG'];

const sum = (a, f) => a.reduce((t, x) => t + (f ? f(x) : x), 0);
const div = (a, b) => (b ? a / b : 0);

// ---------- format ----------
export const fmt = {
  jt: (n, d = 1) => {
    const v = (n || 0) / 1e6;
    const s = Math.abs(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
    return (v < 0 && Math.abs(v) >= Math.pow(10, -d) / 2 ? '-' : '') + s;
  },
  pct: (r, d = 1) => (r * 100).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%',
  // untuk nilai yang bisa null (laju vs Sep/L3M)
  pace: (r, d = 0) => (r == null ? '-' : (r * 100).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%'),
  int: (n) => Math.round(n || 0).toLocaleString('id-ID'),
  short: (name) => {
    const p = String(name || '').split(' ');
    return p.length > 2 ? p.slice(0, 2).join(' ') : name;
  },
};

// ---------- waktu ----------
function wibParts(now) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = f.format(now).split('-').map(Number);
  return { y, m, d };
}

const workdays = (y, m, upto) => {
  const last = new Date(y, m, 0).getDate();
  let n = 0;
  for (let d = 1; d <= Math.min(upto, last); d++) if (new Date(y, m - 1, d).getDay() !== 0) n++; // Senin-Sabtu
  return n;
};

const MON_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Data selalu H-1: hari kerja berjalan = hari kerja dari tgl 1 s/d kemarin.
export function timeInfo(period, override, now = new Date()) {
  const t = wibParts(now);
  const y = period?.year ?? t.y;
  const m = period?.month ?? t.m;
  const last = new Date(y, m, 0).getDate();
  const total = override?.total || workdays(y, m, last);
  let upto;
  if (t.y * 12 + t.m > y * 12 + m) upto = last; // bulan data sudah lewat
  else if (t.y * 12 + t.m < y * 12 + m) upto = 0;
  else upto = Math.min(t.d - 1, last); // H-1
  const auto = workdays(y, m, upto);
  const hk = Math.min(total, override?.hk ?? auto);
  const asOfDay = Math.max(1, Math.min(upto, last));
  // tanggal terakhir yang datanya sudah masuk = hari kerja ke-hk (ikut berubah kalau hari kerja diatur manual)
  let dataDay = 0;
  if (hk > 0) {
    let c = 0;
    for (let d = 1; d <= last; d++) {
      if (new Date(y, m - 1, d).getDay() !== 0) c++;
      if (c === hk) { dataDay = d; break; }
    }
  }
  return {
    dataDay,
    y, m, total, hk, auto,
    sisa: Math.max(0, total - hk),
    tg: div(hk, total),
    asOf: upto > 0 ? `${asOfDay} ${MON_ID[m - 1]} ${y}` : '-',
    asOfDay,
    monthLabel: `${['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][m - 1]} ${y}`,
    monthShort: `${MON_ID[m - 1].toUpperCase()} ${y}`,
    overridden: !!override,
  };
}

// status warna: bandingkan ACV dengan timegone
export function status(acv, tg) {
  if (tg <= 0) return 'ok';
  const r = acv / tg;
  return r >= 1 ? 'ok' : r >= 0.8 ? 'mid' : 'low';
}

// warna untuk laju vs Sep / L3M (100% = sama dengan laju periode pembanding)
export const paceCls = (r) => (r == null ? 'mut' : r >= 1 ? 'ok' : r >= 0.8 ? 'mid' : 'low');

// Laju vs periode lain: ACT ÷ (nilai periode pembanding × timegone).
// base = omset penuh Sep, atau rata-rata per bulan L3M. null kalau belum ada hari berjalan / tidak ada pembanding.
export const pace = (act, base, tg) => (tg > 0 && base > 0 ? act / (base * tg) : null);

// ---------- store stats ----------
export function storeStats(list) {
  const n = list.length;
  const ca = list.filter((s) => s.act >= 1).length;
  const caProd = list.filter((s) => s.act >= s.min).length;
  const act = sum(list, (s) => s.act);
  const tgt = sum(list, (s) => s.tgt);
  const lm = sum(list, (s) => s.lm);
  const l3m = sum(list, (s) => s.l3m);
  return { n, ca, caProd, caPct: div(ca, n), caProdPct: div(caProd, n), act, tgt, lm, l3m, acv: div(act, tgt) };
}

// ---------- turunan utama ----------
export function derive(data, mode, time) {
  const tg = (data.targets[mode] || data.targets.milestone) || {};
  const principals = data.principals;

  const mk = (name, tgtObj, actObj, stores) => {
    const tgt = tgtObj?.total || 0;
    const act = actObj?.total || 0;
    const acv = div(act, tgt);
    const pr = {};
    for (const p of principals) {
      const t = tgtObj?.[p] || 0;
      const a = actObj?.[p] || 0;
      pr[p] = { tgt: t, act: a, acv: div(a, t), gap: a - t };
    }
    const st = storeStats(stores);
    const pj = storeStats(stores.filter((s) => s.pj));
    const ps = storeStats(stores.filter((s) => s.ps));
    return {
      name, tgt, act, acv, gap: act - tgt,
      need: div(Math.max(0, tgt - act), Math.max(1, time.sisa)),
      pr, st, pj, ps,
      lmAct: st.lm, l3mAct: st.l3m,
      vsLm: pace(act, st.lm, time.tg),
      vsL3m: pace(act, st.l3m, time.tg),
    };
  };

  const sales = data.salesmen.map((name) => mk(name, tg[name], data.pAct[name], data.stores.filter((s) => s.sales === name)));
  const sumPr = {};
  for (const p of principals) {
    const t = sum(sales, (x) => x.pr[p].tgt);
    const a = sum(sales, (x) => x.pr[p].act);
    sumPr[p] = { tgt: t, act: a, acv: div(a, t), gap: a - t };
  }
  const total = mk(
    'TOTAL',
    { total: sum(sales, (x) => x.tgt), ...Object.fromEntries(principals.map((p) => [p, sumPr[p].tgt])) },
    { total: sum(sales, (x) => x.act), ...Object.fromEntries(principals.map((p) => [p, sumPr[p].act])) },
    data.stores
  );
  const ranked = [...sales].sort((a, b) => b.acv - a.acv);
  ranked.forEach((s, i) => (s.rank = i + 1));
  return { sales, total, principals, mode };
}

// penjualan per hari kunjungan (SEN-SAB) untuk satu set toko
export function byRouteDay(list) {
  const r = [0, 0, 0, 0, 0, 0, 0];
  const n = [0, 0, 0, 0, 0, 0, 0];
  for (const s of list) {
    r[s.day] += s.act;
    n[s.day] += 1;
  }
  return [1, 2, 3, 4, 5, 6].map((d) => ({ day: DAY_NAMES[d], act: r[d], n: n[d] }));
}

// agregasi sub brand (kategori) untuk satu set toko
export function catAgg(data, list) {
  const rows = data.subs.map((s, i) => ({ i, ...s, cur: 0, lm: 0, l3m: 0, buyers: 0, buyersLm: 0 }));
  for (const s of list) {
    const c = data.cat.cur[s.id];
    const l = data.cat.lm[s.id];
    const m = data.cat.l3m[s.id];
    if (c) for (const [k, v] of Object.entries(c)) { rows[k].cur += v; if (v > 0) rows[k].buyers++; }
    if (l) for (const [k, v] of Object.entries(l)) { rows[k].lm += v; if (v > 0) rows[k].buyersLm++; }
    if (m) for (const [k, v] of Object.entries(m)) rows[k].l3m += v;
  }
  return rows;
}

// sub brand satu toko
export function storeCat(data, id) {
  const keys = new Set([...Object.keys(data.cat.cur[id] || {}), ...Object.keys(data.cat.lm[id] || {}), ...Object.keys(data.cat.l3m[id] || {})]);
  return [...keys]
    .map((k) => ({ ...data.subs[k], cur: data.cat.cur[id]?.[k] || 0, lm: data.cat.lm[id]?.[k] || 0, l3m: data.cat.l3m[id]?.[k] || 0 }))
    .sort((a, b) => b.cur - a.cur || b.lm - a.lm);
}

export function groupBy(list, f) {
  const m = new Map();
  for (const x of list) {
    const k = f(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

// ukuran toko (CC5): selalu 4 baris, urut SMALL > SUPERBIG
export function sizeRows(stores) {
  const g = groupBy(stores, (s) => s.size || 'LAINNYA');
  const keys = [...SIZES, ...[...g.keys()].filter((k) => !SIZES.includes(k))];
  return keys.map((k) => ({ k, ...storeStats(g.get(k) || []) }));
}

// ---------- kategori fokus ----------
export const DEFAULT_FOCUS_BY_TEAM = {
  arjuna: [
    { name: 'Chocolatos Wafer Stick', kw: ['Chocolatos Wafer Stick'] },
    { name: 'Rosta', kw: ['Rosta'] },
    { name: 'Roasted', kw: ['Roasted'] },
    { name: 'Dilan', kw: ['Dilan'] },
    { name: 'Pilus', kw: ['Pilus'] },
    { name: 'Malkist', kw: ['Malkist'] },
  ],
  bima: [
    { name: 'RTS', kw: ['RTS'] },
    { name: 'GBS', kw: ['GBS'] },
    { name: 'MBR-B', kw: ['MBR'] },
    { name: 'RANS', kw: ['RANS'] },
    { name: 'FLORA', kw: ['FLORA'] },
  ],
};
export const DEFAULT_FOCUS = DEFAULT_FOCUS_BY_TEAM.arjuna;
export const defaultFocus = (team) => DEFAULT_FOCUS_BY_TEAM[team] || DEFAULT_FOCUS;

export const focusCatsOf = (data) => (data.settings?.focusCats?.length ? data.settings.focusCats : defaultFocus(data.team));

// satu baris per kategori: "Label = kata kunci 1, kata kunci 2" (tanpa "=" berarti label = kata kunci)
export function parseFocusText(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, b] = l.split('=');
      const name = a.trim();
      const kw = (b ?? a).split(',').map((x) => x.trim()).filter(Boolean);
      return { name, kw };
    })
    .filter((c) => c.name && c.kw.length);
}
export const focusToText = (cats) => cats.map((c) => (c.kw.length === 1 && c.kw[0] === c.name ? c.name : `${c.name} = ${c.kw.join(', ')}`)).join('\n');

// untuk tiap kategori fokus: sub brand yang cocok. Kata kunci dicocokkan sebagai kata utuh
// terhadap "principal + brand + nama sub brand" (jadi "GBS" = seluruh principal GBS, "RTS" = Chocolatos Drink RTS).
const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function focusMatches(data, cats) {
  return cats.map((c) => {
    const res = c.kw.map((k) => new RegExp('(^|[^a-z0-9])' + esc(k.trim().toLowerCase()) + '([^a-z0-9]|$)'));
    const idx = [];
    data.subs.forEach((s, i) => {
      const hay = `${s.p} ${s.b} ${s.n}`.toLowerCase();
      if (res.some((r) => r.test(hay))) idx.push(i);
    });
    return { ...c, idx, subs: idx.map((i) => data.subs[i].n) };
  });
}

const sumIdx = (o, idx) => (o ? idx.reduce((a, i) => a + (o[i] || 0), 0) : 0);

// agregasi per kategori fokus untuk satu set toko
export function focusAgg(data, list, cats, tg) {
  const ms = focusMatches(data, cats);
  const n = list.length;
  const ca = list.filter((s) => s.act >= 1).length;
  let total = 0;
  const rows = ms.map((m) => {
    let cur = 0, lm = 0, l3m = 0, buyers = 0, buyersLm = 0, buyersCa = 0;
    for (const s of list) {
      const c = sumIdx(data.cat.cur[s.id], m.idx);
      const l = sumIdx(data.cat.lm[s.id], m.idx);
      const t = sumIdx(data.cat.l3m[s.id], m.idx);
      cur += c; lm += l; l3m += t;
      if (c > 0) { buyers++; if (s.act >= 1) buyersCa++; }
      if (l > 0) buyersLm++;
    }
    total += cur;
    return {
      name: m.name, subs: m.subs, cur, lm, l3m, buyers, buyersLm,
      penJks: div(buyers, n), penCa: div(buyersCa, ca),
      vsLm: pace(cur, lm, tg), vsL3m: pace(cur, l3m, tg),
    };
  });
  rows.forEach((r) => (r.share = div(r.cur, total)));
  return { rows, total, n, ca };
}

// ---------- riwayat harian (untuk grafik tren) ----------
export function makeSnapshot(data, time) {
  const s = {};
  for (const name of data.salesmen) {
    const st = storeStats(data.stores.filter((x) => x.sales === name));
    s[name] = [Math.round(data.pAct[name]?.total || 0), st.ca, st.caProd];
  }
  const vals = Object.values(s);
  const pr = {};
  for (const name of data.salesmen) {
    for (const [p, v] of Object.entries(data.pAct[name] || {})) if (p !== 'total') pr[p] = Math.round((pr[p] || 0) + v);
  }
  const sumAct = (f) => Math.round(data.stores.filter(f).reduce((a, x) => a + x.act, 0));
  return {
    hk: time.hk,
    tg: Math.round(time.tg * 10000) / 10000,
    day: time.asOfDay,
    total: time.total,
    s,
    pr,
    pj: sumAct((x) => x.pj),
    ps: sumAct((x) => x.ps),
    t: [vals.reduce((a, x) => a + x[0], 0), vals.reduce((a, x) => a + x[1], 0), vals.reduce((a, x) => a + x[2], 0)],
  };
}

// satu snapshot per hari kerja berjalan; upload ulang di hari yang sama menimpa
export function upsertHistory(hist, snap) {
  const h = (hist || []).filter((x) => x.hk !== snap.hk);
  h.push(snap);
  return h.sort((a, b) => a.hk - b.hk);
}

export const periodKey = (d) => (d?.meta?.period ? d.meta.period.year * 12 + d.meta.period.month : null);

// gabungkan data baru dengan data lama: bulan ini diganti, Sep & L3M tetap
export function mergeKeepHistory(oldD, newD) {
  if (!oldD) return newD;
  const key = (s) => s.id + '|' + s.sales;
  const old = new Map(oldD.stores.map((s) => [key(s), s]));
  const stores = newD.stores.map((s) => {
    const o = old.get(key(s));
    return o ? { ...s, lm: o.lm, l3m: o.l3m } : s;
  });
  // kategori: lm & l3m dari data lama untuk toko yang sudah ada, subs di-remap
  const subs = [...newD.subs];
  const idx = new Map(subs.map((s, i) => [s.p + '|' + s.n, i]));
  const remap = {};
  oldD.subs.forEach((s, i) => {
    const k = s.p + '|' + s.n;
    if (!idx.has(k)) { idx.set(k, subs.length); subs.push(s); }
    remap[i] = idx.get(k);
  });
  const cat = { cur: newD.cat.cur, lm: {}, l3m: {} };
  for (const per of ['lm', 'l3m']) {
    for (const [id, o] of Object.entries(oldD.cat[per])) {
      const t = {};
      for (const [k, v] of Object.entries(o)) t[remap[k]] = v;
      cat[per][id] = t;
    }
  }
  // toko baru (belum ada di data lama): pakai Sep & L3M dari file baru
  const oldIds = new Set(oldD.stores.map((s) => s.id));
  for (const per of ['lm', 'l3m']) {
    for (const [id, o] of Object.entries(newD.cat[per])) if (!oldIds.has(id)) cat[per][id] = o;
  }
  return { ...newD, stores, subs, cat, meta: { ...newD.meta, historyKept: true } };
}


// ---------- Bandingkan antar waktu: Okt vs Sep vs L3M (rata-rata per bulan) ----------
export const COMPARE_DIMS = [
  { v: 'sales', label: 'Salesman' },
  { v: 'prin', label: 'Principal' },
  { v: 'brand', label: 'Brand' },
  { v: 'sub', label: 'Kategori' },
  { v: 'fokus', label: 'Kat. Fokus' },
  { v: 'hari', label: 'Hari Kunjungan' },
  { v: 'pj', label: 'Pareto JKS' },
  { v: 'ps', label: 'Pareto SAK' },
  { v: 'size', label: 'Ukuran Toko' },
];

const dapCache = new WeakMap();
// target DAP per toko per salesman (kalau sheet DAP ada)
export function dapTargetMap(data) {
  if (dapCache.has(data)) return dapCache.get(data);
  const m = {};
  for (const x of data.dap || []) {
    const k = x.id + '|' + x.s.toUpperCase();
    m[k] = (m[k] || 0) + x.t;
  }
  dapCache.set(data, m);
  return m;
}
export const storeDapTarget = (data, s) => dapTargetMap(data)[s.id + '|' + s.sales.toUpperCase()] || 0;

// baris: { label, cur, lm, l3m, bCur, bLm, bL3, n, ca, caProd, tgt }  (b* = jumlah toko yang beli di periode itu; n/ca/caProd/tgt hanya untuk dimensi berbasis toko)
export function compareRows(data, dim, sal, filterFn) {
  const stores = data.stores.filter((s) => (sal === 'ALL' || s.sales === sal) && (!filterFn || filterFn(s)));
  const cnt = (list, k) => list.filter((s) => s[k] > 0).length;
  const fromStores = (label, list, cur) => ({
    label,
    cur: cur ?? sum(list, (s) => s.act),
    lm: sum(list, (s) => s.lm),
    l3m: sum(list, (s) => s.l3m),
    bCur: cnt(list, 'act'), bLm: cnt(list, 'lm'), bL3: cnt(list, 'l3m'),
    n: list.length,
    ca: list.filter((s) => s.act >= 1).length,
    caProd: list.filter((s) => s.act >= s.min).length,
    tgt: sum(list, (s) => storeDapTarget(data, s)),
  });
  const names = sal === 'ALL' ? data.salesmen : [sal];
  const live = (r) => r.bCur + r.bLm + r.bL3 > 0;
  if (dim === 'sales') return names.map((n) => fromStores(n, stores.filter((s) => s.sales === n), filterFn ? undefined : data.pAct[n]?.total));
  if (dim === 'pj') return names.map((n) => fromStores(n, stores.filter((s) => s.sales === n && s.pj))).filter(live);
  if (dim === 'ps') {
    const rows = names.map((n) => fromStores(n, stores.filter((s) => s.sales === n && s.ps))).filter(live);
    return [fromStores('Total SAK', stores.filter((s) => s.ps)), ...rows];
  }
  if (dim === 'size') return sizeRows(stores).filter((x) => x.n > 0).map((x) => fromStores(x.k, stores.filter((s) => (s.size || 'LAINNYA') === x.k)));
  if (dim === 'hari') {
    const g = groupBy(stores, (s) => parseRoute(s.hk).wd);
    return [1, 2, 3, 4, 5, 6].filter((wd) => g.has(wd)).map((wd) => fromStores(weekdayName(wd), g.get(wd)));
  }

  // dimensi kategori: kelompokkan sub brand
  const groups = new Map();
  if (dim === 'fokus') {
    for (const m of focusMatches(data, focusCatsOf(data))) groups.set(m.name, m.idx);
  } else {
    data.subs.forEach((sb, i) => {
      const k = dim === 'prin' ? sb.p : dim === 'brand' ? sb.b : sb.n;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(i);
    });
  }
  const rows = [];
  for (const [label, idx] of groups) {
    const r = { label, cur: 0, lm: 0, l3m: 0, bCur: 0, bLm: 0, bL3: 0 };
    for (const s of stores) {
      const a = sumIdx(data.cat.cur[s.id], idx);
      const b = sumIdx(data.cat.lm[s.id], idx);
      const c = sumIdx(data.cat.l3m[s.id], idx);
      r.cur += a; r.lm += b; r.l3m += c;
      if (a > 0) r.bCur++;
      if (b > 0) r.bLm++;
      if (c > 0) r.bL3++;
    }
    if (r.cur || r.lm || r.l3m) rows.push(r);
  }
  return rows;
}

// ---------- rute kunjungan & DAP ----------
const WD_NAME = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const weekdayName = (wd) => WD_NAME[wd] || '';

// "[2]SELASA" -> tiap minggu | "Rute Hari Jumat Minggu 1&3" -> hanya minggu ke-1 dan ke-3
export function parseRoute(str) {
  const u = String(str || '').toUpperCase();
  const names = [['SENIN', 1], ['SELASA', 2], ['RABU', 3], ['KAMIS', 4], ['JUMAT', 5], ['SABTU', 6]];
  let wd = 0;
  for (const [n, i] of names) if (u.includes(n)) wd = i;
  const m = u.match(/MINGGU\s*([\d&\s]+)/);
  const weeks = m ? m[1].split('&').map((x) => parseInt(x, 10)).filter(Boolean) : null;
  return { wd, weeks };
}

// minggu ke-n dalam bulan: tanggal 1-7 = minggu 1, 8-14 = minggu 2, dst
export const weekOfMonth = (day) => Math.ceil(day / 7);

// tanggal-tanggal kunjungan sebuah toko dalam satu bulan (kecuali tanggal libur)
export function visitDays(route, y, m, holidays = []) {
  const { wd, weeks } = typeof route === 'string' ? parseRoute(route) : route;
  if (!wd) return [];
  const last = new Date(y, m, 0).getDate();
  const hol = new Set(holidays);
  const out = [];
  for (let d = 1; d <= last; d++) {
    if (new Date(y, m - 1, d).getDay() !== wd) continue;
    if (weeks && !weeks.includes(weekOfMonth(d))) continue;
    if (hol.has(d)) continue;
    out.push(d);
  }
  return out;
}

export const roundUp = (v, step = 1000) => Math.ceil(Math.max(0, v) / step) * step;

// DAP satu tanggal: toko yang dijadwalkan hari itu + PLAN = (Target DAP - Actual) / sisa kunjungan (termasuk hari itu)
export function dapForDate(data, y, m, d, holidays = []) {
  const rows = [];
  let unparsed = 0;
  for (const x of data.dap || []) {
    const rt = parseRoute(x.r);
    if (!rt.wd) { unparsed++; continue; }
    const days = visitDays(rt, y, m, holidays);
    if (!days.includes(d)) continue;
    const sisa = days.filter((v) => v >= d).length;
    const gap = x.a - x.t; // Actual - Target DAP (negatif = masih kurang)
    rows.push({ ...x, wd: rt.wd, sisa, gap, plan: sisa > 0 ? roundUp(Math.max(0, -gap) / sisa) : 0, done: gap >= 0, freq: rt.weeks ? 'Minggu ' + rt.weeks.join('&') : 'Tiap minggu' });
  }
  const by = new Map();
  for (const r of rows) {
    if (!by.has(r.s)) by.set(r.s, []);
    by.get(r.s).push(r);
  }
  const order = data.salesmen || [];
  const idx = (n) => order.findIndex((o) => o.toUpperCase() === n.toUpperCase());
  const groups = [...by.entries()]
    .map(([name, list]) => ({
      name,
      list: list.sort((a, b) => b.t - a.t),
      n: list.length,
      target: sum(list, (r) => r.t),
      actual: sum(list, (r) => r.a),
      plan: sum(list, (r) => r.plan),
    }))
    .sort((a, b) => (idx(a.name) < 0 ? 99 : idx(a.name)) - (idx(b.name) < 0 ? 99 : idx(b.name)));
  return { groups, total: rows.length, unparsed };
}

// tanggal (hari dalam bulan) terakhir yang datanya sudah masuk = H-1
export function dataDay(time) {
  return time.hk > 0 || time.asOf !== '-' ? time.asOfDay : 0;
}

// per toko: berapa kunjungan yang sudah lewat dibanding total bulan ini (timegone toko), berdasar tanggal data
export function routeTimegone(route, y, m, dataDayN, holidays = []) {
  const days = visitDays(route, y, m, holidays);
  if (!days.length) return { tg: 0, total: 0, done: 0 };
  const done = days.filter((v) => v <= dataDayN).length;
  return { tg: done / days.length, total: days.length, done };
}

// ---------- fokus per hari kunjungan ----------
export function dayFocus(data, time, holidays = [], sal = 'ALL') {
  const dd = time.dataDay || 0;
  const dapT = {};
  for (const x of data.dap || []) dapT[x.id + '|' + x.s.toUpperCase()] = (dapT[x.id + '|' + x.s.toUpperCase()] || 0) + x.t;
  const rows = [];
  for (const s of data.stores) {
    if (sal !== 'ALL' && s.sales !== sal) continue;
    const rt = parseRoute(s.hk);
    if (!rt.wd) continue;
    const { tg } = routeTimegone(rt, time.y, time.m, dd, holidays);
    const t = dapT[s.id + '|' + s.sales.toUpperCase()] || 0;
    rows.push({ s, wd: rt.wd, tg, t });
  }
  const mk = (list) => {
    const act = sum(list, (r) => r.s.act);
    const lm = sum(list, (r) => r.s.lm);
    const l3 = sum(list, (r) => r.s.l3m);
    const tgt = sum(list, (r) => r.t);
    const eLm = sum(list, (r) => r.s.lm * r.tg);
    const eL3 = sum(list, (r) => r.s.l3m * r.tg);
    const eT = sum(list, (r) => r.t * r.tg);
    return {
      n: list.length,
      ca: list.filter((r) => r.s.act >= 1).length,
      act, lm, l3m: l3, tgt, eLm, eL3, eT,
      acv: tgt ? act / tgt : null,
      vsT: eT > 0 ? act / eT : null,
      vsLm: eLm > 0 ? act / eLm : null,
      vsL3m: eL3 > 0 ? act / eL3 : null,
    };
  };
  const days = [1, 2, 3, 4, 5, 6].map((wd) => ({ wd, label: weekdayName(wd), ...mk(rows.filter((r) => r.wd === wd)) }));
  const total = mk(rows);
  days.forEach((d) => { d.share = total.act ? d.act / total.act : 0; });
  const names = sal === 'ALL' ? data.salesmen : [sal];
  const matrix = names.map((name) => {
    const mine = rows.filter((r) => r.s.sales === name);
    const t = mk(mine);
    return { name, total: t, days: [1, 2, 3, 4, 5, 6].map((wd) => { const c = mk(mine.filter((r) => r.wd === wd)); return { ...c, wd, share: t.act ? c.act / t.act : 0 }; }) };
  });
  return { days, total, matrix, hasTarget: total.tgt > 0 };
}
