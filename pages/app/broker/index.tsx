import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Donut from '../../../components/dash/Donut';
import Bars from '../../../components/dash/Bars';
import MiniCalendar from '../../../components/dash/MiniCalendar';

export default function BrokerDashboard() {
  const r = useRouter();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const j = await fetch('/api/dashboard/broker');
        const d = await j.json();
        if (!j.ok) throw new Error(d.error || j.statusText);
        setData(d);
      } catch (e: any) {
        setErr(e.message || 'Error cargando');
      }
    })();
  }, []);

  if (err) return <div style={{ padding: 16, color: '#b00' }}>Error: {err}</div>;
  if (!data) return <div style={{ padding: 16 }}>Cargando…</div>;

  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

  return (
    <AppLayout role="broker">
      <h1 style={{ color: '#2b2b2b' }}>Bienvenido de vuelta (Broker)</h1>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 16 }}>
        <KpiCard title="Última Quincena" value={Number(data.lastFortnightAmount).toFixed(2)} />
        <KpiCard title="Morosidad +60 días" value={Number(data.morosidadOver60).toFixed(2)} />
        <KpiCard title="Pendientes de identificar" value={Number(data.pendingIdentify)} />
      </div>

      {/* Gráficas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.12)', padding: 12 }}>
          <h2 style={{ margin: '8px 0' }}>Convivo Lissa</h2>
          <Donut label="Convivio LISSA" current={data.convivio.current} goal={data.convivio.goal} split={data.convivio.split} />
        </div>
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.12)', padding: 12 }}>
          <h2 style={{ margin: '8px 0' }}>Concurso ASSA</h2>
          <Donut label="concurso ASSA" current={data.assa.current} goal={data.assa.goal} />
        </div>
      </div>

      {/* Producción anual */}
      <div style={{ background: '#fff', marginTop: 20, borderRadius: 12, boxShadow: '0 6px 16px rgba(0,0,0,0.12)', padding: 12 }}>
        <Bars labels={months} series={[{ label: 'Producción', data: data.production.map((r: any) => r.y2024) }]} />
      </div>

      {/* Calendario */}
      <MiniCalendar events={data.calendar} />
    </AppLayout>
  );
}
