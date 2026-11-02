import { useRef, useState } from 'react';
import { SLOT_INFO } from '../lib/ingest.js';
import { FIELD_LABEL } from '../lib/table.js';
import { deleteSlot, saveSlot } from '../lib/store.js';
import { Panel } from './ui.jsx';

const MON = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const MAXMB = 80;
const loadOv = () => { try { return JSON.parse(localStorage.getItem('sm_colmap') || '{}'); } catch { return {}; } };
const fmtUp = (iso) => { try { return new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

// Satu slot = satu file Excel kecil. Sheet dikenali dari JUDULNYA, kolom dari namanya (longgar); kalau meleset, atur sendiri di "Pemetaan kolom".
export default function UploadModal({ slots, depot, team, storeMode, timeOv, setTimeOv, auto, period, onClose, onDone }) {
  const [slot, setSlot] = useState('main');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [res, setRes] = useState(null); // { slot, parsed, info, wb, fileName }
  const [ov, setOv] = useState(loadOv());
  const [over, setOver] = useState(false);
  const now = new Date();
  const [per, setPer] = useState({ year: period?.year || now.getFullYear(), month: period?.month || now.getMonth() + 1 });
  const [hk, setHk] = useState({ hk: timeOv?.hk ?? '', total: timeOv?.total ?? '' });
  const input = useRef(null);
  const wbRef = useRef(null);

  async function read(file, slotId = slot, override = ov) {
    if (!file) return;
    setErr(''); setRes(null);
    if (file.size > MAXMB * 1024 * 1024) {
      setErr(`File ${Math.round(file.size / 1048576)} MB terlalu besar untuk browser. Biasanya ada sheet yang ke-format sampai baris 1.048.576. Di Excel: klik baris di bawah data terakhir, Ctrl+Shift+↓, klik kanan > Delete, lakukan juga untuk kolom di kanan data, lalu Save. Ukuran normal 1-5 MB. Atau pecah per slot (Qty dan GreenStore/MSS di file terpisah).`);
      return;
    }
    setBusy('Membaca file Excel...');
    try {
      await new Promise((r) => setTimeout(r, 40));
      const [{ PARSERS, previewMap }, XLSX] = await Promise.all([import('../lib/ingest.js'), import('xlsx')]);
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: false, cellStyles: false, sheetRows: 60000 });
      wbRef.current = { wb, file };
      const p = slotId === 'main' ? { year: per.year, month: per.month, label: `${MON[per.month - 1].slice(0, 3).toUpperCase()} ${per.year}` } : null;
      const r = PARSERS[slotId](wb, { team, fileName: file.name, override, period: p });
      setRes({ slot: slotId, parsed: r.data, info: r.info, map: previewMap(wb, slotId, override), fileName: file.name });
    } catch (e) {
      try {
        const { previewMap } = await import('../lib/ingest.js');
        const m = wbRef.current ? previewMap(wbRef.current.wb, slotId, override) : [];
        setRes({ slot: slotId, parsed: null, info: null, map: m, fileName: file.name, error: e.message || String(e) });
      } catch { /* abaikan */ }
      setErr(e.message || String(e));
    }
    setBusy('');
  }

  const remap = async (sheetKind, field, value) => {
    const next = { ...ov, [sheetKind]: { ...(ov[sheetKind] || {}), [field]: value } };
    if (!value) delete next[sheetKind][field];
    setOv(next);
    localStorage.setItem('sm_colmap', JSON.stringify(next));
    if (wbRef.current) await read(wbRef.current.file, res?.slot || slot, next);
  };

  async function save() {
    if (!res?.parsed) return;
    setBusy('Menyimpan...');
    try {
      const s = res.slot;
      const data = { ...res.parsed };
      if (s === 'main') { data.depot = depot; data.team = team; data.meta = { ...data.meta, uploadedAt: new Date().toISOString() }; }
      await saveSlot(storeMode, depot, team, s, data);
      if (s === 'main' && (hk.hk !== '' || hk.total !== '')) setTimeOv({ hk: hk.hk === '' ? undefined : +hk.hk, total: hk.total === '' ? undefined : +hk.total });
      onDone(s, data);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy('');
  }

  async function remove(s) {
    if (!window.confirm(`Hapus data slot "${SLOT_INFO[s].label}"?`)) return;
    setBusy('Menghapus...');
    try { await deleteSlot(storeMode, depot, team, s); onDone(s, null); } catch (e) { setErr(e.message || String(e)); }
    setBusy('');
  }

  const filled = (s) => slots[s];
  const stamp = (s) => { const d = slots[s]; return d ? (d.meta?.uploadedAt || d.uploadedAt) : null; };

  return (
    <div className="veil" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <Panel title="UPLOAD DATA" right={<button className="btn sm" onClick={onClose}>Tutup</button>}>
          <div className="mini" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', marginBottom: 10 }}>
            {['main', 'sku', 'prog', 'skudb'].map((s) => (
              <button key={s} className={'it' + (slot === s ? ' sel' : '')} style={{ textAlign: 'left', cursor: 'pointer', borderColor: slot === s ? 'var(--ac)' : undefined, background: slot === s ? 'var(--ac-soft)' : undefined }} onClick={() => { setSlot(s); setRes(null); setErr(''); }}>
                <div className="h"><span>{SLOT_INFO[s].label}</span><span className={filled(s) ? 'ok' : 'mut'}>{filled(s) ? '●' : '○'}</span></div>
                <div className="sub">{filled(s) ? `update ${fmtUp(stamp(s))}` : 'belum ada'}</div>
              </button>
            ))}
          </div>
          <div className="mut" style={{ marginBottom: 8 }}>{SLOT_INFO[slot].hint}. {slot === 'skudb' ? 'Dipakai bersama oleh kedua tim di depo ini.' : `Disimpan untuk depo & tim yang sedang dibuka.`}</div>

          {slot === 'main' && (
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="mut">Periode data</span>
              <select className="input" style={{ minWidth: 0 }} value={per.month} onChange={(e) => setPer({ ...per, month: +e.target.value })}>{MON.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
              <input className="input" style={{ minWidth: 0, width: 80 }} type="number" value={per.year} onChange={(e) => setPer({ ...per, year: +e.target.value })} />
              <span className="mut">(dipakai kalau file format baru; format lama membaca periodenya sendiri)</span>
            </div>
          )}

          <div
            className={'drop' + (over ? ' over' : '')}
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files?.[0]); }}
          >
            {busy || `Tarik file Excel ke sini atau klik untuk pilih (${SLOT_INFO[slot].label})`}
            <input ref={input} type="file" accept=".xlsx,.xlsm,.xls" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
          {err && <div className="warn err">{err}</div>}

          {res && (
            <div style={{ marginTop: 10 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <b>{res.fileName}</b>
                {res.parsed && <span className="ok">terbaca</span>}
              </div>
              {res.parsed && res.slot === 'main' && (
                <div className="kpis k4" style={{ marginTop: 8 }}>
                  <div className="kpi"><div className="l">Salesman</div><div className="v">{res.parsed.salesmen.length}</div><div className="s">{res.parsed.salesmen.slice(0, 3).join(', ')}{res.parsed.salesmen.length > 3 ? '…' : ''}</div></div>
                  <div className="kpi"><div className="l">Toko</div><div className="v">{res.parsed.stores.length.toLocaleString('id-ID')}</div><div className="s">{res.parsed.stores.filter((s) => s.pj).length} Pareto JKS</div></div>
                  <div className="kpi"><div className="l">SKU</div><div className="v">{res.parsed.subs.length}</div><div className="s">{res.parsed.hasQty ? 'ada qty' : 'dari slot Qty'}</div></div>
                  <div className="kpi"><div className="l">DAP</div><div className="v">{res.parsed.dap.length}</div><div className="s">baris toko</div></div>
                </div>
              )}
              {res.parsed && res.slot === 'sku' && <div className="mut">{res.parsed.rows.toLocaleString('id-ID')} baris · {res.parsed.subs.length} SKU · {Object.keys(res.parsed.per).length.toLocaleString('id-ID')} toko</div>}
              {res.parsed && res.slot === 'prog' && <div className="mut">{res.parsed.items.length} baris · program: {[...new Set(res.parsed.items.map((x) => x.p))].join(', ')}</div>}
              {res.parsed && res.slot === 'skudb' && <div className="mut">{res.parsed.items.length.toLocaleString('id-ID')} SKU</div>}
              {(res.parsed?.warnings || []).map((w, i) => <div key={i} className="warn">{w}</div>)}

              {res.map?.length > 0 && !res.info?.legacy && (
                <details style={{ marginTop: 8 }} open={!res.parsed}>
                  <summary style={{ cursor: 'pointer' }}>Pemetaan kolom ({res.map.filter((m) => m.ok).length}/{res.map.length} sheet terbaca)</summary>
                  {res.map.map((m) => (
                    <div key={m.sheet} style={{ margin: '8px 0' }}>
                      <b>{m.sheet}</b> {m.ok ? <span className="mut">· {m.rows} baris</span> : <span className="low">· header tidak ketemu</span>}
                      {m.ok && (
                        <div className="scroll">
                          <table className="t" style={{ marginTop: 4 }}>
                            <tbody>
                              {m.cols.map((c) => (
                                <tr key={c.f}>
                                  <td className="l">{c.label}{c.need ? ' *' : ''}</td>
                                  <td className="l">
                                    <select className="input" style={{ minWidth: 0, padding: '2px 6px' }} value={c.col} onChange={(e) => remap(res.slot, c.f, e.target.value)}>
                                      <option value="">{c.col ? '— (tidak dipakai)' : '— tidak ketemu'}</option>
                                      {m.heads.map((h) => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="mut">* wajib. Pilihan kolom diingat untuk upload berikutnya di browser ini.</div>
                </details>
              )}

              {res.slot === 'main' && res.parsed && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer' }}>Hari kerja manual (opsional)</summary>
                  <div className="row" style={{ marginTop: 6 }}>
                    <input className="input" style={{ minWidth: 0, width: 110 }} type="number" placeholder={`berjalan (${auto.auto})`} value={hk.hk} onChange={(e) => setHk({ ...hk, hk: e.target.value })} />
                    <input className="input" style={{ minWidth: 0, width: 110 }} type="number" placeholder={`total (${auto.total})`} value={hk.total} onChange={(e) => setHk({ ...hk, total: e.target.value })} />
                    <span className="mut">kosong = otomatis</span>
                  </div>
                </details>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                {filled(slot) && <button className="btn" onClick={() => remove(slot)}>Hapus slot ini</button>}
                <button className="btn coin" disabled={!res.parsed || !!busy} onClick={save}>{busy || 'Simpan'}</button>
              </div>
            </div>
          )}
          {!res && filled(slot) && (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
              <button className="btn" onClick={() => remove(slot)}>Hapus slot ini</button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
