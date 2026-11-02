import { useMemo, useState } from 'react';
import { fmt, pace, paceCls, status } from '../lib/calc.js';
import { Bar, Panel, Seg, useSorted } from '../components/ui.jsx';
import SalFilter from '../components/SalFilter.jsx';
import { StoreTable } from './Stores.jsx';

const SUBS = [{ v: 'pj', label: 'Pareto JKS' }, { v: 'ps', label: 'Pareto SAK' }, { v: 'ca', label: 'CA' }];

export default function Pareto({ D, data, time, sub, setSub, sal, setSal, onStore }) {
  return (
    <>
      <div className="tabs-row">
        <Seg value={sub} onChange={setSub} options={SUBS} />
        {sub !== 'ca' && <SalFilter data={data} value={sal} onChange={setSal} />}
      </div>
      {sub === 'ca' ? <CaView D={D} time={time} /> : <ParetoView kind={sub} D={D} data={data} time={time} sal={sal} onStore={onStore} />}
    </>
  );
}

function ParetoView({ kind, D, data, time, sal, onStore }) {
  const label = kind === 'pj' ? 'PARETO JKS (30 TOKO TERBESAR PER SALESMAN)' : 'PARETO SAK (30 TOKO PRIORITAS SPV)';
  const rows = D.sales.map((s) => ({ name: s.name, ...s[kind] })).filter((r) => r.n > 0);
  const tot = D.total[kind];
  const { rows: sorted, th } = useSorted(rows, 'acv', -1);
  const list = useMemo(() => data.stores.filter((s) => s[kind] && (sal === 'ALL' || s.sales === sal)), [data, kind, sal]);
  const hasTgt = data.meta.storeTgt;
  return (
    <div className="grid">
      <Panel title={label} right={hasTgt ? `${fmt.jt(tot.act)} / ${fmt.jt(tot.tgt)} jt` : `${fmt.jt(tot.act)} jt`} flush>
        <div className="scroll">
          <table className="t">
            <thead>
              <tr>
                {th('name', 'Salesman', 'l')}
                {th('n', 'Toko')}
                {hasTgt && th('tgt', 'TGT')}
                {th('act', 'ACT')}
                {hasTgt ? th('acv', 'ACV') : th((r) => pace(r.act, r.lm, time.tg) ?? -1, '% SEP')}
                {!hasTgt && th((r) => pace(r.act, r.l3m, time.tg) ?? -1, '% L3M')}
                {th('ca', 'CA')}
                {th('caProd', 'Prod')}
                {th((r) => r.n - r.ca, 'Belum CA')}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.name}>
                  <td className="nm">{r.name}</td>
                  <td>{r.n}</td>
                  {hasTgt && <td>{fmt.jt(r.tgt)}</td>}
                  <td>{fmt.jt(r.act)}</td>
                  {hasTgt ? (
                    <td className="bc"><div className="barlbl"><Bar value={r.acv} mark={time.tg} tg={time.tg} /><span className={status(r.acv, time.tg)}>{fmt.pct(r.acv, 0)}</span></div></td>
                  ) : (
                    <td className={paceCls(pace(r.act, r.lm, time.tg))}>{fmt.pace(pace(r.act, r.lm, time.tg))}</td>
                  )}
                  {!hasTgt && <td className={paceCls(pace(r.act, r.l3m, time.tg))}>{fmt.pace(pace(r.act, r.l3m, time.tg))}</td>}
                  <td>{r.ca}</td>
                  <td>{r.caProd}</td>
                  <td className={r.n - r.ca ? 'neg' : ''}>{r.n - r.ca}</td>
                </tr>
              ))}
              <tr className="tot">
                <td>TOTAL</td><td>{tot.n}</td>{hasTgt && <td>{fmt.jt(tot.tgt)}</td>}<td>{fmt.jt(tot.act)}</td>
                {hasTgt ? <td>{fmt.pct(tot.acv, 0)}</td> : <td>{fmt.pace(pace(tot.act, tot.lm, time.tg))}</td>}
                {!hasTgt && <td>{fmt.pace(pace(tot.act, tot.l3m, time.tg))}</td>}
                <td>{tot.ca}</td><td>{tot.caProd}</td><td>{tot.n - tot.ca}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {data.meta.autoPareto && <div className="note">Pareto tim ini dihitung otomatis: 30 toko terbesar per salesman berdasarkan rata-rata L3M (SAK: 30 terbesar se-tim). % SEP / % L3M = ACT ÷ (pembanding × timegone).</div>}
      </Panel>
      <Panel title="DAFTAR TOKO" right={`${list.length} toko · klik untuk detail`} flush>
        <StoreTable list={list} time={time} onStore={onStore} limit={40} defKey="tgt" hasTgt={data.meta.storeTgt} />
      </Panel>
    </div>
  );
}

function CaView({ D, time }) {
  const T = D.total;
  const rows = D.sales.map((s) => ({ name: s.name, ...s.st }));
  const { rows: sorted, th } = useSorted(rows, 'caPct', -1);
  const [mode, setMode] = useState('ca');
  return (
    <div className="grid">
      <div className="kpis" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="kpi hero"><div className="l">CA (Customer Active)</div><div className="v">{fmt.pct(T.st.caPct)}</div><div className="s">{T.st.ca} dari {T.st.n} toko</div></div>
        <div className="kpi"><div className="l">CA Produktif</div><div className="v">{fmt.pct(T.st.caProdPct)}</div><div className="s">{T.st.caProd} toko</div></div>
        <div className="kpi"><div className="l">Belum CA</div><div className="v low">{T.st.n - T.st.ca}</div><div className="s">toko belum transaksi</div></div>
        <div className="kpi"><div className="l">CA tapi belum produktif</div><div className="v mid">{T.st.ca - T.st.caProd}</div><div className="s">di bawah minimum</div></div>
      </div>
      <Panel title="CA PER SALESMAN" right={<Seg wrap value={mode} onChange={setMode} options={[{ v: 'ca', label: 'CA' }, { v: 'prod', label: 'CA Prod' }]} />} flush>
        <div className="scroll">
          <table className="t">
            <thead>
              <tr>
                {th('name', 'Salesman', 'l')}
                {th('n', 'Toko')}
                {th('ca', 'CA')}
                {th('caPct', 'CA%')}
                {th('caProd', 'Prod')}
                {th('caProdPct', 'Prod%')}
                {th((r) => r.n - r.ca, 'Belum CA')}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.name}>
                  <td className="nm">{r.name}</td>
                  <td>{r.n}</td>
                  <td>{r.ca}</td>
                  <td className="bc"><div className="barlbl"><Bar value={r.caPct} color="bg-mp" /><span>{fmt.pct(r.caPct, 0)}</span></div></td>
                  <td>{r.caProd}</td>
                  <td className="bc"><div className="barlbl"><Bar value={r.caProdPct} color="bg-ok" /><span>{fmt.pct(r.caProdPct, 0)}</span></div></td>
                  <td className="neg">{r.n - r.ca}</td>
                </tr>
              ))}
              <tr className="tot"><td>TOTAL</td><td>{T.st.n}</td><td>{T.st.ca}</td><td>{fmt.pct(T.st.caPct, 0)}</td><td>{T.st.caProd}</td><td>{fmt.pct(T.st.caProdPct, 0)}</td><td>{T.st.n - T.st.ca}</td></tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="mut" style={{ fontSize: 13 }}>CA = toko dengan transaksi ≥ Rp1 di bulan ini. CA Produktif = nilai transaksi ≥ Minimum CA Prod toko (retail 200rb, grosir 1jt kalau kosong di LAB).</div>
    </div>
  );
}
