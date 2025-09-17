import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function UpdatePasswords() {
  const [pw, setPw] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setMsg('Contraseña actualizada. Ya puedes iniciar sesión.');
    } catch (e:any) { setErr(e.message || 'Error'); }
  }
  return (
    <div style={{ maxWidth:520, margin:'48px auto', background:'#fff', padding:24, borderRadius:12 }}>
      <h2>Define tu nueva contraseña</h2>
      <form onSubmit={onSubmit}>
        <input className="full" type="password" placeholder="Nueva contraseña" value={pw} onChange={e=>setPw(e.target.value)} />
        {msg && <div style={{color:'#060'}}>{msg}</div>}
        {err && <div style={{color:'#b00'}}>{err}</div>}
        <button className="btn" disabled={!pw}>Guardar</button>
      </form>
      <style jsx>{`.full{width:100%;padding:12px;border:1px solid #ccd;border-radius:8px;margin:8px 0}.btn{background:#0e1039;color:#fff;border:none;padding:10px 16px;border-radius:8px}`}</style>
    </div>
  );
}
