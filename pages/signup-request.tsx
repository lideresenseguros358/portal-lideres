// /pages/signup-request.tsx
import React, { useState } from 'react';

const UI = { white:'#fff', blue:'#010139', olive:'#8aaa19', bg:'#e6e6e6', gray:'#8b8b8b' };

export default function SignupRequestPage() {
  // Arriba
  const [name, setName] = useState('');
  const [brokerid, setBrokerId] = useState('');       // cédula/pasaporte
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Abajo
  const [birthdate, setBirthdate] = useState('');     // YYYY-MM-DD
  const [licenseno, setLicense] = useState('');       // "si no tiene dejar en blanco"
  const [bank_account_no, setBankAccount] = useState('');
  const [bank_id, setBankId] = useState('');          // selector simple de momento
  const [beneficiary_name, setBenefName] = useState('');
  const [beneficiary_id, setBenefId] = useState('');
  const [sameAs, setSameAs] = useState(false);
  const [assacode, setAssa] = useState('');
  const [defaultpercent, setDefaultPercent] = useState<number | ''>('');
  const [plain_password, setPassword] = useState(''); // contraseña elegida

  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleSameAs(v: boolean) {
    setSameAs(v);
    if (v) setBenefId(brokerid || '');
  }

  async function send() {
    setBusy(true); setMsg(null); setErr(null);
    try {
      const payload = {
        name, email, brokerid, phone,
        birthdate: birthdate || null,
        licenseno: licenseno || null,
        bank_account_no: bank_account_no || null,
        bank_id: bank_id || null,
        beneficiary_name: beneficiary_name || null,
        beneficiary_id: beneficiary_id || null,
        assacode: assacode || null,
        defaultpercent: defaultpercent === '' ? null : Number(defaultpercent),
        plain_password
      };

      const r = await fetch('/api/signup-request', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo enviar');

      setMsg('Solicitud enviada. Te contactaremos pronto.');
      // Limpia
      setName(''); setBrokerId(''); setEmail(''); setPhone('');
      setBirthdate(''); setLicense(''); setBankAccount(''); setBankId('');
      setBenefName(''); setBenefId(''); setSameAs(false); setAssa('');
      setDefaultPercent(''); setPassword('');
    } catch (e:any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2>Solicitud de nuevo usuario</h2>
        <p className="help">Completa tus datos. Un administrador aprobará tu acceso.</p>

        <div className="grid">
          <div className="col">
            <label>Nombre completo</label>
            <input value={name} onChange={e=>setName(e.target.value)} required />
          </div>
          <div className="col">
            <label>Cédula / Pasaporte</label>
            <input value={brokerid} onChange={e=>{ setBrokerId(e.target.value); if (sameAs) setBenefId(e.target.value); }} required />
          </div>
          <div className="col">
            <label>Correo</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div className="col">
            <label>Celular</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} required />
          </div>
        </div>

        <div className="grid">
          <div className="col">
            <label>Fecha de nacimiento</label>
            <input type="date" value={birthdate} onChange={e=>setBirthdate(e.target.value)} />
          </div>
          <div className="col">
            <label>Licencia de corredor</label>
            <input placeholder="si no tiene dejar en blanco" value={licenseno} onChange={e=>setLicense(e.target.value)} />
          </div>
          <div className="col">
            <label>Número de cuenta</label>
            <input value={bank_account_no} onChange={e=>setBankAccount(e.target.value)} />
          </div>
          <div className="col">
            <label>Banco</label>
            <input placeholder="Nombre o código del banco" value={bank_id} onChange={e=>setBankId(e.target.value)} />
          </div>
        </div>

        <div className="grid">
          <div className="col">
            <label>Dueño de la cuenta</label>
            <input value={beneficiary_name} onChange={e=>setBenefName(e.target.value)} />
          </div>
          <div className="col">
            <label>Cédula del dueño de la cuenta</label>
            <div className="row">
              <input value={beneficiary_id} onChange={e=>setBenefId(e.target.value)} />
              <label className="same">
                <input type="checkbox" checked={sameAs} onChange={e=>toggleSameAs(e.target.checked)} />
                el mismo
              </label>
            </div>
          </div>
          <div className="col">
            <label>Código ASSA</label>
            <input value={assacode} onChange={e=>setAssa(e.target.value)} />
          </div>
          <div className="col">
            <label>% por defecto</label>
            <input type="number" step="0.01" value={defaultpercent} onChange={e=>setDefaultPercent(e.target.value === '' ? '' : Number(e.target.value))} />
          </div>
        </div>

        <div className="grid">
          <div className="col">
            <label>Contraseña</label>
            <input type="password" value={plain_password} onChange={e=>setPassword(e.target.value)} required />
          </div>
        </div>

        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}

        <button onClick={send} disabled={busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
      </div>

      <style jsx>{`
        .wrap { min-height:100vh; display:grid; place-items:center; background:${UI.bg}; padding:24px; }
        .card { width:920px; max-width:95vw; background:${UI.white}; border-radius:18px; box-shadow:0 6px 18px rgba(0,0,0,.06); padding:24px; }
        h2 { color:${UI.olive}; margin:0 0 6px; }
        .help { color:${UI.gray}; margin:0 0 16px; }
        .grid { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; margin-bottom:8px; }
        @media (max-width:720px){ .grid{ grid-template-columns:1fr; } }
        .col label { display:block; font-size:13px; color:${UI.gray}; margin-bottom:6px; }
        input, textarea { width:100%; padding:10px 12px; border-radius:10px; border:1px solid #ddd; }
        .row { display:flex; align-items:center; gap:10px; }
        .same { display:flex; align-items:center; gap:6px; font-size:13px; color:${UI.gray}; user-select:none; }
        .err { margin-top:10px; color:#a00; }
        .ok  { margin-top:10px; color:#0a3; }
        button { width:100%; margin-top:14px; padding:12px 14px; border:none; border-radius:10px; background:${UI.blue}; color:#fff; font-weight:700; }
      `}</style>
    </div>
  );
}
