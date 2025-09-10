import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const r = useRouter();
  useEffect(() => { r.replace('/login'); }, [r]);
  return <p style={{textAlign:'center',marginTop:40}}>Redirigiendo a /login…</p>;
}
