// /pages/login.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { supabase } from '../lib/supabase-client'; // ajusta si tu ruta es distinta

// Colores
const OLIVE = '#8aaa19';
const FOOTER_BLUE = '#010139';
const SUBTITLE_GRAY = '#6b6b6b';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      // lee perfil para decidir a dónde mandar
      const uid = data.user?.id;
      let role: 'broker' | 'master' = 'broker';
      if (uid) {
        const { data: p, error: pe } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .single();
        if (!pe && p?.role) role = p.role as 'broker' | 'master';
      }
      router.replace(role === 'master' ? '/app/master' : '/app/broker');
    } catch (err: any) {
      setMsg(err?.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      {/* Header blanco con logo a la IZQUIERDA (responsive) */}
      <header className="top">
        <div className="logoWrap">
          <Image src="/logo.png" alt="Lissa" width={104} height={40} />
        </div>
      </header>

      {/* Fondo con imagen (responsive cover) */}
      <div className="bg" role="img" aria-label="Fondo Panamá" />

      <main className="center">
        <form className="card" onSubmit={handleSubmit}>
          <h1 className="title">Portal Virtual</h1>
          <h2 className="title olive">Corredores</h2>
          <p className="subtitle">Ingrese su usuario y contraseña</p>

          <input
            type="email"
            placeholder="correo@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button disabled={loading} aria-busy={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <nav className="links">
            <a href="/app/auth/forgot">¿Olvidaste tu contraseña?</a>
            <a href="/app/auth/signup-request">Solicitar nuevo usuario</a>
          </nav>

          {msg && <div className="error">{msg}</div>}
        </form>
      </main>

      {/* Footer dentro de franja azul oscuro */}
      <footer className="footer">
        <div className="footInner">
          <div className="reg">
            Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750
          </div>
          <div className="sub">
            Desarrollado por Líderes en Seguros | Todos los derechos reservados
          </div>
        </div>
      </footer>

      <style jsx>{`
        .login {
          min-height: 100vh;
          display: grid;
          grid-template-rows: auto 1fr auto;
          background: #e6e6e6;
        }
        .top {
          background: #fff;
          height: 56px;
          display: flex;
          align-items: center;
          padding: 0 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,.08);
        }
        .logoWrap { display:flex; align-items:center; }
        .bg {
          position: fixed;
          inset: 56px 0 96px 0; /* debajo del header y encima del footer */
          background: url('/fondo_login.webp') center/cover no-repeat;
          z-index: 0;
        }
        .center {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          padding: 24px 12px;
        }
        .card {
          width: 100%;
          max-width: 480px; /* más angosto */
          background: #fff;
          border-radius: 12px;
          padding: 18px;
          box-shadow: 0 8px 28px rgba(0,0,0,.12);
        }
        .title {
          margin: 0;
          text-align: center;
          color: ${OLIVE};
          font-weight: 800;
        }
        .title.olive { margin-top: 2px; font-size: 18px; }
        .subtitle {
          margin: 6px 0 14px;
          text-align: center;
          color: ${SUBTITLE_GRAY};
          font-size: 13px;
        }
        input {
          width: 100%;
          height: 42px;                 /* NO altos */
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 0 12px;
          background: #f3f6fb;
          margin-bottom: 10px;
          outline: none;
        }
        input:focus { border-color: ${OLIVE}; background:#fff; }
        button {
          width: 100%;
          height: 40px;
          border: 0;
          border-radius: 8px;
          background: #0a1233;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }
        button[disabled] { opacity: .7; cursor: default; }
        .links {
          margin-top: 10px;
          display: flex;
          gap: 12px;
          justify-content: center;
          font-size: 12px;
        }
        .links a { color: #0a1233; text-decoration: underline; }
        .error {
          margin-top: 10px;
          color: #b00020;
          text-align: center;
          font-size: 13px;
        }
        .footer {
          background: ${FOOTER_BLUE};
          color: #cfd3da;
          padding: 8px 12px;
        }
        .footInner {
          max-width: 1200px; margin: 0 auto; text-align:center;
        }
        .reg { font-size: 9px; line-height: 1.4; }
        .sub { font-size: 8px; line-height: 1.2; }
        @media (max-width: 480px) {
          .card { max-width: 92vw; padding: 14px; }
        }
      `}</style>
    </div>
  );
}
