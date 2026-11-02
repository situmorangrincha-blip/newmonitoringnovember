import { useState } from 'react';
import { DEPOTS, TEAMS, depotLabel, login, teamLabel } from '../lib/store.js';

export function DepotPick({ onPick }) {
  return (
    <div className="gate">
      <h1>Sales Monitor</h1>
      <p>Pilih depo</p>
      <div className="gate-btns">
        {DEPOTS.map((d) => (
          <button key={d.id} className={'pick ' + d.id} onClick={() => onPick(d.id)}>{d.label}</button>
        ))}
      </div>
    </div>
  );
}

export function TeamPick({ depot, onPick, onBack, info }) {
  return (
    <div className="gate" data-depot={depot}>
      <h1>{depotLabel(depot)}</h1>
      <p>Pilih tim</p>
      <div className="gate-btns">
        {TEAMS.map((t) => (
          <button key={t.id} className="pick" onClick={() => onPick(t.id)}>
            {t.label}<small>{t.desc}</small>
          </button>
        ))}
      </div>
      {info && (!info.configured.arjuna || !info.configured.bima) && (
        <div className="warn">Password {[!info.configured.arjuna && 'Arjuna (PASS_RINCHA)', !info.configured.bima && 'Bima (PASS_ECI)'].filter(Boolean).join(' dan ')} belum di-set di Vercel.</div>
      )}
      <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button className="btn ghost" onClick={onBack}>← Ganti depo</button>
      </div>
    </div>
  );
}

export function Pass({ depot, team, mode, onOk, onBack }) {
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try { await login(mode, team, p); onOk(p); } catch (x) { setErr(x.message || 'Gagal masuk'); setBusy(false); }
  };
  return (
    <form className="gate" data-depot={depot} onSubmit={go}>
      <h1>{depotLabel(depot)} · Tim {teamLabel(team)}</h1>
      <p>{mode === 'cloud' ? 'Masukkan password tim' : 'Mode lokal (tanpa backend): password dilewati'}</p>
      {mode === 'cloud' && <input className="input" type="password" autoFocus placeholder="Password" value={p} onChange={(e) => setP(e.target.value)} />}
      {err && <div className="warn err">{err}</div>}
      <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button type="button" className="btn" onClick={onBack}>Kembali</button>
        <button className="btn coin" type="submit" disabled={busy || (mode === 'cloud' && !p)}>{busy ? '...' : 'Masuk'}</button>
      </div>
    </form>
  );
}
