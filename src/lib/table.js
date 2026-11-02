// Pembaca tabel generik: posisi tabel bebas, nama kolom dicocokkan longgar (sinonim), peran sheet dikenali dari JUDUL sheet.
import * as XLSX from 'xlsx';

export const key = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const str = (v) => (v == null ? '' : String(v).trim());

// angka dari sel: angka asli, atau teks "Rp 1.234.567" / "1,234.5" / "1.234,5"
export function toNum(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  let s = String(v ?? '').trim();
  if (!s || s === '-') return 0;
  s = s.replace(/rp|idr|\s/gi, '').replace(/%$/, '');
  const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/[()\-]/g, '');
  const dots = (s.match(/\./g) || []).length;
  const com = (s.match(/,/g) || []).length;
  if (dots && com) s = s.lastIndexOf('.') > s.lastIndexOf(',') ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  else if (com > 1 || (com === 1 && /,\d{3}$/.test(s))) s = s.replace(/,/g, '');
  else if (com === 1) s = s.replace(',', '.');
  else if (dots > 1 || (dots === 1 && /\.\d{3}$/.test(s))) s = s.replace(/\./g, '');
  const n = parseFloat(s);
  return isFinite(n) ? (neg ? -n : n) : 0;
}

export const isYes = (v) => {
  const s = key(v);
  return !!s && !['0', 'N', 'NO', 'TIDAK', 'FALSE', 'NON', 'NONPARETO', 'X'].includes(s);
};

// ---------- peran sheet dari judul ----------
// khusus -> sheet "KHUSUS <nama>" (menimpa data salesman/tim yang tercantum)
export function sheetRole(name) {
  const k = key(name);
  if (k.startsWith('KHUSUS')) return 'khusus';
  if (/(DATABASESKU|MASTERSKU|SKUDB|SKUMASTER|DAFTARSKU|^SKU$|^MASTER)/.test(k)) return 'skudb';
  if (/(GREEN|MSS|PROGRAM)/.test(k)) return 'prog';
  if (/(QTY|QUANTITY|KUANTITAS)/.test(k)) return 'sku';
  if (k.includes('OLAPDAP') || k.startsWith('DAP')) return k === 'OLAPDAP' ? 'olapdap' : 'dap';
  if (/(PARETO|^LAB$)/.test(k)) return 'pareto';
  if (/^(TGT|TARGET)/.test(k) || k.includes('TARGETSALESMAN')) return 'target';
  return 'main';
}

// ---------- definisi kolom (sinonim, sudah dinormalisasi) ----------
export const FIELDS = {
  sales: ['SALESMAN', 'NAMASALESMAN', 'NAMASALES', 'SALES', 'SLS', 'NAMASLS'],
  id: ['IDPELANGGAN', 'IDTOKO', 'IDOUTLET', 'KODETOKO', 'KODEPELANGGAN', 'KODEOUTLET', 'IDCUST', 'SZCUSTID', 'CUSTID', 'IDCUSTOMER', 'ID'],
  name: ['NAMAPELANGGAN', 'NAMATOKO', 'NAMAOUTLET', 'NAMACUSTOMER', 'SZCUSTNAME', 'SZNAME', 'CUSTNAME', 'TOKO', 'OUTLET', 'PELANGGAN'],
  route: ['HARIKUNJ', 'HARIKUNJUNGAN', 'RUTEHARI', 'RUTE', 'ROUTE', 'JKS', 'HARI'],
  channel: ['CATEGORYCHANNEL', 'CHANNEL', 'CC1', 'SALURAN'],
  size: ['CC5', 'UKURANTOKO', 'UKURAN', 'SIZETOKO', 'SIZE'],
  pareto: ['PARETOJKS', 'PARETO', 'ISPARETO', 'TOKOPARETO'],
  paretoSak: ['PARETOSAK'],
  principal: ['PRINCIPAL', 'PRINSIPAL', 'PRIN'],
  brand: ['BRAND', 'MEREK'],
  category: ['KATEGORI', 'CATEGORY', 'SUBBRAND', 'SUBKATEGORI', 'KATEGORIFOKUS'],
  code: ['KODESKU', 'SKUCODE', 'IDSKU', 'SKUID', 'KODEBARANG', 'KODEPRODUK', 'KODEITEM', 'KODE', 'SKU'],
  skuName: ['NAMASKU', 'SKUNAME', 'NAMABARANG', 'NAMAPRODUK', 'NAMAITEM', 'DESKRIPSI', 'DESCRIPTION', 'PRODUK', 'BARANG', 'NAMA'],
  act: ['ACTUAL', 'ACT', 'REALISASI', 'OMSET', 'NETSALES', 'NETSALESPKD', 'NILAI', 'VALUE', 'REVENUE', 'PENCAPAIAN', 'ACHIEVEMENT', 'ACH'],
  qty: ['QTY', 'QUANTITY', 'KUANTITAS', 'QTYPCS', 'JUMLAH', 'VOLUME'],
  target: ['TARGET', 'TGT', 'TARGETBULAN', 'TARGETMILESTONE'],
  lm: ['SEPTEMBER', 'SEPT', 'SEP', 'LM', 'LASTMONTH', 'BULANLALU', 'PREVMONTH'],
  l3m: ['L3MMONTH', 'L3MAVG', 'AVGL3M', 'RATARATAL3M', 'RATA2L3M', 'L3M'],
  min: ['MINIMUMPROD', 'MINCAPROD', 'MINIMUMCA', 'MINCA', 'MINPROD'],
  tim: ['TIM', 'TEAM', 'GRUP', 'GROUP', 'STATUSTIM', 'SZSTATUSTIM'],
  program: ['PROGRAM', 'INDIKATOR', 'KPI'],
  est: ['ESTIMATEBYSALESMAN', 'ESTIMASI', 'ESTIMATE'],
  so: ['ACTUALSO', 'SO'],
  hp: ['HP'],
};

export const FIELD_LABEL = {
  sales: 'Salesman', id: 'ID Toko', name: 'Nama Toko', route: 'Hari Kunjungan', channel: 'Channel', size: 'Ukuran Toko', pareto: 'Pareto JKS', paretoSak: 'Pareto SAK',
  principal: 'Principal', brand: 'Brand', category: 'Kategori', code: 'Kode SKU', skuName: 'Nama SKU', act: 'Actual / Omset', qty: 'Qty', target: 'Target',
  lm: 'Bulan Lalu (Sep)', l3m: 'Rata-rata L3M', min: 'Min CA Prod', tim: 'Tim', program: 'Program', est: 'Estimasi', so: 'Actual SO', hp: 'HP',
};

// kolom yang wajib ada supaya tabel dianggap cocok, per jenis tabel
export const SPEC = {
  main: { want: ['sales', 'id', 'name', 'route', 'channel', 'size', 'pareto', 'paretoSak', 'principal', 'brand', 'category', 'code', 'skuName', 'act', 'qty', 'target', 'lm', 'l3m', 'min', 'tim'], need: ['sales', 'id'] },
  sku: { want: ['sales', 'id', 'name', 'principal', 'brand', 'category', 'code', 'skuName', 'act', 'qty', 'target'], need: ['id', 'qty'] },
  prog: { want: ['sales', 'id', 'name', 'program', 'target', 'act'], need: ['target', 'act'] },
  skudb: { want: ['code', 'skuName', 'brand', 'category', 'principal'], need: ['code'] },
  target: { want: ['sales', 'principal', 'brand', 'target'], need: ['sales', 'target'] },
  pareto: { want: ['sales', 'id', 'name', 'pareto', 'paretoSak', 'target', 'min'], need: ['id'] },
  dap: { want: ['sales', 'route', 'id', 'name', 'channel', 'target', 'est', 'hp', 'pareto', 'so'], need: ['id', 'target'] },
};

// petakan kolom pada satu baris header -> { field: index }
function mapRow(cells, want, override = {}) {
  const heads = cells.map(key);
  const used = new Set();
  const map = {};
  for (const f of want) {
    const ov = override[f];
    if (ov) {
      const i = heads.indexOf(key(ov));
      if (i >= 0 && !used.has(i)) { map[f] = i; used.add(i); continue; }
    }
  }
  // 1) cocok persis, urut sinonim (sinonim awal = prioritas)
  for (const f of want) {
    if (map[f] !== undefined) continue;
    for (const syn of FIELDS[f]) {
      const i = heads.findIndex((h, ix) => h === syn && !used.has(ix));
      if (i >= 0) { map[f] = i; used.add(i); break; }
    }
  }
  // 2) mengandung sinonim panjang (>=4 huruf), kecuali kolom ambigu
  const loose = ['target', 'act', 'qty', 'lm', 'l3m', 'route', 'channel', 'pareto'];
  for (const f of want) {
    if (map[f] !== undefined || !loose.includes(f)) continue;
    for (const syn of FIELDS[f]) {
      if (syn.length < 3) continue;
      const i = heads.findIndex((h, ix) => h.length > 0 && h.includes(syn) && !used.has(ix));
      if (i >= 0) { map[f] = i; used.add(i); break; }
    }
  }
  return map;
}

export function grid(ws, maxRows = 60000) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false }).slice(0, maxRows);
}

// cari baris header terbaik; kembalikan { hr, map, heads } atau null
export function findHeader(g, spec, override = {}) {
  let best = null;
  for (let r = 0; r < Math.min(g.length, 80); r++) {
    const cells = (g[r] || []).map((v) => (typeof v === 'string' ? v : v == null ? '' : typeof v === 'number' ? '' : String(v)));
    if (cells.filter(Boolean).length < 2) continue;
    const map = mapRow(cells, spec.want, override);
    if (!spec.need.every((f) => map[f] !== undefined)) continue;
    const score = Object.keys(map).length;
    if (!best || score > best.score) best = { hr: r, map, score, heads: cells };
  }
  return best;
}

// baca satu sheet sebagai tabel. kind = kunci SPEC. Hasil: { rows:[{field:value}], map, heads, hr } | null
export function readTable(ws, kind, override = {}) {
  const spec = SPEC[kind];
  const g = grid(ws);
  const h = findHeader(g, spec, override);
  if (!h) return null;
  const rows = [];
  const keyField = spec.need[0];
  for (let r = h.hr + 1; r < g.length; r++) {
    const row = g[r] || [];
    const first = str(row.find((v) => v != null && v !== ''));
    if (/^(GRAND\s*TOTAL|TOTAL)$/i.test(first)) break;
    const o = {};
    let any = false;
    for (const [f, i] of Object.entries(h.map)) {
      const v = row[i];
      o[f] = v == null ? null : v;
      if (f === keyField && str(v) !== '') any = true;
    }
    if (any) rows.push(o);
  }
  return { rows, map: h.map, heads: h.heads, hr: h.hr, kind };
}

// info pemetaan untuk ditampilkan di layar "pemetaan kolom"
export function describeMap(t, kind) {
  if (!t) return [];
  return SPEC[kind].want.map((f) => ({ f, label: FIELD_LABEL[f], col: t.map[f] !== undefined ? t.heads[t.map[f]] : '', need: SPEC[kind].need.includes(f) }));
}

// semua sheet di workbook beserta perannya
export const sheetsByRole = (wb) => {
  const out = {};
  for (const n of wb.SheetNames) (out[sheetRole(n)] ||= []).push(n);
  return out;
};

export const grpName = (sheetName) => {
  const t = String(sheetName).replace(/^\s*khusus\s*/i, '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
};
