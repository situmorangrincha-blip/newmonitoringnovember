# Sales Monitor (v4)

Dashboard sales minimalis. Ungu pastel = SP Kebayoran, biru = Depo Kapuk. Alur: Depo → Tim → password tim.

## Deploy (sama seperti sebelumnya)
1. Push seluruh isi folder ke GitHub (folder `src`, `api`, `scripts` harus ikut sebagai folder).
2. Vercel → Import repo (Vite terdeteksi otomatis).
3. Storage → Blob → Connect (otomatis menambah `BLOB_READ_WRITE_TOKEN`).
4. Settings → Environment Variables: `PASS_RINCHA` (tim Arjuna), `PASS_ECI` (tim Bima) → Redeploy.
5. Log build harus berisi `[check-files] OK`.

## Upload: 4 slot terpisah (per depo × tim)
| Slot | Isi | Catatan |
|---|---|---|
| Data utama | omset/ACT per toko, Sep, L3M, Pareto JKS, target, hari kunjungan, sheet DAP, sheet TGT | sheet dikenali dari JUDUL: `TGT…` target, `DAP…` DAP, `PARETO…`/`LAB` pareto, `KHUSUS …` menimpa salesman yang tercantum |
| Qty / SKU | baris per toko × SKU: kode/nama SKU, qty, nilai | |
| GreenStore / MSS | target + actual per salesman atau toko | judul sheet `GREENSTORE` / `MSS` menentukan nama program |
| Database SKU | kode SKU + nama (+ brand/kategori) | per depo, dipakai kedua tim |

Header tabel dicari otomatis (posisi bebas), nama kolom dicocokkan longgar. Kalau meleset: Upload → "Pemetaan kolom".
File format lama (sheet OLAP SALES / JKS SALESMAN / BIMA) masih terbaca di slot Data utama.
Batas simpan per slot 4,3 MB (JSON hasil baca); file Excel maksimal 80 MB di browser.

## Catatan angka
- "Timegone sama" = Sep/L3M × timegone (estimasi proporsional, data Sep & L3M adalah total sebulan).
- Level SKU: Sep/L3M tidak tersedia (datanya per toko). Target di level SKU = target per SKU kalau ada, kalau tidak target principal per salesman (tanda *).
