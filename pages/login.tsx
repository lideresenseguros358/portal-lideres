// /pages/login.tsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabase-client';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function pwOk(v: string) { return v.length >= 6; }

export default function LoginPage() {
  const r = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [msg, setMsg]     = useState<string|null>(null);
  const [loading, setLoading] = useState(false);
  const [caps, setCaps] = useState(false);

  const valid = isEmail(email) && pwOk(pass);

  useEffect(() => {
    // si ya hay sesión, redirige
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      // lee perfil y manda a master/broker
      supabase.from('profiles').select('role').eq('id', u.id).single()
        .then(({ data: p }) => {
          if (p?.role === 'master') r.replace('/app/master');
          else if (p?.role === 'broker') r.replace('/app/broker');
        });
    });
  }, [r]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!valid) { setMsg('Verifica tu correo y contraseña.'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error('No user id');

      const { data: prof, error: pErr } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', uid)
        .single();
      if (pErr) throw pErr;

      localStorage.setItem('portal_email', email.trim());

      if (prof?.role === 'master') r.replace('/app/master');
      else if (prof?.role === 'broker') r.replace('/app/broker');
      else throw new Error('Rol no permitido');
    } catch (err: any) {
      setMsg(err.message || 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <header className="topbar">
        <img src="/logo.png" alt="LISSa" className="logo" />
      </header>

      <div className="login-card">
        <h2 className="title">Ingresar</h2>
        <form onSubmit={onSubmit} className="form-grid" noValidate>
          <input
            className="full"
            type="email"
            placeholder="Usuario (correo)"
            value={email}
            onChange={(e)=>setEmail(e.target.value)}
            onKeyUp={(e)=>setCaps((e.getModifierState && e.getModifierState('CapsLock')) || false)}
            aria-invalid={!isEmail(email)}
          />
          <input
            className="full"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e)=>setPass(e.target.value)}
            onKeyUp={(e)=>setCaps((e.getModifierState && e.getModifierState('CapsLock')) || false)}
            aria-invalid={!pwOk(pass)}
          />
          {caps && <div className="warn full">Bloq Mayús activado</div>}
          {msg &&  <div className="error full">{msg}</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          {/* LINKS CORRECTOS (no /app/auth/...) */}
          <a className="link full" href="/forgot">¿Olvidaste tu contraseña?</a>
          <a className="link full" href="/signup-request">Solicitar nuevo usuario</a>
        </form>
      </div>

      <footer className="foot">© {new Date().getFullYear()} Líderes en Seguros, S.A.</footer>

      <style jsx global>{`
        html, body, #__next { height: 100%; }
        body { margin:0; font-family: Arial, Helvetica, sans-serif; }
        .login-wrap {
          min-height: 100%;
          background: url('/fondo_login.jpg') center/cover no-repeat fixed;
          position: relative;
        }
        .login-wrap:before {
          content: ""; position: absolute; inset: 0; background: rgba(0,0,0,.35);
        }
      `}</style>
      <style jsx>{`
        .topbar { position: relative; z-index: 1; padding: 12px 16px; }
        .logo { height: 38px; }
        .login-card {
          position: relative; z-index: 1;
          max-width: 520px; margin: 56px auto 24px;
          background: #fff; border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,.15);
          padding: 24px;
        }
        .title { margin: 0 0 12px; }
        .form-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .full { grid-column: 1/-1; }
        input { width: 100%; padding: 12px 14px; border: 1px solid #c3c9d2; border-radius: 8px; font-size: 14px; }
        input[aria-invalid="true"] { border-color: #e03d3d; }
        .btn { background:#0b1939; color:#fff; border:none; padding:12px 16px; border-radius:8px; font-weight:700; cursor:pointer; }
        .btn:disabled { opacity:.7; cursor:not-allowed; }
        .link { color:#0b1939; text-decoration:none; font-size:14px; text-align:center; }
        .link:hover { text-decoration: underline; }
        .warn { color:#b08600; font-size:13px; }
        .error { color:#b00020; font-size:13px; }
        .foot { position: relative; z-index: 1; color:#fff; text-align:center; padding:12px; }
        @media (max-width: 720px) { .login-card { margin: 24px 16px; } }
      `}</style>
    </div>
  );
}
