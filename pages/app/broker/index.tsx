// /pages/app/broker/index.tsx
import React, { useEffect, useState } from 'react';
import { authFetch, supabase } from '../../../lib/supabase-client';

export default function BrokerDashboard() {
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
        const r = await authFetch('/api/dashboard/brokers');
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
      <h1>Bienvenido de vuelta (Broker)</h1>
      <div>Última quincena neta: {Number(data.lastFortnightAmount).toFixed(2)}</div>
      {/* Restaura aquí tus cards y charts originales */}
    </div>
  );
}

