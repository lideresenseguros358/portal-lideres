// /pages/app/master/solicitudes.tsx
import React, { useEffect, useState } from 'react';

const UI = { white:'#fff', blue:'#010139', olive:'#8aaa19', bg:'#e6e6e6', gray:'#8b8b8b' };

type Req = {
  id: string;
  name: string;
  email: string;
  brokerid: string;
  phone: string;
  created_at: string;
};

export default function SolicitudesMaster() {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/admin/requests');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error cargando');
      setItems(j.data || []);
    } catch(e:any){ setErr(e.message); } finally { setLoading(false); }
  }

  async function decide(id: string, action: 'approve'|'reject') {
    const r = await fetch(`/api/admin/requests/${action}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request_id: id })
    });
    const j = await r.json();
    if (!r.ok) { alert(j.error || 'Error'); return; }
    load();
  }

  useEffect(()=>{ load(); }, []);

  return (
    <div className="wrap">
      <div className="card">
        <h2>Solicitudes de nuevos usuarios</h2>
        {err && <div className="err">{err}</div>}
        {loading && <p>Cargando...</p>}
        {!loading && items.length === 0 && <p>No hay solicitudes pendientes.</p>}

        {items.map(x=>(
          <div key={x.id} className="row">
            <div className="info">
              <strong>{x.name}</strong> <span>{x.email}</span><br/>
              <small>Cédula: {x.brokerid} · Cel: {x.phone}</small>
            </div>
            <div className="actions">
              <button className="ok" onClick={()=>decide(x.id,'approve')}>Aprobar</button>
              <button className="no" onClick={()=>decide(x.id,'reject')}>Rechazar</button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .wrap { min-height:100vh; display:grid; place-items:center; background:${UI.bg}; padding:24px; }
        .card { width:920px; max-width:95vw; background:${UI.white}; border-radius:18px; box-shadow:0 6px 18px rgba(0,0,0,.06); padding:24px; }
        h2 { color:${UI.olive}; margin:0 0 16px; }
        .row { display:flex; justify-content:space-between; align-items:center; padding:12px 0; border-bottom:1px solid #eee; }
        .info span { color:${UI.gray}; margin-left:6px; }
        .info small { color:${UI.gray}; }
        .actions button { margin-left:8px; padding:8px 12px; border:none; border-radius:8px; color:#fff; font-weight:700; }
        .actions .ok { background:${UI.blue}; }
        .actions .no { background:#b11; }
        .err { color:#a00; margin-bottom:12px; }
      `}</style>
    </div>
  );
}
