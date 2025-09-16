// /pages/app/auth/signup-request.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function SignupRequestPage() {
  const [form, setForm] = useState({
    full_name: '', doc_id: '', email: '', phone: '', mobile: '',
    birth_date: '', broker_license: '',
    bank_account: '', bank_name: '',
    account_owner: '', owner_doc_id: '',
    same_owner: false,
    password_plain: ''
  });
  const [msg, setMsg] = useState<string|null>(null);
  const [ok, setOk] = useState(false);

  const set = (k: string, v: any) => setForm(s => ({ ...s, [k]: v }));

  const onSame = (v: boolean) => {
    if (v) {
      setForm(s => ({ ...s, same_owner: true, account_owner: s.full_name, owner_doc_id: s.doc_id }));
    } else {
      set('same_owner', false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const payload = { ...form };
      // convertir fecha si viene en mm/dd/yyyy
      if (payload.birth_date) {
        const [m,d,y] = payload.birth_date.split(/[/-]/);
        if (y && m && d) payload.birth_date = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
      }
      const { error } = await supabase.from('signup_requests').insert(payload);
      if (error) throw error;
      setOk(true);
    } catch (err:any) {
      setMsg(err?.message || String(err));
    }
  };

  return (
    <div className="page">
      <form className="card" onSubmit={onSubmit}>
        <h1 className="title">Solicitud de nuevo usuario</h1>
        <p className="subtitle">Completa tus datos. Un administrador aprobará tu acceso.</p>

        <div className="grid">
          <div>
            <label>Nombre completo</label>
            <input value={form.full_name} onChange={e=>set('full_name', e.target.value)} />
          </div>
          <div>
            <label>Cédula / Pasaporte</label>
            <input value={form.doc_id} onChange={e=>set('doc_id', e.target.value)} />
          </div>

          <div>
            <label>Correo</label>
            <input type="email" value={form.email} onChange={e=>set('email', e.target.value)} />
          </div>
          <div>
            <label>Celular</label>
            <input value={form.mobile} onChange={e=>set('mobile', e.target.value)} />
          </div>

          <div>
            <label>Fecha de nacimiento</label>
            <input placeholder="mm/dd/yyyy" value={form.birth_date} onChange={e=>set('birth_date', e.target.value)} />
          </div>
          <div>
            <label>Licencia de corredor (si no tiene dejar en blanco)</label>
            <input value={form.broker_license} onChange={e=>set('broker_license', e.target.value)} />
          </div>
        </div>

        <h3 className="section">Cuenta bancaria para comisiones</h3>
        <div className="grid">
          <div>
            <label>Número de cuenta</label>
            <input value={form.bank_account} onChange={e=>set('bank_account', e.target.value)} />
          </div>
          <div>
            <label>Banco</label>
            <input value={form.bank_name} onChange={e=>set('bank_name', e.target.value)} />
          </div>

          <div>
            <label>Dueño de la cuenta</label>
            <input value={form.account_owner} onChange={e=>set('account_owner', e.target.value)} />
          </div>
          <div className="row">
            <div style={{flex:1}}>
              <label>Cédula del dueño de la cuenta</label>
              <input value={form.owner_doc_id} onChange={e=>set('owner_doc_id', e.target.value)} />
            </div>
            <label className="chk">
              <input type="checkbox" checked={form.same_owner} onChange={e=>onSame(e.target.checked)} />
              <span>el mismo</span>
            </label>
          </div>

          <div>
            <label>Contraseña</label>
            <input type="password" value={form.password_plain} onChange={e=>set('password_plain', e.target.value)} />
          </div>
        </div>

        {msg && <div className="err">{msg}</div>}
        {ok
          ? <div className="ok">¡Solicitud enviada! Te notificaremos por correo.</div>
          : <button className="btn" type="submit">Enviar solicitud</button>
        }
      </form>

      <style jsx>{`
        :global(html, body, #__next){ height:100%; }
        .page { min-height:100%; background:#e6e6e6; padding:24px 12px; display:flex; justify-content:center; }
        .card {
          width:min(980px, 96vw);
          background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.12);
          padding:24px; margin:16px auto;
        }
        .title { margin:0; font-size:22px; color:#333; }
        .subtitle { margin:6px 0 16px; color:#6b6b6b; }
        .section { margin:8px 0 8px; color:#333; font-size:16px; }
        .grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
        .grid > div { display:flex; flex-direction:column; }
        label { font-size:13px; color:#444; margin-bottom:6px; }
        input {
          border:1px solid #c9c9c9; border-radius:8px; padding:12px 10px; font-size:14px;
        }
        .row { display:flex; gap:12px; align-items:flex-end; }
        .chk { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
        .btn {
          margin-top:16px; padding:12px 18px; background:#0a1028; color:#fff; border:0; border-radius:8px; font-weight:700;
        }
        .err { margin-top:8px; color:#b00020; }
        .ok  { margin-top:8px; color:#0b7e16; }
        @media (max-width:760px){
          .grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
