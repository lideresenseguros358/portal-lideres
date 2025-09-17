// pages/login.tsx
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
// ⬇️ AJUSTA este import si tu cliente está en otro path (p.ej. '../lib/supabase')
import { supabase } from '../lib/supabase';

const OLIVE = '#8aaa19';
const FOOTER_BLUE = '#0b1039';

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
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Cookies para que el middleware deje pasar a /app (12h)
      const exp = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
      document.cookie = `portal_session=1; path=/; SameSite=Lax`;
      document.cookie = `portal_expires=${exp}; path=/; SameSite=Lax`;

      router.replace('/app');
    } catch (err: any) {
      setMsg(err?.message ?? 'Error al iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Líderes en Seguros | Login</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="page">
        {/* Background a pantalla completa + overlay 35% */}
        <div className="bg">
          <Image
            src="/fondo_login.jpg"
            alt="Panamá"
            fill
            priority
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          />
          <div className="overlay" />
        </div>

        {/* Header blanco SIEMPRE por encima */}
        <header className="topbar">
          <div className="logo">
            <Image
              src="/logo.png"
              alt="LISSA"
              width={180}
              height={42}
              // No deformar: fijamos alto y dejamos ancho auto
              style={{ height: 42, width: 'auto' }}
              priority
            />
          </div>
        </header>

        {/* Card centrado y angosto */}
        <main className="center">
          <form className="card" onSubmit={handleSubmit}>
            <h1 className="title">Portal Virtual</h1>
            <h2 className="subtitle">Corredores</h2>
            <p className="helper">Ingrese su usuario y contraseña</p>

            <input
              className="inp"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@dominio.com"
            />
            <input
              className="inp"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
            />

            {msg && <div className="error">{msg}</div>}

            <button className="btn" disabled={loading}>
              {loading ? 'Entrando…' : 'Iniciar sesión'}
            </button>

            <div className="links">
              <a href="/auth/forgot">Olvidé mi contraseña</a>
              <a href="/auth/signup-request">¿Nuevo usuario?</a>
            </div>
          </form>
        </main>

        {/* Footer azul por delante del fondo */}
        <footer className="footer">
          <div className="footInner">
            <div className="footMain">
              Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá – Licencia PJ750
            </div>
            <div className="footSub">
              Desarrollado por Líderes en Seguros | Todos los derechos reservados
            </div>
          </div>
        </footer>
      </div>

      {/* Arial en todo el sitio */}
      <style jsx global>{`
        * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
        html, body, #__next { height: 100%; }
        a { color: #2d56cf; text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>

      <style jsx>{`
        .page {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .bg {
          position: fixed;
          inset: 0;
          z-index: 1; /* al fondo */
        }
        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,.35);
          pointer-events: none; /* clave: no bloquea clics */
        }

        .topbar {
          position: relative;
          z-index: 4; /* por encima del fondo */
          height: 72px;
          background: #fff;
          display: flex;
          align-items: center;
          padding: 0 24px;
          box-shadow: 0 1px 6px rgba(0,0,0,.08);
        }

        .center {
          position: relative;
          z-index: 5;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .card {
          width: 100%;
          max-width: 420px; /* más angosto */
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 10px 26px rgba(0,0,0,.18);
          padding: 22px 18px;
          text-align: center;
        }
        .title { margin: 2px 0 6px; color: ${OLIVE}; font-size: 26px; font-weight: 700; }
        .subtitle { margin: 0 0 14px; color: ${OLIVE}; font-size: 18px; font-weight: 700; }
        .helper { margin: 4px 0 14px; color: #666; font-size: 13px; }

        .inp {
          width: 100%;
          border: 1px solid #d8d8d8;
          background: #eef3f9;
          border-radius: 8px;
          padding: 12px 10px;
          font-size: 14px;
          margin: 8px 0;
        }

        .btn {
          width: 100%;
          border: 0;
          background: ${FOOTER_BLUE};
          color: #fff;
          font-weight: 700;
          border-radius: 8px;
          padding: 12px 10px;
          margin-top: 8px;
          cursor: pointer;
        }
        .btn:disabled { opacity: .65; cursor: default; }

        .links {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin-top: 12px;
          font-size: 13px;
        }

        .error {
          color: #b00020;
          background: #fee;
          border: 1px solid #f9c;
          padding: 8px 12px;
          border-radius: 8px;
          margin: 8px 0;
        }

        .footer {
          position: relative;
          z-index: 4;
          height: 72px;
          background: ${FOOTER_BLUE};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #c9c9c9;
          font-size: 11px;
        }
        .footInner { text-align: center; line-height: 1.2; }
        .footSub { color: #b5b5b5; font-size: 10px; margin-top: 4px; }
      `}</style>
    </>
  );
}
