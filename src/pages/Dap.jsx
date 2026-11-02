import { useEffect, useMemo, useState } from 'react';
import { fmt, weekdayName } from '../lib/calc.js';
import { COLS, COL_BY, DEFAULT_DAP, buildDap, cardColumns, cardHeadLine, cardRows, catOptions, skuOptions } from '../lib/dapModel.js';
import { Panel } from '../components/ui.jsx';

const pad = (n) => String(n).padStart(2, '0');
const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const IND = [['tgt', 'Target'], ['act', 'Actual Rp'], ['qty', 'Qty'], ['gap', 'Gap'], ['ach', '% Ach'], ['ca', 'Sudah beli?']];
const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

export function defaultDapDate(time, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [y, m, d] = f.format(now).split('-').map(Number);
  return y === time.y && m === time.m ? d : 1;
}

export default function Dap({ data, time, day, setDay, holidays, setHolidays, depot, team }) {
  const ckey = `sm_dap_${depot}_${team}`;
  const [cfg, setCfg] = useState(() => ({ ...DEFAULT_DAP, ...(load(ckey) || {}), par: { ...DEFAULT_DAP.par, ...(load(ckey)?.par || {}) } }));
  const [busy, setBusy] = useState('');
  const [holTxt, setHolTxt] = useState(holidays.join(', '));
  const [skuQ, setSkuQ] = useState('');
  const [skuQ2, setSkuQ2] = useState('');
  const [openCards, setOpenCards] = useState(null);
  useEffect(() => { localStorage.setItem(ckey, JSON.stringify(cfg)); }, [cfg, ckey]);
  const setPar = (p) => setCfg((c) => ({ ...c, par: { ...c.par, ...p } }));

  const last = new Date(time.y, time.m, 0).getDate();
  const d = Math.min(Math.max(1, day), last);
  const wd = new Date(time.y, time.m - 1, d).getDay();
  const iso = `${time.y}-${pad(time.m)}-${pad(d)}`;
  const model = useMemo(() => buildDap(data, time, d, holidays, cfg), [data, time, d, holidays, cfg]);
  const stale = d > (time.dataDay || 0) + 1;
  const tot = model.groups.reduce((a, g) => ({ t: a.t + g.target, a: a.a + g.actual, p: a.p + g.plan, c: a.c + g.cards.length }), { t: 0, a: 0, p: 0, c: 0 });

  const skus = useMemo(() => skuOptions(data), [data]);
  const cats = useMemo(() => catOptions(data), [data]);
  const filt = (arr, q) => arr.filter((x) => !q || `${x.n} ${x.k} ${x.b}`.toLowerCase().includes(q.toLowerCase())).slice(0, 80);

  const move = (delta) => {
    let n = d;
    for (let i = 0; i < 40; i++) { n += delta; if (n < 1 || n > last) return; if (new Date(time.y, time.m - 1, n).getDay() !== 0) { setDay(n); return; } }
  };
  const saveHol = () => {
    const arr = [...new Set(holTxt.split(/[,\s]+/).map((x) => parseInt(x, 10)).filter((x) => x >= 1 && x <= last))].sort((a, b) => a - b);
    setHolidays(arr); setHolTxt(arr.join(', '));
  };

  const colMove = (k, dir) => setCfg((c) => {
    const a = [...c.cols]; const i = a.indexOf(k); const j = i + dir;
    if (i < 0 || j < 0 || j >= a.length) return c;
    [a[i], a[j]] = [a[j], a[i]];
    return { ...c, cols: a };
  });
  const toggleCol = (k) => setCfg((c) => ({ ...c, cols: c.cols.includes(k) ? c.cols.filter((x) => x !== k) : [...c.cols, k] }));
  const toggleSkuMain = (k) => setCfg((c) => ({ ...c, skuMain: c.skuMain.includes(k) ? c.skuMain.filter((x) => x !== k) : [...c.skuMain, k] }));
  const toggleFocus = (t, k) => setPar({ focus: cfg.par.focus.some((f) => f.t === t && f.k === k) ? cfg.par.focus.filter((f) => !(f.t === t && f.k === k)) : [...cfg.par.focus, { t, k }] });

  const nCols = model.head.length;
  async function pdf(only) {
    setBusy('Menyusun PDF...');
    try {
      const { makeDapPdf } = await import('../lib/dapPdf.js');
      await makeDapPdf({ data, model, only, y: time.y, m: time.m, d, cfg, asOf: time.asOf, depot });
    } catch (e) { alert('Gagal membuat PDF: ' + (e?.message || e)); }
    setBusy('');
  }

  if (!data.dap?.length) {
    return (
      <Panel title="DAP (DAILY ACCOUNT PLAN)">
        <div className="empty">
          <h2>Belum ada data DAP</h2>
          <p className="mut">Tidak ada sheet DAP dan tidak ada toko dengan target + hari kunjungan di data utama. Tambahkan sheet berjudul DAP … (kolom: Salesman, Hari/Rute, ID Pelanggan, Nama, Target) lalu upload ulang.</p>
        </div>
      </Panel>
    );
  }

  const cardCols = cardColumns(cfg.par, model.hasTgt);

  return (
    <div className="grid">
      <Panel title={`DAP ${data.meta.teamLabel?.toUpperCase() || ''} · ${weekdayName(wd).toUpperCase()} ${d} ${MON[time.m - 1].toUpperCase()} ${time.y}`} right={`${model.total} toko · ${model.groups.length} salesman`}>
        <div className="row">
          <button className="btn sm" onClick={() => move(-1)} aria-label="Hari sebelumnya">◀</button>
          <input className="input" style={{ minWidth: 0, width: 160 }} type="date" value={iso} min={`${time.y}-${pad(time.m)}-01`} max={`${time.y}-${pad(time.m)}-${pad(last)}`} onChange={(e) => { const v = e.target.value; if (v) setDay(parseInt(v.slice(8, 10), 10)); }} />
          <button className="btn sm" onClick={() => move(1)} aria-label="Hari berikutnya">▶</button>
          <span className="mut">{weekdayName(wd)}</span>
          <span style={{ flex: 1 }} />
          <button className="btn coin" disabled={!model.total || !!busy} onClick={() => pdf(null)}>{busy || 'Unduh PDF (semua salesman)'}</button>
        </div>
        {wd === 0 && <div className="warn">Hari Minggu tidak ada kunjungan.</div>}
        {stale && <div className="warn">Actual s/d {time.asOf} (data H-1). Kunjungan antara tanggal itu dan {d} belum terhitung.</div>}
        <div className="kpis k4" style={{ marginTop: 10 }}>
          <div className="kpi"><div className="l">Toko dikunjungi</div><div className="v">{model.total}</div><div className="s">{model.groups.length} salesman</div></div>
          <div className="kpi"><div className="l">Target DAP</div><div className="v">{fmt.jt(tot.t)}<small>jt</small></div><div className="s">toko hari ini</div></div>
          <div className="kpi"><div className="l">Actual MTD</div><div className="v">{fmt.jt(tot.a)}<small>jt</small></div><div className="s">gap {fmt.jt(tot.a - tot.t)} jt</div></div>
          <div className="kpi hero"><div className="l">PLAN hari ini</div><div className="v">{fmt.jt(tot.p)}<small>jt</small></div><div className="s">{cfg.par.on ? `${tot.c} halaman Fokus Pareto` : 'minimal target kunjungan'}</div></div>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: 'pointer' }}>Tanggal libur (opsional)</summary>
          <div className="row" style={{ marginTop: 8 }}>
            <input className="input" style={{ minWidth: 0, width: 200 }} placeholder="mis. 17, 20" value={holTxt} onChange={(e) => setHolTxt(e.target.value)} />
            <button className="btn sm" onClick={saveHol}>Simpan</button>
          </div>
        </details>
      </Panel>

      <Panel title="ATUR ISI DAP" right={nCols > 14 ? <span className="low">{nCols} kolom: font PDF mengecil</span> : `${nCols} kolom`}>
        <b>Kolom tabel DAP</b> <span className="mut">(No, Nama Toko, ID selalu ada)</span>
        <div className="cols-pick">
          {COLS.filter((c) => c.k !== 'blank').map((c) => (
            <label key={c.k} className={cfg.cols.includes(c.k) ? 'on' : ''}>
              <input type="checkbox" checked={cfg.cols.includes(c.k)} onChange={() => toggleCol(c.k)} />{c.label}
            </label>
          ))}
          <label className={cfg.cols.includes('blank') ? 'on' : ''}><input type="checkbox" checked={cfg.cols.includes('blank')} onChange={() => toggleCol('blank')} />Kolom kosong</label>
        </div>
        <div className="row" style={{ margin: '4px 0 8px' }}>
          <span className="mut">Urutan:</span>
          {cfg.cols.map((k) => (
            <span key={k} className="pill">{COL_BY[k]?.label || 'Kosong'}<span className="ordr"><button onClick={() => colMove(k, -1)}>◀</button><button onClick={() => colMove(k, 1)}>▶</button></span></span>
          ))}
        </div>
        <div className="row" style={{ margin: '10px 0 4px' }}>
          <b>SKU fokus di tabel DAP</b>
          <span className="mut">{skus.length ? `${skus.length} SKU tersedia${data.skudb?.length ? ' (database SKU)' : ' (dari data qty)'}` : 'belum ada database SKU / data qty'}</span>
          <span style={{ flex: 1 }} />
          <span className="mut">Isi kolom:</span>
          <div className="seg"><button className={cfg.skuMetric === 'qty' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'qty' })}>Qty</button><button className={cfg.skuMetric === 'rp' ? 'on' : ''} onClick={() => setCfg({ ...cfg, skuMetric: 'rp' })}>Rp</button></div>
        </div>
        {skus.length > 0 && (
          <>
            <input className="input" style={{ width: 240, marginBottom: 6 }} placeholder="cari SKU / brand" value={skuQ} onChange={(e) => setSkuQ(e.target.value)} />
            <div className="skulist">
              {filt(skus, skuQ).map((s) => (
                <label key={s.k}><input type="checkbox" checked={cfg.skuMain.includes(s.k)} onChange={() => toggleSkuMain(s.k)} /><b>{s.n}</b><span className="mut">{s.k !== s.n ? s.k : ''} {s.b}{s.inData ? '' : ' · belum ada datanya'}</span></label>
              ))}
            </div>
            {cfg.skuMain.length > 0 && <div className="mt">{cfg.skuMain.map((k) => <span key={k} className="pill">{skus.find((s) => s.k === k)?.n || k}<button className="x" onClick={() => toggleSkuMain(k)}>×</button></span>)}</div>}
          </>
        )}

        <div className="row" style={{ margin: '14px 0 4px', borderTop: '1px solid var(--line)', paddingTop: 10 }}>
          <b>Halaman Fokus Pareto</b>
          <label className="row" style={{ gap: 5 }}><input type="checkbox" checked={cfg.par.on} onChange={(e) => setPar({ on: e.target.checked })} />ikut di PDF dan preview</label>
        </div>
        {cfg.par.on && (
          <>
            <div className="mut" style={{ marginBottom: 6 }}>Toko Pareto JKS salesman yang jadwal kunjungannya jatuh di tanggal ini, satu toko satu halaman. Sep dan L3M tampil di header sebagai angka level toko.</div>
            <div className="opt-row">
              <span className="mut">Satuan</span>
              <div className="seg">{[['qty', 'Qty'], ['rp', 'Value Rp'], ['both', 'Keduanya']].map(([v, l]) => <button key={v} className={cfg.par.unit === v ? 'on' : ''} onClick={() => setPar({ unit: v })}>{l}</button>)}</div>
              <span className="mut">Toko per halaman</span>
              <div className="seg">{[1, 2].map((v) => <button key={v} className={cfg.par.perPage === v ? 'on' : ''} onClick={() => setPar({ perPage: v })}>{v}</button>)}</div>
            </div>
            <div className="cols-pick">
              {IND.map(([k, l]) => (
                <label key={k} className={cfg.par.inds.includes(k) ? 'on' : ''}>
                  <input type="checkbox" checked={cfg.par.inds.includes(k)} onChange={() => setPar({ inds: cfg.par.inds.includes(k) ? cfg.par.inds.filter((x) => x !== k) : [...cfg.par.inds, k] })} />{l}
                </label>
              ))}
              {[['hdr', 'Header Sep / L3M'], ['notes', 'Kotak catatan'], ['blank', 'Kolom Order kosong']].map(([k, l]) => (
                <label key={k} className={cfg.par[k] ? 'on' : ''}><input type="checkbox" checked={!!cfg.par[k]} onChange={(e) => setPar({ [k]: e.target.checked })} />{l}</label>
              ))}
            </div>
            <b>Fokus (SKU / kategori, boleh campur)</b>
            <div className="row" style={{ marginTop: 4 }}>
              <input className="input" style={{ width: 240 }} placeholder="cari SKU / kategori" value={skuQ2} onChange={(e) => setSkuQ2(e.target.value)} />
              {cfg.par.focus.map((f) => <span key={f.t + f.k} className="pill">{f.t === 'cat' ? 'Kategori: ' : ''}{f.t === 'sku' ? (skus.find((s) => s.k === f.k)?.n || f.k) : f.k}<button className="x" onClick={() => toggleFocus(f.t, f.k)}>×</button></span>)}
            </div>
            <div className="skulist" style={{ marginTop: 6 }}>
              {cats.filter((c) => !skuQ2 || c.toLowerCase().includes(skuQ2.toLowerCase())).map((c) => (
                <label key={'c' + c}><input type="checkbox" checked={cfg.par.focus.some((f) => f.t === 'cat' && f.k === c)} onChange={() => toggleFocus('cat', c)} /><b>{c}</b><span className="mut">kategori</span></label>
              ))}
              {filt(skus, skuQ2).map((s) => (
                <label key={s.k}><input type="checkbox" checked={cfg.par.focus.some((f) => f.t === 'sku' && f.k === s.k)} onChange={() => toggleFocus('sku', s.k)} /><b>{s.n}</b><span className="mut">{s.b}</span></label>
              ))}
              {!skus.length && !cats.length && <div className="mut" style={{ padding: 6 }}>Belum ada SKU. Upload slot Qty / Database SKU.</div>}
            </div>
            {!cfg.par.focus.length && <div className="warn">Pilih minimal satu SKU atau kategori fokus supaya halaman Pareto muncul.</div>}
          </>
        )}
      </Panel>

      {model.groups.map((g) => (
        <Panel key={g.name} title={g.name.toUpperCase()} right={<><span>{g.n} toko · PLAN {fmt.jt(g.plan, 2)} jt </span><button className="btn sm" style={{ marginLeft: 6 }} onClick={() => pdf(g.name)}>PDF</button></>} flush>
          <div className="scroll">
            <table className="t">
              <thead><tr>{model.head.map((c, i) => <th key={i} className={i === 1 || i === 2 ? 'l' : ''}>{c.label}</th>)}</tr></thead>
              <tbody>
                {g.rows.map((x) => (
                  <tr key={x.r.id + x.r.s}>
                    {x.cells.map((v, i) => <td key={i} className={i === 1 ? 'l nm' : i === 2 ? 'l mut' : model.head[i].neg && String(v).startsWith('-') ? 'neg' : v === 'tercapai' ? 'ok' : ''}>{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cfg.par.on && (
            <div className="note">
              <div className="row">
                <b>Fokus Pareto: {g.cards.length} toko hari ini</b>
                {g.cards.length > 0 && cfg.par.focus.length > 0 && <button className="btn sm" onClick={() => setOpenCards(openCards === g.name ? null : g.name)}>{openCards === g.name ? 'Tutup preview' : 'Lihat preview'}</button>}
                {g.cards.length === 0 && <span className="mut">tidak ada toko Pareto hari ini</span>}
              </div>
              {openCards === g.name && g.cards.map((c) => (
                <div key={c.s.id} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: 8, margin: '8px 0', background: '#fff' }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}><b>{c.s.name} <span className="mut">{c.s.id}</span></b>{c.notInDap && <span className="tag y">tidak ada di DAP utama</span>}</div>
                  <div className="mut" style={{ fontSize: 12 }}>{cardHeadLine(c)}</div>
                  <table className="t" style={{ marginTop: 4 }}>
                    <thead><tr>{cardCols.map((cc) => <th key={cc.k} className={cc.k === 'name' ? 'l' : ''}>{cc.label}</th>)}</tr></thead>
                    <tbody>{cardRows(c, cardCols).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={j === 0 ? 'l' : ''}>{v}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ))}
      {!model.groups.length && <Panel title="TIDAK ADA KUNJUNGAN"><div className="empty"><p className="mut">Tidak ada toko yang dijadwalkan di tanggal ini.</p></div></Panel>}
    </div>
  );
}
