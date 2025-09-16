import React, { useEffect, useState } from 'react';

const C = { bg:'#e6e6e6', white:'#fff', olive:'#8aaa19', blue:'#010139' };

type ClientRow = {
  id: string;
  client_name: string;
  policy: string;
  insurer: string;
  created_at?: string;
};

type ApiList = { ok: true; items: ClientRow[]; total: number } | { ok: false; error: string };

export default function BrokerClients(){
  const email = typeof window!=='undefined' ? (localStorage.getItem('portal_email') || '') : '';
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string| null>(null);

  async function load(p = page, query = q){
    setBusy(true); setErr(null);
    try{
      const url = `/api/clients?me=1&q=${encodeURIComponent(query)}&page=${p}&pageSize=${pageSize}`;
      const r = await fetch(url, { headers:{ 'x-email': email }});
      const j = (await r.json()) as ApiList;
      if (!r.ok || !('ok' in j) || !j.ok) throw new Error((j as any).error || r.statusText);
      setRows(j.items); setTotal(j.total); setPage(p);
    }catch(e:any){ setErr(e.message); }
    finally{ setBusy(false); }
  }

  useEffect(()=>{ load(1, q); }, []);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIdx = (page-1)*pageSize + 1;
  const endIdx = Math.min(total, page*pageSize);
  const qs = `q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}&me=1`;

  return (
    <div className="wrap">
      <div className="card">
        <h2>Mis clientes</h2>

        <div className="top">
          <input
            placeholder="Buscar por cliente o póliza…"
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyDown={e=> (e.key==='Enter') && load(1, q)}
          />
          <button onClick={()=>load(1, q)}>Buscar</button>
          <div className="spacer" />
          <a className="btn" href={`/api/exports/clients.csv?${qs}`}>CSV</a>
          <a className="btn" href={`/api/exports/clients.xlsx?${qs}`}>XLSX</a>
          <a className="btn" href={`/api/exports/clients.pdf?${qs}`}>PDF</a>
        </div>

        {busy && <p>Cargando…</p>}
        {err && <div className="err">{err}</div>}

        <table className="tbl">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Póliza</th>
              <th>Aseguradora</th>
              <th>Creado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=>(
              <tr key={r.id}>
                <td>{r.client_name}</td>
                <td>{r.policy}</td>
                <td>{r.insurer}</td>
                <td>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</td>
              </tr>
            ))}
            {!busy && rows.length===0 && <tr><td colSpan={4} style={{textAlign:'center', color:'#666'}}>Sin resultados</td></tr>}
          </tbody>
        </table>

        <div className="pager">
          <span>{startIdx}-{endIdx} de {total}</span>
          <div className="pgbtns">
            <button disabled={page<=1} onClick={()=>load(page-1, q)}>‹ Anterior</button>
            <span>Pag {page} / {totalPages}</span>
            <button disabled={page>=totalPages} onClick={()=>load(page+1, q)}>Siguiente ›</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap{min-height:100vh;background:${C.bg};padding:16px;display:grid;place-items:start}
        .card{width:100%;max-width:1140px;background:${C.white};border-radius:16px;box-shadow:0 6px 18px rgba(0,0,0,.06);padding:16px}
        h2{color:${C.olive};margin:0 0 12px}
        .top{display:flex;gap:8px;align-items:center;margin-bottom:10px}
        .top input{flex:1;border:1px solid #ddd;border-radius:8px;padding:10px}
        .btn{background:${C.blue};color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none}
        .tbl{width:100%;border-collapse:separate;border-spacing:0 6px}
        .tbl th,.tbl td{background:#fff;padding:10px}
        .pager{display:flex;justify-content:space-between;align-items:center;margin-top:10px}
        .pgbtns{display:flex;gap:8px;align-items:center}
        .pgbtns button{padding:8px 10px}
        .err{color:#a00}
      `}</style>
    </div>
  );
}
