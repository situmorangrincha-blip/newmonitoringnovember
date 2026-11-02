import { useMemo, useState } from 'react';
import { COMPARE_DIMS, byRouteDay, catAgg, compareRows, fmt, focusAgg, focusCatsOf, pace, paceCls, sizeRows } from '../lib/calc.js';
import { GroupedBars, HBars, LineChart, Legend, PAL, PixelDonut } from '../components/charts.jsx';
import { Panel, Seg } from '../components/ui.jsx';
import SalFilter from '../components/SalFilter.jsx';
import SnapFrame from '../components/SnapFrame.jsx';

const SUBS = [
  { v: 'perf', label: 'Performa' },
  { v: 'banding', label: 'Bandingkan' },
  { v: 'prin', label: 'Principal' },
  { v: 'fokus', label: 'Kat. Fokus' },
  { v: 'ukuran', label: 'Ukuran Toko' },
  { v: 'pareto', label: 'Pareto & CA' },
  { v: 'sales', label: 'Salesman' },
  { v: 'tren', label: 'Tren Harian' },
];

const jt = (v) => fmt.jt(v, 0);
const jt1 = (v) => fmt.jt(v, 1);
const pc = (v) => fmt.pct(v, 0);
const nm = (s) => fmt.short(s);

export default function Charts({ D, data, time, mode, setMode, sub, setSub, sal, setSal, snapping, snapBg, cmpDim, setCmpDim }) {
  const one = sal === 'ALL' ? D.sales[0].name : sal;
  const needSal = sub === 'fokus' || sub === 'ukuran' || sub === 'sales' || sub === 'banding';
  return (
    <SnapFrame snapping={snapping} bg={snapBg}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div className="hero-title">GRAFIK {time.monthShort}{data.meta.teamLabel ? ` · TIM ${data.meta.teamLabel.toUpperCase()}` : ''}</div>
          <div className="mut">data s/d {time.asOf} (H-1) · timegone {fmt.pct(time.tg)}</div>
        </div>
        {(sub === 'perf' || sub === 'prin' || sub === 'pareto') && (
          <div className="row">
            <span className="mut">VS</span>
            <Seg value={mode} onChange={setMode} disabled={!data.meta.hasBti} options={[{ v: 'milestone', label: 'Milestone' }, { v: 'bti', label: 'BTI' }]} />
          </div>
        )}
      </div>
      <div className="tabs-row" data-nosnap>
        <Seg wrap value={sub} onChange={setSub} options={SUBS} />
        {needSal && <SalFilter data={data} value={sub === 'sales' ? one : sal} onChange={setSal} noAll={sub === 'sales'} />}
      </div>
      {sub === 'perf' && <Perf D={D} time={time} mode={mode} />}
      {sub === 'banding' && <Compare data={data} time={time} sal={sal} dim={cmpDim} setDim={setCmpDim} />}
      {sub === 'prin' && <Prin D={D} time={time} mode={mode} />}
      {sub === 'fokus' && <Fokus data={data} time={time} sal={sal} />}
      {sub === 'ukuran' && <Ukuran data={data} time={time} sal={sal} />}
      {sub === 'pareto' && <Pareto D={D} time={time} hasTgt={data.meta.storeTgt} />}
      {sub === 'sales' && <SalesView D={D} data={data} time={time} name={one} />}
      {sub === 'tren' && <Tren D={D} data={data} time={time} mode={mode} setMode={setMode} />}
    </SnapFrame>
  );
}

function Perf({ D, time, mode }) {
  const label = mode === 'bti' ? 'BTI' : 'Milestone';
  const names = D.sales.map((s) => nm(s.name));
  const sorted = [...D.sales].sort((a, b) => b.acv - a.acv);
  const total = D.total.act || 1;
  return (
    <div className="cgrid">
      <Panel title="ACV PER SALESMAN" right={`garis = timegone ${fmt.pct(time.tg)}`}>
        <HBars rows={sorted.map((s) => ({ label: nm(s.name), v: s.acv, text: fmt.pct(s.acv), color: s.acv >= time.tg ? '#2fbf71' : s.acv >= time.tg * 0.8 ? '#ffc933' : '#ec4a5a' }))} max={Math.max(0.2, time.tg * 1.6, ...sorted.map((s) => s.acv))} refv={time.tg} />
      </Panel>
      <Panel title="SHARE ACTUAL PER SALESMAN" right={`${fmt.jt(D.total.act)} jt`}>
        <PixelDonut items={D.sales.map((s, i) => ({ label: nm(s.name), v: s.act, color: PAL[i % PAL.length] }))} center={`${fmt.jt(D.total.act, 0)}`} sub="jt ACT" />
      </Panel>
      <Panel className="wide" title={`TARGET ${label.toUpperCase()} VS ACTUAL (jt)`}>
        <GroupedBars wide
          groups={D.sales.map((s, i) => ({ label: names[i], vals: [s.tgt / 1e6, s.act / 1e6] }))}
          series={[{ name: 'Target', color: '#8b5cf6' }, { name: 'Actual', color: '#2fbf71' }]}
          fmtV={(v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',')}
        />
        <Legend items={[{ name: 'Target', color: '#8b5cf6' }, { name: 'Actual', color: '#2fbf71' }]} />
      </Panel>
      <Panel className="wide" title="ACTUAL VS SEP & L3M (laju pro-rata)" right="100% = laju sama">
        <GroupedBars wide
          groups={D.sales.map((s, i) => ({ label: names[i], vals: [(s.vsLm ?? 0) * 100, (s.vsL3m ?? 0) * 100] }))}
          series={[{ name: '% SEP', color: '#35a8e0' }, { name: '% L3M', color: '#ffc933' }]}
          refv={100}
          refLabel="100%"
          fmtV={(v) => Math.round(v) + '%'}
        />
        <Legend items={[{ name: '% SEP', color: '#35a8e0' }, { name: '% L3M', color: '#ffc933' }]} />
      </Panel>
    </div>
  );
}

function Prin({ D, time, mode }) {
  const ps = D.principals.filter((p) => D.total.pr[p].tgt > 0 || D.total.pr[p].act > 0);
  return (
    <div className="cgrid">
      {ps.map((p) => (
        <Panel key={p} title={`${p} VS ${mode === 'bti' ? 'BTI' : 'MILESTONE'}`} right={`${fmt.pct(D.total.pr[p].acv)} · ${fmt.jt(D.total.pr[p].act)}/${fmt.jt(D.total.pr[p].tgt)} jt`}>
          <HBars
            rows={[...D.sales].sort((a, b) => b.pr[p].acv - a.pr[p].acv).map((s) => ({ label: nm(s.name), v: s.pr[p].acv, text: s.pr[p].tgt ? fmt.pct(s.pr[p].acv) : '-', color: s.pr[p].acv >= time.tg ? '#2fbf71' : s.pr[p].acv >= time.tg * 0.8 ? '#ffc933' : '#ec4a5a' }))}
            max={Math.max(0.2, time.tg * 1.6, ...D.sales.map((s) => s.pr[p].acv))}
            refv={time.tg}
          />
        </Panel>
      ))}
    </div>
  );
}

function Fokus({ data, time, sal }) {
  const cats = focusCatsOf(data);
  const stores = sal === 'ALL' ? data.stores : data.stores.filter((s) => s.sales === sal);
  const agg = useMemo(() => focusAgg(data, stores, cats, time.tg), [data, stores, cats, time.tg]);
  if (!data.subs.length) return <Panel title="KATEGORI FOKUS"><div className="empty">Data kategori belum ada.</div></Panel>;
  const r = agg.rows;
  const ser = [{ name: 'Okt', color: '#2fbf71' }, { name: 'Sep', color: '#35a8e0' }, { name: 'L3M/bln', color: '#ffc933' }];
  return (
    <div className="cgrid">
      <Panel className="wide" title="ACT KATEGORI FOKUS (jt)" right={sal === 'ALL' ? 'semua salesman' : nm(sal)}>
        <GroupedBars wide groups={r.map((x) => ({ label: x.name, vals: [x.cur / 1e6, x.lm / 1e6, x.l3m / 1e6] }))} series={ser} fmtV={(v) => v.toFixed(1).replace('.', ',')} />
        <Legend items={ser} />
      </Panel>
      <Panel title="LAJU VS SEP & L3M" right="100% = laju sama">
        <GroupedBars
          groups={r.map((x) => ({ label: x.name, vals: [(x.vsLm ?? 0) * 100, (x.vsL3m ?? 0) * 100] }))}
          series={[{ name: '% SEP', color: '#35a8e0' }, { name: '% L3M', color: '#ffc933' }]}
          refv={100} refLabel="100%" fmtV={(v) => Math.round(v) + '%'} h={250}
        />
        <Legend items={[{ name: '% SEP', color: '#35a8e0' }, { name: '% L3M', color: '#ffc933' }]} />
      </Panel>
      <Panel title="PENETRASI TOKO" right={`${agg.n} toko JKS · ${agg.ca} CA`}>
        <HBars rows={[...r].sort((a, b) => b.penJks - a.penJks).map((x) => ({ label: x.name, v: x.penJks, text: `${pc(x.penJks)} (${x.buyers})` }))} max={Math.max(0.1, ...r.map((x) => x.penJks))} labelW={150} />
        <div className="mut" style={{ fontSize: 12.5, marginTop: 8 }}>Persentase toko JKS yang beli kategori ini bulan ini.</div>
      </Panel>
    </div>
  );
}

function Ukuran({ data, time, sal }) {
  const stores = sal === 'ALL' ? data.stores : data.stores.filter((s) => s.sales === sal);
  const rows = sizeRows(stores).filter((x) => x.n > 0 || ['SMALL', 'MEDIUM', 'BIG', 'SUPERBIG'].includes(x.k));
  const ser = [{ name: 'Okt', color: '#2fbf71' }, { name: 'Sep', color: '#35a8e0' }];
  return (
    <div className="cgrid">
      <Panel title="ACT PER UKURAN TOKO (jt)" right={sal === 'ALL' ? 'semua salesman' : nm(sal)}>
        <GroupedBars groups={rows.map((x) => ({ label: x.k, vals: [x.act / 1e6, x.lm / 1e6] }))} series={ser} fmtV={(v) => v.toFixed(1).replace('.', ',')} />
        <Legend items={ser} />
      </Panel>
      <Panel title="JUMLAH TOKO & CA">
        <GroupedBars groups={rows.map((x) => ({ label: x.k, vals: [x.n, x.ca, x.caProd] }))} series={[{ name: 'Toko', color: '#8b5cf6' }, { name: 'CA', color: '#35a8e0' }, { name: 'CA Prod', color: '#2fbf71' }]} fmtV={(v) => Math.round(v)} />
        <Legend items={[{ name: 'Toko', color: '#8b5cf6' }, { name: 'CA', color: '#35a8e0' }, { name: 'CA Prod', color: '#2fbf71' }]} />
      </Panel>
      <Panel title="CA% PER UKURAN">
        <HBars rows={rows.map((x) => ({ label: x.k, v: x.caPct, text: `${pc(x.caPct)} (${x.ca}/${x.n})` }))} max={Math.max(0.2, ...rows.map((x) => x.caPct))} labelW={90} />
      </Panel>
      <Panel title="LAJU VS SEP (pro-rata)" right="100% = laju sama">
        <HBars
          rows={rows.map((x) => {
            const p = pace(x.act, x.lm, time.tg);
            return { label: x.k, v: p ?? 0, text: fmt.pace(p), color: p == null ? '#c9c8e0' : p >= 1 ? '#2fbf71' : p >= 0.8 ? '#ffc933' : '#ec4a5a' };
          })}
          max={Math.max(1.2, ...rows.map((x) => pace(x.act, x.lm, time.tg) ?? 0))}
          refv={1}
          labelW={90}
        />
      </Panel>
    </div>
  );
}

function Pareto({ D, time, hasTgt }) {
  const names = D.sales.map((s) => nm(s.name));
  const col = (v) => (v >= time.tg ? '#2fbf71' : v >= time.tg * 0.8 ? '#ffc933' : '#ec4a5a');
  const pcol = (p) => (p == null ? '#c9c8e0' : p >= 1 ? '#2fbf71' : p >= 0.8 ? '#ffc933' : '#ec4a5a');
  const pj = (s) => pace(s.pj.act, s.pj.l3m, time.tg);
  const ps = (s) => pace(s.ps.act, s.ps.l3m, time.tg);
  return (
    <div className="cgrid">
      <Panel className="wide" title="CORONG TOKO PER SALESMAN" right="toko → CA → CA Prod">
        <GroupedBars wide
          groups={D.sales.map((s, i) => ({ label: names[i], vals: [s.st.n, s.st.ca, s.st.caProd] }))}
          series={[{ name: 'Toko JKS', color: '#8b5cf6' }, { name: 'CA', color: '#35a8e0' }, { name: 'CA Prod', color: '#2fbf71' }]}
          fmtV={(v) => Math.round(v)}
        />
        <Legend items={[{ name: 'Toko JKS', color: '#8b5cf6' }, { name: 'CA', color: '#35a8e0' }, { name: 'CA Prod', color: '#2fbf71' }]} />
      </Panel>
      {hasTgt ? (
        <>
          <Panel title="ACV PARETO JKS" right={`garis = timegone ${fmt.pct(time.tg)}`}>
            <HBars rows={D.sales.map((s) => ({ label: nm(s.name), v: s.pj.acv, text: s.pj.n ? fmt.pct(s.pj.acv) : '-', color: col(s.pj.acv) }))} max={Math.max(0.2, time.tg * 1.6, ...D.sales.map((s) => s.pj.acv))} refv={time.tg} />
          </Panel>
          <Panel title="ACV PARETO SAK" right={`${D.total.ps.n} toko`}>
            <HBars rows={[{ label: 'Total SAK', v: D.total.ps.acv, text: fmt.pct(D.total.ps.acv), color: col(D.total.ps.acv) }, ...D.sales.filter((s) => s.ps.n > 0).map((s) => ({ label: nm(s.name), v: s.ps.acv, text: fmt.pct(s.ps.acv), color: col(s.ps.acv) }))]} max={Math.max(0.2, time.tg * 1.6, D.total.ps.acv)} refv={time.tg} />
          </Panel>
        </>
      ) : (
        <>
          <Panel title="LAJU PARETO JKS VS L3M" right="100% = laju sama">
            <HBars rows={D.sales.map((s) => ({ label: nm(s.name), v: pj(s) ?? 0, text: fmt.pace(pj(s)), color: pcol(pj(s)) }))} max={Math.max(1.2, ...D.sales.map((s) => pj(s) ?? 0))} refv={1} />
          </Panel>
          <Panel title="LAJU PARETO SAK VS L3M" right={`${D.total.ps.n} toko`}>
            <HBars rows={[{ label: 'Total SAK', v: pace(D.total.ps.act, D.total.ps.l3m, time.tg) ?? 0, text: fmt.pace(pace(D.total.ps.act, D.total.ps.l3m, time.tg)), color: pcol(pace(D.total.ps.act, D.total.ps.l3m, time.tg)) }, ...D.sales.filter((s) => s.ps.n > 0).map((s) => ({ label: nm(s.name), v: ps(s) ?? 0, text: fmt.pace(ps(s)), color: pcol(ps(s)) }))]} max={Math.max(1.2, pace(D.total.ps.act, D.total.ps.l3m, time.tg) ?? 0)} refv={1} />
          </Panel>
        </>
      )}
      <Panel className="wide" title="CA% & CA PROD% PER SALESMAN">
        <GroupedBars wide
          groups={D.sales.map((s, i) => ({ label: names[i], vals: [s.st.caPct * 100, s.st.caProdPct * 100] }))}
          series={[{ name: 'CA%', color: '#35a8e0' }, { name: 'CA Prod%', color: '#2fbf71' }]}
          fmtV={(v) => Math.round(v) + '%'}
        />
        <Legend items={[{ name: 'CA%', color: '#35a8e0' }, { name: 'CA Prod%', color: '#2fbf71' }]} />
      </Panel>
    </div>
  );
}

function SalesView({ D, data, time, name }) {
  const S = D.sales.find((s) => s.name === name) || D.sales[0];
  const list = data.stores.filter((s) => s.sales === S.name);
  const days = byRouteDay(list);
  const cats = catAgg(data, list).filter((r) => r.cur > 0).sort((a, b) => b.cur - a.cur);
  const top = cats.slice(0, 5);
  const rest = cats.slice(5).reduce((a, r) => a + r.cur, 0);
  const items = [...top.map((r, i) => ({ label: r.n, v: r.cur, color: PAL[i % PAL.length] })), ...(rest > 0 ? [{ label: 'Lainnya', v: rest, color: '#c9c8e0' }] : [])];
  const ser = [{ name: 'Okt', color: '#2fbf71' }, { name: 'Sep', color: '#35a8e0' }, { name: 'L3M/bln', color: '#ffc933' }];
  return (
    <div className="cgrid">
      <Panel title={`ACT PER HARI KUNJUNGAN · ${nm(S.name)}`} right="jt">
        <GroupedBars groups={days.map((d) => ({ label: `${d.day} (${d.n})`, vals: [d.act / 1e6] }))} series={[{ name: 'ACT', color: '#35a8e0' }]} fmtV={(v) => v.toFixed(1).replace('.', ',')} />
      </Panel>
      <Panel title="MIX KATEGORI BULAN INI" right={`${fmt.jt(S.act)} jt`}>
        {items.length ? <PixelDonut items={items} center={fmt.jt(items.reduce((a, x) => a + x.v, 0), 1)} sub="jt kategori" /> : <div className="mut">Belum ada transaksi kategori.</div>}
      </Panel>
      <Panel title="ACTUAL VS SEP & L3M (jt, pro-rata)" right="batang pembanding = nilai × timegone">
        <GroupedBars
          groups={[{ label: 'Actual vs Sep', vals: [S.act / 1e6, (S.lmAct * time.tg) / 1e6] }, { label: 'Actual vs L3M', vals: [S.act / 1e6, (S.l3mAct * time.tg) / 1e6] }]}
          series={[{ name: 'Actual', color: '#2fbf71' }, { name: 'Pembanding', color: '#8b5cf6' }]}
          fmtV={(v) => v.toFixed(1).replace('.', ',')}
        />
        <Legend items={[{ name: 'Actual', color: '#2fbf71' }, { name: 'Pembanding (pro-rata)', color: '#8b5cf6' }]} />
      </Panel>
      <Panel title="ACV & PENETRASI TOKO">
        <HBars
          rows={[
            { label: 'ACV', v: S.acv, text: fmt.pct(S.acv), color: S.acv >= time.tg ? '#2fbf71' : S.acv >= time.tg * 0.8 ? '#ffc933' : '#ec4a5a' },
            { label: 'CA%', v: S.st.caPct, text: `${pc(S.st.caPct)} (${S.st.ca}/${S.st.n})` },
            { label: 'CA Prod%', v: S.st.caProdPct, text: `${pc(S.st.caProdPct)} (${S.st.caProd})` },
            ...(D.sales[0] && S.pj.tgt > 0 ? [{ label: 'Pareto JKS', v: S.pj.acv, text: fmt.pct(S.pj.acv) }] : []),
          ]}
          max={Math.max(0.3, time.tg * 1.6, S.acv, S.st.caPct)}
          refv={time.tg}
          labelW={96}
        />
      </Panel>
    </div>
  );
}

function Tren({ D, data, time, mode, setMode }) {
  const hist = data.history || [];
  const tgt = D.total.tgt;
  const tgOf = (h) => h.tg ?? (h.total ? h.hk / h.total : 0);
  const names = data.salesmen;
  if (!hist.length) {
    return (
      <Panel title="TREN HARIAN">
        <div className="empty">
          <h2>BELUM ADA RIWAYAT</h2>
          <p className="mut">Riwayat harian mulai terkumpul sejak upload pertama setelah fitur ini aktif. Upload lagi besok, grafiknya bertambah satu titik tiap hari kerja.</p>
        </div>
      </Panel>
    );
  }
  const acvPts = hist.map((h) => [h.hk, tgt ? h.t[0] / tgt : 0]);
  const actPts = hist.map((h) => [h.hk, h.t[0] / 1e6]);
  const caPts = hist.map((h) => [h.hk, h.t[1]]);
  const prodPts = hist.map((h) => [h.hk, h.t[2]]);
  const xMax = Math.max(time.total, ...hist.map((h) => h.hk));
  // skala ACV menyesuaikan data (awal bulan zoom ke 0-20%, makin lama makin lebar)
  const lastTg = tgOf(hist[hist.length - 1]);
  const acvTop = Math.max(0.1, Math.ceil(Math.max(lastTg, ...acvPts.map((p) => p[1]), ...hist.map((h) => tgOf(h))) * 1.25 * 25) / 25);
  const xEnd = Math.min(xMax, acvTop * (time.total || xMax));
  const refLine = { pts: [[0, 0], [xEnd, xEnd / (time.total || xMax)]] };
  const salSeries = names.map((n, i) => {
    const t = D.sales.find((s) => s.name === n)?.tgt || 0;
    return { name: nm(n), color: PAL[i % PAL.length], pts: hist.map((h) => [h.hk, t ? (h.s[n]?.[0] || 0) / t : 0]) };
  });
  const lastH = hist[hist.length - 1];
  const prKeys = Object.keys(lastH.pr || {}).sort((a, b) => (lastH.pr[b] || 0) - (lastH.pr[a] || 0)).slice(0, 5);
  const prSeries = prKeys.map((p, i) => ({ name: p, color: PAL[i % PAL.length], pts: hist.map((h) => [h.hk, (h.pr?.[p] || 0) / 1e6]) }));
  return (
    <div className="cgrid">
      <Panel className="wide" title="ACV TOTAL VS TIMEGONE" right={`${hist.length} hari tercatat · ${mode === 'bti' ? 'BTI' : 'Milestone'}`}>
        <LineChart wide series={[{ name: 'ACV', color: '#2fbf71', pts: acvPts }]} refLine={refLine} yMax={acvTop} xMax={xMax} fmtY={(v) => Math.round(v * 100) + '%'} xLabel={(x) => 'H' + x} />
        <Legend items={[{ name: 'ACV total', color: '#2fbf71' }, { name: 'Timegone (garis target laju)', color: '#ec4a5a' }]} />
      </Panel>
      <Panel title="ACTUAL MTD (jt)">
        <LineChart series={[{ name: 'ACT', color: '#35a8e0', pts: actPts }]} xMax={xMax} fmtY={(v) => Math.round(v)} xLabel={(x) => 'H' + x} />
      </Panel>
      <Panel title="TOKO CA & CA PROD">
        <LineChart series={[{ name: 'CA', color: '#35a8e0', pts: caPts }, { name: 'CA Prod', color: '#2fbf71', pts: prodPts }]} xMax={xMax} fmtY={(v) => Math.round(v)} xLabel={(x) => 'H' + x} />
        <Legend items={[{ name: 'CA', color: '#35a8e0' }, { name: 'CA Prod', color: '#2fbf71' }]} />
      </Panel>
      <Panel title="ACT PER PRINCIPAL (jt)">
        <LineChart series={prSeries} xMax={xMax} fmtY={(v) => Math.round(v)} xLabel={(x) => 'H' + x} />
        <Legend items={prSeries.map((x) => ({ name: x.name, color: x.color }))} />
      </Panel>
      <Panel title="ACT PARETO JKS & SAK (jt)">
        <LineChart series={[{ name: 'Pareto JKS', color: '#8b5cf6', pts: hist.map((h) => [h.hk, (h.pj || 0) / 1e6]) }, { name: 'Pareto SAK', color: '#ffc933', pts: hist.map((h) => [h.hk, (h.ps || 0) / 1e6]) }]} xMax={xMax} fmtY={(v) => Math.round(v)} xLabel={(x) => 'H' + x} />
        <Legend items={[{ name: 'Pareto JKS', color: '#8b5cf6' }, { name: 'Pareto SAK', color: '#ffc933' }]} />
      </Panel>
      <Panel className="wide" title="ACV PER SALESMAN">
        <LineChart wide series={salSeries} refLine={refLine} yMax={acvTop} xMax={xMax} fmtY={(v) => Math.round(v * 100) + '%'} xLabel={(x) => 'H' + x} />
        <Legend items={salSeries.map((s) => ({ name: s.name, color: s.color }))} />
      </Panel>
    </div>
  );
}

// ---------- Bandingkan antar waktu ----------
function Compare({ data, time, sal, dim, setDim }) {
  const [metric, setMetric] = useState('act');
  const [basis, setBasis] = useState('pro');
  const rows0 = useMemo(() => compareRows(data, dim, sal), [data, dim, sal]);
  const m = basis === 'pro' ? time.tg : 1;
  const isAct = metric === 'act';
  const conv = (v) => (isAct ? v / 1e6 : v);
  const rows = useMemo(() => {
    const r = rows0.map((x) => {
      const c = isAct ? x.cur : x.bCur;
      const l = (isAct ? x.lm : x.bLm) * m;
      const t = (isAct ? x.l3m : x.bL3) * m;
      return { label: x.label, c, l, t, gl: l > 0 ? c / l : null, gt: t > 0 ? c / t : null };
    });
    const top = dim === 'brand' || dim === 'sub' || dim === 'prin' ? 10 : 99;
    return r.sort((a, b) => Math.max(b.c, b.l, b.t) - Math.max(a.c, a.l, a.t)).slice(0, top);
  }, [rows0, m, isAct, dim]);
  const fmtV = isAct ? (v) => (v >= 100 ? v.toFixed(0) : v.toFixed(1)).replace('.', ',') : (v) => Math.round(v);
  const ser = [
    { name: 'Okt (MTD)', color: '#2fbf71' },
    { name: basis === 'pro' ? 'Sep × timegone' : 'Sep (penuh)', color: '#35a8e0' },
    { name: basis === 'pro' ? 'L3M × timegone' : 'L3M/bln (penuh)', color: '#ffc933' },
  ];
  const noTg = basis === 'pro' && time.tg <= 0;
  return (
    <div className="cgrid">
      <Panel className="wide" title="BANDINGKAN ANTAR WAKTU" right={sal === 'ALL' ? 'semua salesman' : nm(sal)}>
        <div className="tabs-row" style={{ marginBottom: 6 }}>
          <Seg wrap value={dim} onChange={setDim} options={COMPARE_DIMS} />
        </div>
        <div className="tabs-row" style={{ marginBottom: 0 }}>
          <Seg wrap value={metric} onChange={setMetric} options={[{ v: 'act', label: 'Omset (ACT)' }, { v: 'buy', label: 'Toko beli' }]} />
          <Seg wrap value={basis} onChange={setBasis} options={[{ v: 'pro', label: 'Pro-rata timegone' }, { v: 'full', label: 'Total penuh' }]} />
        </div>
        <div className="mut" style={{ fontSize: 13, marginTop: 6 }}>
          {basis === 'pro'
            ? `Okt dibanding Sep dan L3M yang sudah dikali timegone ${fmt.pct(time.tg)} (laju yang sama). L3M = rata-rata per bulan.`
            : 'Okt (baru berjalan) dibanding Sep dan L3M untuk satu bulan penuh. L3M = rata-rata per bulan.'}
        </div>
        {noTg && <div className="warn">Belum ada hari kerja berjalan, jadi pembanding pro-rata masih 0. Pakai "Total penuh" dulu.</div>}
      </Panel>
      <Panel className="wide" title={isAct ? 'NILAI (jt)' : 'JUMLAH TOKO YANG BELI'} right={rows.length ? `${rows.length} item` : ''}>
        {rows.length ? (
          <>
            <GroupedBars wide groups={rows.map((r) => ({ label: r.label, vals: [conv(r.c), conv(r.l), conv(r.t)] }))} series={ser} fmtV={fmtV} showVals={rows.length <= 8} />
            <Legend items={ser} />
          </>
        ) : <div className="mut">Belum ada data untuk dimensi ini.</div>}
      </Panel>
      <Panel className="wide" title="GROWTH VS SEP & L3M" right="100% = sama dengan pembanding">
        {rows.length ? (
          <>
            <GroupedBars wide
              groups={rows.map((r) => ({ label: r.label, vals: [(r.gl ?? 0) * 100, (r.gt ?? 0) * 100] }))}
              series={[{ name: '% vs Sep', color: '#35a8e0' }, { name: '% vs L3M', color: '#ffc933' }]}
              refv={100} refLabel="100%" fmtV={(v) => Math.round(v) + '%'} showVals={rows.length <= 8}
            />
            <Legend items={[{ name: '% vs Sep', color: '#35a8e0' }, { name: '% vs L3M', color: '#ffc933' }]} />
          </>
        ) : null}
      </Panel>
      <Panel className="wide" title="TABEL" flush>
        <div className="scroll">
          <table className="t">
            <thead><tr><th>{COMPARE_DIMS.find((d) => d.v === dim)?.label}</th><th>OKT</th><th>SEP</th><th>L3M</th><th>% SEP</th><th>% L3M</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="nm">{r.label}</td>
                  <td>{isAct ? fmt.jt(r.c, 2) : fmt.int(r.c)}</td>
                  <td>{isAct ? fmt.jt(r.l, 2) : fmt.int(r.l)}</td>
                  <td>{isAct ? fmt.jt(r.t, 2) : fmt.int(r.t)}</td>
                  <td className={paceCls(r.gl)}>{fmt.pace(r.gl)}</td>
                  <td className={paceCls(r.gt)}>{fmt.pace(r.gt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
