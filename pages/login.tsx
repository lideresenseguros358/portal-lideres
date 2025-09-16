// /pages/login.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';

type Role = 'master' | 'broker';

interface ApiLoginOk {
  ok: true;
  sessionId: string;
  role: Role;
  brokerEmail: string;
  expiresAt: string;
}
interface ApiLoginErr { ok: false; error: string; }
type ApiLoginRes = ApiLoginOk | ApiLoginErr;

const COLORS = {
  brandBlue: '#010139',
  olive: '#8aaa19',
  lightGrayText: '#a9a8a8',
  errorBorder: '#f4bab4',
  errorText: '#9b1c1c',
  footerText: '#cfd3d8',
};

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string>('');

  async function doLogin(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setErr('');
    setBusy(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: password.trim() })
      });

      const data = (await res.json()) as ApiLoginRes;
      if (!res.ok || !('ok' in data) || !data.ok) {
        throw new Error((data as ApiLoginErr).error || `Error (${res.status})`);
      }

      // Compatibilidad con tu middleware: guarda también en el cliente si quieres
      if (typeof window !== 'undefined') {
        localStorage.setItem('portal_session', data.sessionId || '');
        localStorage.setItem('portal_role', data.role || '');
        localStorage.setItem('portal_email', data.brokerEmail || email);
        document.cookie = `portal_expires=${encodeURIComponent(data.expiresAt)}; path=/; samesite=lax; ${process.env.NODE_ENV === 'production' ? 'secure;' : ''}`;
      }

      const role = (data.role || '').toLowerCase() as Role;
      if (role === 'master') r.push('/app/master');
      else if (role === 'broker') r.push('/app/broker');
      else r.push('/app');
    } catch (e: any) {
      setErr(e instanceof Error ? e.message : 'No se pudo iniciar sesión');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <img src="/logo.png" alt="Líderes en Seguros" className="logo" />
          <div className="spacer" />
          <div className="foot1">Mi cuenta</div>
        </div>
      </header>

      <main className="center">
        <section className="card">
          <h1 className="title">Portal Virtual</h1>
          <p className="subtitleOlive">de Corredores</p>
          <p className="subtitleGray">Ingrese su usuario y contraseña</p>

          <form onSubmit={doLogin} className="form">
            <label htmlFor="email">Usuario</label>
            <input id="email" type="email" inputMode="email" autoComplete="username"
                   placeholder="correo@ejemplo.com" value={email}
                   onChange={(e) => setEmail(e.target.value)} disabled={busy} required />

            <label htmlFor="pass">Contraseña</label>
            <input id="pass" type="password" autoComplete="current-password"
                   placeholder="••••••••" value={password}
                   onChange={(e) => setPassword(e.target.value)} disabled={busy} required />

            {err && <div className="error">{err}</div>}

            <button type="submit" disabled={busy}>
              {busy ? 'Ingresando…' : 'Iniciar sesión'}
            </button>

            <div className="links">
              <a href="/auth/forgot">Olvidé mi Contraseña</a>
              <a href="/signup-request">¿Nuevo usuario?</a>
            </div>
          </form>
        </section>
      </main>

      <footer className="bottombar">
        <div className="foot1">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750</div>
        <div className="foot2">Desarrollado por Líderes en Seguros | Todos los derechos reservados</div>
      </footer>

      <style jsx>{`
        /* ✅ Fix borde blanco lateral y fondo de lado a lado */
        :global(html, body, #__next) { margin:0; padding:0; height:100%; background:#e6e6e6; overflow-x:hidden; }
        .page { min-height:100vh; width:100vw; position:relative; background-image:url('/fondo_login.webp'); background-size:cover; background-position:center; background-repeat:no-repeat; }
        .topbar { position:fixed; top:0; left:0; right:0; height:64px; background:#fff; box-shadow:0 9px 8px rgba(0,0,0,.08); z-index:5; }
        .topbar-inner { max-width:1120px; margin:0 auto; height:100%; display:flex; align-items:center; padding:0 16px; gap:16px; }
        .logo { height:38px; width:auto; object-fit:contain; }
        .spacer { flex:1; }
        .center { position:relative; z-index:1; min-height:100vh; display:grid; place-items:center; padding:88px 16px 96px; }
        .card { width:100%; max-width:480px; background:#fff; border-radius:16px; box-shadow:0 9px 8px rgba(0,0,0,.12); padding:28px; }
        .title { margin:0; text-align:center; color:${COLORS.olive}; font-size:34px; font-weight:700; }
        .subtitleOlive { margin:4px 0; text-align:center; color:${COLORS.olive}; font-size:18px; font-weight:700; }
        .subtitleGray { margin:0 0 18px; text-align:center; color:${COLORS.lightGrayText}; font-size:15px; }
        .form { display:grid; gap:10px; }
        label { font-weight:700; color:#333; }
        input { height:42px; border-radius:10px; border:1px solid #e5e7eb; padding:0 12px; }
        input:focus { border-color:${COLORS.olive}; box-shadow:0 0 3px rgba(138,170,25,.18); background:#fff; outline:none; }
        .error { background:#fdecea; border:1px solid ${COLORS.errorBorder}; color:${COLORS.errorText}; border-radius:8px; padding:12px; font-size:14px; }
        button { background:${COLORS.brandBlue}; color:#fff; width:100%; height:40px; border:none; border-radius:10px; font-weight:700; cursor:pointer; margin-top:6px; }
        button[disabled] { opacity:.7; cursor:default; }
        .links { display:flex; justify-content:space-between; margin-top:10px; }
        .links a { color:${COLORS.olive}; text-decoration:none; font-weight:700; }
        .links a:hover { text-decoration:underline; }

        .bottombar { position:fixed; left:0; right:0; bottom:0; background:${COLORS.brandBlue}; z-index:3; padding:10px 16px 12px; text-align:center; }
        .foot1 { color:${COLORS.footerText}; font-size:12px; line-height:1.2; }
        .foot2 { color:${COLORS.footerText}; font-size:12px; line-height:1.2; opacity:.9; margin-top:4px; }

        @media (max-width:420px) { .card { padding:22px 18px; } }
      `}</style>
    </div>
  );
}
