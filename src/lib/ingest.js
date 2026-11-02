// Ubah workbook per slot (main / sku / prog / skudb) jadi dataset. Peran sheet dikenali dari judul sheet.
import { parseAll, parsePeriod, autoPareto, sizeOf } from './parse.js';
import { FIELDS, grpName, isYes, key, readTable, sheetsByRole, str, toNum, describeMap } from './table.js';

export const SLOT_INFO = {
  main: { label: 'Data utama', hint: 'Omset per toko, Sep, L3M, Pareto JKS, target, DAP (sheet dikenali dari judul)' },
  sku: { label: 'Qty / SKU per toko', hint: 'Baris per toko × SKU: kode SKU, qty, nilai' },
  prog: { label: 'GreenStore / MSS', hint: 'Target, Actual per salesman atau toko' },
  skudb: { label: 'Database SKU', hint: 'Kode SKU + nama SKU (+ brand/kategori). Per depo, jarang diganti' },
};

const LEGACY = (wb) => wb.SheetNames.some((n) => /^OLAPSALES/.test(key(n)) || key(n) === 'JKSSALESMAN');
const rp = (v) => Math.round(toNum(v));
const DAYS = [['SENIN', 1], ['SELASA', 2], ['RABU', 3], ['KAMIS', 4], ['JUMAT', 5], ['SABTU', 6]];
const dayOf = (s) => { const u = String(s || '').toUpperCase(); let d = 0; for (const [n, i] of DAYS) if (u.includes(n)) d = i; return d; };
const nk = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

// --------- util: baca banyak sheet satu jenis ---------
function readKind(wb, names, kind, override, warn, label) {
  const out = [];
  for (const n of names) {
    const t = readTable(wb.Sheets[n], kind, override?.[kind] || {});
    if (!t) { warn.push(`Sheet "${n}" dilewati: kolom ${kind === 'skudb' ? 'Kode SKU' : 'wajib'} untuk ${label} tidak ketemu (judul kolom tidak dikenali). Atur lewat Pemetaan kolom.`); continue; }
    out.push({ sheet: n, ...t });
  }
  return out;
}

export function previewMap(wb, slot, override) {
  // untuk layar pemetaan: sheet mana kebaca & kolom mana yang cocok
  const roles = sheetsByRole(wb);
  const pick = slot === 'main' ? [...(roles.main || []), ...(roles.khusus || [])] : slot === 'sku' ? [...(roles.sku || []), ...(roles.main || [])] : slot === 'prog' ? [...(roles.prog || []), ...(roles.main || [])] : [...(roles.skudb || []), ...(roles.main || [])];
  const kind = slot;
  const found = [];
  for (const n of pick.slice(0, 8)) {
    const t = readTable(wb.Sheets[n], kind, override?.[kind] || {});
    found.push({ sheet: n, ok: !!t, rows: t?.rows.length || 0, cols: describeMap(t, kind), heads: t?.heads?.filter(Boolean) || [] });
  }
  return found;
}

// ====================== SLOT: DATA UTAMA ======================
export function parseMain(wb, o) {
  const { team, fileName, override, period, roster } = o;
  const warn = [];
  if (LEGACY(wb)) {
    const r = parseAll(wb, { fileName, roster });
    const d = r[team];
    if (!d) throw new Error(`Format lama terdeteksi, tapi data tim ${team === 'bima' ? 'Bima' : 'Arjuna'} tidak ada di file ini. ${r.warnings.join(' | ')}`);
    d.warnings = [...r.warnings, ...d.warnings, 'Info: format lama terbaca lewat pembaca khusus (sheet OLAP/JKS)'];
    d.meta.legacy = true;
    return { data: d, info: { legacy: true } };
  }

  const roles = sheetsByRole(wb);
  const mainSheets = readKind(wb, roles.main || [], 'main', override, warn, 'data utama');
  const khusus = readKind(wb, roles.khusus || [], 'main', override, warn, 'data khusus');
  if (!mainSheets.length && !khusus.length) {
    throw new Error('Tidak ada sheet data yang terbaca. Pastikan ada sheet berisi kolom Salesman dan ID Toko (nama kolom dicocokkan longgar). ' + warn.join(' | '));
  }

  // baris khusus menimpa salesman yang tercantum di sana
  const rows = [];
  const khSales = new Set();
  const khGroup = {};
  for (const t of khusus) for (const r of t.rows) { const s = nk(r.sales); if (s) { khSales.add(s); khGroup[s] = grpName(t.sheet); } }
  for (const t of mainSheets) for (const r of t.rows) if (!khSales.has(nk(r.sales))) rows.push({ ...r });
  for (const t of khusus) for (const r of t.rows) rows.push({ ...r, _g: grpName(t.sheet) });
  if (khusus.length) warn.push(`Info: sheet ${khusus.map((t) => `"${t.sheet}"`).join(', ')} menimpa data ${khSales.size} salesman yang tercantum di dalamnya (baris yang sama di sheet lain diabaikan)`);

  // ---- agregasi per toko ----
  const hasSku = rows.some((r) => str(r.code) || str(r.skuName) || str(r.category));
  const stores = new Map();
  const salesmen = [];
  const sSeen = new Set();
  for (const r of rows) {
    const id = str(r.id);
    const sales = str(r.sales);
    if (!id || !sales) continue;
    if (!sSeen.has(nk(sales))) { sSeen.add(nk(sales)); salesmen.push(sales); }
    const k = id + '|' + nk(sales);
    let s = stores.get(k);
    if (!s) {
      s = { id, name: str(r.name) || id, sales, hk: str(r.route), day: dayOf(r.route), cc1: str(r.channel) || '-', cc2: '-', cc5: str(r.size) || '-', size: sizeOf(r.size), tipe: '', kec: '', kel: '', min: 0, pj: false, ps: false, tgt: 0, act: 0, lm: 0, l3m: 0, grp: r._g || str(r.tim) || '' };
      stores.set(k, s);
    }
    if (!s.hk && str(r.route)) { s.hk = str(r.route); s.day = dayOf(r.route); }
    if (r.pareto != null && isYes(r.pareto)) s.pj = true;
    if (r.paretoSak != null && isYes(r.paretoSak)) s.ps = true;
    s.act += toNum(r.act);
    s.tgt += toNum(r.target);
    if (hasSku) {
      if (!s.lm) s.lm = toNum(r.lm);
      if (!s.l3m) s.l3m = toNum(r.l3m);
    } else { s.lm += toNum(r.lm); s.l3m += toNum(r.l3m); }
    if (!s.min) s.min = toNum(r.min);
  }
  if (!stores.size) throw new Error('Tabel terbaca tapi tidak ada baris dengan Salesman + ID Toko terisi');

  // sheet pareto/LAB
  const par = readKind(wb, roles.pareto || [], 'pareto', override, warn, 'pareto');
  let parHits = 0;
  const byId = new Map();
  for (const s of stores.values()) { const a = byId.get(s.id) || []; a.push(s); byId.set(s.id, a); }
  for (const t of par) {
    for (const r of t.rows) {
      const id = str(r.id);
      const list = (byId.get(id) || []).filter((s) => !str(r.sales) || nk(s.sales) === nk(r.sales));
      for (const s of list) {
        parHits++;
        if (r.pareto == null || isYes(r.pareto)) s.pj = true;
        if (r.paretoSak != null && isYes(r.paretoSak)) s.ps = true;
        if (toNum(r.target)) s.tgt = toNum(r.target);
        if (toNum(r.min)) s.min = toNum(r.min);
      }
    }
  }
  const list = [...stores.values()];
  for (const s of list) { s.act = Math.round(s.act); s.tgt = Math.round(s.tgt); s.lm = Math.round(s.lm); s.l3m = Math.round(s.l3m); if (!s.min) s.min = 200000; }
  const anyPareto = list.some((s) => s.pj);
  if (!anyPareto) {
    autoPareto(list, salesmen);
    warn.push('Info: belum ada kolom/sheet Pareto JKS, Pareto dihitung otomatis (30 toko terbesar per salesman berdasarkan L3M)');
  }
  if (!list.some((s) => s.tgt)) warn.push('Info: target per toko tidak ada (kolom Target kosong)');
  if (!list.some((s) => s.lm)) warn.push('Info: kolom Sep / bulan lalu tidak ketemu, pembanding vs Sep kosong');
  if (!list.some((s) => s.l3m)) warn.push('Info: kolom L3M tidak ketemu, pembanding vs L3M kosong');
  if (!list.some((s) => s.hk)) warn.push('Info: kolom Hari Kunjungan tidak ketemu, DAP dan fokus per hari tidak bisa dipakai');

  // ---- principal & SKU dari baris data ----
  const principalOf = (r) => nk(r.principal || r.brand);
  const pAct = {};
  const principals = new Set();
  for (const r of rows) {
    const sales = str(r.sales);
    if (!sales) continue;
    const t = (pAct[sales] ||= { total: 0 });
    const a = toNum(r.act);
    t.total += a;
    const p = principalOf(r);
    if (p) { t[p] = (t[p] || 0) + a; principals.add(p); }
  }
  // ---- target salesman ----
  const tgtRows = readKind(wb, roles.target || [], 'target', override, warn, 'target');
  const milestone = {};
  for (const t of tgtRows) {
    for (const r of t.rows) {
      const sales = salesmen.find((s) => nk(s) === nk(r.sales));
      if (!sales) continue;
      const o2 = (milestone[sales] ||= { total: 0 });
      const v = toNum(r.target);
      o2.total += v;
      const p = nk(r.principal || r.brand);
      if (p) { o2[p] = (o2[p] || 0) + v; principals.add(p); }
    }
  }
  for (const s of salesmen) {
    if (!milestone[s]) {
      milestone[s] = { total: list.filter((x) => x.sales === s).reduce((a, x) => a + x.tgt, 0) };
      if (!tgtRows.length && s === salesmen[0]) warn.push('Info: sheet Target tidak ada (judul sheet diawali TGT/TARGET), target salesman dijumlah dari target toko');
    }
    pAct[s] ||= { total: 0 };
  }

  // ---- DAP ----
  const dapRows = readKind(wb, roles.dap || [], 'dap', override, warn, 'DAP');
  let dap = [];
  const actOf = (id, sales) => stores.get(id + '|' + nk(sales))?.act ?? 0;
  for (const t of dapRows) {
    for (const r of t.rows) {
      const id = str(r.id);
      const sales = str(r.sales);
      if (!id || !sales) continue;
      dap.push({ id, n: str(r.name) || stores.get(id + '|' + nk(sales))?.name || id, s: sales, r: str(r.route), ch: str(r.channel), t: rp(r.target), e: rp(r.est), hp: str(r.hp), par: isYes(r.pareto) ? 'P' : '', so: rp(r.so), m: [0, 0, 0], a: rp(actOf(id, sales)) });
    }
  }
  if (!dap.length) {
    dap = list.filter((s) => s.hk && s.tgt > 0).map((s) => ({ id: s.id, n: s.name, s: s.sales, r: s.hk, ch: s.cc1 === '-' ? '' : s.cc1, t: s.tgt, e: 0, hp: '', par: s.pj ? 'P' : '', so: 0, m: [0, 0, 0], a: s.act }));
    if (dap.length) warn.push('Info: sheet DAP tidak ada, DAP dibuat otomatis dari target per toko + hari kunjungan');
  }

  const data = {
    v: 3,
    team,
    meta: { period: period || null, uploadedAt: new Date().toISOString(), fileName: fileName || '', region: '', teamLabel: team === 'bima' ? 'Bima' : 'Arjuna', storeTgt: list.some((s) => s.tgt), autoPareto: !anyPareto, hasBti: false, hasDap: dap.length > 0, flat: true, parHits },
    salesmen,
    principals: [...principals],
    targets: { milestone, bti: null },
    pAct,
    stores: list,
    subs: [], cat: { cur: {}, lm: {}, l3m: {} },
    dap,
    history: [], settings: {},
    warnings: warn,
  };
  if (hasSku) applySku(data, skuFromRows(rows), warn);
  return { data, info: { sheets: [...mainSheets, ...khusus].map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'main') })) } };
}

// ====================== SKU (qty / nilai per toko × SKU) ======================
function skuFromRows(rows) {
  const subs = [];
  const idx = new Map();
  const per = {};
  for (const r of rows) {
    const id = str(r.id);
    if (!id) continue;
    const code = str(r.code);
    const nm = str(r.skuName);
    const cat = str(r.category);
    const kk = code || nm || cat;
    if (!kk) continue;
    if (!idx.has(kk)) { idx.set(kk, subs.length); subs.push({ p: nk(r.principal) || nk(r.brand) || '-', b: str(r.brand) || str(r.principal) || '-', n: nm || cat || code, c: code, k: cat }); }
    const i = idx.get(kk);
    const o = (per[id] ||= {});
    const x = (o[i] ||= [0, 0, 0]);
    x[0] += toNum(r.qty); x[1] += toNum(r.act); x[2] += toNum(r.target);
  }
  return { subs, per };
}

export function parseSku(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  let names = [...(roles.sku || [])];
  if (!names.length) names = [...(roles.main || []), ...(roles.khusus || [])];
  const tabs = readKind(wb, names, 'sku', o.override, warn, 'qty SKU');
  if (!tabs.length) throw new Error('Tidak ada sheet qty yang terbaca: butuh kolom ID Toko dan Qty. ' + warn.join(' | '));
  const rows = tabs.flatMap((t) => t.rows);
  const sk = skuFromRows(rows);
  if (!sk.subs.length) throw new Error('Tabel terbaca tapi tidak ada kolom SKU (kode/nama SKU atau kategori)');
  const per = {};
  for (const [id, o2] of Object.entries(sk.per)) { per[id] = {}; for (const [i, x] of Object.entries(o2)) per[id][i] = [Math.round(x[0] * 100) / 100, Math.round(x[1]), Math.round(x[2])]; }
  return { data: { subs: sk.subs, per, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString(), rows: rows.length }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'sku') })) } };
}

// terapkan SKU ke dataset utama: cat.cur = nilai, qty.cur = qty
export function applySku(data, sk, warn = []) {
  const ids = new Set(data.stores.map((s) => s.id));
  data.subs = sk.subs;
  data.cat = { cur: {}, lm: {}, l3m: {} };
  data.qty = { cur: {} };
  data.skuTgt = {};
  let miss = 0;
  for (const [id, o] of Object.entries(sk.per)) {
    if (!ids.has(id)) { miss++; continue; }
    for (const [i, x] of Object.entries(o)) {
      if (x[1]) (data.cat.cur[id] ||= {})[i] = x[1];
      if (x[0]) (data.qty.cur[id] ||= {})[i] = x[0];
      if (x[2]) (data.skuTgt[id] ||= {})[i] = x[2];
    }
  }
  data.hasQty = Object.keys(data.qty.cur).length > 0;
  if (miss) warn.push(`Info: ${miss} ID toko di data SKU tidak ada di data utama (diabaikan)`);
  return data;
}

// ====================== PROGRAM (GreenStore / MSS) ======================
const progName = (sheet, v) => {
  if (str(v)) return str(v);
  const k = key(sheet);
  return k.includes('GREEN') ? 'GreenStore' : k.includes('MSS') ? 'MSS' : str(sheet);
};

export function parseProg(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  let names = [...(roles.prog || [])];
  if (!names.length) names = wb.SheetNames.slice();
  const tabs = readKind(wb, names, 'prog', o.override, warn, 'program');
  if (!tabs.length) throw new Error('Tidak ada sheet program yang terbaca: butuh kolom Target dan Actual. ' + warn.join(' | '));
  const items = [];
  for (const t of tabs) {
    for (const r of t.rows) {
      const s = str(r.sales);
      const id = str(r.id);
      if (!s && !id) continue;
      items.push({ p: progName(t.sheet, r.program), s, id, n: str(r.name), t: Math.round(toNum(r.target)), a: Math.round(toNum(r.act)) });
    }
  }
  if (!items.length) throw new Error('Sheet program terbaca tapi kosong');
  return { data: { items, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'prog') })) } };
}

// ====================== DATABASE SKU ======================
export function parseSkuDb(wb, o) {
  const warn = [];
  const roles = sheetsByRole(wb);
  const names = roles.skudb?.length ? roles.skudb : wb.SheetNames.slice();
  const tabs = readKind(wb, names, 'skudb', o.override, warn, 'database SKU');
  if (!tabs.length) throw new Error('Database SKU tidak terbaca: butuh kolom Kode SKU. ' + warn.join(' | '));
  const seen = new Set();
  const items = [];
  for (const t of tabs) {
    for (const r of t.rows) {
      const c = str(r.code);
      if (!c || seen.has(c)) continue;
      seen.add(c);
      items.push({ c, n: str(r.skuName) || c, b: str(r.brand), k: str(r.category), p: str(r.principal) });
    }
  }
  return { data: { items, warnings: warn, fileName: o.fileName, uploadedAt: new Date().toISOString() }, info: { sheets: tabs.map((t) => ({ sheet: t.sheet, rows: t.rows.length, cols: describeMap(t, 'skudb') })) } };
}

export const PARSERS = { main: parseMain, sku: parseSku, prog: parseProg, skudb: parseSkuDb };

// ====================== GABUNG SLOT -> data siap pakai ======================
export function buildData(slots, depot, team) {
  const m = slots.main;
  if (!m) return null;
  const d = { ...m, depot, team, warnings: [...(m.warnings || [])] };
  d.stores = m.stores.map((s) => ({ ...s }));
  if (slots.sku) { d.cat = { cur: {}, lm: {}, l3m: {} }; applySku(d, slots.sku, d.warnings); if (m.meta?.legacy) d.warnings.push('Info: data SKU/qty menggantikan kategori dari format lama'); }
  d.prog = slots.prog?.items || [];
  d.skudb = slots.skudb?.items || [];
  if (d.skudb.length) {
    const by = new Map(d.skudb.map((x) => [x.c, x]));
    d.subs = d.subs.map((sb) => { const x = sb.c && by.get(sb.c); return x ? { ...sb, n: x.n || sb.n, b: x.b || sb.b, k: x.k || sb.k } : sb; });
  }
  d.groups = {};
  for (const s of d.stores) if (s.grp) d.groups[s.sales] = s.grp;
  d.hasGroups = new Set(Object.values(d.groups)).size > 0;
  d.meta = { ...d.meta, hasQty: !!d.hasQty, hasProg: d.prog.length > 0, hasSkuDb: d.skudb.length > 0 };
  return d;
}

export { FIELDS };
