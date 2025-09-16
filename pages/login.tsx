// /pages/login.tsx
import React, { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function pwOk(v: string) { return (v ?? '').length >= 6; }

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

    // chequeo de envs (causa #1 de “client-side exception”)
    const missing: string[] = [];
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (missing.length) {
      setErr('Faltan variables de entorno: ' + missing.join(', '));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) throw error;

      // obtener role del token actual (no rompe si falla)
      const u = await supabase.auth.getUser();
      const role = (u.data.user?.app_metadata as any)?.role as 'master' | 'broker' | undefined;

      if (typeof window !== 'undefined') {
        localStorage.setItem('portal_email', email.trim());
        localStorage.setItem('portal_role', role || '');
      }

      if (role === 'master') location.href = '/app/master';
      else if (role === 'broker') location.href = '/app/broker';
      else location.href = '/app/broker'; // fallback
    } catch (e: any) {
      setErr(e?.message || 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h2 className="title">Ingresar</h2>

        {err && <div className="warn">{err}</div>}
        {msg && <div className="ok">{msg}</div>}

        <form className="form-grid" onSubmit={onSubmit} noValidate>
          <input
            className="full"
            type="email"
            placeholder="Usuario (correo)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={(!err && !isEmail(email)) ? 'true' : undefined}
          />
          <input
            className="full"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyUp={(e) => setCaps((e.getModifierState && e.getModifierState('CapsLock')) || false)}
            aria-invalid={(!err && !pwOk(pass)) ? 'true' : undefined}
          />
          {caps && <div className="warn full">Bloq Mayús activado</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          <a className="link full" href="/app/auth/forgot">¿Olvidaste tu contraseña?</a>
          <a className="link full" href="/app/auth/signup-request">Solicitar nuevo usuario</a>
        </form>
      </div>

      <style jsx global>{`
        html, body, #__next { height: 100%; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        .login-wrap {
          min-height: 100%;
          background:url('/fondo_login.webp') center/cover no-repeat fixed;
          position:relative;
        }
        .login-wrap::before {
          content:''; position:absolute; inset:0;
          background: rgba(0,0,0,.35); /* overlay negro 35% */
        }
      `}</style>

      <style jsx>{`
        .login-card {
          position:relative; z-index:1;
          max-width: 520px; margin: 56px auto;
          background: #fff; border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,.15);
          padding: 24px;
        }
        .title { margin: 0 0 12px; }
        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        .full { width: 100%; padding: 12px 14px; border: 1px solid #c3c9d2; border-radius: 8px; font-size: 14px; }
        [aria-invalid="true"] { border-color: #c0392b; }
        .btn {
          background: #0e1839; color:#fff; border:none; padding: 12px 16px;
          border-radius: 8px; font-weight:700; cursor:pointer;
        }
        .btn:disabled { opacity:.7; cursor:not-allowed; }
        .warn { color:#b00; font-size:13px; }
        .ok { color:#0a0; font-size:13px; }
        .link { color:#0e1839; text-decoration:none; font-size:14px; text-align:center; }
        .link:hover { text-decoration: underline; }
        @media (max-width: 720px) { .login-card { margin: 24px 12px; } }
      `}</style>
    </div>
  );
}

