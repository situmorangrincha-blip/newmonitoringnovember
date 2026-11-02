import { useEffect, useMemo, useRef, useState } from 'react';
import { derive, timeInfo } from './lib/calc.js';
import { buildData } from './lib/ingest.js';
import { DEPOTS, clearAuth, depotLabel, loadAll, probe, saveSlot, setAuth, teamLabel } from './lib/store.js';
import UploadModal from './components/UploadModal.jsx';
import StoreModal from './components/StoreModal.jsx';
import { DepotPick, Pass, TeamPick } from './components/Gate.jsx';
import { Panel } from './components/ui.jsx';
import Explore from './pages/Explore.jsx';
import Performance from './pages/Performance.jsx';
import Focus from './pages/Focus.jsx';
import Stores from './pages/Stores.jsx';
import Pareto from './pages/Pareto.jsx';
import Salesman from './pages/Salesman.jsx';
import Charts from './pages/Charts.jsx';
import Dap, { defaultDapDate } from './pages/Dap.jsx';

const PAGES = [
  { id: 'explore', label: 'Jelajah' },
  { id: 'dap', label: 'DAP' },
  { id: 'perf', label: 'Performa' },
  { id: 'pareto', label: 'Pareto & CA' },
  { id: 'stores', label: 'Toko' },
  { id: 'sales', label: 'Salesman' },
  { id: 'focus', label: 'Fokus' },
  { id: 'chart', label: 'Grafik' },
];
const loadJson = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const fmtUp = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
const EMPTY = { main: null, sku: null, prog: null, skudb: null };

export default function App() {
  const [phase, setPhase] = useState('probe'); // probe | depot | team | pass | loading | ready | error
  const [storeMode, setStoreMode] = useState('cloud');
  const [info, setInfo] = useState(null);
  const [depot, setDepot] = useState(null);
  const [team, setTeam] = useState(null);
  const [slots, setSlots] = useState(EMPTY);
  const [bootErr, setBootErr] = useState('');
  const [page, setPage] = useState('explore');
  const [subs, setSubs] = useState({ focus: 'principal', pareto: 'pj', chart: 'perf' });
  const [cmpDim, setCmpDim] = useState('sales');
  const [dapDay, setDapDay] = useState(null);
  const [holMap, setHolMap] = useState(() => loadJson('sm_hol', {}));
  const [mode, setMode] = useState('milestone');
  const [sal, setSal] = useState('ALL');
  const [up, setUp] = useState(false);
  const [store, setStore] = useState(null);
  const [snapping, setSnapping] = useState(false);
  const [toast, setToast] = useState('');
  const [timeOv, setTimeOvState] = useState(() => loadJson('sm_time', null));
  const passRef = useRef('');

  const setTimeOv = (v) => { setTimeOvState(v); if (v) localStorage.setItem('sm_time', JSON.stringify(v)); else localStorage.removeItem('sm_time'); };
  const say = (m) => { setToast(m); setTimeout(() => setToast(''), 3200); };

  useEffect(() => { probe().then((r) => { setStoreMode(r.mode); setInfo(r.info); setPhase('depot'); }); }, []);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => { document.documentElement.setAttribute('data-depot', depot || 'kebayoran'); }, [depot]);

  const ready = phase === 'ready';
  const data = useMemo(() => (ready ? buildData(slots, depot, team) : null), [ready, slots, depot, team]);
  const time = useMemo(() => (data ? timeInfo(data.meta.period, timeOv) : null), [data, timeOv]);
  const effMode = mode === 'bti' && !data?.meta.hasBti ? 'milestone' : mode;
  const D = useMemo(() => (data ? derive(data, effMode, time) : null), [data, effMode, time]);
  const holKey = time ? `${time.y}-${time.m}` : '';
  const holidays = holMap[holKey] || [];
  const setHolidays = (arr) => { const m = { ...holMap, [holKey]: arr }; setHolMap(m); localStorage.setItem('sm_hol', JSON.stringify(m)); };
  const autoTime = useMemo(() => (data ? timeInfo(data.meta.period, null) : { auto: 0, total: 27 }), [data]);

  async function enter(d, t) {
    setPhase('loading');
    setSal('ALL'); setPage('explore'); setDapDay(null);
    try {
      const r = await loadAll(storeMode, d, t);
      setSlots({ ...EMPTY, ...r });
      setPhase('ready');
    } catch (e) { setBootErr(e?.message || 'Gagal memuat data'); setPhase('error'); }
  }
  const logout = () => { clearAuth(); passRef.current = ''; setDepot(null); setTeam(null); setSlots(EMPTY); setPhase('depot'); };

  async function saveFocus(cats) {
    const main = { ...slots.main, settings: { ...(slots.main.settings || {}), focusCats: cats } };
    setSlots({ ...slots, main });
    try { await saveSlot(storeMode, depot, team, 'main', main); say('Kategori fokus disimpan'); } catch (e) { say('Gagal simpan: ' + (e?.message || e)); }
  }

  async function snap() {
    setSnapping(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      const { toPng } = await import('html-to-image');
      const el = document.getElementById('snap-out');
      const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, filter: (n) => !(n.dataset && 'nosnap' in n.dataset) });
      const blob = await (await fetch(dataUrl)).blob();
      const name = `${page === 'chart' ? 'grafik' : 'performa'}-${depot}-${team}-${new Date().toISOString().slice(0, 10)}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: 'Performa' }).catch(() => {});
      else { const a = document.createElement('a'); a.href = dataUrl; a.download = name; a.click(); }
      say('Screenshot tersimpan');
    } catch (e) { say('Gagal bikin gambar: ' + (e?.message || e)); }
    setSnapping(false);
  }
  const canSnap = page === 'perf' || page === 'chart';
  const setSub = (v) => setSubs({ ...subs, [page]: v });

  if (phase === 'probe') return <div className="app"><div className="gate"><p>Memuat…</p></div></div>;
  if (phase === 'depot') return <div className="app"><DepotPick onPick={(d) => { setDepot(d); setPhase('team'); }} /></div>;
  if (phase === 'team') return <div className="app" data-depot={depot}><TeamPick depot={depot} info={storeMode === 'cloud' ? info : null} onPick={(t) => { setTeam(t); setPhase('pass'); }} onBack={() => setPhase('depot')} /></div>;
  if (phase === 'pass') return <div className="app" data-depot={depot}><Pass depot={depot} team={team} mode={storeMode} onBack={() => setPhase('team')} onOk={(pw) => { passRef.current = pw; setAuth({ team, pass: pw }); enter(depot, team); }} /></div>;
  if (phase === 'loading') return <div className="app"><div className="gate"><p>Memuat data…</p></div></div>;
  if (phase === 'error') return (
    <div className="app"><div className="gate"><Panel title="Gagal memuat"><div className="empty"><p>{bootErr}</p><div className="row" style={{ justifyContent: 'center' }}><button className="btn coin" onClick={() => enter(depot, team)}>Coba lagi</button><button className="btn" onClick={logout}>Keluar</button></div></div></Panel></div></div>
  );

  const common = { D, data, time };
  const body = D && {
    explore: <Explore data={data} time={time} depot={depot} team={team} />,
    perf: <Performance {...common} mode={mode} setMode={setMode} snapping={snapping} snapBg={null} both={null} />,
    focus: <Focus {...common} mode={mode} sub={subs.focus} setSub={setSub} sal={sal} setSal={setSal} onSaveFocus={saveFocus} holidays={holidays} />,
    stores: <Stores data={data} time={time} sal={sal} setSal={setSal} onStore={setStore} />,
    pareto: <Pareto {...common} sub={subs.pareto} setSub={setSub} sal={sal} setSal={setSal} onStore={setStore} />,
    sales: <Salesman {...common} sal={sal} setSal={setSal} onStore={setStore} />,
    chart: <Charts {...common} mode={mode} setMode={setMode} sub={subs.chart} setSub={setSub} sal={sal} setSal={setSal} snapping={snapping} snapBg={null} cmpDim={cmpDim} setCmpDim={setCmpDim} />,
    dap: <Dap data={data} time={time} day={dapDay ?? defaultDapDate(time)} setDay={setDapDay} holidays={holidays} setHolidays={setHolidays} depot={depot} team={team} />,
  }[page];

  return (
    <div className="app" data-depot={depot}>
      <header className="top">
        <div className="logo">
          <i>{depot === 'kapuk' ? 'K' : 'KB'}</i>
          <div><b>Sales Monitor</b><small>{depotLabel(depot)} · Tim {teamLabel(team)}{data?.meta.period ? ' · ' + data.meta.period.label : ''}</small></div>
        </div>
        {data && <span className="chip" title="Waktu upload data utama terakhir">update {fmtUp(data.meta.uploadedAt)}</span>}
        {data && canSnap && <button className="btn sm" onClick={snap}>Simpan PNG</button>}
        <button className="btn coin sm" onClick={() => setUp(true)}>Upload</button>
        <button className="btn sm" onClick={logout}>Keluar</button>
      </header>

      <nav className="nav" aria-label="Halaman">
        {PAGES.map((p) => <button key={p.id} className={'btn' + (p.id === page ? ' on' : '')} aria-current={p.id === page ? 'page' : undefined} onClick={() => setPage(p.id)}>{p.label}</button>)}
      </nav>

      {!data ? (
        <Panel title="Belum ada data">
          <div className="empty">
            <h2>Belum ada data {depotLabel(depot)} · Tim {teamLabel(team)}</h2>
            <p className="mut">Upload data utama dulu. Qty, GreenStore/MSS, dan database SKU bisa menyusul di slot masing-masing.</p>
            <button className="btn coin" onClick={() => setUp(true)}>Upload data</button>
          </div>
        </Panel>
      ) : (
        <div className="screen">{body}</div>
      )}

      {data && (
        <div className="foot">
          {data.meta.fileName || 'data'} · hari kerja {time.hk}/{time.total}{time.overridden ? ' (manual)' : ''} · timegone {Math.round(time.tg * 100)}%
          {slots.sku ? ' · qty ✓' : ''}{slots.prog ? ' · program ✓' : ''}{slots.skudb ? ' · database SKU ✓' : ''}
        </div>
      )}

      {up && (
        <UploadModal
          slots={{ main: slots.main, sku: slots.sku, prog: slots.prog, skudb: slots.skudb }}
          depot={depot} team={team} storeMode={storeMode} timeOv={timeOv} setTimeOv={setTimeOv} auto={autoTime} period={data?.meta.period}
          onClose={() => setUp(false)}
          onDone={(slot, d) => { setSlots((o) => ({ ...o, [slot]: d })); setUp(false); say(d ? 'Data tersimpan' : 'Slot dihapus'); }}
        />
      )}
      {store && data && <StoreModal s={store} data={data} time={time} onClose={() => setStore(null)} />}
      {snapping && <div className="veil"><div className="modal"><Panel title="Menyimpan"><div className="empty"><p>Membuat gambar…</p></div></Panel></div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
