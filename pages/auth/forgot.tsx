import React, { useMemo, useState } from 'react';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const valid = useMemo(() => isEmail(email), [email]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setErr(null);
    if (!valid) { setErr('Ingresa un correo válido.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'No se pudo enviar el enlace');
      }
      setMsg('Te enviamos un enlace para restablecer tu contraseña. Revisa tu correo (spam/lotes).');
    } catch (e: any) {
      setErr(e?.message || 'Error enviando el enlace');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card" role="form" aria-labelledby="title">
        <h2 id="title" style={{ color: '#6a8a10', marginTop: 0 }}>Recuperar contraseña</h2>
        <p>Ingresa tu correo y recibirás un enlace para restablecer tu contraseña.</p>

        <form onSubmit={onSubmit} className="form-grid" noValidate>
          <input
            className="full"
            type="email"
            placeholder="correo@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!err && !valid}
            aria-describedby={err ? 'email-err' : undefined}
            required
          />
          {err && <div id="email-err" className="err full">{err}</div>}
          {msg && <div className="ok full">{msg}</div>}

          <button className="btn full" type="submit" disabled={!valid || loading}>
            {loading ? 'Enviando…' : 'Enviar enlace'}
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
.login-card { position:relative; max-width:640px; margin:40px auto; background:#fff; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.15); padding:24px; }
.form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.full { grid-column:1 / -1; }
input { width:100%; padding:12px 14px; border:1px solid #ddd; border-radius:8px; font-size:14px; }
input[aria-invalid="true"] { border-color:#c0392b; outline:0; }
.btn { background:#0e1039; color:#fff; border:none; padding:12px 16px; border-radius:8px; font-weight:700; cursor:pointer; }
.btn:disabled { opacity:.7; cursor:not-allowed; }
.err { color:#b00; font-size:13px; }
.ok { color:#0a6; font-size:13px; }
@media (max-width:720px){ .form-grid{ grid-template-columns:1fr; } .login-card{ margin:16px; } }
`;

