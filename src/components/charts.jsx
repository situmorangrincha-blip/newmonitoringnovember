import { useId } from 'react';

// Grafik bergaya retro, digambar sendiri (tanpa library): batang bersegmen, donat kotak-kotak, garis bertitik kotak.
export const PAL = ['#35a8e0', '#ffc933', '#2fbf71', '#ec4a5a', '#8b5cf6', '#ff8a3d'];
const INK = '#20214a';
const clamp = (v) => Math.max(0, Math.min(1, v));

function niceMax(max) {
  if (!(max > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const m = max / p;
  const n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
  return n * p;
}

const wrapLabel = (s, n = 11) => {
  s = String(s ?? '');
  if (s.length <= n) return [s];
  const cut = s.lastIndexOf(' ', n);
  if (cut > 2) {
    const a = s.slice(0, cut);
    const b = s.slice(cut + 1);
    return [a, b.length > n ? b.slice(0, n - 1) + '…' : b];
  }
  return [s.slice(0, n - 1) + '…'];
};

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((x) => (
        <span key={x.name}><i style={{ background: x.color }} />{x.name}</span>
      ))}
    </div>
  );
}

// ---- batang horizontal (health bar) ----
export function HBars({ rows, max, refv, fmtV = (v) => v, color = 'var(--mp)', labelW = 128 }) {
  const m = max ?? Math.max(0.0001, ...rows.map((r) => r.v), refv || 0);
  return (
    <div className="hb">
      {rows.map((r) => (
        <div className="hb-row" key={r.label}>
          <span className="hb-l" style={{ width: labelW }} title={r.label}>{r.label}</span>
          <div className="bar">
            <i style={{ width: clamp(r.v / m) * 100 + '%', backgroundColor: r.color || color }} />
            {refv != null && <b style={{ left: clamp(refv / m) * 100 + '%' }} />}
          </div>
          <span className="hb-v">{r.text ?? fmtV(r.v)}</span>
        </div>
      ))}
    </div>
  );
}

// ---- batang vertikal berkelompok ----
export function GroupedBars({ groups, series, h = 240, fmtV = (v) => v, refv, refLabel, yMax, showVals = true, wide = false }) {
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const W = wide ? 1040 : 520, L = 46, R = 10, T = 14, B = 44;
  const ch = h - T - B;
  const cw = W - L - R;
  const dataMax = Math.max(0, ...groups.flatMap((g) => g.vals.map((v) => v || 0)), refv || 0);
  const Y = yMax ?? niceMax(dataMax);
  const gw = cw / Math.max(1, groups.length);
  const bw = Math.min(wide ? 52 : 38, (gw * 0.78) / series.length);
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const y = (v) => T + ch - clamp(v / Y) * ch;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img">
      <defs>
        <pattern id={`p${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="1.5" y="4.5" fill="rgba(32,33,74,.25)" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(Y * t)} y2={y(Y * t)} stroke="#c9c8e0" strokeWidth="1.5" strokeDasharray={t ? '3 4' : ''} />
          <text x={L - 6} y={y(Y * t) + 4} textAnchor="end" className="ch-t">{fmtV(Y * t)}</text>
        </g>
      ))}
      {groups.map((g, gi) => {
        const x0 = L + gi * gw + (gw - bw * series.length) / 2;
        const lab = wrapLabel(g.label);
        return (
          <g key={g.label + gi}>
            <title>{g.label}</title>
            {series.map((s, si) => {
              const v = g.vals[si] || 0;
              const bh = clamp(v / Y) * ch;
              const x = x0 + si * bw;
              return (
                <g key={s.name}>
                  <rect x={x + 1} y={y(v)} width={bw - 2} height={Math.max(v > 0 ? 2 : 0, bh)} fill={s.color} stroke={INK} strokeWidth="2" />
                  <rect x={x + 1} y={y(v)} width={bw - 2} height={Math.max(v > 0 ? 2 : 0, bh)} fill={`url(#p${uid})`} />
                  {showVals && v > 0 && series.length <= 3 && groups.length <= 8 && (
                    <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" className="ch-v">{fmtV(v)}</text>
                  )}
                </g>
              );
            })}
            {lab.map((l, k) => (
              <text key={k} x={L + gi * gw + gw / 2} y={h - B + 15 + k * 12} textAnchor="middle" className="ch-t">{l}</text>
            ))}
          </g>
        );
      })}
      {refv != null && (
        <g>
          <line x1={L} x2={W - R} y1={y(refv)} y2={y(refv)} stroke="#ec4a5a" strokeWidth="2.5" strokeDasharray="8 5" />
          {refLabel && <text x={W - R - 2} y={y(refv) - 5} textAnchor="end" className="ch-ref">{refLabel}</text>}
        </g>
      )}
      <line x1={L} x2={W - R} y1={T + ch} y2={T + ch} stroke={INK} strokeWidth="3" />
    </svg>
  );
}

// ---- donat kotak-kotak ----
export function PixelDonut({ items, center, sub, size = 190 }) {
  const N = 40;
  const total = items.reduce((a, x) => a + Math.max(0, x.v), 0) || 1;
  let acc = 0;
  const bounds = items.map((x) => (acc += Math.max(0, x.v) / total));
  const colorAt = (p) => items[Math.max(0, bounds.findIndex((b) => p <= b + 1e-9))]?.color || '#c9c8e0';
  const R = size * 0.37, c = size / 2;
  return (
    <div className="donut">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut-svg" role="img">
        {Array.from({ length: N }, (_, k) => {
          const a = (360 / N) * k;
          return (
            <rect key={k} x={-size * 0.04} y={-R} width={size * 0.08} height={size * 0.115}
              transform={`translate(${c} ${c}) rotate(${a})`} fill={colorAt((k + 0.5) / N)} stroke={INK} strokeWidth="1.8" />
          );
        })}
        <text x={c} y={c + 2} textAnchor="middle" className="ch-big">{center}</text>
        {sub && <text x={c} y={c + 20} textAnchor="middle" className="ch-t">{sub}</text>}
      </svg>
      <div className="donut-leg">
        {items.map((x) => (
          <div key={x.label}><i style={{ background: x.color }} /><span>{x.label}</span><b>{(Math.max(0, x.v) / total * 100).toLocaleString('id-ID', { maximumFractionDigits: 0 })}%</b></div>
        ))}
      </div>
    </div>
  );
}

// ---- garis bertitik kotak ----
export function LineChart({ series, xMax, yMax, h = 240, fmtY = (v) => v, refLine, xLabel = (x) => x, wide = false }) {
  const W = wide ? 1040 : 520, L = 50, R = 12, T = 14, B = 34;
  const ch = h - T - B, cw = W - L - R;
  const dataMax = Math.max(0, ...series.flatMap((s) => s.pts.map((p) => p[1])), ...(refLine ? refLine.pts.map((p) => p[1]) : []));
  const Y = yMax ?? niceMax(dataMax * 1.05);
  const X = Math.max(1, xMax);
  const x = (v) => L + (v / X) * cw;
  const y = (v) => T + ch - clamp(v / Y) * ch;
  const xs = Array.from({ length: X + 1 }, (_, i) => i).filter((i) => X <= 14 || i % Math.ceil(X / 14) === 0);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${h}`} role="img">
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(Y * t)} y2={y(Y * t)} stroke="#c9c8e0" strokeWidth="1.5" strokeDasharray={t ? '3 4' : ''} />
          <text x={L - 6} y={y(Y * t) + 4} textAnchor="end" className="ch-t">{fmtY(Y * t)}</text>
        </g>
      ))}
      {xs.map((i) => <text key={i} x={x(i)} y={h - B + 16} textAnchor="middle" className="ch-t">{xLabel(i)}</text>)}
      {refLine && (
        <polyline points={refLine.pts.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')} fill="none" stroke="#ec4a5a" strokeWidth="2.5" strokeDasharray="8 5" />
      )}
      {series.map((s) => (
        <g key={s.name}>
          {s.pts.length > 1 && <polyline points={s.pts.map((p) => `${x(p[0])},${y(p[1])}`).join(' ')} fill="none" stroke={s.color} strokeWidth="3.5" strokeLinejoin="miter" />}
          {s.pts.map((p, i) => <rect key={i} x={x(p[0]) - 4.5} y={y(p[1]) - 4.5} width="9" height="9" fill={s.color} stroke={INK} strokeWidth="2" />)}
        </g>
      ))}
      <line x1={L} x2={W - R} y1={T + ch} y2={T + ch} stroke={INK} strokeWidth="3" />
    </svg>
  );
}
