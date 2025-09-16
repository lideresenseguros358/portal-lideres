// /pages/app/auth/signup-request.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase-client';

export default function SignupRequest() {
  const [form, setForm] = useState<any>({});
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('');

  const set = (k: string) => (e: any) => setForm((s: any) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg('');
    try {
      const { error } = await supabase.from('signup_requests').insert({
        full_name: form.full_name || '',
        document_id: form.document_id || '',
        email: form.email || '',
        phone: form.phone || '',
        birthdate: form.birthdate || null,
        broker_license: form.broker_license || '',
        bank_name: form.bank_name || '',
        bank_account_no: form.bank_account_no || '',
        bank_owner_name: form.bank_owner_name || '',
        bank_owner_id: form.bank_owner_id || '',
        password: form.password || '',
      });
      if (error) throw error;
      setMsg('Solicitud enviada. Un administrador aprobará tu acceso.');
      setForm({});
    } catch (e: any) { setErr(e?.message || 'Error'); }
  }

  return (
    <div style={{ maxWidth: 920, margin:'40px auto', background:'#fff', padding:24, borderRadius:12 }}>
      <h2>Solicitud de nuevo usuario</h2>
      <p>Completa tus datos. Un administrador aprobará tu acceso.</p>

      <form onSubmit={onSubmit} className="grid">
        <input placeholder="Nombre completo" value={form.full_name||''} onChange={set('full_name')} />
        <input placeholder="Cédula / Pasaporte" value={form.document_id||''} onChange={set('document_id')} />
        <input placeholder="Correo" value={form.email||''} onChange={set('email')} />
        <input placeholder="Celular" value={form.phone||''} onChange={set('phone')} />
        <input placeholder="Fecha de nacimiento" type="date" value={form.birthdate||''} onChange={set('birthdate')} />
        <input placeholder="Licencia de corredor (si no tiene dejar en blanco)" value={form.broker_license||''} onChange={set('broker_license')} />

        <div className="sep">Cuenta bancaria para comisiones</div>

        <input placeholder="Número de cuenta" value={form.bank_account_no||''} onChange={set('bank_account_no')} />
        <input placeholder="Banco (nombre o código)" value={form.bank_name||''} onChange={set('bank_name')} />
        <input placeholder="Dueño de la cuenta" value={form.bank_owner_name||''} onChange={set('bank_owner_name')} />
        <input placeholder="Cédula del dueño de la cuenta" value={form.bank_owner_id||''} onChange={set('bank_owner_id')} />

        <input placeholder="Contraseña" type="password" value={form.password||''} onChange={set('password')} />

        {msg && <div className="ok">{msg}</div>}
        {err && <div className="err">{err}</div>}

        <button className="btn" type="submit">Enviar solicitud</button>
      </form>

      <style jsx>{`
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        .grid > input { padding:12px; border:1px solid #ccd; border-radius:8px; }
        .sep { grid-column: 1 / -1; margin:8px 0 0; font-weight:700; color:#333 }
        .btn { grid-column: 1 / -1; background:#0e1039; color:#fff; border:none; padding:12px 16px; border-radius:8px; margin-top:8px; }
        .ok { grid-column: 1 / -1; color:#060; }
        .err { grid-column: 1 / -1; color:#b00; }
        @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

