import { useMemo } from 'react';
import { byRouteDay, catAgg, fmt, pace, paceCls, status } from '../lib/calc.js';
import { Bar, Panel, initials } from '../components/ui.jsx';
import { StoreTable } from './Stores.jsx';

export default function Salesman({ D, data, time, sal, setSal, onStore }) {
  const hasTgt = data.meta.storeTgt;
  const name = D.sales.some((x) => x.name === sal) ? sal : D.sales[0].name;
  const S = D.sales.find((s) => s.name === name);
  const list = useMemo(() => data.stores.filter((s) => s.sales === name), [data, name]);
  const days = useMemo(() => byRouteDay(list), [list]);
  const maxDay = Math.max(1, ...days.map((d) => d.act));
  const cats = useMemo(() => catAgg(data, list).filter((r) => r.cur > 0).sort((a, b) => b.cur - a.cur).slice(0, 7), [data, list]);
  const catTot = cats.reduce((a, r) => a + r.cur, 0) || 1;
  const bti = data.targets.bti?.[name]?.total || 0;
  const mil = data.targets.milestone?.[name]?.total || 0;
  const todo = useMemo(() => list.filter((s) => s.act < 1).sort((a, b) => b.tgt - a.tgt || b.lm - a.lm), [list]);
  const top = useMemo(() => [...list].sort((a, b) => b.act - a.act).slice(0, 8), [list]);
  const st = status(S.acv, time.tg);

  return (
    <>
      <div className="chars">
        {D.sales.map((s) => (
          <button key={s.name} data-sfx="pick" className={'char' + (s.name === name ? ' on' : '')} onClick={() => setSal(s.name)}>
            <div className="av">{initials(s.name)}</div>
            <div className="n">{s.name}</div>
            <div className={'a ' + status(s.acv, time.tg)}>ACV {fmt.pct(s.acv)} · #{s.rank}</div>
          </button>
        ))}
      </div>

      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi hero"><div className="l">ACV {D.mode === 'bti' ? 'BTI' : 'Milestone'}</div><div className={'v ' + st}>{fmt.pct(S.acv)}</div><div className="s">timegone {fmt.pct(time.tg)} · rank #{S.rank}</div></div>
        <div className="kpi"><div className="l">Actual MTD</div><div className="v">{fmt.jt(S.act)}<small>jt</small></div><div className="s">vs SEP <b className={paceCls(S.vsLm)}>{fmt.pace(S.vsLm)}</b> · vs L3M <b className={paceCls(S.vsL3m)}>{fmt.pace(S.vsL3m)}</b></div></div>
        <div className="kpi"><div className="l">Milestone</div><div className="v">{fmt.jt(mil)}<small>jt</small></div><div className="s">ACV {mil ? fmt.pct(S.act / mil) : '-'}</div></div>
        <div className="kpi"><div className="l">BTI</div><div className="v">{bti ? fmt.jt(bti) : '-'}<small>{bti ? 'jt' : ''}</small></div><div className="s">ACV {bti ? fmt.pct(S.act / bti) : '-'}</div></div>
        <div className="kpi"><div className="l">Butuh per hari</div><div className="v">{fmt.jt(S.need)}<small>jt</small></div><div className="s">sisa {time.sisa} hari kerja</div></div>
      </div>

      <div className="grid g3">
        <Panel title="PRINCIPAL" right={D.mode === 'bti' ? 'vs BTI' : 'vs Milestone'}>
          <div className="mini">
            {D.principals.filter((p) => S.pr[p].tgt > 0 || S.pr[p].act > 0).map((p) => (
              <div className="it" key={p}>
                <div className="h"><span>{p}</span><span className={status(S.pr[p].acv, time.tg)}>{S.pr[p].tgt ? fmt.pct(S.pr[p].acv) : '-'}</span></div>
                <Bar value={S.pr[p].acv} mark={time.tg} tg={time.tg} />
                <div className="sub">{fmt.jt(S.pr[p].act)} / {fmt.jt(S.pr[p].tgt)} jt</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="TOKO: CA & PARETO" right={`${S.st.n} toko`}>
          <div className="mini">
            <div className="it"><div className="h"><span>CA</span><span>{fmt.pct(S.st.caPct, 0)}</span></div><Bar value={S.st.caPct} color="bg-mp" /><div className="sub">{S.st.ca} toko · {S.st.n - S.st.ca} belum</div></div>
            <div className="it"><div className="h"><span>CA Prod</span><span>{fmt.pct(S.st.caProdPct, 0)}</span></div><Bar value={S.st.caProdPct} color="bg-mp" /><div className="sub">{S.st.caProd} toko</div></div>
            {[['Pareto JKS', S.pj], ['Pareto SAK', S.ps]].filter(([, st]) => st.n > 0).map(([title, st]) => {
              const p = pace(st.act, st.l3m, time.tg);
              return hasTgt ? (
                <div className="it" key={title}><div className="h"><span>{title}</span><span className={status(st.acv, time.tg)}>{fmt.pct(st.acv, 0)}</span></div><Bar value={st.acv} mark={time.tg} tg={time.tg} /><div className="sub">{st.ca}/{st.n} CA · {fmt.jt(st.act)} / {fmt.jt(st.tgt)} jt</div></div>
              ) : (
                <div className="it" key={title}><div className="h"><span>{title}</span><span className={paceCls(p)}>{fmt.pace(p)}</span></div><Bar value={Math.min(1, p ?? 0)} color={'bg-' + (p == null ? 'mp' : p >= 1 ? 'ok' : p >= 0.8 ? 'mid' : 'low')} /><div className="sub">{st.ca}/{st.n} CA · {fmt.jt(st.act)} jt · vs L3M</div></div>
              );
            })}
          </div>
        </Panel>
        <Panel title="ACT PER HARI KUNJUNGAN" right="jt (jml toko)">
          <div className="days">
            {days.map((d) => (
              <div className="day" key={d.day}>
                <span>{d.act ? fmt.jt(d.act) : ''}</span>
                <i style={{ height: Math.max(2, (d.act / maxDay) * 78) + 'px' }} />
                <b>{d.day}</b>
                <span className="mut">({d.n})</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid g2 mt">
        <Panel title="MIX KATEGORI OKTOBER" right={cats.length ? `${fmt.jt(catTot)} jt` : ''}>
          <div className="mini">
            {cats.map((c) => (
              <div className="it" key={c.i}>
                <div className="h"><span>{c.n}</span><span>{fmt.jt(c.cur, 2)} jt</span></div>
                <Bar value={c.cur / catTot} color="bg-mp" />
              </div>
            ))}
            {!cats.length && <div className="mut">Belum ada transaksi kategori bulan ini.</div>}
          </div>
        </Panel>
        <Panel title="TOP TOKO OKTOBER" right="klik untuk detail" flush>
          <StoreTable list={top} time={time} onStore={onStore} limit={8} defKey="act" showSales={false} compact hasTgt={hasTgt} />
        </Panel>
      </div>

      <Panel className="mt" title="TO-DO: TOKO BELUM CA (TGT TERBESAR DULU)" right={`${todo.length} toko`} flush>
        <StoreTable list={todo} time={time} onStore={onStore} limit={15} defKey="tgt" showSales={false} hasTgt={hasTgt} />
      </Panel>
    </>
  );
}
