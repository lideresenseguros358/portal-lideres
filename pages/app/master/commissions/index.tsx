// /pages/app/master/commissions/index.tsx
import React, { useEffect, useState } from 'react';

const C = { blue:'#010139', olive:'#8aaa19', bg:'#e6e6e6', gray:'#888', white:'#fff' };

type Pending = { id:string; insurer:string; policy:string; broker_email?:string; amount:number; note?:string; };
type Advance = { id:string; broker_email:string; concept:string; amount:number; totalDiscount:number; saldo:number; created_at:string; };
type TotalsInsurer = { insurer:string; bruto:number; oficina:number; };
type RowBroker = { broker:string; subtotal:number; adelantos:number; descuentos:number; neto:number; };

export default function MasterCommissions() {
  const [totals, setTotals] = useState<TotalsInsurer[]>([]);
  const [perBroker, setPerBroker] = useState<RowBroker[]>([]);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string| null>(null);
  const [err, setErr] = useState<string| null>(null);

  async function load() {
    setBusy(true); setErr(null);
    try {
      const [t, b, p, a] = await Promise.all([
        fetch('/api/commissions/totals').then(r=>r.json()),
        fetch('/api/commissions/by-broker').then(r=>r.json()),
        fetch('/api/commissions/pendings').then(r=>r.json()),
        fetch('/api/advances').then(r=>r.json()),
      ]);
      if (!t.ok) throw new Error(t.error); if (!b.ok) throw new Error(b.error);
      if (!p.ok) throw new Error(p.error); if (!a.ok) throw new Error(a.error);
      setTotals(t.items || []); setPerBroker(b.items || []); setPendings(p.items || []); setAdvances(a.items || []);
    } catch(e:any){ setErr(e.message); } finally { setBusy(false); }
  }

  async function uploadInsurer(e: React.ChangeEvent<HTMLInputElement>, insurerCode: string) {
    const f = e.target.files?.[0]; if (!f) return;
    const form = new FormData(); form.append('file', f); form.append('insurer', insurerCode);
    const r = await fetch('/api/import/insurer', { method:'POST', body: form });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || 'Error'); return; }
    setMsg(`Importado ${insurerCode}`); load();
  }

  async function closeFortnight() {
    if (!confirm('¿Cerrar y pagar quincena?')) return;
    const r = await fetch('/api/fortnights/close', { method:'POST' });
    const j = await r.json();
    if (!r.ok) { setErr(j.error || 'Error'); return; }
    setMsg('Quincena cerrada y pagada.'); load();
  }

  useEffect(()=>{ load(); }, []);

  return (
    <div className="wrap">
      <div className="card">
        <h2>Comisiones — Quincena en curso</h2>
        {busy && <p>Cargando…</p>}
        {err && <div className="err">{err}</div>}
        {msg && <div className="ok">{msg}</div>}

        {/* Importadores por aseguradora */}
        <section className="block">
          <h3>Importar reportes</h3>
          <div className="grid4">
            {['ASSA','PMA','MAPFRE','ACIERTA'].map(code=>(
              <label key={code} className="uploader">
                <span>{code}</span>
                <input type="file" accept=".xlsx,.csv,.pdf,.jpg,.png" onChange={e=>uploadInsurer(e, code)} />
              </label>
            ))}
          </div>
          <small className="hint">Acepta XLSX/CSV/PDF/JPG/PNG con lectura inteligente.</small>
        </section>

        {/* Totales por aseguradora */}
        <section className="block">
          <h3>Totales por aseguradora</h3>
          <table className="tbl">
            <thead><tr><th>Aseguradora</th><th>Monto bruto</th><th>Total oficina</th></tr></thead>
            <tbody>{totals.map(t=>(
              <tr key={t.insurer}><td>{t.insurer}</td><td>B/. {t.bruto.toFixed(2)}</td><td>B/. {t.oficina.toFixed(2)}</td></tr>
            ))}</tbody>
          </table>
        </section>

        {/* Pendientes de identificar */}
        <section className="block">
          <h3>Pendientes de identificar</h3>
          <table className="tbl">
            <thead><tr><th>Aseguradora</th><th>Póliza</th><th>Monto</th><th>Marcados “mío”</th><th></th></tr></thead>
            <tbody>{pendings.map(p=>(
              <tr key={p.id}><td>{p.insurer}</td><td>{p.policy}</td><td>B/. {p.amount.toFixed(2)}</td><td>{p.broker_email || '-'}</td>
                <td><button onClick={()=>location.href=`/app/master?tab=pendings&id=${p.id}`}>Resolver</button></td></tr>
            ))}</tbody>
          </table>
        </section>

        {/* Adelantos y saldos */}
        <section className="block">
          <h3>Adelantos y saldos</h3>
          <table className="tbl">
            <thead><tr><th>Broker</th><th>Concepto</th><th>Monto</th><th>Descontado</th><th>Saldo</th><th>Creado</th></tr></thead>
            <tbody>{advances.map(a=>(
              <tr key={a.id}><td>{a.broker_email}</td><td>{a.concept}</td><td>B/. {a.amount.toFixed(2)}</td>
              <td>B/. {a.totalDiscount.toFixed(2)}</td><td>B/. {a.saldo.toFixed(2)}</td><td>{new Date(a.created_at).toLocaleDateString()}</td></tr>
            ))}</tbody>
          </table>
          <div className="actions">
            <a className="btn" href="/app/master/advances">Ingresar adelanto</a>
          </div>
        </section>

        {/* Consolidado por corredor */}
        <section className="block">
          <h3>Consolidado por corredor (neto)</h3>
          <table className="tbl">
            <thead><tr><th>Corredor</th><th>Subtotal</th><th>Adelantos</th><th>Descuentos</th><th>Pago</th></tr></thead>
            <tbody>{perBroker.map(r=>(
              <tr key={r.broker}><td>{r.broker}</td>
                <td>B/. {r.subtotal.toFixed(2)}</td>
                <td>- B/. {r.adelantos.toFixed(2)}</td>
                <td>- B/. {r.descuentos.toFixed(2)}</td>
                <td><b>B/. {r.neto.toFixed(2)}</b></td>
              </tr>
            ))}</tbody>
          </table>
        </section>

        <div className="footer">
          <button className="danger" onClick={closeFortnight}>Pagar / Cerrar quincena</button>
          <a className="btn" href="/api/exports/banco-general">Descargar TXT Banco General</a>
          <a className="btn" href="/api/exports/summary.pdf">Descargar reporte PDF</a>
          <a className="btn" href="/api/exports/summary.xlsx">Descargar Excel</a>
        </div>
      </div>

      <style jsx>{`
        .wrap{ min-height:100vh; background:${C.bg}; padding:16px; display:grid; place-items:start; }
        .card{ width:100%; max-width:1140px; margin:0 auto; background:${C.white}; border-radius:16px; box-shadow:0 6px 18px rgba(0,0,0,.06); padding:16px; }
        h2{ color:${C.olive}; margin:0 0 16px; }
        .block{ margin-top:16px; }
        .grid4{ display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        @media (max-width:900px){ .grid4{ grid-template-columns:repeat(2,1fr);} }
        @media (max-width:520px){ .grid4{ grid-template-columns:1fr;} }
        .uploader{ display:grid; place-items:center; border:1px dashed #ccc; border-radius:10px; padding:16px; cursor:pointer; }
        .uploader input{ display:none; }
        .hint{ color:${C.gray}; }
        .tbl{ width:100%; border-collapse:separate; border-spacing:0 6px; }
        .tbl th, .tbl td { background:#fff; padding:8px 10px; }
        .actions{ margin-top:8px; }
        .btn{ display:inline-block; margin-right:8px; background:${C.blue}; color:#fff; padding:8px 12px; border-radius:8px; text-decoration:none; }
        .danger{ background:#b11; color:#fff; padding:10px 14px; border:none; border-radius:10px; }
        .footer{ display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; }
        .err{ color:#a00; }
        .ok{ color:#0a3; }
      `}</style>
    </div>
  );
}
