// /pages/app/master/index.tsx
import React, { useEffect, useState } from 'react';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Bars from '../../../components/dash/Bars';

type MasterDash = {
  brokers_count: number;
  insurers_count: number;
  pending_requests: number;
  chart: { labels: string[]; series: { label: string; data: number[] }[] };
};

export default function MasterDashboard() {
  const [data, setData] = useState<MasterDash | null>(null);
  const [name, setName] = useState<string>('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/dashboard/master').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/me').then(r => r.ok ? r.json() : { name: '' }),
    ]).then(([d, me]) => { if (alive) { setData(d); setName(me?.name || ''); } })
      .catch(() => {
        if (alive) setData({
          brokers_count: 0, insurers_count: 0, pending_requests: 0,
          chart: { labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
                   series: [{ label: 'Producción', data: Array(12).fill(0) }] },
        });
      });
    return () => { alive = false; };
  }, []);

  return (
    <AppLayout role="master" userName={name}>
      <h1 style={{margin:'4px 0 14px', color:'#010139'}}>Panel Administrativo {name && `• ${name}`}</h1>

      {!data ? <div>Cargando…</div> : (
        <>
          <div className="grid kpis">
            <KpiCard title="Corredores activos" value={String(data.brokers_count)} />
            <KpiCard title="Aseguradoras" value={String(data.insurers_count)} />
            <KpiCard title="Solicitudes pendientes" value={String(data.pending_requests)} />
          </div>

          <div className="block">
            <h2 style={{textAlign:'center'}}>Producción consolidada</h2>
            <Bars labels={data.chart.labels} series={data.chart.series} />
          </div>
        </>
      )}

      <style jsx>{`
        .grid { display:grid; gap:16px; }
        .kpis { grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); margin-bottom: 12px; }
        .block { background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:12px; }
      `}</style>
    </AppLayout>
  );
}
