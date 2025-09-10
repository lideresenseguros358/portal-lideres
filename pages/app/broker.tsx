import { useRouter } from 'next/router';

export default function Broker(){
  const r = useRouter();
  return (
    <main style={{padding:24}}>
      <h1>Dashboard Broker</h1>
      <p>Bienvenido, Broker.</p>
      <button onClick={async()=>{
        await fetch('/api/logout', { method:'POST' });
        r.push('/login');
      }}>Cerrar sesión</button>
    </main>
  );
}
