// /pages/app/broker/commissions.tsx
import React, { useEffect, useState } from 'react';
const C = { blue:'#010139', olive:'#8aaa19', bg:'#e6e6e6', white:'#fff' };

type Batch = { id:string; label:string; total:number; created_at:string };
type Pending = { id:string; insurer:string; policy:string; amount:number; };

export default function BrokerCommissions(){
  const [history, setHistory] = useState<Batch[]>([]);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const email = typeof window !== 'undefined' ? localStorage.getItem('portal_email') || '' : '';

  async function load(){
    const [h, p] = await Promise.all([
      fetch('/api/commissions/history', { headers:{'x-email': email}}).then(r=>r.json()),
      fetch('/api/commissions/pendings', { headers:{'x-email': email}}).then(r=>r.json())
    ]);
    if (h.ok) setHistory(h.items||[]);
    if (p.ok) setPendings(p.items||[]);
  }

  async function markMine(id:string){
    const r = await fetch('/api/commissions/pendings/mine', {
      method:'POST', headers:{'content-type':'application/json','x-email':email},
      body: JSON.stringify({ id })
    });
    const j = await r.json(); if (!r.ok) return alert(j.error||'Error'); load();
  }

  useEffect(()=>{ load(); }, []);

  return (
    <div className="wrap">
      <div className="card">
        <h2>Mis Comisiones</h2>

        <section className="block">
          <h3>Quincenas</h3>
          <table className="tbl">
            <thead><tr><th>Quincena</th><th>Total</th><th></th></tr></thead>
            <tbody>{history.map(b=>(
              <tr key={b.id}>
                <td>{b.label}</td>
                <td><b>B/. {b.total.toFixed(2)}</b></td>
                <td><a className="btn" href={`/api/commissions/receipt.pdf?batch=${b.id}`}>Descargar PDF</a></td>
              </tr>
            ))}</tbody>
          </table>
        </section>

        <section className="block">
          <h3>Pendientes de identificar</h3>
          <table className="tbl">
            <thead><tr><th>Aseguradora</th><th>Póliza</th><th>Monto</th><th></th></tr></thead>
            <tbody>{pendings.map(p=>(
              <tr key={p.id}>
                <td>{p.insurer}</td><td>{p.policy}</td><td>B/. {p.amount.toFixed(2)}</td>
                <td><button className="btn" onClick={()=>markMine(p.id)}>Marcar “mío”</button></td>
              </tr>
            ))}</tbody>
          </table>
        </section>
      </div>

      <style jsx>{`
        .wrap{ min-height:100vh; background:${C.bg}; padding:16px; display:grid; place-items:start; }
        .card{ width:100%; max-width:1020px; background:${C.white}; border-radius:16px; box-shadow:0 6px 18px rgba(0,0,0,.06); padding:16px;}
        h2{ color:${C.olive}; }
        .tbl{ width:100%; border-collapse:separate; border-spacing:0 6px; }
        .tbl th, .tbl td{ background:#fff; padding:10px; }
        .btn{ background:${C.blue}; color:#fff; border:none; border-radius:8px; padding:8px 12px; text-decoration:none; }
        .block{ margin-top:16px; }
      `}</style>
    </div>
  );
}
