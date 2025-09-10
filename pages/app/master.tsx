// /pages/app/master.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Master() {
  const r = useRouter();

  useEffect(() => {
    const role = (typeof window !== 'undefined' ? localStorage.getItem('portal_role') : '') || '';
    if (role.toLowerCase() !== 'master') r.replace('/login');
  }, [r]);

  function logout() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('portal_session');
      localStorage.removeItem('portal_role');
      localStorage.removeItem('portal_email');
    }
    r.push('/login');
  }

  const email = typeof window !== 'undefined' ? localStorage.getItem('portal_email') : '';

  return (
    <main style={{ maxWidth: 1000, margin: '6vh auto', padding: 24 }}>
      <h2>Dashboard Master</h2>
      <p>Usuario: {email}</p>
      <button onClick={logout}>Cerrar sesión</button>
      <hr />
      <p>(Aquí irán KPIs, importadores, reportes, etc.)</p>
    </main>
  );
}
