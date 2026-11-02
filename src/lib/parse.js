// Parser Excel -> JSON, satu file untuk dua tim (Arjuna & Bima).
// Posisi data dicari lewat LABEL, bukan nomor cell, jadi geser baris/kolom sedikit tidak bikin rusak.
import * as XLSX from 'xlsx';

const norm = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const str = (v) => (v == null ? '' : String(v).trim());
const num = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);
const rp = (v) => Math.round(num(v));

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const MONTHS_ID = { MEI: 'MAY', AGU: 'AUG', AGT: 'AUG', OKT: 'OCT', DES: 'DEC' };

function grid(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
}

function findCell(g, pred, r0 = 0, r1 = g.length) {
  for (let r = r0; r < Math.min(r1, g.length); r++) {
    const row = g[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) if (row[c] != null && pred(row[c], r, c)) return { r, c };
  }
  return null;
}

export function parsePeriod(v) {
  const m = String(v ?? '').toUpperCase().match(/([A-Z]{3})[A-Z]*\W*(\d{4})/);
  if (!m) return null;
  const mon = MONTHS_ID[m[1]] || m[1];
  const mi = MONTHS.indexOf(mon);
  if (mi < 0) return null;
  return { year: +m[2], month: mi + 1, key: +m[2] * 12 + mi, label: `${m[1]} ${m[2]}` };
}

function periodAbove(g, r, c) {
  for (let rr = r - 1; rr >= Math.max(0, r - 18); rr--) {
    if (norm(g[rr]?.[c]) === 'PERIOD YMWD') return g[rr][c + 1];
  }
  return null;
}

// ukuran toko dari CC5. SUPERBIG dicek sebelum BIG (karena mengandung kata BIG).
export const SIZES = ['SMALL', 'MEDIUM', 'BIG', 'SUPERBIG'];
export function sizeOf(v) {
  const u = String(v ?? '').toUpperCase();
  if (u.includes('SUPERBIG')) return 'SUPERBIG';
  if (u.includes('MEDIUM')) return 'MEDIUM';
  if (u.includes('SMALL')) return 'SMALL';
  if (u.includes('BIG')) return 'BIG';
  return 'LAINNYA';
}

const DAYS = [['SENIN', 1], ['SELASA', 2], ['RABU', 3], ['KAMIS', 4], ['JUMAT', 5], ['SABTU', 6]];
const dayOf = (s) => {
  const u = String(s || '').toUpperCase();
  for (const [d, i] of DAYS) if (u.includes(d)) return i;
  return 0;
};

function sheetByName(wb) {
  const out = { dap: [] };
  for (const name of wb.SheetNames) {
    const n = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (n.startsWith('KHUSUS') || n.includes('IKTIAR') || n.includes('IKHTIAR')) out.ik = out.ik || name;
    else if (n === 'OLAPDAP') out.olapdap = name;
    else if (n.startsWith('DAP')) out.dap.push(name);
    else if (n.includes('BIMA')) out.bima = name;
    else if (n.includes('RECAP')) out.recap = name;
    else if (n === 'TGT') out.tgt = name;
    else if (n.includes('FOCUSCATEGORY')) out.cat = name;
    else if (n.startsWith('OLAPSALES')) out.sales = name;
    else if (n === 'LAB') out.lab = name;
    else if (n.includes('JKS')) out.jks = name;
  }
  return out;
}

// ---------- tim dikenali dari NAMA salesman ----------
export const DEFAULT_ROSTER = {
  arjuna: ['hendra', 'steven', 'rossi', 'mikael', 'rahmat'],
  bima: ['iktiar', 'prayogo', 'maesyaroh', 'maesaro', 'asep', 'kurniawan'],
};
export function teamOfName(name, roster = DEFAULT_ROSTER) {
  const toks = norm(name).toLowerCase().split(' ');
  for (const t of ['arjuna', 'bima']) {
    if ((roster[t] || []).some((k) => toks.includes(String(k).toLowerCase().trim()))) return t;
  }
  return null;
}
const isIktiar = (n) => norm(n).includes('IKTIAR') || norm(n).includes('IKHTIAR');

// ---------- (LOOK) RECAPT: daftar salesman tim Arjuna ----------
function parseRecap(g) {
  const h = findCell(g, (v) => norm(v) === 'ALL SALES PERFORMANCE');
  if (!h) throw new Error('Sheet RECAPT: tulisan "ALL SALES PERFORMANCE" tidak ketemu');
  const names = [];
  for (let r = h.r + 2; r < g.length; r++) {
    const v = str(g[r]?.[h.c]);
    if (!v || norm(v) === 'GRAND TOTAL') break;
    names.push(v);
  }
  if (!names.length) throw new Error('Sheet RECAPT: daftar salesman kosong');
  return names;
}

// ---------- TGT: target milestone & BTI ----------
function principalBase(h) {
  const x = h.replace(/^T\s+/i, '').trim().toUpperCase();
  const m = x.match(/^(.+?)[-\s][AB]$/); // GPPJ-A, GPPJ-B, MBR A -> GPPJ, MBR (FLORA tetap FLORA)
  return m ? m[1] : x;
}

function parseTarget(g, title) {
  const t = findCell(g, (v) => norm(v) === title);
  if (!t) return null;
  const hr = t.r + 1;
  const head = g[hr] || [];
  const nameCol = head.findIndex((v) => norm(v) === 'ROW LABELS');
  if (nameCol < 0) return null;
  const cols = [];
  for (let c = nameCol + 1; c < head.length; c++) {
    const h = str(head[c]);
    if (h) cols.push({ c, h, up: norm(h) });
  }
  const out = {};
  for (let r = hr + 1; r < g.length; r++) {
    const name = str(g[r]?.[nameCol]);
    if (!name || norm(name) === 'GRAND TOTAL') break;
    const o = { total: 0 };
    let sum = 0;
    for (const { c, h, up } of cols) {
      if (up.includes('TOTAL') || up.includes('SHARE')) continue;
      const v = num(g[r][c]);
      const b = principalBase(h);
      o[b] = (o[b] || 0) + v;
      sum += v;
    }
    o.total = sum; // total = jumlah semua kolom principal (termasuk FLORA)
    out[name] = o;
  }
  return out;
}

// ---------- pivot salesman x principal ----------
function parsePivotSalesman(g) {
  const p = findCell(g, (v, r, c) => norm(v) === 'PRINCIPAL' && norm(g[r]?.[c - 1]) === 'NETSALESPKD', 0, 60);
  if (!p) return null;
  const nameCol = p.c - 1;
  const hr = p.r + 1;
  const heads = [];
  for (let c = p.c; c < (g[hr]?.length || 0); c++) {
    const h = str(g[hr][c]);
    if (!h) break;
    heads.push({ c, h });
  }
  const out = {};
  for (let r = hr + 1; r < g.length; r++) {
    const name = str(g[r]?.[nameCol]);
    if (!name || norm(name) === 'GRAND TOTAL') break;
    const o = {};
    let tot = 0;
    for (const { c, h } of heads) {
      const v = num(g[r][c]);
      if (norm(h) === 'GRAND TOTAL') tot = v;
      else o[norm(h)] = v;
    }
    o.total = tot || Object.values(o).reduce((a, b) => a + b, 0);
    out[name] = o;
  }
  return { pAct: out, principals: heads.map((x) => norm(x.h)).filter((x) => x !== 'GRAND TOTAL') };
}

// ---------- blok per toko ----------
// kind: outlet_np (szName,SzCustId,NetSalesPKD) | outlet_pr (szName,SzCustId,szCust_Name + kolom principal)
//       cat_n (szName,SzCustId,<sub brand>)      | cat_b (SzCustId,szCust_Name,<sub brand>)
function findHeaders(g) {
  const out = [];
  for (let r = 0; r < Math.min(70, g.length); r++) {
    const row = g[r] || [];
    for (let c = 0; c < row.length - 1; c++) {
      const a = norm(row[c]);
      const b = norm(row[c + 1]);
      if (a === 'SZNAME' && b === 'SZCUSTID') {
        const x = norm(row[c + 2]);
        const kind = x === 'NETSALESPKD' ? 'outlet_np' : x === 'SZCUST_NAME' ? 'outlet_pr' : 'cat_n';
        out.push({ r, c, kind, hasAvg: norm(row[c + 3]) === 'L3M /MONTH', period: periodAbove(g, r, c) });
      } else if (a === 'SZCUSTID' && b === 'SZCUST_NAME' && norm(row[c - 1]) !== 'SZNAME') {
        out.push({ r, c, kind: 'cat_b', hasAvg: false, period: periodAbove(g, r, c) });
      }
    }
  }
  return out;
}

// beri label cur / lm / l3m ke blok-blok berdasarkan periode
function classify(blocks) {
  const l3m = blocks.find((b) => b.hasAvg || /MULTIPLE/i.test(String(b.period ?? '')));
  const rest = blocks.filter((b) => b !== l3m);
  rest.forEach((b) => (b.p = parsePeriod(b.period)));
  rest.sort((a, b) => (b.p?.key ?? -1) - (a.p?.key ?? -1) || a.c - b.c);
  const hasPeriods = rest.every((b) => b.p);
  const ordered = hasPeriods ? rest : [...rest].sort((a, b) => a.c - b.c);
  return { cur: ordered[0], lm: ordered[1], l3m };
}

// baris per toko: [{ name (salesman), id, v }]
function readOutletRows(g, b) {
  const rows = [];
  let vc = b.c + 2;
  if (b.kind === 'outlet_np') vc = b.hasAvg ? b.c + 3 : b.c + 2;
  if (b.kind === 'outlet_pr') {
    const head = g[b.r] || [];
    for (let c = b.c + 3; c < head.length; c++) if (norm(head[c]) === 'GRAND TOTAL') { vc = c; break; }
  }
  for (let r = b.r + 1; r < g.length; r++) {
    const id = str(g[r]?.[b.c + 1]);
    const nm = str(g[r]?.[b.c]);
    if (!id || norm(nm) === 'GRAND TOTAL') break;
    rows.push({ name: nm, id, v: num(g[r][vc]) });
  }
  return rows;
}

const sumById = (rows, filter) => {
  const m = {};
  for (const r of rows) if (!filter || filter(r)) m[r.id] = (m[r.id] || 0) + r.v;
  return m;
};
const mergeMaps = (...ms) => {
  const o = {};
  for (const m of ms) for (const [k, v] of Object.entries(m)) o[k] = (o[k] || 0) + v;
  return o;
};

// ---------- blok kategori (principal > [brand >] sub brand per toko) ----------
function hasBrandRow(g, b) {
  for (let r = Math.max(0, b.r - 5); r < b.r; r++) {
    for (let c = b.c + 2; c < b.c + 6; c++) if (norm(g[r]?.[c]) === 'BRAND') return true;
  }
  return false;
}

function readCatBlock(g, b, divide = 1) {
  const hdr = g[b.r] || [];
  const lv3 = hasBrandRow(g, b);
  const pRow = g[b.r - (lv3 ? 2 : 1)] || [];
  const bRow = lv3 ? g[b.r - 1] || [] : [];
  const first = b.c + 2;
  const cols = [];
  let gt = -1;
  for (let c = first; c < Math.max(hdr.length, pRow.length); c++) {
    const p = str(pRow[c]);
    if (norm(p) === 'GRAND TOTAL') { gt = c; break; }
    const sub = str(hdr[c]);
    const br = lv3 ? str(bRow[c]) : '';
    if (!p && !sub && !br) break;
    const P = norm(p) || 'LAINNYA';
    const brand = lv3 ? br || p || P : sub.split(' ')[0] || p || P;
    const n = sub || br || p || P;
    cols.push({ c, p: P, b: brand, n, key: P + '|' + n });
  }
  const hasName = b.kind === 'cat_n';
  const rows = [];
  for (let r = b.r + 1; r < g.length; r++) {
    const id = str(g[r]?.[hasName ? b.c + 1 : b.c]);
    if (!id || norm(id).startsWith('GRAND')) break;
    const name = hasName ? str(g[r][b.c]) : '';
    const vals = {};
    let sum = 0;
    for (const { c, key } of cols) {
      const v = num(g[r][c]);
      if (v) { vals[key] = (vals[key] || 0) + v / divide; sum += v; }
    }
    rows.push({ name, id, vals, total: (gt >= 0 ? num(g[r][gt]) : sum) / divide });
  }
  return { cols, rows };
}

// ---------- JKS ----------
function headerRow(g, must) {
  for (let r = 0; r < Math.min(40, g.length); r++) {
    const row = (g[r] || []).map(norm);
    if (must.every((m) => row.includes(m))) {
      const idx = {};
      row.forEach((h, i) => h && idx[h] === undefined && (idx[h] = i));
      return { r, idx };
    }
  }
  return null;
}

function readJks(gj, hj, names) {
  const J = hj.idx;
  const team = new Set(names.map(norm));
  const rows = [];
  for (let r = hj.r + 1; r < gj.length; r++) {
    const row = gj[r];
    const id = str(row?.[J['ID PELANGGAN']]);
    const sales = str(row?.[J['NAMA SALESMAN']]);
    if (!id || !team.has(norm(sales))) continue;
    rows.push({
      id,
      name: str(row[J['NAMA PELANGGAN']]),
      sales: names.find((s) => norm(s) === norm(sales)),
      hk: str(row[J['HARI KUNJ']]),
      day: dayOf(row[J['HARI KUNJ']]),
      cc1: str(row[J['CC1']]) || '-',
      cc2: str(row[J['CC2']]) || '-',
      cc5: str(row[J['CC5']]) || '-',
      size: sizeOf(row[J['CC5']]),
      tipe: str(row[J['TIPE SALES']]),
      kec: str(row[J['KECAMATAN']]),
      kel: str(row[J['KELURAHAN']]),
    });
  }
  return rows;
}

// Pareto otomatis (dipakai kalau tim tidak punya sheet LAB): 30 toko terbesar per salesman
// berdasarkan rata-rata L3M (lalu Sep, lalu Okt). SAK = 30 toko terbesar se-tim.
export function autoPareto(stores, salesmen, n = 30) {
  const cmp = (a, b) => b.l3m - a.l3m || b.lm - a.lm || b.act - a.act;
  const live = (s) => s.l3m > 0 || s.lm > 0 || s.act > 0;
  for (const name of salesmen) {
    stores.filter((s) => s.sales === name && live(s)).sort(cmp).slice(0, n).forEach((s) => { s.pj = true; });
  }
  const seen = new Set();
  for (const s of [...stores].sort(cmp)) {
    if (seen.size >= n) break;
    if (!live(s)) break;
    seen.add(s.id);
  }
  stores.forEach((s) => { s.ps = seen.has(s.id); });
}

const teamMeta = (period, region, fileName, uploadedAt, extra) => ({
  period: period ? { year: period.year, month: period.month, label: period.label } : null,
  uploadedAt: uploadedAt || new Date().toISOString(),
  fileName: fileName || '',
  region,
  ...extra,
});

// ---------- rakit satu dataset tim ----------
function assemble(o) {
  const { team, salesmen, targets, pAct, principals, jksRows, octMap, lmMap, l3mMap, lab, labById, catParts, warnings, meta } = o;
  const subs = [];
  const subIdx = {};
  const reg = (col) => {
    if (subIdx[col.key] === undefined) {
      subIdx[col.key] = subs.length;
      subs.push({ p: col.p, b: col.b, n: col.n });
    }
    return subIdx[col.key];
  };

  let labHits = 0;
  const stores = jksRows.map((s) => {
    const k = s.id + '|' + norm(s.sales);
    const l = lab[k] || (labById ? labById[s.id] : null) || {};
    if (lab[k]) labHits++;
    const wholesale = /WHOLESAL/i.test(s.tipe);
    return {
      ...s,
      min: l.min || (wholesale ? 1000000 : 200000),
      pj: !!l.pj,
      ps: !!l.ps,
      tgt: rp(l.tgt),
      act: rp(octMap[s.id]),
      lm: rp(lmMap[s.id]),
      l3m: rp(l3mMap[s.id]),
    };
  });
  const hasLab = labHits > 0;
  if (!hasLab) {
    autoPareto(stores, salesmen);
    warnings.push('Info: tim ini tidak punya sheet LAB, jadi Pareto JKS/SAK dihitung otomatis (30 toko terbesar berdasarkan rata-rata L3M), CA Produktif pakai minimum default (retail 200rb, grosir 1jt), dan target per toko tidak tersedia');
  } else {
    const noMin = jksRows.filter((s) => !((lab[s.id + '|' + norm(s.sales)] || (labById ? labById[s.id] : null) || {}).min > 0)).length;
    if (noMin) warnings.push(`Info: ${noMin} toko belum punya Minimum CA Prod di LAB, dipakai default (retail 200rb, grosir 1jt)`);
  }

  // kategori / sub brand per toko (hanya toko tim, biar file kecil)
  const ids = new Set(stores.map((s) => s.id));
  const cat = { cur: {}, lm: {}, l3m: {} };
  for (const per of ['cur', 'lm', 'l3m']) {
    for (const part of catParts[per] || []) {
      const idx = part.cols.map(reg);
      const byKey = {};
      part.cols.forEach((c, i) => { byKey[c.key] = idx[i]; });
      for (const row of part.rows) {
        if (!ids.has(row.id)) continue;
        const t = cat[per][row.id] || (cat[per][row.id] = {});
        for (const [k, v] of Object.entries(row.vals)) t[byKey[k]] = (t[byKey[k]] || 0) + v;
      }
    }
  }
  for (const per of ['cur', 'lm', 'l3m']) {
    for (const t of Object.values(cat[per])) for (const k of Object.keys(t)) t[k] = Math.round(t[k]);
  }

  // cek silang
  const actStores = stores.reduce((a, s) => a + s.act, 0);
  const actPivot = Object.values(pAct).reduce((a, x) => a + (x.total || 0), 0);
  if (Math.abs(actStores - actPivot) > Math.max(1000, actPivot * 0.001)) {
    warnings.push(
      `Info: ACT per toko (${Math.round(actStores).toLocaleString('id-ID')}) beda dengan pivot salesman (${Math.round(actPivot).toLocaleString('id-ID')}): ada toko yang dijual salesman tapi tidak terdaftar di JKS-nya`
    );
  }
  for (const name of salesmen) {
    const a = stores.filter((x) => x.sales === name).reduce((t, x) => t + x.act, 0);
    const b = pAct[name]?.total || 0;
    if (Math.abs(a - b) > 100000) {
      warnings.push(`Info: ACT ${name} di pivot ${Math.round(b).toLocaleString('id-ID')} vs total tokonya di JKS ${Math.round(a).toLocaleString('id-ID')} (ada toko yang dijual salesman lain)`);
    }
  }

  return {
    v: 2,
    team,
    meta: { ...meta, storeTgt: hasLab, autoPareto: !hasLab, actStores, actPivot, hasBti: !!targets.bti },
    salesmen,
    principals,
    targets,
    pAct,
    stores,
    subs,
    cat,
    history: [],
    settings: {},
    warnings,
  };
}

const pickTargets = (t, names, warnings) => {
  const o = {};
  if (!t) return o;
  const m = Object.fromEntries(Object.entries(t).map(([k, v]) => [norm(k), v]));
  for (const s of names) {
    if (m[norm(s)]) o[s] = m[norm(s)];
    else warnings.push(`Target "${s}" tidak ada di TGT`);
  }
  return o;
};
const pickPact = (piv, names) => {
  const m = Object.fromEntries(Object.entries(piv?.pAct || {}).map(([k, v]) => [norm(k), v]));
  const o = {};
  for (const s of names) if (m[norm(s)]) o[s] = m[norm(s)];
  return o;
};

// ---------- DAP ----------
function parseDapSheet(g) {
  const h = headerRow(g, ['ID PELANGGAN', 'TARGET']);
  if (!h) return [];
  const I = h.idx;
  const col = (...ns) => {
    for (const n of ns) if (I[n] !== undefined) return I[n];
    return -1;
  };
  const c = {
    sales: col('SALESMAN', 'NAMA SALESMAN'), jks: col('JKS', 'HARI KUNJ'), id: col('ID PELANGGAN'), name: col('NAMA PELANGGAN'),
    ch: col('CATEGORY CHANNEL'), tgt: col('TARGET'), est: col('ESTIMATE BY SALESMAN'), estp: col('ESTIMATE BY SALESMAN (PPN)'),
    hp: col('HP'), par: col('PARETO'), so: col('ACTUAL SO'), m1: col('JUNI'), m2: col('JULI'), m3: col('AGUSTUS'),
  };
  const out = [];
  const get = (row, i) => (i >= 0 ? row[i] : null);
  for (let r = h.r + 1; r < g.length; r++) {
    const row = g[r] || [];
    const id = str(get(row, c.id));
    const sales = str(get(row, c.sales));
    if (!/^\d{4}-/.test(id) || !sales) continue;
    out.push({
      id,
      n: str(get(row, c.name)),
      s: sales,
      r: str(get(row, c.jks)),
      ch: str(get(row, c.ch)),
      t: rp(get(row, c.tgt)),
      e: rp(get(row, c.est)),
      hp: str(get(row, c.hp)),
      par: str(get(row, c.par)),
      so: rp(get(row, c.so)),
      m: [rp(get(row, c.m1)), rp(get(row, c.m2)), rp(get(row, c.m3))],
    });
  }
  return out;
}

// OLAP DAP: pivot penjualan per toko per tim (dibedakan lewat label szStatusTim di atas tiap blok)
function parseOlapDap(g) {
  const maps = {};
  for (const b of findHeaders(g).filter((h) => h.kind === 'outlet_np')) {
    let team = null;
    for (let rr = b.r - 1; rr >= Math.max(0, b.r - 14); rr--) {
      if (norm(g[rr]?.[b.c]) === 'SZSTATUSTIM') {
        const v = norm(g[rr][b.c + 1]);
        team = v.includes('ARJUNA') ? 'arjuna' : v.includes('BIMA') ? 'bima' : null;
        break;
      }
    }
    if (team) maps[team] = mergeMaps(maps[team] || {}, sumById(readOutletRows(g, b)));
  }
  return maps;
}

// ---------- pintu masuk ----------
export function parseAll(wb, metaIn = {}) {
  const top = [];
  const roster = metaIn.roster || DEFAULT_ROSTER;
  const teamOf = (n) => teamOfName(n, roster);
  const sh = sheetByName(wb);
  const G = (k) => grid(wb.Sheets[sh[k]]);
  const fileName = metaIn.fileName || '';
  const uploadedAt = metaIn.uploadedAt;
  const out = { arjuna: null, bima: null, warnings: top };

  const gt = sh.tgt ? G('tgt') : null;
  const milestone = gt ? parseTarget(gt, 'TARGET MILESTONE') : null;
  const bti = gt ? parseTarget(gt, 'TARGET BTI') : null;
  const gj = sh.jks ? G('jks') : null;
  const hj = gj ? headerRow(gj, ['ID PELANGGAN', 'NAMA SALESMAN']) : null;

  // daftar salesman per tim: dari JKS, dikenali lewat nama
  const names = { arjuna: [], bima: [] };
  if (gj && hj) {
    const seen = new Set();
    const all = [];
    for (let r = hj.r + 1; r < gj.length; r++) {
      const n = str(gj[r]?.[hj.idx['NAMA SALESMAN']]);
      if (n && !seen.has(norm(n))) { seen.add(norm(n)); all.push(n); }
    }
    for (const t of ['arjuna', 'bima']) {
      const mine = all.filter((n) => teamOf(n) === t);
      const order = (n) => (roster[t] || []).findIndex((k) => norm(n).toLowerCase().split(' ').includes(String(k).toLowerCase()));
      names[t] = mine.sort((a, b) => order(a) - order(b));
    }
    const loose = all.filter((n) => !teamOf(n));
    if (loose.length) top.push(`Nama salesman di JKS yang belum masuk tim mana pun (diabaikan): ${loose.join(', ')}. Tambahkan lewat "Atur nama tim".`);
  }

  // sheet OLAP Arjuna
  let A = null;
  if (sh.sales) {
    const gs = G('sales');
    const heads = findHeaders(gs);
    const ob = classify(heads.filter((h) => h.kind === 'outlet_np'));
    const rg = findCell(gs, (v) => norm(v) === 'REGION', 0, 60);
    A = {
      piv: parsePivotSalesman(gs),
      ob,
      region: rg ? str(gs[rg.r]?.[rg.c + 1]).replace(/^\d+\s*-\s*/, '') : '',
      rows: {
        cur: ob.cur ? readOutletRows(gs, ob.cur) : [],
        lm: ob.lm ? readOutletRows(gs, ob.lm) : [],
        l3m: ob.l3m ? readOutletRows(gs, ob.l3m) : [],
      },
    };
  }
  let AC = null;
  if (sh.cat) {
    const gc = G('cat');
    const cb = classify(findHeaders(gc).filter((h) => h.kind === 'cat_n'));
    AC = {
      cur: cb.cur ? readCatBlock(gc, cb.cur, 1) : null,
      lm: cb.lm ? readCatBlock(gc, cb.lm, 1) : null,
      l3m: cb.l3m ? readCatBlock(gc, cb.l3m, 3) : null, // L3M = total 3 bulan -> dibagi 3 = rata-rata per bulan
    };
  }

  // LAB (hanya tim Arjuna)
  const lab = {};
  const labById = {};
  let labWarn = null;
  if (sh.lab) {
    const gl = G('lab');
    const hl = headerRow(gl, ['ID PELANGGAN', 'NAMA SALESMAN', 'TGT']);
    if (hl) {
      const L = hl.idx;
      for (let r = hl.r + 1; r < gl.length; r++) {
        const row = gl[r];
        const id = str(row?.[L['ID PELANGGAN']]);
        if (!id) continue;
        const rec = {
          min: num(row[L['MINIMUM PROD']]),
          pj: norm(row[L['PARETO JKS']]) === 'PARETO JKS',
          ps: ['PARETO JKS', 'PARETO SAK'].includes(norm(row[L['PARETO SAK']])),
          tgt: num(row[L['TGT']]),
        };
        lab[id + '|' + norm(row[L['NAMA SALESMAN']])] = rec;
        labById[id] = rec;
      }
    } else labWarn = 'Sheet LAB: header tidak lengkap (butuh Id Pelanggan, Nama Salesman, TGT)';
  }

  // DAP + OLAP DAP
  const dapAll = [];
  for (const n of sh.dap) dapAll.push(...parseDapSheet(grid(wb.Sheets[n])));
  const olapDap = sh.olapdap ? parseOlapDap(G('olapdap')) : {};
  const attachDap = (d, team, storeAct, ikAct) => {
    const rows = dapAll.filter((x) => teamOf(x.s) === team);
    d.dap = rows.map((x) => {
      let a;
      if (isIktiar(x.s)) a = ikAct?.[x.id] ?? 0;
      else a = olapDap[team]?.[x.id] ?? storeAct[x.id] ?? 0;
      return { ...x, a: rp(a) };
    });
    d.meta.hasDap = d.dap.length > 0;
    if (!d.dap.length) d.warnings.push('Info: sheet DAP untuk tim ini tidak ada / kosong, halaman DAP tidak tersedia');
    else {
      const have = new Set(d.dap.map((x) => norm(x.s)));
      for (const s of d.salesmen) if (!have.has(norm(s))) d.warnings.push(`Info: ${s} belum punya toko di sheet DAP`);
    }
  };

  // ===== ARJUNA =====
  try {
    for (const [k, label] of [['tgt', 'TGT'], ['sales', 'OLAP SALES'], ['jks', 'JKS SALESMAN']]) {
      if (!sh[k]) throw new Error(`Sheet "${label}" tidak ditemukan`);
    }
    if (!names.arjuna.length) throw new Error('tidak ada salesman tim Arjuna di JKS (cek "Atur nama tim")');
    const w = [];
    if (labWarn) w.push(labWarn);
    if (!sh.lab) w.push('Sheet LAB tidak ada: target toko, min CA prod & flag pareto kosong');
    if (!sh.cat) w.push('Sheet OLAP FOCUS CATEGORY tidak ada: tampilan kategori/SKU per toko kosong');
    if (!milestone) throw new Error('Sheet TGT: blok "TARGET MILESTONE" tidak ketemu');
    if (!bti) w.push('Sheet TGT: blok "TARGET BTI" tidak ketemu, pilihan BTI dimatikan');
    if (!hj) throw new Error('Sheet JKS SALESMAN: header "Id Pelanggan" / "Nama Salesman" tidak ketemu');
    if (!A.piv) throw new Error('Sheet OLAP SALES: pivot salesman x principal tidak ketemu');
    const salesmen = names.arjuna;
    const pAct = pickPact(A.piv, salesmen);
    for (const s of salesmen) if (!pAct[s]) w.push(`Salesman "${s}" belum ada di pivot OLAP SALES (anggap ACT 0)`);
    if (!A.ob.cur) throw new Error('Sheet OLAP SALES: pivot per outlet (bulan ini) tidak ketemu');
    if (!A.ob.lm) w.push('Pivot bulan lalu per outlet tidak ketemu');
    if (!A.ob.l3m) w.push('Pivot L3M per outlet tidak ketemu');
    const period = A.ob.cur.p || parsePeriod(A.ob.cur.period);
    if (!period) w.push('Periode bulan berjalan tidak terbaca, dipakai bulan dari tanggal hari ini');
    const jksRows = readJks(gj, hj, salesmen);
    if (!jksRows.length) throw new Error('Sheet JKS SALESMAN: tidak ada toko milik salesman Arjuna');
    if (hj.idx['CC5'] === undefined) w.push('Sheet JKS SALESMAN: kolom CC5 tidak ada, ukuran toko (SMALL/MEDIUM/BIG/SUPERBIG) kosong');
    const mine = (r) => teamOf(r.name) === 'arjuna'; // CA/ACT hanya dari penjualan salesman tim ini
    const tm = pickTargets(milestone, salesmen, w);
    const principals = [...new Set([...A.piv.principals, ...Object.values(tm).flatMap((o) => Object.keys(o).filter((k) => k !== 'total' && o[k] > 0))])];
    const octMap = sumById(A.rows.cur, mine);
    out.arjuna = assemble({
      team: 'arjuna',
      salesmen,
      targets: { milestone: tm, bti: bti ? pickTargets(bti, salesmen, w) : null },
      pAct,
      principals,
      jksRows,
      octMap,
      lmMap: sumById(A.rows.lm, mine),
      l3mMap: sumById(A.rows.l3m, mine),
      lab,
      labById,
      catParts: {
        cur: AC?.cur ? [{ cols: AC.cur.cols, rows: AC.cur.rows.filter(mine) }] : [],
        lm: AC?.lm ? [{ cols: AC.lm.cols, rows: AC.lm.rows.filter(mine) }] : [],
        l3m: AC?.l3m ? [{ cols: AC.l3m.cols, rows: AC.l3m.rows.filter(mine) }] : [],
      },
      warnings: w,
      meta: teamMeta(period, A.region, fileName, uploadedAt, { teamLabel: 'Arjuna' }),
    });
    attachDap(out.arjuna, 'arjuna', octMap, null);
  } catch (e) {
    top.push('Tim Arjuna dilewati: ' + (e.message || e));
  }

  // ===== BIMA =====
  if (sh.bima) {
    try {
      const w = [];
      const gb = G('bima');
      if (!milestone) throw new Error('Sheet TGT: blok "TARGET MILESTONE" tidak ketemu');
      if (!hj) throw new Error('Sheet JKS SALESMAN: header "Id Pelanggan" / "Nama Salesman" tidak ketemu');
      if (!names.bima.length) throw new Error('tidak ada salesman tim Bima di JKS (cek "Atur nama tim")');
      const salesmen = names.bima;
      const jksRows = readJks(gj, hj, salesmen);
      if (!jksRows.length) throw new Error('Sheet JKS SALESMAN: tidak ada toko milik salesman Bima');
      const ikNames = salesmen.filter(isIktiar);
      const ikStores = new Set(jksRows.filter((r) => isIktiar(r.sales)).map((r) => r.id));
      const nonIk = (r) => teamOf(r.name) === 'bima' && !isIktiar(r.name);

      // --- sumber 1: sheet BIMA (semua salesman Bima kecuali Iktiar)
      const piv = parsePivotSalesman(gb);
      if (!piv) throw new Error('Sheet BIMA: pivot salesman x principal tidak ketemu');
      const heads = findHeaders(gb);
      const op = classify(heads.filter((h) => h.kind === 'outlet_pr'));
      if (!op.cur) throw new Error('Sheet BIMA: pivot per toko (bulan ini) tidak ketemu');
      const cb = classify(heads.filter((h) => h.kind === 'cat_b'));
      const catB = {
        cur: cb.cur ? readCatBlock(gb, cb.cur, 1) : null,
        lm: cb.lm ? readCatBlock(gb, cb.lm, 1) : null,
        l3m: cb.l3m ? readCatBlock(gb, cb.l3m, 3) : null,
      };
      if (!catB.cur) w.push('Pivot kategori Bima (bulan ini) tidak ketemu');
      if (!catB.lm) w.push('Pivot kategori Bima (Sep) tidak ketemu: nilai Sep per toko kosong');
      if (!catB.l3m) w.push('Pivot kategori Bima (L3M) tidak ketemu: nilai L3M per toko kosong');
      const period = op.cur.p || parsePeriod(op.cur.period);
      const rg = findCell(gb, (v) => norm(v) === 'REGION', 0, 60);
      const region = rg ? str(gb[rg.r]?.[rg.c + 1]).replace(/^\d+\s*-\s*/, '') : '';
      const notIkStore = (r) => !ikStores.has(r.id);
      const catTot = (blk, keep) => (blk ? sumById(blk.rows.filter(keep).map((r) => ({ id: r.id, v: r.total }))) : {});

      let octMap = sumById(readOutletRows(gb, op.cur), nonIk);
      let lmMap = catTot(catB.lm, notIkStore);
      let l3mMap = catTot(catB.l3m, notIkStore);
      const pAct = pickPact(piv, salesmen.filter((s) => !isIktiar(s)));
      const parts = {
        cur: catB.cur ? [{ cols: catB.cur.cols, rows: catB.cur.rows.filter(notIkStore) }] : [],
        lm: catB.lm ? [{ cols: catB.lm.cols, rows: catB.lm.rows.filter(notIkStore) }] : [],
        l3m: catB.l3m ? [{ cols: catB.l3m.cols, rows: catB.l3m.rows.filter(notIkStore) }] : [],
      };

      // --- sumber 2: sheet khusus Iktiar (seluruh omset Iktiar hanya dari sini)
      const ikAct = {};
      if (ikNames.length) {
        if (!sh.ik) {
          w.push('Sheet khusus Iktiar (KHUSUS IKTIAR) tidak ada: omset Iktiar dianggap 0');
        } else {
          const gi = G('ik');
          const ipiv = parsePivotSalesman(gi);
          const ih = findHeaders(gi);
          const iop = classify(ih.filter((h) => h.kind === 'outlet_pr'));
          const icb = classify(ih.filter((h) => h.kind === 'cat_b'));
          const ikOnly = (r) => isIktiar(r.name);
          const inIk = (r) => ikStores.has(r.id);
          if (ipiv) Object.assign(pAct, pickPact(ipiv, ikNames));
          else w.push('Sheet khusus Iktiar: pivot salesman x principal tidak ketemu');
          if (iop.cur) {
            const m = sumById(readOutletRows(gi, iop.cur), ikOnly);
            octMap = mergeMaps(octMap, m);
            Object.assign(ikAct, m);
          } else w.push('Sheet khusus Iktiar: pivot per toko (bulan ini) tidak ketemu');
          const ib = {
            cur: icb.cur ? readCatBlock(gi, icb.cur, 1) : null,
            lm: icb.lm ? readCatBlock(gi, icb.lm, 1) : null,
            l3m: icb.l3m ? readCatBlock(gi, icb.l3m, 3) : null,
          };
          lmMap = mergeMaps(lmMap, catTot(ib.lm, inIk));
          l3mMap = mergeMaps(l3mMap, catTot(ib.l3m, inIk));
          for (const per of ['cur', 'lm', 'l3m']) if (ib[per]) parts[per].push({ cols: ib[per].cols, rows: ib[per].rows.filter(inIk) });
          w.push(`Info: omset ${ikNames.join(', ')} dibaca hanya dari sheet khusus Iktiar (basis semua produk), baris Iktiar di sheet lain diabaikan`);
        }
      }

      const tm = pickTargets(milestone, salesmen, w);
      for (const s of salesmen) if (!pAct[s]) w.push(`Salesman "${s}" belum ada di pivot (anggap ACT 0)`);
      const principals = [...new Set([...piv.principals, ...Object.values(pAct).flatMap((o) => Object.keys(o).filter((k) => k !== 'total' && o[k] > 0)), ...Object.values(tm).flatMap((o) => Object.keys(o).filter((k) => k !== 'total' && o[k] > 0))])];
      out.bima = assemble({
        team: 'bima',
        salesmen,
        targets: { milestone: tm, bti: bti ? pickTargets(bti, salesmen, w) : null },
        pAct,
        principals,
        jksRows,
        octMap,
        lmMap,
        l3mMap,
        lab: {},
        labById: null,
        catParts: parts,
        warnings: w,
        meta: teamMeta(period, region, fileName, uploadedAt, { teamLabel: 'Bima' }),
      });
      attachDap(out.bima, 'bima', octMap, ikAct);
    } catch (e) {
      top.push('Tim Bima dilewati: ' + (e.message || e));
    }
  }

  if (!out.arjuna && !out.bima) throw new Error(top.join(' | ') || 'File tidak berisi data tim yang dikenali');
  return out;
}

// kompatibel dengan kode lama: ambil dataset Arjuna
export function parseWorkbook(wb, meta) {
  const r = parseAll(wb, meta);
  if (!r.arjuna) throw new Error(r.warnings.join(' | '));
  return r.arjuna;
}
