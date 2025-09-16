// /pages/app/auth/login.tsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function isEmail(v: string){ return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function pwOk(v: string){ return (v ?? '').length >= 8; }

export default function LoginPage(){
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [caps, setCaps] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const valid = isEmail(email) && pwOk(pass);

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setMsg(null);
    if (!valid) { setMsg('Verifica tu correo y contraseña.'); return; }
    setLoading(true);
    try{
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: pass
      });
      if (error) throw error;

      // guarda token para Bearer
      const token = data.session?.access_token;
      if (token) localStorage.setItem('sb-access-token', token);

      // trae user para decidir rol
      const { data: u } = await supabase.auth.getUser();
      const role = (u.user?.app_metadata as any)?.role as ('master'|'broker'|undefined);

      localStorage.setItem('portal_email', email.trim());
      localStorage.setItem('portal_role', role ?? '');

      if (role === 'master') location.href = '/app/master';
      else if (role === 'broker') location.href = '/app/broker';
      else location.href = '/app/broker';
    } catch(err:any){
      setMsg(err?.message || 'Error iniciando sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h2 className="title">Ingresar</h2>
        <form className="form-grid" onSubmit={onSubmit} noValidate>
          <input className="full" type="email" placeholder="Usuario (correo)"
                 value={email} onChange={e=>setEmail(e.target.value)}
                 aria-invalid={!!msg && !isEmail(email)} />
          <input className="full" type="password" placeholder="Contraseña"
                 value={pass} onChange={e=>setPass(e.target.value)}
                 onKeyUp={(e)=>setCaps((e as any).getModifierState?.('CapsLock'))}
                 aria-invalid={!!msg && !pwOk(pass)} />
          {caps && <div className="warn full">Bloq Mayús activado</div>}
          {msg && <div className="msg full">{msg}</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Ingresando…' : 'Entrar'}
          </button>

          <a className="link full" href="/app/auth/forgot">¿Olvidaste tu contraseña?</a>
          <a className="link full" href="/app/auth/signup-request">Solicitar nuevo usuario</a>
        </form>
      </div>

      <style jsx global>{`
        html, body, #__next { height: 100%; }
        body { margin:0; font-family: Arial, Helvetica, sans-serif; }
        .login-wrap { min-height:100%; background:url('/fondo_login.webp') center/cover no-repeat fixed; position:relative; }
        .login-wrap::before { content:''; position:absolute; inset:0; background: rgba(0,0,0,.35); }
      `}</style>
      <style jsx>{`
        .login-card { position:relative; z-index:1; max-width:520px; margin:48px auto; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); padding:24px; }
        .form-grid { display:grid; grid-template-columns:1fr; gap:12px; }
        .full { width:100%; padding:12px 14px; border:1px solid #c3c9d2; border-radius:8px; font-size:14px; }
        .btn { background:#0e1939; color:#fff; border:none; padding:12px 16px; border-radius:8px; font-weight:700; cursor:pointer; }
        .btn:disabled { opacity:.7; cursor:not-allowed; }
        .warn { color:#b80e0e; font-size:13px; }
        .msg { color:#0e1939; font-size:13px; }
        .link { color:#0e1839; text-decoration:none; font-size:14px; text-align:center; }
        .link:hover { text-decoration:underline; }
        @media (max-width:720px){ .login-card{ margin:16px; } }
      `}</style>
    </div>
  );
}

