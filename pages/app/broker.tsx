// /pages/app/broker.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Broker() {
  const r = useRouter();

  useEffect(() => {
    const role = (typeof window !== 'undefined' ? localStorage.getItem('portal_role') : '') || '';
    if (role.toLowerCase() !== 'broker') r.replace('/login');
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
      <h2>Dashboard Broker</h2>
      <p>Usuario: {email}</p>
      <button onClick={logout}>Cerrar sesión</button>
      <hr />
      <p>(Tabla de comisiones, morosidad, producción, etc.)</p>
    </main>
  );
}
