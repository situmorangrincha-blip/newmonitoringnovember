// Dijalankan sebelum build. Kalau ada file yang tidak ikut ke-upload ke GitHub,
// log Vercel akan menampilkan daftar file yang benar-benar ada, bukan error Rollup yang membingungkan.
import fs from 'node:fs';
import path from 'node:path';

const need = [
  'index.html', 'vite.config.js',
  'src/main.jsx', 'src/App.jsx', 'src/styles.css',
  'src/lib/parse.js', 'src/lib/table.js', 'src/lib/ingest.js', 'src/lib/calc.js', 'src/lib/store.js', 'src/lib/dapModel.js', 'src/lib/dapPdf.js',
  'src/components/Gate.jsx', 'src/components/charts.jsx', 'src/components/SnapFrame.jsx', 'src/components/ui.jsx', 'src/components/SalFilter.jsx', 'src/components/StoreModal.jsx', 'src/components/UploadModal.jsx',
  'src/pages/Explore.jsx', 'src/pages/Performance.jsx', 'src/pages/Focus.jsx', 'src/pages/Stores.jsx', 'src/pages/Pareto.jsx', 'src/pages/Salesman.jsx', 'src/pages/Charts.jsx', 'src/pages/Dap.jsx',
  'api/data.js',
];
const missing = need.filter((f) => !fs.existsSync(f));
if (!missing.length) {
  console.log(`[check-files] OK, ${need.length} file wajib ada.`);
  process.exit(0);
}
const walk = (dir, depth = 0, out = []) => {
  if (depth > 2) return out;
  for (const n of fs.readdirSync(dir).sort()) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = path.join(dir, n);
    out.push('  '.repeat(depth) + n + (fs.statSync(p).isDirectory() ? '/' : ''));
    if (fs.statSync(p).isDirectory()) walk(p, depth + 1, out);
  }
  return out;
};
console.error('\n[check-files] FILE BERIKUT TIDAK ADA DI REPO:');
missing.forEach((f) => console.error('  - ' + f));
console.error('\nIsi folder build (' + process.cwd() + '):\n' + walk('.').join('\n'));
console.error('\nBerarti file/folder di atas belum ke-upload ke GitHub. Upload ulang yang hilang lalu redeploy.\n');
process.exit(1);
