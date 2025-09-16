// /pages/app/master/index.tsx
import React, { useEffect, useState } from 'react';
import { authFetch, supabase } from '../../../lib/supabase-client';

export default function MasterDashboard() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        location.href = '/login';
        return;
      }
      try {
        const r = await authFetch('/api/dashboard/masters');
        if (!r.ok) throw new Error(r.error);
        setData(r.data);
      } catch (e: any) {
        setErr(String(e.message || e));
      }
    })();
  }, []);

  if (err) return <div style={{ padding: 16, color: '#b00' }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Cargando…</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Bienvenido de vuelta (Master)</h1>
      <div>PMA anual: {Number(data.pmaYearTotal).toFixed(2)}</div>
      <div>Comisión anual oficina: {Number(data.commissionsYearOffice).toFixed(2)}</div>
      <div>Pendientes de identificar: {Number(data.pendingIdentify).toFixed(0)}</div>
      {/* Deja tus cards y charts como los tenías — sólo aseguramos la data */}
    </div>
  );
}

