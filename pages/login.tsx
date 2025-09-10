// /pages/login.tsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { gsLogin } from '@/lib/gsheets';

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [err, setErr] = useState<string>('');

  async function doLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await gsLogin(email.trim(), password.trim());
      if (!data.ok) throw new Error(data.error);

      // Guardar sesión local
      if (typeof window !== 'undefined') {
        localStorage.setItem('portal_session', data.sessionId);
        localStorage.setItem('portal_role', data.role);
        localStorage.setItem('portal_email', data.brokerEmail);
      }

      // Redirigir por rol
      const role = data.role.toLowerCase();
      if (role === 'master') r.push('/app/master');
      else if (role === 'broker') r.push('/app/broker');
      else r.push('/app'); // fallback
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar sesión';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '10vh auto', padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 8 }}>Portal Virtual</h2>
      <p style={{ textAlign: 'center', marginTop: 0, color: '#666' }}>Introduce usuario y contraseña</p>

      <form onSubmit={doLogin}>
        <label>Usuario</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          type="email"
          placeholder="email@dominio.com"
          required
          style={{ width: '100%', padding: 12, margin: '6px 0 12px', borderRadius: 8, border: '1px solid #ddd' }}
        />

        <label>Contraseña</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          type="password"
          required
          style={{ width: '100%', padding: 12, margin: '6px 0 16px', borderRadius: 8, border: '1px solid #ddd' }}
        />

        {err && <div style={{ color: '#b00020', marginBottom: 12 }}>{err}</div>}

        <button
          disabled={busy}
          type="submit"
          style={{ width: '100%', padding: 12, borderRadius: 8, background: '#111827', color: '#fff', border: 0, cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          {busy ? 'Iniciando…' : 'Iniciar sesión'}
        </button>
      </form>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 14 }}>
        <a href="/nuevo-usuario">¿Nuevo usuario?</a>
        <a href="/olvide-password">Olvidé mi contraseña</a>
      </div>
    </main>
  );
}
