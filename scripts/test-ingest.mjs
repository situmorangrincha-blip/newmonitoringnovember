import * as XLSX from 'xlsx';
import fs from 'node:fs';
import { parseMain, parseSku, parseProg, parseSkuDb, buildData } from '../src/lib/ingest.js';

const aoa = (rows, offR = 0, offC = 0) => {
  const out = Array.from({ length: offR }, () => []);
  for (const r of rows) out.push([...Array(offC).fill(null), ...r]);
  return XLSX.utils.aoa_to_sheet(out);
};
const sm = ['Hendra X', 'Steven Y'];
const stores = [];
for (let i = 1; i <= 20; i++) stores.push([sm[i % 2], '2016-' + String(i).padStart(4, '0'), 'TOKO ' + i, ['[1]SENIN', '[2]SELASA', 'Rute Hari Selasa Minggu 1&3'][i % 3], 'WARUNG', i % 2 ? 'MEDIUM' : 'SMALL', i % 4 === 0 ? 'Y' : '', 100000 * i, 150000 * i, 90000 * i, 120000 * i]);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aoa([['Laporan oktober'], [], ['Nama Salesman', 'ID Pelanggan', 'Nama Toko', 'Hari Kunj', 'Channel', 'CC5', 'Pareto JKS', 'Actual', 'Target', 'Sep', 'L3M /Month'], ...stores], 2, 2), 'OMSET');
XLSX.utils.book_append_sheet(wb, aoa([['Salesman', 'ID Toko', 'Nama Toko', 'Hari', 'Realisasi', 'Target', 'September', 'L3M'], ['Yudi Z', '2016-9001', 'KH 1', '[3]RABU', 700000, 900000, 500000, 600000], ['Yudi Z', '2016-9002', 'KH 2', '[3]RABU', 300000, 400000, 200000, 300000]]), 'KHUSUS YUDISTIRA');
XLSX.utils.book_append_sheet(wb, aoa([['Salesman', 'Principal', 'Target'], ['Hendra X', 'GPPJ', 5000000], ['Hendra X', 'MBR', 2000000], ['Steven Y', 'GPPJ', 4000000]]), 'TGT SALESMAN');
XLSX.utils.book_append_sheet(wb, aoa([['Hari', 'Salesman', 'ID Pelanggan', 'Nama Pelanggan', 'Target', 'Actual SO'], ['[2]SELASA', 'Hendra X', '2016-0002', 'TOKO 2', 800000, 0]]), 'DAP HENDRA');
const r = parseMain(wb, { team: 'arjuna', fileName: 't.xlsx', period: { year: 2026, month: 10, label: 'OCT 2026' } });
const d = r.data;
console.log('salesmen', d.salesmen, 'stores', d.stores.length, 'groups', d.stores.filter((s) => s.grp).length, 'dap', d.dap.length);
console.log('pj', d.stores.filter((s) => s.pj).length, 'targets', JSON.stringify(d.targets.milestone));
console.log('warn', d.warnings);

const wb2 = XLSX.utils.book_new();
const sku = [['Salesman', 'ID Pelanggan', 'Kode SKU', 'Nama SKU', 'Brand', 'Qty', 'Nilai']];
for (let i = 1; i <= 20; i++) for (const c of ['CH1', 'CH2']) sku.push([sm[i % 2], '2016-' + String(i).padStart(4, '0'), c, c === 'CH1' ? 'Chocolatos Wafer' : 'Chocolatos Drink', 'CHOCOLATOS', i, i * 5000]);
XLSX.utils.book_append_sheet(wb2, aoa(sku, 1, 1), 'QTY SKU');
const s = parseSku(wb2, { fileName: 'q.xlsx' });
const wb3 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb3, aoa([['Salesman', 'Target', 'Actual'], ['Hendra X', 10, 7], ['Steven Y', 10, 4]]), 'GREENSTORE');
XLSX.utils.book_append_sheet(wb3, aoa([['Salesman', 'ID Toko', 'Target', 'Actual'], ['Hendra X', '2016-0002', 3, 1]]), 'MSS');
const p = parseProg(wb3, {});
const wb4 = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb4, aoa([['Kode SKU', 'Nama SKU'], ['CH1', 'Chocolatos Wafer 20g'], ['CH2', 'Chocolatos Drink 28g']]), 'DATABASE SKU');
const k = parseSkuDb(wb4, {});
const full = buildData({ main: d, sku: s.data, prog: p.data, skudb: k.data }, 'kebayoran', 'arjuna');
console.log('sku subs', full.subs, 'qty stores', Object.keys(full.qty.cur).length, 'prog', full.prog, 'skudb', full.skudb.length, 'hasGroups', full.hasGroups, full.groups);
console.log('json kb', Math.round(JSON.stringify(full).length / 1024));

// format lama
const f = process.argv[2];
if (f && fs.existsSync(f)) {
  const wbl = XLSX.read(fs.readFileSync(f), { type: 'buffer', sheetRows: 8000 });
  const lr = parseMain(wbl, { team: 'arjuna', fileName: f });
  console.log('LEGACY arjuna stores', lr.data.stores.length, lr.data.salesmen);
  const lb = parseMain(wbl, { team: 'bima', fileName: f });
  console.log('LEGACY bima stores', lb.data.stores.length, lb.data.salesmen);
}
