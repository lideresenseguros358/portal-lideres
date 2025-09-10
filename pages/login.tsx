import { useState } from 'react';
import { useRouter } from 'next/router';
import { gsLogin } from '.../lib/gsheets';

export default function Login(){
  const r = useRouter();
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [err,setErr] = useState('');

  return (
    <main style={{maxWidth:420, margin:'10vh auto', padding:24, borderRadius:12, boxShadow:'0 6px 24px rgba(0,0,0,.08)', background:'#fff'}}>
      <h2 style={{textAlign:'center', marginBottom:8}}>Portal Virtual</h2>
      <p style={{textAlign:'center', marginTop:0, color:'#666'}}>Introduce el usuario y contraseña</p>

      <label>Usuario</label>
      <input
        value={email}
        onChange={e=>setEmail(e.target.value)}
        placeholder="correo@dominio.com"
        style={{width:'100%', padding:'10px 12px', marginBottom:12}}
      />

      <label>Contraseña</label>
      <input
        type="password"
        value={password}
        onChange={e=>setPassword(e.target.value)}
        placeholder="••••••••"
        style={{width:'100%', padding:'10px 12px', marginBottom:12}}
      />

      {!!err && <div style={{color:'#b00020', marginBottom:12}}>{err}</div>}

      <button
        onClick={async ()=>{
          try{
            setErr('');
            const res = await gsLogin(email.trim(), password);
            // éxito → /app (router por rol)
            r.push('/app');
          }catch(e:any){
            setErr(e.message || 'Error al iniciar sesión');
          }
        }}
        style={{width:'100%', padding:'12px', background:'#010139', color:'#fff', border:0, borderRadius:8, cursor:'pointer'}}
      >
        Iniciar sesión
      </button>

      <div style={{display:'flex', justifyContent:'space-between', marginTop:12}}>
        <a href="/nuevo-usuario" style={{fontSize:14}}>¿Nuevo usuario?</a>
        <a href="/olvide-password" style={{fontSize:14}}>Olvidé mi contraseña</a>
      </div>
    </main>
  );
}
