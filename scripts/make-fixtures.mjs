import * as XLSX from 'xlsx';
const out = process.argv[2] || '/home/claude/test';
const aoa = (rows, offR = 0, offC = 0) => XLSX.utils.aoa_to_sheet([...Array.from({ length: offR }, () => []), ...rows.map((r) => [...Array(offC).fill(null), ...r])]);
const sm = ['Hendra Mulya', 'Lie Steven Budi', 'Rossi Mustaqim'];
const routes = ['[1]SENIN', '[2]SELASA', '[3]RABU', '[2]SELASA', 'Rute Hari Selasa Minggu 1&3'];
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const stores = [];
for (let i = 1; i <= 90; i++) {
  const s = sm[i % 3];
  const act = Math.round(rnd() * 900000 / 1000) * 1000;
  stores.push([s, '2016-' + String(i).padStart(4, '0'), 'TOKO ' + i + ' ' + s.split(' ')[0].toUpperCase(), routes[i % 5], i % 7 === 0 ? 'GROSIR' : 'WARUNG', ['SMALL', 'MEDIUM', 'BIG'][i % 3], i % 4 === 0 ? 'Y' : '', act, Math.round(act * 1.3 / 1000) * 1000 + 100000, Math.round(act * 1.1), Math.round(act * 1.2)]);
}
let wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aoa([['Laporan Oktober 2026'], [], ['Nama Salesman', 'ID Pelanggan', 'Nama Toko', 'Hari Kunj', 'Channel', 'CC5', 'Pareto JKS', 'Actual', 'Target', 'Sep', 'L3M /Month'], ...stores], 2, 2), 'OMSET');
XLSX.utils.book_append_sheet(wb, aoa([['Salesman', 'ID Toko', 'Nama Toko', 'Hari', 'Realisasi', 'Target', 'September', 'L3M'], ['Yudi Z', '2016-9001', 'KH SATU', '[3]RABU', 700000, 900000, 500000, 600000], ['Yudi Z', '2016-9002', 'KH DUA', '[3]RABU', 300000, 400000, 200000, 300000]]), 'KHUSUS YUDISTIRA');
XLSX.utils.book_append_sheet(wb, aoa([['Salesman', 'Principal', 'Target'], ...sm.flatMap((s) => [[s, 'GPPJ', 9000000], [s, 'MBR', 3000000]]), ['Yudi Z', 'GPPJ', 1300000]]), 'TGT SALESMAN');
XLSX.writeFile(wb, out + '/main.xlsx');

wb = XLSX.utils.book_new();
const sku = [['Salesman', 'ID Pelanggan', 'Kode SKU', 'Nama SKU', 'Principal', 'Brand', 'Qty', 'Nilai']];
const SK = [['CH1', 'Chocolatos Wafer 20g', 'GPPJ', 'CHOCOLATOS'], ['CH2', 'Chocolatos Drink 28g', 'GPPJ', 'CHOCOLATOS'], ['GD1', 'Gery Wafer 100g', 'GPPJ', 'GERY'], ['MB1', 'Mie Mbr 85g', 'MBR', 'MBR']];
for (const s of stores) for (const k of SK) if (rnd() > 0.35) { const q = 1 + Math.floor(rnd() * 12); sku.push([s[0], s[1], k[0], k[1], k[2], k[3], q, q * 2500]); }
XLSX.utils.book_append_sheet(wb, aoa(sku, 1, 1), 'QTY SKU');
XLSX.writeFile(wb, out + '/qty.xlsx');

wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aoa([['Salesman', 'Target', 'Actual'], ...sm.map((s, i) => [s, 20, 8 + i * 4])]), 'GREENSTORE');
XLSX.utils.book_append_sheet(wb, aoa([['Salesman', 'ID Toko', 'Target', 'Actual'], ['Hendra Mulya', '2016-0003', 3, 1]]), 'MSS');
XLSX.writeFile(wb, out + '/prog.xlsx');

wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, aoa([['Kode SKU', 'Nama SKU'], ...SK.map((k) => [k[0], k[1].replace(/ \d+g$/, ' ' + (k[1].match(/\d+g/) || [''])[0])])]), 'DATABASE SKU');
XLSX.writeFile(wb, out + '/skudb.xlsx');
console.log('fixtures ok', stores.length, 'stores', sku.length, 'sku rows');
