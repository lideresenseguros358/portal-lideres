import React, { useMemo, useState } from 'react';

type Form = {
  name: string;
  brokerId: string;           // cédula/pasaporte
  email: string;
  phone: string;
  birthDate: string;          // yyyy-mm-dd
  licenseNo: string;          // opcional
  bank_id: string;
  bank_account_no: string;
  beneficiary_name: string;
  beneficiary_id: string;
  assaCode: string;
  defaultPercent: string;     // número
  plain_password: string;     // decide su contraseña
};

const initial: Form = {
  name: '', brokerId: '', email: '', phone: '',
  birthDate: '', licenseNo: '', bank_id: '', bank_account_no: '',
  beneficiary_name: '', beneficiary_id: '', assaCode: '', defaultPercent: '',
  plain_password: '',
};

// ---------- helpers ----------
function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }
function maskId(v: string) { // deja dígitos y - . /
  return v.replace(/[^0-9A-Za-z\-./]/g, '').slice(0, 25);
}
function maskPhone(v: string) { // dígitos + separadores, salida 0000-0000 o 6000-0000-00 si es más largo
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 8) return d.replace(/(\d{4})(\d{0,4})/, (_, a, b) => b ? `${a}-${b}` : a);
  return d.replace(/(\d{4})(\d{4})(\d{0,3})/, (_, a, b, c) => c ? `${a}-${b}-${c}` : `${a}-${b}`);
}
function pctOk(v: string) { const n = Number(v); return !isNaN(n) && n >= 0 && n <= 100; }

// fuerza de contraseña simple (0-4)
function pwScore(v: string) {
  let s = 0;
  if (v.length >= 8) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[a-z]/.test(v)) s++;
  if (/\d/.test(v) || /[^A-Za-z0-9]/.test(v)) s++;
  return s;
}
function pwValid(v: string) { return pwScore(v) >= 3; }

export default function SignupRequestPage() {
  const [f, setF] = useState<Form>(initial);
  const [sameId, setSameId] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setF((s) => ({ ...s, [k]: v }));
  }

  function onSameToggle(checked: boolean) {
    setSameId(checked);
    if (checked) set('beneficiary_id', f.brokerId);
  }

  const score = pwScore(f.plain_password);
  const formValid = useMemo(() => {
    return (
      f.name.trim().length > 2 &&
      f.brokerId.trim().length >= 5 &&
      isEmail(f.email) &&
      f.phone.replace(/\D/g, '').length >= 8 &&
      !!f.birthDate &&
      f.bank_id.trim().length >= 2 &&
      f.bank_account_no.trim().length >= 6 &&
      f.beneficiary_name.trim().length >= 2 &&
      f.beneficiary_id.trim().length >= 5 &&
      (f.defaultPercent === '' || pctOk(f.defaultPercent)) &&
      pwValid(f.plain_password)
    );
  }, [f]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (!formValid) { setErr('Revisa los campos resaltados.'); return; }
    setLoading(true);
    try {
      const payload = { ...f, defaultPercent: f.defaultPercent ? String(Number(f.defaultPercent) || 0) : '' };
      const res = await fetch('/api/signup-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || 'No se pudo enviar la solicitud');
      }
      setMsg('Solicitud enviada. Un administrador aprobará tu acceso.');
      setF(initial); setSameId(false);
    } catch (e: any) {
      setErr(e?.message || 'Error enviando la solicitud');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" role="form" aria-labelledby="title">
        <h2 id="title" style={{ color:'#6a8a10', marginTop:0 }}>Solicitud de nuevo usuario</h2>
        <p>Completa tus datos. Un administrador aprobará tu acceso.</p>

        <form onSubmit={onSubmit} className="form-grid" noValidate>
          {/* Orden: nombre, cédula, correo, celular */}
          <input
            className="full"
            placeholder="Nombre completo"
            value={f.name}
            onChange={e => set('name', e.target.value)}
            aria-invalid={f.name.trim().length > 0 && f.name.trim().length <= 2}
            required
          />
          <input
            placeholder="Cédula / Pasaporte"
            value={f.brokerId}
            onChange={e => { const v = maskId(e.target.value); set('brokerId', v); if (sameId) set('beneficiary_id', v); }}
            aria-invalid={f.brokerId !== '' && f.brokerId.trim().length < 5}
            required
          />
          <input
            type="email"
            placeholder="Correo"
            value={f.email}
            onChange={e => set('email', e.target.value)}
            aria-invalid={f.email !== '' && !isEmail(f.email)}
            required
          />
          <input
            placeholder="Celular"
            value={f.phone}
            onChange={e => set('phone', maskPhone(e.target.value))}
            aria-invalid={f.phone !== '' && f.phone.replace(/\D/g, '').length < 8}
            required
          />

          {/* separador visual */}
          <div className="hint full" />

          <div className="label">Fecha de nacimiento</div>
          <div className="label">Licencia de corredor <span className="muted">(si no tiene dejar en blanco)</span></div>
          <input
            type="date"
            value={f.birthDate}
            onChange={e => set('birthDate', e.target.value)}
            aria-invalid={f.birthDate === ''}
            required
          />
          <input
            placeholder="Licencia de corredor"
            value={f.licenseNo}
            onChange={e => set('licenseNo', e.target.value)}
          />

          <div className="label">Banco</div>
          <div className="label">Número de cuenta</div>
          <input
            placeholder="Nombre o código del banco"
            value={f.bank_id}
            onChange={e => set('bank_id', e.target.value)}
            aria-invalid={f.bank_id !== '' && f.bank_id.trim().length < 2}
            required
          />
          <input
            placeholder="Número de cuenta"
            value={f.bank_account_no}
            onChange={e => set('bank_account_no', e.target.value.replace(/[^\d\- ]/g, '').slice(0, 24))}
            aria-invalid={f.bank_account_no !== '' && f.bank_account_no.trim().length < 6}
            required
          />

          <div className="label">Dueño de la cuenta</div>
          <div className="label">
            Cédula del dueño de la cuenta{' '}
            <label className="chk">
              <input
                type="checkbox"
                checked={sameId}
                onChange={e => onSameToggle(e.target.checked)}
              />
              <span>el mismo</span>
            </label>
          </div>
          <input
            placeholder="Nombre del dueño de la cuenta"
            value={f.beneficiary_name}
            onChange={e => set('beneficiary_name', e.target.value)}
            aria-invalid={f.beneficiary_name !== '' && f.beneficiary_name.trim().length < 2}
            required
          />
          <input
            placeholder="Cédula del dueño"
            value={f.beneficiary_id}
            onChange={e => set('beneficiary_id', maskId(e.target.value))}
            aria-invalid={f.beneficiary_id !== '' && f.beneficiary_id.trim().length < 5}
            required
          />

          <div className="label">Código ASSA</div>
          <div className="label">% por defecto</div>
          <input
            placeholder="Código ASSA"
            value={f.assaCode}
            onChange={e => set('assaCode', e.target.value.replace(/[^0-9A-Za-z\-]/g, '').slice(0, 16))}
          />
          <input
            type="number"
            step="0.01"
            placeholder="0"
            value={f.defaultPercent}
            onChange={e => set('defaultPercent', e.target.value)}
            aria-invalid={f.defaultPercent !== '' && !pctOk(f.defaultPercent)}
          />

          {/* contraseña con medidor */}
          <div className="full">
            <input
              type="password"
              placeholder="Contraseña"
              value={f.plain_password}
              onChange={e => set('plain_password', e.target.value)}
              aria-invalid={f.plain_password !== '' && !pwValid(f.plain_password)}
              required
              style={{ width:'100%', padding:'12px 14px', border:'1px solid #ddd', borderRadius:8, fontSize:14 }}
            />
            <div className="meter" aria-hidden>
              <div className={`meter-bar s${score}`} />
            </div>
            <ul className="reqs">
              <li className={f.plain_password.length >= 8 ? 'ok' : ''}>Mínimo 8 caracteres</li>
              <li className={/[A-Z]/.test(f.plain_password) ? 'ok' : ''}>Una mayúscula</li>
              <li className={/[a-z]/.test(f.plain_password) ? 'ok' : ''}>Una minúscula</li>
              <li className={/\d/.test(f.plain_password) || /[^A-Za-z0-9]/.test(f.plain_password) ? 'ok' : ''}>
                Un número o símbolo
              </li>
            </ul>
          </div>

          {err && <div className="err full">{err}</div>}
          {msg && <div className="ok full">{msg}</div>}

          <button className="btn full" type="submit" disabled={!formValid || loading}>
            {loading ? 'Enviando…' : 'Enviar solicitud'}
          </button>
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
.login-wrap { min-height: 100%; background:url('/fondo_login.webp') center/cover no-repeat fixed; position:relative; }
.login-wrap::before { content:''; position:absolute; inset:0; background:rgba(0,0,0,.35); }
`;

const cardCss = `
.login-card { position:relative; max-width:920px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); padding:24px; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.full { grid-column:1 / -1; }
.label { color:#333; font-weight:700; font-size:14px; align-self:end; }
.muted { color:#888; font-weight:400; }
.hint { height:4px; }
.chk { display:inline-flex; align-items:center; gap:6px; font-weight:400; color:#333; margin-left:6px; }
input, select { width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; box-sizing:border-box; }
input[aria-invalid="true"], select[aria-invalid="true"] { border-color:#c0392b; }
.btn { background:#0e1039; color:#fff; border:none; padding:12px 16px; border-radius:8px; font-weight:700; cursor:pointer; }
.btn:disabled { opacity:.7; cursor:not-allowed; }
.err { color:#b00; font-size:13px; }
.ok { color:#0a6; font-size:13px; }

/* medidor */
.meter { height:6px; background:#eee; border-radius:6px; margin-top:8px; overflow:hidden; }
.meter-bar { height:100%; width:0%; transition:width .2s; background:#c0392b; }
.meter-bar.s1 { width:25%; }
.meter-bar.s2 { width:50%; background:#e67e22; }
.meter-bar.s3 { width:75%; background:#f1c40f; }
.meter-bar.s4 { width:100%; background:#27ae60; }
.reqs { list-style:disc; padding-left:20px; margin:8px 0 0; color:#666; font-size:12px; }
.reqs li.ok { color:#27ae60; }

@media (max-width:960px){ .login-card{ margin:16px; } }
@media (max-width:720px){ .form-grid{ grid-template-columns:1fr; } }
`;
