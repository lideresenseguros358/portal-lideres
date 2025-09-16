// /pages/login.tsx
import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase-client';

function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function pwOk(v: string) { return v.length >= 6; }

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const valid = useMemo(() => isEmail(email) && pwOk(pass), [email, pass]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (!valid) { setErr('Verifica tu correo y contraseña.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) throw error;

      // lee perfil actual para rutear
      const { data: user } = await supabase.auth.getUser();
      const role = (user?.user?.app_metadata as any)?.role as 'master' | 'broker' | undefined;
      if (role === 'master') location.href = '/app/master';
      else if (role === 'broker') location.href = '/app/broker';
      else location.href = '/app/broker';
    } catch (e: any) {
      setErr(e?.message || 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap" role="main" aria-labelledby="title">
      <header className="top">
        <img src="/logo.png" alt="LIDESA" height={40} />
        <div />
      </header>

      <div className="login-card">
        <h1 id="title" style={{ margin: 0 }}>Ingresar</h1>
        <p className="subtitle">Portal Líderes en Seguros</p>

        <form onSubmit={onSubmit} className="form-grid" noValidate>
          <input
            className="full" type="email" placeholder="Usuario (correo)"
            value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!err && !isEmail(email)}
          />
          <input
            className="full" type="password" placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyUp={(e) => setCaps((e.nativeEvent as any).getModifierState?.('CapsLock'))}
            aria-invalid={!!err && !pwOk(pass)}
          />

          {caps && <div className="warn full">Bloq Mayús activado</div>}
          {err && <div className="ok full" style={{ color: '#b00' }}>{err}</div>}
          {msg && <div className="ok full">{msg}</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          <a className="link full" href="/forgot">¿Olvidaste tu contraseña?</a>
          <a className="link full" href="/signup-request">Solicitar nuevo usuario</a>
        </form>
      </div>

      <footer className="footer">
        <small>© {new Date().getFullYear()} Líderes en Seguros, S.A.</small>
      </footer>

      <style jsx global>{globalCss}</style>
      <style jsx>{cardCss}</style>
    </div>
  );
}

const globalCss = `
  html, body, #__next { height: 100%; }
  body { margin:0; font-family: Arial, Helvetica, sans-serif; }
  .login-wrap { min-height:100%; background:url('/fondo_login.webp') center/cover no-repeat fixed; position:relative; }
  .login-wrap::before { content:''; position:absolute; inset:0; background: rgba(0,0,0,.35); } /* overlay 35% */
  .top { position:relative; z-index:1; display:flex; align-items:center; justify-content:space-between; padding:12px 16px; }
  .footer { position:fixed; left:0; right:0; bottom:0; text-align:center; padding:10px 0; color:#fff; z-index:1; }
`;

const cardCss = `
  .login-card { position:relative; z-index:1; max-width:520px; margin:64px auto; background:#fff;
    border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); padding:24px; }
  .subtitle { color:#6b6b6b; margin-top:4px; }
  .form-grid { display:grid; grid-template-columns:1fr; gap:12px; }
  .full { width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; }
  input[aria-invalid="true"] { border-color:#c0392b; }
  .btn { background:#0b1e39; color:#fff; border:none; padding:12px 16px; border-radius:8px; font-weight:700; cursor:pointer; }
  .btn:disabled { opacity:.7; cursor:not-allowed; }
  .warn { color:#b06b00; font-size:13px; }
  .link { color:#0e8193; text-decoration:none; font-size:14px; text-align:center; }
  .link:hover { text-decoration:underline; }
  @media (max-width:720px){ .login-card{ margin:24px; } }
`;

