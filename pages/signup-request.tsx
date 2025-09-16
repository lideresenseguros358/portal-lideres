import React, { useState, useMemo } from 'react';

type ReqBody = {
  fullname: string;
  doc_id: string;
  email: string;
  phone: string;
  birthdate?: string | null;
  broker_license?: string | null;
  bank?: string | null;
  bank_account_no?: string | null;
  account_owner?: string | null;
  account_owner_doc?: string | null;
  same_owner?: boolean;
  password: string;
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignupRequestPage() {
  // campos
  const [fullname, setFullname] = useState('');
  const [docId, setDocId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [license, setLicense] = useState('');
  const [bank, setBank] = useState('');
  const [acct, setAcct] = useState('');
  const [owner, setOwner] = useState('');
  const [ownerDoc, setOwnerDoc] = useState('');
  const [sameOwner, setSameOwner] = useState(false);
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // si marcan "el mismo", copiamos dueño/cedula del titular
  React.useEffect(() => {
    if (sameOwner) {
      setOwner(fullname);
      setOwnerDoc(docId);
    }
  }, [sameOwner, fullname, docId]);

  const valid = useMemo(() => {
    return (
      fullname.trim().length > 2 &&
      docId.trim().length > 2 &&
      isEmail(email) &&
      password.trim().length >= 6
    );
  }, [fullname, docId, email, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!valid) return;

    setLoading(true);
    try {
      const payload: ReqBody = {
        fullname: fullname.trim(),
        doc_id: docId.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        birthdate: birthdate || null,
        broker_license: license || null,
        bank: bank || null,
        bank_account_no: acct || null,
        account_owner: (owner || null),
        account_owner_doc: (ownerDoc || null),
        same_owner: sameOwner,
        password: password.trim(),
      };

      const res = await fetch('/api/auth/signup-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      setMsg('Solicitud enviada. Te contactaremos cuando sea aprobada.');
      // limpiar
      setFullname(''); setDocId(''); setEmail(''); setPhone('');
      setBirthdate(''); setLicense(''); setBank(''); setAcct('');
      setOwner(''); setOwnerDoc(''); setSameOwner(false); setPassword('');
    } catch (e: any) {
      setErr(e?.message ?? 'Error enviando solicitud');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="card">
        <h2 className="title">Solicitud de nuevo usuario</h2>
        <p className="sub">Completa tus datos. Un administrador aprobará tu acceso.</p>

        <form className="grid" onSubmit={onSubmit} noValidate>
          <div className="field">
            <label>Nombre completo</label>
            <input value={fullname} onChange={e => setFullname(e.target.value)} />
          </div>

          <div className="field">
            <label>Cédula / Pasaporte</label>
            <input value={docId} onChange={e => setDocId(e.target.value)} />
          </div>

          <div className="field">
            <label>Correo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} aria-invalid={email ? !isEmail(email) : undefined}/>
          </div>

          <div className="field">
            <label>Celular</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div className="field">
            <label>Fecha de nacimiento</label>
            <input type="date" value={birthdate} onChange={e => setBirthdate(e.target.value)} />
          </div>

          <div className="field">
            <label>Licencia de corredor</label>
            <input placeholder="si no tiene dejar en blanco" value={license} onChange={e => setLicense(e.target.value)} />
          </div>

          {/* Subtítulo de sección de banco */}
          <div className="section" style={{gridColumn: '1 / -1'}}>
            <h3>Cuenta bancaria para comisiones</h3>
          </div>

          <div className="field">
            <label>Número de cuenta</label>
            <input value={acct} onChange={e => setAcct(e.target.value)} />
          </div>

          <div className="field">
            <label>Banco</label>
            <input placeholder="Nombre o código del banco" value={bank} onChange={e => setBank(e.target.value)} />
          </div>

          <div className="field">
            <label>Dueño de la cuenta</label>
            <input value={owner} onChange={e => setOwner(e.target.value)} disabled={sameOwner}/>
          </div>

          <div className="field">
            <label>Cédula del dueño de la cuenta</label>
            <div className="row">
              <input value={ownerDoc} onChange={e => setOwnerDoc(e.target.value)} disabled={sameOwner}/>
              <label className="chk">
                <input type="checkbox" checked={sameOwner} onChange={e => setSameOwner(e.target.checked)} />
                <span>el mismo</span>
              </label>
            </div>
          </div>

          <div className="field" style={{gridColumn: '1 / -1'}}>
            <label>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <small>Mínimo 6 caracteres.</small>
          </div>

          {(err || msg) && (
            <div className={err ? 'alert err' : 'alert ok'} style={{gridColumn: '1 / -1'}}>
              {err ?? msg}
            </div>
          )}

          <div style={{gridColumn: '1 / -1'}}>
            <button className="btn" type="submit" disabled={!valid || loading}>
              {loading ? 'Enviando…' : 'Enviar solicitud'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{globalCss}</style>
      <style jsx>{cardCss}</style>
    </div>
  );
}

const globalCss = `
  html, body, #__next { height: 100%; }
  body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
  .wrap { min-height: 100%; background:url('/fondo_login.webp') center/cover no-repeat fixed; position:relative; }
  .wrap::before { content:''; position:absolute; inset:0; background: rgba(0,0,0,.35); }
`;

const cardCss = `
  .card {
    position: relative;
    max-width: 920px;
    margin: 48px auto;
    background:#fff;
    border-radius:12px;
    box-shadow: 0 10px 38px rgba(0,0,0,.15);
    padding:28px;
  }
  .title { margin: 0 0 4px; color:#2b2b2b; }
  .sub { margin:0 0 16px; color:#6b6b6b; }

  .grid {
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px 16px;
  }
  .field { display:flex; flex-direction:column; }
  label { color:#333; font-size:13px; margin-bottom:6px; }
  input {
    width:100%;
    padding:12px 12px;
    border: 1px solid #c9d3e0;
    border-radius: 8px;
    font-size:14px;
    outline: none;
  }
  input[aria-invalid="true"] { border-color:#e05b5b; }
  .row { display:flex; align-items:center; gap:12px; }
  .chk { display:flex; align-items:center; gap:8px; white-space:nowrap; font-size:13px; color:#4a4a4a; }
  .section h3 {
    margin: 10px 0 6px;
    font-size: 14px;
    color:#2b2b2b;
    border-top: 1px dashed #e7e7e7;
    padding-top: 12px;
  }
  .btn {
    display:inline-block;
    width:100%;
    background:#0e2139;
    color:#fff;
    border:none;
    border-radius:8px;
    padding:14px 16px;
    font-weight:700;
    cursor:pointer;
  }
  .btn:disabled { opacity:.65; cursor:not-allowed; }
  .alert { padding:10px 12px; border-radius:8px; font-size:13px; }
  .alert.ok { background:#eef9f0; color:#0c7b2d; border:1px solid #bfe7c9; }
  .alert.err { background:#fff2f2; color:#b01010; border:1px solid #f0c5c5; }

  @media (max-width: 760px) {
    .card { margin:16px; padding:20px; }
    .grid { grid-template-columns: 1fr; }
  }
`;
