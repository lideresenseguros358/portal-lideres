// /pages/app/auth/forgot.tsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/update-passwords`
      });
      if (error) throw error;
      setOk(true);
    } catch (err:any) {
      setMsg(err?.message || String(err));
    }
  };

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1>Recuperar contraseña</h1>
        <p>Ingresa tu correo y recibirás un enlace para restablecer tu contraseña.</p>
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
        {msg && <div className="err">{msg}</div>}
        {ok ? <div className="ok">Revisa tu correo para continuar.</div> : <button className="btn">Enviar enlace</button>}
      </form>
      <style jsx>{`
        .page { min-height:100vh; background:#e6e6e6; display:flex; align-items:center; justify-content:center; padding:24px; }
        .card { width:min(520px, 92vw); background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.12); padding:24px; }
        input { width:100%; margin-top:12px; padding:12px 10px; border:1px solid #c9c9c9; border-radius:8px; }
        .btn { margin-top:12px; background:#0a1028; color:#fff; border:0; border-radius:8px; padding:12px 16px; font-weight:700; }
        .err { margin-top:8px; color:#b00020; }
        .ok { margin-top:8px; color:#0b7e16; }
      `}</style>
    </div>
  );
}
