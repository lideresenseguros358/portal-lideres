// /pages/login.tsx
import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { supabase } from '../lib/supabase-client'; // deja tu import como lo tengas
import Link from 'next/link';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
function pwOk(v: string) { return v.trim().length >= 6; }

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|null>(null);
  const [err, setErr] = useState<string|null>(null);
  const [caps, setCaps] = useState(false);

  const valid = useMemo(() => isEmail(email) && pwOk(pass), [email, pass]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!valid) { setErr('Verifica tu correo y contraseña.'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(), password: pass
      });
      if (error) throw error;

      // redirección por rol (lee desde local/session)
      const { data: user } = await supabase.auth.getUser();
      const role = (user.user?.app_metadata?.role ?? '') as 'master'|'broker'|'';
      if (role === 'master') location.href = '/app/master';
      else if (role === 'broker') location.href = '/app/broker';
      else location.href = '/';
    } catch (e: any) {
      setErr(e?.message || 'Error iniciando sesión');
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
        <header className="top">
          <div className="logoBox">
            {/* Usa tu logo real en /public/logo.svg ó ajusta ruta */}
            <Image src="/logo.svg" alt="LISSA" width={120} height={40} />
          </div>
        </header>

        <main className="hero" aria-label="Fondo">
          <div className="card" role="group" aria-labelledby="cardTitle">
            <h1 id="cardTitle" className="title">Portal Virtual</h1>
            <h2 className="title sub">Corredores</h2>
            <p className="subtitle">Ingrese su usuario y contraseña</p>

            <form className="form" onSubmit={onSubmit} noValidate>
              <input
                className="input"
                type="email"
                placeholder="Usuario (correo)"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                aria-invalid={email ? !isEmail(email) : undefined}
              />
              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={pass}
                onChange={(e)=>setPass(e.target.value)}
                onKeyUp={(e)=>setCaps((e as any).getModifierState?.('CapsLock'))}
                aria-invalid={pass ? !pwOk(pass) : undefined}
              />
              {caps && <div className="warn">Bloq Mayús activado</div>}
              {err &&  <div className="error">{err}</div>}
              {msg &&  <div className="msg">{msg}</div>}

              <button className="btn" type="submit" disabled={!valid || loading}>
                {loading ? 'Ingresando…' : 'Entrar'}
              </button>

              <div className="links">
                {/* ENLACES: deben existir /pages/app/auth/forgot.tsx y /pages/app/auth/signup-request.tsx */}
                <Link href="/app/auth/forgot">¿Olvidaste tu contraseña?</Link>
                <Link href="/app/auth/signup-request">Solicitar nuevo usuario</Link>
              </div>
            </form>
          </div>
        </main>

        <footer className="bottom">
          <div className="foot">
            <div className="f1">
              Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750
            </div>
            <div className="f2">
              Desarrollado por Líderes en Seguros | Todos los derechos reservados
            </div>
          </div>
        </footer>
      </div>

      <style jsx>{`
        :global(html,body,#__next){height:100%}
        .page{min-height:100%;display:flex;flex-direction:column;font-family:Arial, Helvetica, sans-serif;background:#e6e6e6;}
        .top{height:56px;background:#fff;display:flex;align-items:center;box-shadow:0 1px 6px rgba(0,0,0,.08)}
        .logoBox{width:100%;max-width:1160px;margin:0 auto;padding:0 16px;display:flex;align-items:center}
        .hero{flex:1;position:relative;background:url('/fondo_login.webp') center/cover no-repeat fixed;}
        .hero:before{content:"";position:absolute;inset:0;background:rgba(0,0,0,.35);}
        .card{position:relative;z-index:1;margin:64px auto;background:#fff;border-radius:16px;box-shadow:0 12px 36px rgba(0,0,0,.15);
              padding:24px;width:92%;max-width:520px;}
        .title{margin:0;text-align:center;color:#8AAA19;}
        .title.sub{margin-top:2px;font-size:22px;font-weight:700}
        .subtitle{margin:6px 0 16px;text-align:center;color:#777}
        .form{display:grid;gap:12px}
        .input{width:100%;height:44px;padding:10px 12px;border:1px solid #c9c9c9;border-radius:10px;font-size:14px}
        .input[aria-invalid="true"]{border-color:#d33}
        .warn{font-size:12px;color:#b36}
        .error{font-size:13px;color:#b00020}
        .msg{font-size:13px;color:#0a7}
        .btn{height:44px;border:0;border-radius:10px;background:#0b1039;color:#fff;font-weight:700;cursor:pointer}
        .btn:disabled{opacity:.6;cursor:not-allowed}
        .links{display:flex;flex-direction:column;gap:8px;margin-top:6px;text-align:center}
        .links :global(a){color:#1a2b88;text-decoration:none}
        .links :global(a:hover){text-decoration:underline}
        .bottom{background:#010139;padding:14px 0;margin-top:auto}
        .foot{max-width:1160px;margin:0 auto;text-align:center;color:#cfd3de;font-size:9px;line-height:1.3}
        .f2{font-size:8px;margin-top:3px}
        @media (max-width:520px){
          .card{margin:32px auto;padding:18px;border-radius:12px}
          .title.sub{font-size:20px}
        }
      `}</style>
    </>
  );
}

