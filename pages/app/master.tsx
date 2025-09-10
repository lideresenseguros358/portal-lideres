import { useRouter } from 'next/router';

export default function Master(){
  const r = useRouter();
  return (
    <main style={{padding:24}}>
      <h1>Dashboard Master</h1>
      <p>Bienvenido, Master.</p>
      <button onClick={async()=>{
        await fetch('/api/logout', { method:'POST' });
        r.push('/login');
      }}>Cerrar sesión</button>
    </main>
  );
}
