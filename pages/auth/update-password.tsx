// /pages/auth/update-password.tsx
import React, { useState } from 'react';

const UI = { white:'#fff', blue:'#010139', olive:'#8aaa19', bg:'#e6e6e6', gray:'#8b8b8b' };

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const r = await fetch('/api/auth/update-password', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error');
      setMsg('Contraseña actualizada. Ya puedes iniciar sesión.');
      setPassword('');
    } catch(e:any){ setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2>Nueva contraseña</h2>
        <p className="help">Escribe tu nueva contraseña para actualizar tu cuenta.</p>

        <input type="password" placeholder="********" value={password}
          onChange={e=>setPassword(e.target.value)} disabled={busy} />

        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}

        <button onClick={send} disabled={busy || !password}>
          {busy ? 'Guardando...' : 'Actualizar contraseña'}
        </button>
      </div>

      <style jsx>{`
        .wrap { min-height:100vh; display:grid; place-items:center; background:${UI.bg}; }
        .card { width:400px; max-width:95vw; background:${UI.white}; padding:24px; border-radius:18px; box-shadow:0 6px 18px rgba(0,0,0,.06); }
        h2 { color:${UI.olive}; margin:0 0 12px; }
        .help { color:${UI.gray}; margin:0 0 16px; font-size:14px; }
        input { width:100%; padding:10px 12px; border:1px solid #ddd; border-radius:10px; margin-bottom:12px; }
        button { width:100%; padding:12px; border:none; border-radius:10px; background:${UI.blue}; color:#fff; font-weight:700; }
        .err { color:#a00; margin-top:8px; }
        .ok  { color:#080; margin-top:8px; }
      `}</style>
    </div>
  );
}
