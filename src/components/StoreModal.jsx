import { fmt, pace, paceCls, status, storeCat } from '../lib/calc.js';
import { Bar, Panel } from './ui.jsx';
import { StoreFlags } from '../pages/Stores.jsx';

export default function StoreModal({ s, data, time, onClose }) {
  const hasTgt = data.meta.storeTgt;
  const cat = storeCat(data, s.id);
  const acv = s.tgt ? s.act / s.tgt : 0;
  return (
    <div className="veil" onClick={onClose} data-sfx="back">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Panel title={s.name.toUpperCase()} right={<button className="btn sm" data-sfx="back" onClick={onClose}>Tutup</button>}>
          <div className="row" style={{ marginBottom: 8 }}>
            <StoreFlags s={s} />
            <span className="mut">{s.id} · {fmt.short(s.sales)} · {s.cc2} · {s.size} · {s.kec || '-'} · {s.hk}</span>
          </div>
          <div className="mini" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginBottom: 10 }}>
            <div className="it"><div className="h"><span>ACT Okt</span></div><b>{fmt.jt(s.act, 2)} jt</b><div className="sub">min CA prod {fmt.jt(s.min, 1)} jt</div></div>
            {hasTgt
              ? <div className="it"><div className="h"><span>TGT toko</span></div><b>{fmt.jt(s.tgt, 2)} jt</b><div className="sub">ACV <span className={status(acv, time.tg)}>{s.tgt ? fmt.pct(acv, 0) : '-'}</span></div></div>
              : <div className="it"><div className="h"><span>Laju vs L3M</span></div><b className={paceCls(pace(s.act, s.l3m, time.tg))}>{fmt.pace(pace(s.act, s.l3m, time.tg))}</b><div className="sub">vs Sep {fmt.pace(pace(s.act, s.lm, time.tg))}</div></div>}
            <div className="it"><div className="h"><span>Sep</span></div><b>{fmt.jt(s.lm, 2)} jt</b></div>
            <div className="it"><div className="h"><span>L3M / bulan</span></div><b>{fmt.jt(s.l3m, 2)} jt</b></div>
          </div>
          {hasTgt && s.tgt > 0 && <div style={{ marginBottom: 10 }}><Bar value={acv} mark={time.tg} tg={time.tg} /></div>}
          <div className="scroll">
            <table className="t">
              <thead><tr><th>Sub brand</th><th>OKT</th><th>SEP</th><th>L3M</th><th className="l">Catatan</th></tr></thead>
              <tbody>
                {cat.map((c) => (
                  <tr key={c.p + c.n}>
                    <td className="nm">{c.n}</td>
                    <td>{fmt.jt(c.cur, 2)}</td>
                    <td>{fmt.jt(c.lm, 2)}</td>
                    <td>{fmt.jt(c.l3m, 2)}</td>
                    <td className="l">
                      {c.cur <= 0 && c.lm > 0 && <span className="tag r">HILANG</span>}
                      {c.cur > 0 && c.lm <= 0 && <span className="tag g">BARU</span>}
                    </td>
                  </tr>
                ))}
                {!cat.length && <tr><td colSpan={5} className="mut" style={{ textAlign: 'center', padding: 16 }}>Belum ada transaksi sub brand untuk toko ini</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
