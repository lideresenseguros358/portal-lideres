import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function AppRouter() {
  const r = useRouter();
  useEffect(() => {
    const role = (typeof window !== 'undefined' ? localStorage.getItem('portal_role') : '') || '';
    if (!role) { r.replace('/login'); return; }
    const to = role.toLowerCase() === 'master' ? '/app/master'
             : role.toLowerCase() === 'broker' ? '/app/broker'
             : '/login';
    r.replace(to);
  }, [r]);
  return <p style={{textAlign:'center',marginTop:40}}>Redirigiendo…</p>;
}
