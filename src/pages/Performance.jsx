import { fmt, pace, paceCls, status } from '../lib/calc.js';
import { Bar, Kpi, Panel, Seg, useSorted } from '../components/ui.jsx';
import SnapFrame from '../components/SnapFrame.jsx';

export default function Performance({ D, data, time, mode, setMode, snapping, snapBg, both }) {
  const hasTgt = data.meta.storeTgt;
  const T = D.total;
  const st = status(T.acv, time.tg);
  const modeLabel = mode === 'bti' ? 'BTI' : 'Milestone';
  const { rows, th } = useSorted(D.sales, 'acv', -1);
  const principals = D.principals.filter((p) => T.pr[p].tgt > 0 || T.pr[p].act > 0);
  const stale = time.hk === 0;

  return (
    <SnapFrame snapping={snapping} bg={snapBg}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div className="hero-title">PERFORMANCE {time.monthShort}{data.meta.teamLabel ? ` · TIM ${data.meta.teamLabel.toUpperCase()}` : ''}</div>
          <div className="mut">
            {data.meta.region ? data.meta.region + ' · ' : ''}{data.salesmen.length} salesman · data s/d {time.asOf} (H-1)
          </div>
        </div>
        <div className="row">
          <span className="mut">VS</span>
          <Seg value={mode} onChange={setMode} disabled={!data.meta.hasBti} options={[{ v: 'milestone', label: 'Milestone' }, { v: 'bti', label: 'BTI' }]} />
        </div>
      </div>

      {both && (
        <Panel className="teamstrip" title="ARJUNA VS BIMA" right={`ACV vs ${modeLabel} · timegone ${fmt.pct(time.tg)}`}>
          <div className="mini" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {both.map((x) => (
              <div className="it" key={x.team}>
                <div className="h"><span>{x.label}</span><span className={status(x.D.total.acv, time.tg)}>{fmt.pct(x.D.total.acv)}</span></div>
                <Bar value={x.D.total.acv} mark={time.tg} tg={time.tg} />
                <div className="sub">{fmt.jt(x.D.total.act)} / {fmt.jt(x.D.total.tgt)} jt · gap {fmt.jt(x.D.total.gap)} jt</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      <div className="kpis k4">
        <Kpi label={`Target ${modeLabel}`} value={fmt.jt(T.tgt)} unit="jt" sub={`${D.sales.length} salesman`} />
        <Kpi label="Actual MTD" value={fmt.jt(T.act)} unit="jt" sub={`${time.hk} dari ${time.total} hari kerja`} />
        <Kpi hero label="ACV" value={fmt.pct(T.acv)} cls={st} sub={`timegone ${fmt.pct(time.tg)}`} />
        <Kpi label="Gap" value={fmt.jt(T.gap)} unit="jt" cls={T.gap < 0 ? 'low' : 'ok'} sub={`butuh ${fmt.jt(T.need)} jt/hari`} />
      </div>

      <div style={{ margin: '14px 4px 16px' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 4 }}>
          <span className="mut">ACV vs timegone · garis = posisi hari kerja berjalan</span>
          <span>sisa {time.sisa} hari kerja</span>
        </div>
        <Bar big value={T.acv} mark={time.tg} tg={time.tg} />
      </div>

      <div className="grid g21">
        <Panel title={`SALESMAN VS ${modeLabel.toUpperCase()}`} right={`${fmt.jt(T.act)} / ${fmt.jt(T.tgt)} jt`} flush>
          <div className="scroll">
            <table className="t">
              <thead>
                <tr>
                  <th>#</th>
                  {th('name', 'Salesman', 'l')}
                  {th('tgt', 'TGT')}
                  {th('act', 'ACT')}
                  {th('acv', 'ACV')}
                  {th('gap', 'GAP')}
                  {th((r) => r.vsLm ?? -1, '% SEP')}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.name}>
                    <td><span className={'rank' + (s.rank > 1 ? ' n' : '')}>{s.rank}</span></td>
                    <td className="l nm">{s.name}</td>
                    <td>{fmt.jt(s.tgt)}</td>
                    <td>{fmt.jt(s.act)}</td>
                    <td className="bc">
                      <div className="barlbl"><Bar value={s.acv} mark={time.tg} tg={time.tg} /><span className={status(s.acv, time.tg)}>{fmt.pct(s.acv)}</span></div>
                    </td>
                    <td className={s.gap < 0 ? 'neg' : ''}>{fmt.jt(s.gap)}</td>
                    <td className={paceCls(s.vsLm)}>{fmt.pace(s.vsLm)}</td>
                  </tr>
                ))}
                <tr className="tot">
                  <td />
                  <td className="l">TOTAL</td>
                  <td>{fmt.jt(T.tgt)}</td>
                  <td>{fmt.jt(T.act)}</td>
                  <td className="bc"><div className="barlbl"><Bar value={T.acv} mark={time.tg} tg={time.tg} /><span className={st}>{fmt.pct(T.acv)}</span></div></td>
                  <td className={T.gap < 0 ? 'neg' : ''}>{fmt.jt(T.gap)}</td>
                  <td className={paceCls(T.vsLm)}>{fmt.pace(T.vsLm)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="note">% SEP = ACT ÷ (omset Sep × timegone). 100% berarti laju sama dengan September.</div>
        </Panel>

        <Panel title="FOKUS PRINCIPAL" right="ACT / TGT jt">
          <div className="mini">
            {principals.map((p) => {
              const x = T.pr[p];
              return (
                <div className="it" key={p}>
                  <div className="h"><span>{p}</span><span className={status(x.acv, time.tg)}>{fmt.pct(x.acv)}</span></div>
                  <Bar value={x.acv} mark={time.tg} tg={time.tg} />
                  <div className="sub">{fmt.jt(x.act)} / {fmt.jt(x.tgt)} jt</div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel className="mt" title="PARETO & CA" right={`${T.st.n} toko JKS`}>
        <div className="mini" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))' }}>
          {[['Pareto JKS', T.pj], ['Pareto SAK', T.ps]].map(([title, st]) => {
            const p = pace(st.act, st.l3m, time.tg);
            return hasTgt ? (
              <div className="it" key={title}>
                <div className="h"><span>{title}</span><span className={status(st.acv, time.tg)}>{fmt.pct(st.acv)}</span></div>
                <Bar value={st.acv} mark={time.tg} tg={time.tg} />
                <div className="sub">{fmt.jt(st.act)} / {fmt.jt(st.tgt)} jt · {st.ca}/{st.n} toko CA</div>
              </div>
            ) : (
              <div className="it" key={title}>
                <div className="h"><span>{title}</span><span className={paceCls(p)}>{fmt.pace(p)}</span></div>
                <Bar value={Math.min(1, p ?? 0)} color={'bg-' + (p == null ? 'mp' : p >= 1 ? 'ok' : p >= 0.8 ? 'mid' : 'low')} />
                <div className="sub">{fmt.jt(st.act)} jt · vs L3M · {st.ca}/{st.n} toko CA</div>
              </div>
            );
          })}
          <div className="it">
            <div className="h"><span>CA (Customer Active)</span><span>{fmt.pct(T.st.caPct)}</span></div>
            <Bar value={T.st.caPct} color="bg-mp" />
            <div className="sub">{T.st.ca} dari {T.st.n} toko transaksi</div>
          </div>
          <div className="it">
            <div className="h"><span>CA Produktif</span><span>{fmt.pct(T.st.caProdPct)}</span></div>
            <Bar value={T.st.caProdPct} color="bg-mp" />
            <div className="sub">{T.st.caProd} toko lewat minimum</div>
          </div>
        </div>
      </Panel>
      {stale && <div className="warn">Belum ada hari kerja berjalan di bulan ini, timegone masih 0.</div>}
    </SnapFrame>
  );
}
