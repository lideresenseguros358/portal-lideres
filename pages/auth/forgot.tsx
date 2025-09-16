// /pages/app/auth/forgot.tsx
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase-client';

export default function ForgotPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${location.origin}/app/auth/update-passwords`,
      });
      if (error) throw error;
      setMsg('Te enviamos un enlace para restablecer tu contraseña.');
    } catch (e: any) { setErr(e?.message || 'Error'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 520, margin: '48px auto', background:'#fff', padding:24, borderRadius:12 }}>
      <h2>Recuperar contraseña</h2>
      <form onSubmit={onSubmit}>
        <input className="full" type="email" placeholder="Correo" value={email} onChange={e=>setEmail(e.target.value)} />
        {msg && <div style={{ color:'#060' }}>{msg}</div>}
        {err && <div style={{ color:'#b00' }}>{err}</div>}
        <button disabled={!email || loading} className="btn">{loading ? 'Enviando…' : 'Enviar enlace'}</button>
      </form>
      <style jsx>{`.full{width:100%;padding:12px;border:1px solid #ccd;border-radius:8px;margin:8px 0}.btn{background:#0e1039;color:#fff;border:none;padding:10px 16px;border-radius:8px}`}</style>
    </div>
  );
}
