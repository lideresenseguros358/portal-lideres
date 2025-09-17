// pages/login.tsx
import Head from 'next/head';
import { useRouter } from 'next/router';
import React, { useState } from 'react';
import Image from 'next/image';
import { supabase } from '../lib/supabase'; // ajusta si tu path difiere

const OLIVE = '#8aaa19';
const FOOTER_BLUE = '#010139';
const SUBTITLES = '#6b6b6b';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // redirige según cookie/rol (tu middleware actual debe manejarlo)
      router.push('/app/redirect'); // o la ruta que ya estás usando
    } catch (err: any) {
      setMsg(err.message || 'Error al iniciar sesión');
    } finally {
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
        {/* header blanco con logo a la izquierda */}
        <header className="topbar">
          <div className="logoWrap">
            <Image src="/logo.png" width={120} height={42} alt="LISSA" priority />
          </div>
        </header>

        {/* fondo + overlay */}
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

        {/* Card centrado y angosto */}
        <main className="center">
          <form className="card" onSubmit={handleSubmit}>
            <h1 className="title">Portal Virtual</h1>
            <h2 className="subtitle">Corredores</h2>
            <p className="helper">Ingrese su usuario y contraseña</p>

            <input
              type="email"
              placeholder="correo@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="inp"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="inp"
            />

            {msg && <div className="error">{msg}</div>}

            <button className="btn" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>

            <div className="links">
              {/* rutas absolutas CORRECTAS dentro de /app/auth */}
              <a href="/app/auth/forgot">¿Olvidaste tu contraseña?</a>
              <a href="/app/auth/signup-request">Solicitar nuevo usuario</a>
            </div>
          </form>
        </main>

        {/* footer dentro de franja azul */}
        <footer className="footer">
          <div className="footInner">
            <div className="footMain">
              Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá — Licencia PJ750
            </div>
            <div className="footSub">
              Desarrollado por Líderes en Seguros | Todos los derechos reservados
            </div>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
        html, body, #__next { height: 100%; }
        a { color: #2d6cdf; text-decoration: none; }
        a:hover { text-decoration: underline; }
      `}</style>

      <style jsx>{`
        .page { min-height: 100vh; position: relative; background:#e6e6e6; }
        .topbar { position: relative; z-index: 2; height: 56px; background: #fff; box-shadow: 0 1px 6px rgba(0,0,0,.08); display:flex; align-items:center; }
        .logoWrap { margin-left: 16px; display:flex; align-items:center; }
        .bg { position: absolute; inset: 56px 0 72px 0; }
        .overlay { position:absolute; inset:0; background: rgba(0,0,0,.35); }
        .center { position: relative; z-index: 2; display:flex; justify-content:center; align-items:center; padding: 32px 16px; min-height: calc(100vh - 56px - 72px); }
        .card {
          width: 100%;
          max-width: 420px; /* angosto */
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 10px 26px rgba(0,0,0,.18);
          padding: 22px 18px;
          text-align: center;
        }
        .title { margin: 2px 0 0; color: ${OLIVE}; font-size: 26px; font-weight: 700; }
        .subtitle { margin: 0; color: ${OLIVE}; font-size: 18px; font-weight: 700; }
        .helper { margin: 4px 0 14px; color: ${SUBTITLES}; font-size: 13px; }
        .inp {
          width: 100%;
          border: 1px solid #d8d8d8;
          background: #eef3f9;
          border-radius: 8px;
          padding: 10px 12px;   /* más delgado */
          margin: 8px 0;
          font-size: 14px;
        }
        .btn {
          width: 100%;
          border: 0;
          background: #0b1039;
          color: #fff;
          font-weight: 700;
          border-radius: 8px;
          padding: 10px 14px;
          margin-top: 8px;
          cursor: pointer;
        }
        .btn:disabled { opacity: .65; cursor: default; }
        .links { display:flex; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 13px; }
        .error { background:#fff2f0; border:1px solid #ffd6cc; color:#cc1f1a; border-radius:8px; padding:8px; margin:8px 0; font-size:13px; }

        .footer { position: relative; z-index: 2; height: 72px; background: ${FOOTER_BLUE}; display:flex; align-items:center; justify-content:center; }
        .footInner { text-align:center; line-height: 1.2; }
        .footMain { color:#c9c9c9; font-size: 11px; }
        .footSub  { color:#b5b5b5; font-size: 10px; margin-top: 4px; }
      `}</style>
    </>
  );
}
