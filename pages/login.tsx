// /pages/login.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase'; // ajusta la ruta si tu lib vive en otro sitio

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function pwOk(v: string) {
  return v.trim().length >= 6;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Rellena el email si quedó guardado
  useEffect(() => {
    try {
      const saved = localStorage.getItem('portal_email') || '';
      if (saved) setEmail(saved);
    } catch {}
  }, []);

  const valid = isEmail(email) && pwOk(pass);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!valid) {
      setMsg('Verifica tu correo y contraseña.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass,
      });
      if (error) throw error;

      const user = data.user;
      if (!user) throw new Error('No auth user');

      // Guarda email para la próxima
      try { localStorage.setItem('portal_email', email.trim()); } catch {}

      // 1) intenta rol desde app_metadata del token
      let role: 'master' | 'broker' | undefined =
        (user.app_metadata as any)?.role ||
        (user.user_metadata as any)?.role;

      // 2) si no hay rol en el token, intenta en profiles SIN .single()
      if (!role) {
        const uid = user.id;
        const { data: prof, error: pErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .limit(1)
          .maybeSingle(); // ← evita "Cannot coerce..."

        if (pErr) throw pErr;
        role = (prof?.role as any) || undefined;
      }

      if (!role) throw new Error('No se pudo determinar el rol del usuario');

      // Redirección
      if (typeof window !== 'undefined') {
        window.location.href = role === 'master' ? '/app/master' : '/app/broker';
      }
    } catch (err: any) {
      setMsg(String(err?.message ?? err) || 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      {/* HEADER blanco con logo */}
      <header className="topbar">
        <div className="topbar-inner">
          <img src="/logo.png" alt="Líderes en Seguros" className="logo" />
        </div>
      </header>

      {/* CARD */}
      <div className="login-card" role="region" aria-labelledby="title">
        <h2 id="title" className="title">Portal Virtual</h2>
        <h3 className="subtitle">Corredores</h3>
        <p className="hint">Ingrese su usuario y contraseña</p>

        <form onSubmit={onSubmit} className="form-grid" noValidate>
          <input
            className="full"
            type="email"
            placeholder="Usuario (correo)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={msg ? !isEmail(email) : undefined}
          />
          <input
            className="full"
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyUp={(e) => setCaps((e as any).getModifierState?.('CapsLock'))}
            aria-invalid={msg ? !pwOk(pass) : undefined}
          />

          {caps && <div className="warn full">Bloq Mayús activado</div>}
          {msg && <div className="err full">{msg}</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          <a className="link full" href="/app/auth/forgot">¿Olvidaste tu contraseña?</a>
          <a className="link full" href="/app/auth/signup-request">Solicitar nuevo usuario</a>
        </form>
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-line">
          Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750
        </div>
        <div className="footer-sub">
          Desarrollado por Líderes en Seguros | Todos los derechos reservados
        </div>
      </footer>

      {/* ESTILOS */}
      <style jsx global>{`
        :root {
          --olive: #8aaa19;
          --bg-gray: #e6e6e6;
          --txt: #1f2937;
          --muted: #6b7280;
          --err: #b00020;
        }
        html, body, #__next { height: 100%; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: var(--bg-gray); }
      `}</style>

      <style jsx>{`
        .login-wrap {
          min-height: 100%;
          background: url('/fondo_login.webp') center/cover no-repeat fixed;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        /* overlay 35% negro */
        .login-wrap::before {
          content: '';
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.35);
          pointer-events: none;
        }

        /* header blanco con logo a la izquierda */
        .topbar {
          width: 100%;
          background: #fff;
          position: relative;
          z-index: 1;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06);
        }
        .topbar-inner {
          max-width: 1200px;
          margin: 0 auto;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 16px;
        }
        .logo {
          height: 36px;   /* tamaño pedido */
          width: auto;
          display: block;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 560px;
          margin: 56px 16px 0;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.15);
          padding: 20px 20px 12px;
        }

        .title {
          margin: 6px 0 0;
          color: var(--txt);
          font-size: 22px;
          font-weight: 700;
        }
        .subtitle {
          margin: 2px 0;
          color: var(--olive);
          font-size: 18px;
          font-weight: 700;
        }
        .hint {
          margin: 0 0 6px;
          color: var(--muted);
          font-size: 13px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          margin-top: 8px;
        }
        .full { grid-column: 1 / -1; }

        input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px 14px;
          border: 1px solid #c3c9d2;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
        }
        input[aria-invalid="true"] {
          border-color: var(--err);
        }

        .btn {
          display: inline-block;
          width: 100%;
          background: #0b1539; /* tu botón azul oscuro */
          color: #fff;
          padding: 12px 16px;
          border: 0;
          border-radius: 8px;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
        }
        .btn:disabled {
          opacity: .7;
          cursor: not-allowed;
        }

        .warn { color: #d97706; font-size: 13px; }
        .err  { color: var(--err); font-size: 13px; }

        .link {
          color: #0e8199;
          text-decoration: none;
          font-size: 14px;
          text-align: center;
          display: block;
          padding: 6px 0 4px;
        }
        .link:hover { text-decoration: underline; }

        .footer {
          position: relative;
          z-index: 1;
          width: 100%;
          text-align: center;
          margin: 10px 0 18px;
        }
        .footer-line {
          color: #d1d5db;         /* gris claro */
          font-size: 9px;         /* 9px solicitado */
          line-height: 1.2;
        }
        .footer-sub {
          color: #d1d5db;
          font-size: 8px;         /* subtítulo ~8px */
          margin-top: 2px;
        }

        @media (max-width: 720px) {
          .login-card { margin-top: 24px; }
          .topbar-inner { height: 52px; }
          .logo { height: 32px; }
        }
      `}</style>
    </div>
  );
}
