// /pages/login.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase-client';

const isEmail = (v: string) => /.+@.+\..+/.test(v.trim());
const pwOk = (v: string) => v.length >= 6;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(false);

  const valid = isEmail(email) && pwOk(pass);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!valid) { setErr('Verifica tu correo y contraseña.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass });
      if (error) throw error;

      // Buscar el rol y redirigir
      const { data: { user } } = await supabase.auth.getUser();
      const role = (user?.app_metadata as any)?.role as 'master' | 'broker' | undefined;

      if (typeof window !== 'undefined') {
        localStorage.setItem('portal_email', email.trim());
        localStorage.setItem('portal_role', role || '');
      }
      location.href = role === 'master' ? '/app/master' : '/app/broker';
    } catch (e: any) {
      setErr(e?.message || 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <header className="top">
        <img src="/logo.png" alt="LISSA" height={40} />
      </header>

      <div className="login-card">
        <h2 className="title">Ingresar</h2>

        <form className="form-grid" onSubmit={onSubmit} noValidate>
          <input className="full" type="email" placeholder="Usuario (correo)"
            value={email} onChange={(e)=>setEmail(e.target.value)}
            aria-invalid={!!err && !isEmail(email)} />
          <input className="full" type="password" placeholder="Contraseña"
            value={pass} onChange={(e)=>setPass(e.target.value)}
            onKeyUp={(e)=>setCaps(e.getModifierState?.('CapsLock'))}
            aria-invalid={!!err && !pwOk(pass)} />

          {caps && <div className="warn full">Bloq Mayús activado</div>}
          {err &&  <div className="msg  full">{err}</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          <a className="link full" href="/app/auth/forgot">¿Olvidaste tu contraseña?</a>
          <a className="link full" href="/app/auth/signup-request">Solicitar nuevo usuario</a>
        </form>
      </div>

      <footer className="foot">© Líderes en Seguros — Portal</footer>

      <style jsx global>{`
        html, body, #__next { height: 100%; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        .login-wrap { min-height: 100%; background:url('/fondo_login.webp') center/cover no-repeat fixed; position:relative; }
        .login-wrap:before { content:''; position:absolute; inset:0; background: rgba(0,0,0,.35); }
      `}</style>
      <style jsx>{`
        .top { position:absolute; left:16px; top:16px; z-index:2; }
        .login-card { position:relative; z-index:1; max-width:520px; margin:80px auto; background:#fff;
          border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); padding:24px; }
        .title { margin:0 0 12px; }
        .form-grid { display:grid; grid-template-columns:1fr; gap:12px; }
        .full { width:100%; padding:12px 14px; border:1px solid #bdd; border-radius:8px; font-size:14px; }
        .btn { background:#0e1039; color:#fff; border:none; padding:12px 16px; border-radius:8px; font-weight:700; cursor:pointer; }
        .btn:disabled { opacity:.7; cursor:not-allowed; }
        .warn { color:#b60; font-size:13px; }
        .msg { color:#b00; font-size:13px; }
        .link { color:#0e1039; text-decoration:none; font-size:14px; text-align:center; }
        .link:hover { text-decoration:underline; }
        .foot { position:absolute; bottom:16px; left:0; right:0; text-align:center; color:#fff; z-index:1; }
        @media (max-width:720px) { .login-card{ margin:16px; } }
      `}</style>
    </div>
  );
}

