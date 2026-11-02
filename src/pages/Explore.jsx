import { useEffect, useMemo, useState } from 'react';
import { fmt, pace, paceCls, parseRoute, status, weekdayName } from '../lib/calc.js';
import { Bar, Panel, Seg } from '../components/ui.jsx';

const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const uniq = (a) => [...new Set(a)];
const nk = (s) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
const MAX_ROWS = 3;

const STORE_DIMS = ['sales', 'tim', 'store', 'channel', 'size', 'day', 'pareto', 'sak', 'ca'];
const SKU_DIMS = ['principal', 'brand', 'sku', 'category'];
const DIM_LABEL = { sales: 'Salesman', tim: 'Tim', store: 'Toko', channel: 'Channel', size: 'Ukuran toko', day: 'Hari kunjungan', pareto: 'Pareto JKS', sak: 'Pareto SAK', ca: 'Status CA', principal: 'Principal', brand: 'Brand', sku: 'SKU', category: 'Kategori' };

// indikator. grp: kelompok; st: tersedia di level toko; sk: tersedia di level SKU
const MEAS = [
  { id: 'act', label: 'ACT (Rp)', grp: 'Pencapaian', st: 1, sk: 1, kind: 'rp' },
  { id: 'tgt', label: 'Target', grp: 'Pencapaian', st: 1, sk: 'tgt', kind: 'rp' },
  { id: 'ach', label: '% Ach', grp: 'Pencapaian', st: 1, sk: 'tgt', kind: 'pct' },
  { id: 'gap', label: 'Gap', grp: 'Pencapaian', st: 1, sk: 'tgt', kind: 'rp' },
  { id: 'vsTg', label: 'vs Timegone', grp: 'Pencapaian', st: 1, sk: 'tgt', kind: 'pace' },
  { id: 'qty', label: 'Qty', grp: 'Pencapaian', st: 'qty', sk: 'qty', kind: 'qty' },
  { id: 'lm', label: 'Sep', grp: 'Tren', st: 1, sk: 0, kind: 'rp' },
  { id: 'l3m', label: 'L3M', grp: 'Tren', st: 1, sk: 0, kind: 'rp' },
  { id: 'vsLm', label: 'vs Sep', grp: 'Tren', st: 1, sk: 0, kind: 'pace' },
  { id: 'vsL3m', label: 'vs L3M', grp: 'Tren', st: 1, sk: 0, kind: 'pace' },
  { id: 'n', label: 'Jml toko', grp: 'Jangkauan', st: 1, sk: 1, kind: 'int' },
  { id: 'ca', label: 'CA', grp: 'Jangkauan', st: 1, sk: 1, kind: 'int' },
  { id: 'caPct', label: '% CA', grp: 'Jangkauan', st: 1, sk: 1, kind: 'pct' },
  { id: 'notBuy', label: 'Belum beli', grp: 'Jangkauan', st: 1, sk: 1, kind: 'int' },
  { id: 'caProd', label: 'CA Prod', grp: 'Jangkauan', st: 1, sk: 0, kind: 'int' },
  { id: 'avgCa', label: 'ACT / CA', grp: 'Jangkauan', st: 1, sk: 1, kind: 'rp' },
  { id: 'share', label: '% Kontribusi', grp: 'Jangkauan', st: 1, sk: 1, kind: 'pct' },
];
const DEFAULT = { rows: ['sales'], ms: ['act', 'tgt', 'ach', 'ca'], filters: [], basis: 'same', unit: 'jt', cov: 'all', who: 'ALL', grp: 'ALL', q: '' };

export default function Explore({ data, time, depot, team }) {
  const pkey = `sm_presets_${depot}_${team}`;
  const [st, setSt] = useState(DEFAULT);
  const [presets, setPresets] = useState(() => loadJson(pkey, []));
  const [editF, setEditF] = useState(null);
  const [over, setOver] = useState('');
  const [sort, setSort] = useState({ k: null, dir: -1 });
  useEffect(() => { setPresets(loadJson(pkey, [])); setSt(DEFAULT); }, [pkey]);
  const set = (p) => setSt((o) => ({ ...o, ...p }));

  const hasSku = data.subs.length > 0;
  const hasQty = !!data.hasQty;
  const hasSkuTgt = !!data.skuTgt && Object.keys(data.skuTgt).length > 0;
  const tgBase = time.tg;
  const progs = useMemo(() => uniq((data.prog || []).map((x) => x.p)), [data.prog]);
  const teamName = data.meta.teamLabel || '';

  // ---------- definisi dimensi ----------
  const dimStore = useMemo(() => ({
    sales: (s) => s.sales,
    tim: (s) => data.groups?.[s.sales] || teamName,
    store: (s) => s.id,
    channel: (s) => (s.cc1 && s.cc1 !== '-' ? s.cc1 : '-'),
    size: (s) => s.size || '-',
    day: (s) => weekdayName(parseRoute(s.hk).wd) || '-',
    pareto: (s) => (s.pj ? 'Pareto JKS' : 'Non-pareto'),
    sak: (s) => (s.ps ? 'Pareto SAK' : 'Non-SAK'),
    ca: (s) => (s.act >= 1 ? 'Sudah beli' : 'Belum beli'),
  }), [data, teamName]);
  const dimSku = useMemo(() => ({ principal: (sb) => sb.p || '-', brand: (sb) => sb.b || '-', sku: (sb) => sb.n || '-', category: (sb) => sb.k || '-' }), []);
  const storeById = useMemo(() => new Map(data.stores.map((s) => [s.id + '|' + nk(s.sales), s])), [data.stores]);
  const storeCount = useMemo(() => { const o = {}; for (const s of data.stores) o[s.sales] = (o[s.sales] || 0) + 1; return o; }, [data.stores]);
  const nameOf = (id) => data.stores.find((s) => s.id === id)?.name || id;
  const availDims = [...STORE_DIMS, ...(hasSku ? SKU_DIMS : [])];

  // ---------- filter cepat + filter seret ----------
  const filters = [...st.filters];
  if (st.who !== 'ALL') filters.push({ dim: 'sales', vals: [st.who] });
  if (st.grp !== 'ALL') filters.push({ dim: 'tim', vals: [st.grp] });
  if (st.cov === 'pj') filters.push({ dim: 'pareto', vals: ['Pareto JKS'] });
  if (st.cov === 'np') filters.push({ dim: 'pareto', vals: ['Non-pareto'] });
  if (st.cov === 'ps') filters.push({ dim: 'sak', vals: ['Pareto SAK'] });
  const q = st.q.trim().toLowerCase();
  const skuMode = [...st.rows, ...filters.map((f) => f.dim)].some((d) => SKU_DIMS.includes(d)) || !!q;

  const valuesOf = (dim) => {
    if (SKU_DIMS.includes(dim)) return uniq(data.subs.map(dimSku[dim])).sort();
    if (dim === 'store') return data.stores.map((s) => s.id).slice(0, 400);
    return uniq(data.stores.map(dimStore[dim])).sort();
  };

  const calc = useMemo(() => {
    const stF = filters.filter((f) => STORE_DIMS.includes(f.dim) && f.vals.length);
    const skF = filters.filter((f) => SKU_DIMS.includes(f.dim) && f.vals.length);
    const pass = (s) => stF.every((f) => f.vals.includes(dimStore[f.dim](s)));
    const stores = data.stores.filter(pass);
    const rowDimsSt = st.rows.filter((d) => STORE_DIMS.includes(d));
    const rowDimsSk = st.rows.filter((d) => SKU_DIMS.includes(d));
    const keyOf = (vals) => vals.join('\u0001');
    const msAvail = (m) => (skuMode ? m.sk : m.st);

    let groups;
    let total;
    const mkLabel = (vals) => st.rows.map((d, i) => (d === 'store' ? nameOf(vals[i]) : vals[i]));

    if (!skuMode) {
      const m = new Map();
      for (const s of stores) {
        const vals = st.rows.map((d) => dimStore[d](s));
        const k = keyOf(vals);
        if (!m.has(k)) m.set(k, { vals, list: [] });
        m.get(k).list.push(s);
      }
      groups = [...m.values()].map((g) => ({ ...g, ...storeMeasures(g.list, true) }));
      total = storeMeasures(stores, true);
    } else {
      // level SKU: tiap toko x SKU yang punya nilai/qty
      const subOk = data.subs.map((sb, i) => {
        if (!skF.every((f) => f.vals.includes(dimSku[f.dim](sb)))) return false;
        if (q && !`${sb.n} ${sb.b} ${sb.p} ${sb.c || ''} ${sb.k || ''}`.toLowerCase().includes(q)) return false;
        return true;
      });
      const denom = new Map(); // jumlah toko per kombinasi dimensi toko (penyebut CA)
      const sdKey = (s) => keyOf(rowDimsSt.map((d) => dimStore[d](s)));
      for (const s of stores) denom.set(sdKey(s), (denom.get(sdKey(s)) || 0) + 1);
      const m = new Map();
      const cur = data.cat?.cur || {};
      const qt = data.qty?.cur || {};
      let all = { act: 0, qty: 0, tgt: 0, buyers: new Set(), n: stores.length };
      for (const s of stores) {
        const ids = new Set([...Object.keys(cur[s.id] || {}), ...Object.keys(qt[s.id] || {})]);
        for (const i of ids) {
          if (!subOk[i]) continue;
          const sb = data.subs[i];
          const vals = st.rows.map((d) => (STORE_DIMS.includes(d) ? dimStore[d](s) : dimSku[d](sb)));
          const k = keyOf(vals);
          let g = m.get(k);
          if (!g) { g = { vals, act: 0, qty: 0, tgt: 0, buyers: new Set(), sales: new Set(), dk: sdKey(s) }; m.set(k, g); }
          const a = cur[s.id]?.[i] || 0;
          const qq = qt[s.id]?.[i] || 0;
          g.act += a; g.qty += qq; g.tgt += data.skuTgt?.[s.id]?.[i] || 0;
          g.sales.add(s.sales);
          if (a > 0 || qq > 0) g.buyers.add(s.id);
          all.act += a; all.qty += qq; all.tgt += data.skuTgt?.[s.id]?.[i] || 0;
          if (a > 0 || qq > 0) all.buyers.add(s.id);
        }
      }
      // target level principal (per salesman) kalau tidak ada target per SKU
      const principalTgt = (g) => {
        const pi = st.rows.indexOf('principal');
        if (pi < 0) return null;
        const si = st.rows.indexOf('sales');
        const sales = si >= 0 ? [g.vals[si]] : [...g.sales];
        if (sales.length !== 1) return null;
        const t = data.targets?.milestone?.[sales[0]];
        const v = t?.[nk(g.vals[pi])];
        return v > 0 ? v : null;
      };
      groups = [...m.values()].map((g) => {
        const n = denom.get(g.dk) || 0;
        let tgt = g.tgt;
        let tgtNote = false;
        if (!hasSkuTgt) { const pt = principalTgt(g); if (pt != null) { tgt = pt; tgtNote = true; } else tgt = 0; }
        return { ...g, ...skuMeasures({ act: g.act, qty: g.qty, tgt, buyers: g.buyers.size, n }), tgtNote, hasT: tgt > 0 };
      });
      total = skuMeasures({ act: all.act, qty: all.qty, tgt: hasSkuTgt ? all.tgt : 0, buyers: all.buyers.size, n: all.n });
      total.hasT = hasSkuTgt && all.tgt > 0;
      const tot = total.act;
      groups.forEach((g) => { g.share = tot ? g.act / tot : 0; });
      total.share = 1;
    }
    return { groups, total, mkLabel, msAvail, nStores: stores.length };

    function storeMeasures(list) {
      const act = sum(list, (s) => s.act);
      let tgt = sum(list, (s) => s.tgt);
      if (!tgt) {
        // target salesman (sheet TGT) dipakai kalau grup = seluruh toko salesman itu
        const ss = [...new Set(list.map((s) => s.sales))];
        const whole = ss.length > 0 && ss.every((n) => list.filter((s) => s.sales === n).length === storeCount[n]);
        if (whole) tgt = sum(ss, (n) => data.targets?.milestone?.[n]?.total || 0);
      }
      const lm = sum(list, (s) => s.lm);
      const l3m = sum(list, (s) => s.l3m);
      const n = list.length;
      const ca = list.filter((s) => s.act >= 1).length;
      const baseLm = st.basis === 'same' ? lm * tgBase : lm;
      const baseL3 = st.basis === 'same' ? l3m * tgBase : l3m;
      const o = {
        act, tgt, ach: tgt ? act / tgt : null, gap: act - tgt,
        vsTg: tgt > 0 && tgBase > 0 ? act / (tgt * tgBase) : null,
        qty: sum(list, (s) => sum(Object.values(data.qty?.cur?.[s.id] || {}), (v) => v)),
        lm: baseLm, l3m: baseL3,
        vsLm: baseLm > 0 ? act / baseLm : null,
        vsL3m: baseL3 > 0 ? act / baseL3 : null,
        n, ca, caPct: n ? ca / n : 0, notBuy: n - ca,
        caProd: list.filter((s) => s.act >= s.min).length,
        avgCa: ca ? act / ca : 0,
        share: 0,
        hasT: tgt > 0,
      };
      // program (GreenStore / MSS)
      const idSet = new Set(list.map((s) => s.id));
      const salSet = new Set(list.map((s) => s.sales));
      const byStoreDim = st.rows.includes('store');
      for (const p of progs) {
        let t = 0, a = 0;
        for (const x of data.prog || []) {
          if (x.p !== p) continue;
          if (x.id) { if (idSet.has(x.id)) { t += x.t; a += x.a; } } else if (!byStoreDim && salSet.has(x.s)) { t += x.t; a += x.a; }
        }
        o['p:' + p + ':t'] = t; o['p:' + p + ':a'] = a; o['p:' + p + ':pct'] = t ? a / t : null;
      }
      return o;
    }
    function skuMeasures({ act, qty, tgt, buyers, n }) {
      return { act, qty, tgt, ach: tgt ? act / tgt : null, gap: act - tgt, vsTg: tgt > 0 && tgBase > 0 ? act / (tgt * tgBase) : null, n, ca: buyers, caPct: n ? buyers / n : 0, notBuy: Math.max(0, n - buyers), avgCa: buyers ? act / buyers : 0, share: 0 };
    }
  }, [data, st, skuMode, q, tgBase, progs, hasSkuTgt]); // eslint-disable-line

  // ---------- daftar indikator termasuk program ----------
  const allMeas = useMemo(() => {
    const base = MEAS.map((m) => ({ ...m, avail: skuMode ? (m.sk === 'tgt' ? true : !!m.sk) : (m.st === 'qty' ? hasQty : !!m.st) }));
    for (const p of progs) {
      base.push({ id: `p:${p}:t`, label: `${p} Target`, grp: 'Program', kind: 'int', avail: !skuMode });
      base.push({ id: `p:${p}:a`, label: `${p} Ach`, grp: 'Program', kind: 'int', avail: !skuMode });
      base.push({ id: `p:${p}:pct`, label: `${p} %`, grp: 'Program', kind: 'pct', avail: !skuMode });
    }
    return base;
  }, [skuMode, hasQty, progs]);
  const mById = Object.fromEntries(allMeas.map((m) => [m.id, m]));
  const noteOf = (m) => {
    if (m.avail) return '';
    if (skuMode) return m.grp === 'Tren' ? 'tidak tersedia di level SKU (Sep & L3M cuma ada per toko)' : m.grp === 'Program' ? 'program hanya di level toko/salesman' : 'tidak tersedia di level SKU';
    return m.id === 'qty' ? 'belum ada data qty (upload slot Qty)' : '';
  };
  const labelOf = (m) => {
    if (m.id === 'lm') return st.basis === 'same' ? 'Sep @TG' : 'Sep';
    if (m.id === 'l3m') return st.basis === 'same' ? 'L3M @TG' : 'L3M';
    if (m.id === 'vsLm') return st.basis === 'same' ? 'vs Sep @TG' : 'vs Sep (full)';
    if (m.id === 'vsL3m') return st.basis === 'same' ? 'vs L3M @TG' : 'vs L3M (full)';
    return m.label;
  };

  // ---------- tampilan nilai ----------
  const money = (v) => (st.unit === 'jt' ? fmt.jt(v, Math.abs(v) < 1e7 ? 2 : 1) : fmt.int(v));
  const cell = (m, v, g) => {
    if (v == null && (m.kind === 'pct' || m.kind === 'pace')) return '-';
    if (v == null) v = 0;
    if (m.kind === 'rp') {
      if ((m.id === 'tgt' || m.id === 'gap') && g && g.hasT === false) return '-';
      return money(v);
    }
    if (m.kind === 'int') return fmt.int(v);
    if (m.kind === 'qty') return Number.isInteger(v) ? fmt.int(v) : v.toLocaleString('id-ID', { maximumFractionDigits: 1 });
    if (m.kind === 'pct') return v == null ? '-' : fmt.pct(v, 0);
    if (m.kind === 'pace') return fmt.pace(v);
    return String(v);
  };
  const cls = (m, v) => {
    if (v == null) return 'mut';
    if (m.id === 'ach') return status(v, tgBase);
    if (m.id === 'vsTg') return paceCls(v);
    if (m.id === 'vsLm' || m.id === 'vsL3m') return paceCls(v);
    if (m.id === 'gap') return v < 0 ? 'neg' : 'ok';
    return '';
  };

  const msOn = st.ms.filter((id) => mById[id]?.avail);
  const sorted = useMemo(() => {
    const arr = [...calc.groups];
    const k = sort.k;
    arr.sort((a, b) => {
      if (k && k.startsWith('d:')) { const i = +k.slice(2); return String(a.vals[i]).localeCompare(String(b.vals[i])) * sort.dir; }
      const f = k || msOn[0];
      if (!f) return 0;
      return ((a[f] ?? -Infinity) - (b[f] ?? -Infinity)) * sort.dir;
    });
    return arr;
  }, [calc.groups, sort, msOn.join(',')]); // eslint-disable-line
  const clickSort = (k) => setSort((o) => (o.k === k ? { k, dir: -o.dir } : { k, dir: k.startsWith('d:') ? 1 : -1 }));

  // ---------- drag & drop ----------
  const drag = (t, id) => (e) => { e.dataTransfer.setData('text/plain', JSON.stringify({ t, id })); e.dataTransfer.effectAllowed = 'copy'; };
  const addRow = (id) => setSt((o) => (o.rows.includes(id) || o.rows.length >= MAX_ROWS ? o : { ...o, rows: [...o.rows, id] }));
  const addMeas = (id) => setSt((o) => (o.ms.includes(id) ? o : { ...o, ms: [...o.ms, id] }));
  const addFilter = (dim) => { setSt((o) => (o.filters.some((f) => f.dim === dim) ? o : { ...o, filters: [...o.filters, { dim, vals: [] }] })); setEditF(dim); };
  const drop = (zone) => (e) => {
    e.preventDefault(); setOver('');
    let p; try { p = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (zone === 'rows' && p.t === 'dim') addRow(p.id);
    if (zone === 'ms' && p.t === 'm') addMeas(p.id);
    if (zone === 'flt' && p.t === 'dim') addFilter(p.id);
  };
  const zoneProps = (z) => ({ onDragOver: (e) => { e.preventDefault(); setOver(z); }, onDragLeave: () => setOver(''), onDrop: drop(z) });

  const savePreset = () => {
    const name = window.prompt('Nama preset?');
    if (!name) return;
    const p = [...presets.filter((x) => x.name !== name), { name, st: { ...st, q: '', who: 'ALL' } }];
    setPresets(p); localStorage.setItem(pkey, JSON.stringify(p));
  };
  const delPreset = (name) => { const p = presets.filter((x) => x.name !== name); setPresets(p); localStorage.setItem(pkey, JSON.stringify(p)); };

  const groupsOf = (g) => [...new Set(Object.values(data.groups || {}))];
  const timOpts = data.hasGroups ? [teamName, ...groupsOf()] : [];
  const fEdit = st.filters.find((f) => f.dim === editF);

  return (
    <div className="grid">
      <Panel title="CEK CEPAT" right={`${calc.nStores.toLocaleString('id-ID')} toko dalam cakupan · timegone ${fmt.pct(tgBase, 0)}`}>
        <div className="opt-row">
          <span className="mut">Siapa</span>
          <Seg wrap value={st.who} onChange={(v) => set({ who: v })} options={[{ v: 'ALL', label: 'Semua' }, ...data.salesmen.map((s) => ({ v: s, label: fmt.short(s) }))]} />
        </div>
        <div className="opt-row">
          <span className="mut">Cakupan toko</span>
          <Seg value={st.cov} onChange={(v) => set({ cov: v })} options={[{ v: 'all', label: 'Semua toko' }, { v: 'pj', label: 'Pareto JKS' }, { v: 'np', label: 'Non-pareto' }, { v: 'ps', label: 'Pareto SAK' }]} />
          {data.hasGroups && (<><span className="mut" style={{ marginLeft: 8 }}>Tim</span><Seg value={st.grp} onChange={(v) => set({ grp: v })} options={[{ v: 'ALL', label: 'Semua' }, ...timOpts.map((t) => ({ v: t, label: t }))]} /></>)}
        </div>
        <div className="opt-row">
          <span className="mut">Apa</span>
          <input className="input" style={{ width: 260 }} placeholder={hasSku ? 'ketik SKU / brand, mis. chocolatos' : 'upload slot Qty/SKU dulu'} disabled={!hasSku} value={st.q} onChange={(e) => set({ q: e.target.value })} />
          {st.q && <button className="btn sm ghost" onClick={() => set({ q: '' })}>hapus</button>}
          <span className="mut" style={{ marginLeft: 8 }}>Pembanding</span>
          <Seg value={st.basis} onChange={(v) => set({ basis: v })} options={[{ v: 'same', label: 'Timegone sama' }, { v: 'full', label: 'Keseluruhan' }]} />
          <span className="mut" style={{ marginLeft: 8 }}>Angka</span>
          <Seg value={st.unit} onChange={(v) => set({ unit: v })} options={[{ v: 'jt', label: 'Juta' }, { v: 'rp', label: 'Rp' }]} />
        </div>
      </Panel>

      <div className="explore">
        <Panel title="VARIABEL" className="vars">
          <div className="vgroup">Lihat per (tap / geret ke Baris)</div>
          <div className="vchips">
            {availDims.map((d) => (
              <span key={d} className="vchip" draggable onDragStart={drag('dim', d)} onClick={() => addRow(d)} title="Tap = tambah ke Baris">
                {DIM_LABEL[d]}
                <button className="x" title="Jadikan filter" onClick={(e) => { e.stopPropagation(); addFilter(d); }}>▾</button>
              </span>
            ))}
          </div>
          {['Pencapaian', 'Tren', 'Jangkauan', 'Program'].map((g) => {
            const list = allMeas.filter((m) => m.grp === g);
            if (!list.length) return null;
            return (
              <div key={g}>
                <div className="vgroup">{g}</div>
                <div className="vchips">
                  {list.map((m) => (
                    <span key={m.id} className={'vchip m' + (m.avail ? '' : ' off') + (st.ms.includes(m.id) ? ' on' : '')} draggable={m.avail} onDragStart={m.avail ? drag('m', m.id) : undefined} title={noteOf(m) || 'Tap = tambah ke Indikator'} onClick={() => m.avail && addMeas(m.id)}>{labelOf(m)}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </Panel>

        <div>
          <div className="zones">
            <div className={'zone' + (over === 'rows' ? ' over' : '')} {...zoneProps('rows')}>
              <h4>Baris · lihat per</h4>
              {st.rows.map((d) => <span key={d} className="pill">{DIM_LABEL[d]}<button className="x" onClick={() => set({ rows: st.rows.filter((x) => x !== d) })}>×</button></span>)}
              {!st.rows.length && <span className="hint">geret variabel ke sini</span>}
            </div>
            <div className={'zone' + (over === 'ms' ? ' over' : '')} {...zoneProps('ms')}>
              <h4>Indikator</h4>
              {st.ms.map((id) => mById[id] && (
                <span key={id} className="pill" style={mById[id].avail ? undefined : { opacity: 0.45 }} title={noteOf(mById[id])}>{labelOf(mById[id])}<button className="x" onClick={() => set({ ms: st.ms.filter((x) => x !== id) })}>×</button></span>
              ))}
              {!st.ms.length && <span className="hint">geret indikator ke sini</span>}
            </div>
            <div className={'zone' + (over === 'flt' ? ' over' : '')} {...zoneProps('flt')}>
              <h4>Filter</h4>
              {st.filters.map((f) => (
                <span key={f.dim} className="pill" style={{ cursor: 'pointer' }} onClick={() => setEditF(editF === f.dim ? null : f.dim)}>
                  {DIM_LABEL[f.dim]}: {f.vals.length ? (f.vals.length > 2 ? `${f.vals.length} dipilih` : f.vals.map((v) => (f.dim === 'store' ? nameOf(v) : v)).join(', ')) : 'semua'}
                  <button className="x" onClick={(e) => { e.stopPropagation(); set({ filters: st.filters.filter((x) => x.dim !== f.dim) }); if (editF === f.dim) setEditF(null); }}>×</button>
                </span>
              ))}
              {!st.filters.length && <span className="hint">geret variabel (atau tap ▾) ke sini</span>}
            </div>
          </div>
          {fEdit && (
            <div className="fbox">
              <b>{DIM_LABEL[fEdit.dim]}</b> <span className="mut">(kosong = semua)</span>
              <div>
                {valuesOf(fEdit.dim).map((v) => (
                  <label key={v}>
                    <input type="checkbox" checked={fEdit.vals.includes(v)} onChange={(e) => set({ filters: st.filters.map((f) => (f.dim === fEdit.dim ? { ...f, vals: e.target.checked ? [...f.vals, v] : f.vals.filter((x) => x !== v) } : f)) })} />
                    {fEdit.dim === 'store' ? nameOf(v) : v}
                  </label>
                ))}
              </div>
            </div>
          )}

          {skuMode && <div className="warn" style={{ marginBottom: 8 }}>Level SKU aktif: Sep / L3M tidak ditampilkan karena datanya cuma ada per toko. {hasSkuTgt ? '' : 'Target per SKU tidak ada; target diambil dari target principal per salesman (tidak ikut cakupan Pareto), ditandai *.'}</div>}

          {!st.rows.length || !msOn.length ? (
            <Panel title="HASIL"><div className="empty"><p className="mut">Pilih minimal satu Baris dan satu Indikator.</p></div></Panel>
          ) : (
            <>
              <div className="cards">
                {msOn.slice(0, 4).map((id) => {
                  const m = mById[id];
                  const v = calc.total[id];
                  return (
                    <div key={id} className="kpi">
                      <div className="l">{labelOf(m)} · total</div>
                      <div className={'v ' + cls(m, v)}>{cell(m, v, calc.total)}</div>
                      <div className="s">{calc.groups.length} baris</div>
                    </div>
                  );
                })}
              </div>
              <Panel title="HASIL" right={<><button className="btn sm" onClick={savePreset}>Simpan preset</button> <button className="btn sm" onClick={() => setSt(DEFAULT)}>Reset</button></>} flush>
                <div className="scroll">
                  <table className="t">
                    <thead>
                      <tr>
                        {st.rows.map((d, i) => <th key={d} className="l sortable" onClick={() => clickSort('d:' + i)}>{DIM_LABEL[d]}</th>)}
                        {msOn.map((id) => {
                          const m = mById[id];
                          return <th key={id} className={'sortable' + (sort.k === id ? ' sorted' : '')} onClick={() => clickSort(id)}>{labelOf(m)}{skuMode && m.id === 'tgt' && !hasSkuTgt ? '*' : ''}{sort.k === id ? (sort.dir < 0 ? ' ▼' : ' ▲') : ''}</th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.slice(0, 500).map((g) => (
                        <tr key={g.vals.join('|')}>
                          {calc.mkLabel(g.vals).map((v, i) => <td key={i} className="l nm">{v}</td>)}
                          {msOn.map((id) => {
                            const m = mById[id];
                            const v = g[id];
                            return (
                              <td key={id} className={cls(m, v)}>
                                {id === 'ach' && v != null ? (
                                  <span className="barlbl" style={{ minWidth: 110 }}><Bar value={v} mark={tgBase} tg={tgBase} /><span className="ach">{cell(m, v, g)}</span></span>
                                ) : cell(m, v, g)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      <tr className="tot">
                        <td className="l" colSpan={st.rows.length}>TOTAL</td>
                        {msOn.map((id) => <td key={id} className={cls(mById[id], calc.total[id])}>{cell(mById[id], calc.total[id], calc.total)}</td>)}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="note">
                  {st.basis === 'same' ? `Pembanding "Timegone sama": Sep/L3M × timegone (${fmt.pct(tgBase, 0)}), estimasi proporsional karena Sep dan L3M tersimpan sebagai total sebulan.` : 'Pembanding "Keseluruhan": ACT dibanding total Sep / rata-rata L3M sebulan penuh.'}
                  {sorted.length > 500 ? ` Menampilkan 500 dari ${sorted.length} baris.` : ''}
                </div>
              </Panel>
            </>
          )}
          {presets.length > 0 && (
            <div className="row" style={{ marginTop: 10 }}>
              <span className="mut">Preset:</span>
              {presets.map((p) => (
                <span key={p.name} className="pill" style={{ cursor: 'pointer' }} onClick={() => setSt({ ...DEFAULT, ...p.st })}>{p.name}<button className="x" onClick={(e) => { e.stopPropagation(); delPreset(p.name); }}>×</button></span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
