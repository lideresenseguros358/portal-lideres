// pages/app/master/commissions/index.tsx
import React, { useEffect, useState } from 'react';
import AppLayout from '../../../components/AppLayout';
// Update this import to match the actual exports from importMaps
// Adjust this import to match the actual export from importMaps
import { INSURERS } from '../../../lib/importMaps';
// If INSURERS and InsurerKey are default or differently named exports, adjust accordingly:
type InsurerKey = typeof INSURERS[number];

type TotalsInsurer = { insurer: string; t_bruto: number; t_oficina: number };
type Pending = { id: string; insurer: string; policy: string; amount: number; broker_email?: string };
type AdvanceRow = { id: string; broker: string; concept: string; amount: number; totalDiscount: number; saldo: number; created_at: string };
type PerBroker = { id?: string; broker: string; subtotal: number; adelantos: number; descuentos: number; neto: number };

const C = {
  blue:  '#010139',
  olive: '#8aaa19',
  gray:  '#e6e6e6',
  text:  '#888',
  white: '#fff',
};

export default function MasterCommissionsPage() {
  // estado
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [totals, setTotals] = useState<TotalsInsurer[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [perBroker, setPerBroker] = useState<PerBroker[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // form importer (genérico por aseguradora)
  const [selInsurer, setSelInsurer] = useState<InsurerKey>('ASSA');
  const [amount, setAmount] = useState<string>('');

  // cargar tablero
  async function load() {
    setLoading(true);
    setError(null);
    setOkMsg(null);
    try {
      const [t, p, a, b] = await Promise.all([
        fetch('/api/commissions/total').then(r => r.json()),
        fetch('/api/commissions/pending').then(r => r.json()),
        fetch('/api/commissions/advances').then(r => r.json()),
        fetch('/api/commissions/by-broker').then(r => r.json()),
      ]);

      if (!t.ok) throw new Error(t.error || 'Error en totales');
      if (!p.ok) throw new Error(p.error || 'Error en pendientes');
      if (!a.ok) throw new Error(a.error || 'Error en adelantos');
      if (!b.ok) throw new Error(b.error || 'Error por corredor');

      setTotals(t.items || []);
      setPending(p.items || []);
      setAdvances(a.items || []);
      setPerBroker(b.items || []);
      setPendingCount((p.items || []).length);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // importer: ASSA códigos (archivo plano)
  async function uploadAssaCodes(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setOkMsg(null);
    try {
      const form = new FormData();
      form.append('file', f);
      const r = await fetch('/api/import/assa-codets', { method: 'POST', body: form });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Error importando códigos ASSA');
      setOkMsg('Códigos ASSA importados.');
      await load();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      e.target.value = '';
    }
  }

  // importer: genérico por aseguradora + monto declarado
  async function uploadByInsurer(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setOkMsg(null);

    if (!INSURERS.includes(selInsurer)) {
      setError('Aseguradora inválida');
      return;
    }

    try {
      const form = new FormData();
      form.append('file', f);
      form.append('insurer', selInsurer);
      if (amount) form.append('amount', amount);

      const r = await fetch('/api/import/insurers', { method: 'POST', body: form });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Error importando aseguradora');
      setOkMsg(`Reporte de ${selInsurer} importado.`);
      setAmount('');
      await load();
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      e.target.value = '';
    }
  }

  // cerrar quincena (pagar)
  async function closeFortnight() {
    if (!confirm('¿Pagar / Cerrar quincena actual?')) return;
    setError(null);
    setOkMsg(null);
    try {
      const r = await fetch('/api/master/commissions/close', { method: 'POST' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'No se pudo cerrar la quincena');
      setOkMsg('Quincena cerrada y pagada.');
      await load();
    } catch (err: any) {
      setError(err?.message || String(err));
    }
  }

  return (
    <AppLayout role="master">
      <div className="wrap">
        <div className="card">
          <h2>Comisiones — <span className="olive">Quincena en curso</span></h2>

          {loading && <div className="msg">Cargando…</div>}
          {error && <div className="err">⚠️ {error}</div>}
          {okMsg && <div className="ok">✅ {okMsg}</div>}

          {/* Importadores */}
          <details>
            <summary>Importar reportes</summary>
            <div className="block">
              <div className="grid">
                <label className="uploader">
                  <span>ASSA — Códigos</span>
                  <input type="file" accept=".xls,.xlsx,.csv,.pdf,.jpg,.png" onChange={uploadAssaCodes} />
                </label>

                <div className="uploader">
                  <div className="row">
                    <select value={selInsurer} onChange={(e) => setSelInsurer(e.target.value as InsurerKey)} aria-label="Aseguradora">
                      {INSURERS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      inputMode="decimal"
                      placeholder="Monto recibido (opcional)"
                    />
                  </div>
                  <input type="file" accept=".xls,.xlsx,.csv,.pdf,.jpg,.png" onChange={uploadByInsurer} />
                </div>
              </div>
              <small className="hint">Acepta XLS/XLSX/CSV/PDF/JPG/PNG con lectura inteligente.</small>
            </div>
          </details>

          {/* Totales por aseguradora */}
          <details>
            <summary>Totales por aseguradora</summary>
            <div className="block">
              <table className="tbl">
                <thead>
                  <tr><th>Aseguradora</th><th>Monto bruto</th><th>Total oficina</th></tr>
                </thead>
                <tbody>
                  {totals.map(t => (
                    <tr key={t.insurer}>
                      <td>{t.insurer}</td>
                      <td>B/. {t.t_bruto.toFixed(2)}</td>
                      <td>B/. {t.t_oficina.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Pendientes de identificar */}
          <details>
            <summary>
              Pendientes de identificar {pendingCount > 0 && <span className="badge">{pendingCount}</span>}
            </summary>
            <div className="block">
              <table className="tbl">
                <thead>
                  <tr><th>Aseguradora</th><th>Póliza</th><th>Monto</th><th>Marcados “mío”</th><th></th></tr>
                </thead>
                <tbody>
                  {pending.map(p => (
                    <tr key={p.id}>
                      <td>{p.insurer}</td>
                      <td>{p.policy}</td>
                      <td>B/. {p.amount.toFixed(2)}</td>
                      <td>{p.broker_email || ''}</td>
                      <td><a className="btn" href={`/app/master?tab=pending&id=${p.id}`}>Resolver</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Adelantos y saldos */}
          <details>
            <summary>Adelantos y saldos</summary>
            <div className="block">
              <table className="tbl">
                <thead>
                  <tr><th>Broker</th><th>Concepto</th><th>Monto</th><th>Descontado</th><th>Saldo</th><th>Creado</th></tr>
                </thead>
                <tbody>
                  {advances.map(a => (
                    <tr key={a.id}>
                      <td>{a.broker}</td>
                      <td>{a.concept}</td>
                      <td>B/. {a.amount.toFixed(2)}</td>
                      <td>B/. {a.totalDiscount.toFixed(2)}</td>
                      <td>B/. {a.saldo.toFixed(2)}</td>
                      <td>{new Date(a.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="actions">
                <a className="btn" href="/app/master/advances">Ingresar adelantos</a>
              </div>
            </div>
          </details>

          {/* Consolidado por corredor */}
          <details>
            <summary>Consolidado por corredor (neto)</summary>
            <div className="block">
              <table className="tbl">
                <thead>
                  <tr><th>Corredor</th><th>Subtotal</th><th>Adelantos</th><th>Descuentos</th><th>Neto</th></tr>
                </thead>
                <tbody>
                  {perBroker.map(r => (
                    <tr key={r.broker}>
                      <td>{r.broker}</td>
                      <td>B/. {r.subtotal.toFixed(2)}</td>
                      <td>B/. {r.adelantos.toFixed(2)}</td>
                      <td>B/. {r.descuentos.toFixed(2)}</td>
                      <td className="olive">B/. {r.neto.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Acciones finales */}
          <div className="footer">
            <button className="danger" onClick={closeFortnight}>Pagar / Cerrar quincena</button>
            <a className="btn" href="/api/exports/banco-general.txt">Descargar TXT Banco General</a>
            <a className="btn" href="/api/exports/summary.pdf">Descargar reporte PDF</a>
            <a className="btn" href="/api/exports/summary.xlsx">Descargar Excel</a>
          </div>
        </div>

        <style jsx>{`
          .wrap { min-height:100vh; background:${C.gray}; padding:16px; }
          .card { width:100%; max-width:1280px; margin:16px auto; background:${C.white}; border-radius:16px; box-shadow:0 6px 18px rgba(0,0,0,.06); padding:18px; }
          h2 { font-family: Arial, Helvetica, sans-serif; margin:0 0 12px; color:#222; }
          .olive { color:${C.olive}; }

          .msg { color:#666; }
          .err { color:#b00202; background:#fee; border:1px solid #f9c; padding:8px 12px; border-radius:8px; margin:8px 0; }
          .ok  { color:${C.blue}; background:#eef; border:1px solid #9bc; padding:8px 12px; border-radius:8px; margin:8px 0; }

          details { border:1px solid #eee; border-radius:12px; margin:12px 0; overflow:hidden; }
          summary { list-style:none; background:${C.white}; color:${C.blue}; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:8px; padding:9px 12px; line-height:18px; }
          summary::-webkit-details-marker { display:none; }
          .badge { background:${C.blue}; color:#fff; font-size:12px; line-height:18px; border-radius:999px; padding:0 8px; margin-left:6px; }

          .block { background:#f8f8ff; border-top:1px dashed #ccc; padding:12px; display:grid; gap:12px; }
          .grid { display:grid; grid-template-columns:repeat(2, minmax(260px, 1fr)); gap:12px; }
          @media (max-width:880px) { .grid { grid-template-columns:1fr; } }

          .uploader { display:flex; gap:12px; align-items:flex-end; }
          .uploader input[type="file"] { border:1px solid #ddd; border-radius:8px; padding:10px; }
          .row select, .row input { padding:8px 10px; border:1px solid #ddd; border-radius:8px; }

          .tbl { width:100%; border-collapse:separate; border-spacing:0; }
          .tbl th, .tbl td { text-align:left; padding:9px 12px; font:14px/1.3 Arial, Helvetica, sans-serif; }
          .tbl thead th { background:#f0f3ff; color:#333; border-bottom:1px solid #ddd; position:sticky; top:0; }
          .tbl tbody tr:nth-child(even) { background:#fafafa; }

          .actions { margin-top:8px; }
          .btn { display:inline-block; background:${C.blue}; color:#fff; padding:8px 12px; border-radius:10px; text-decoration:none; margin-right:8px; }
          .btn:hover { filter:brightness(1.1); }
          .danger { background:#c90d0d; color:#fff; border:0; border-radius:10px; padding:12px 16px; font-weight:700; cursor:pointer; }
          .danger:hover { filter:brightness(0.95); }
        `}</style>
      </div>
    </AppLayout>
  );
}
