// /pages/app/master/index.tsx
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Bars from '../../../components/dash/Bars';

type Series = { label: string; data: number[] };

type MasterDashData = {
  userName?: string;
  dbCount?: number;
  brokersCount?: number;
  insurersCount?: number;
  commissionsYearOffice?: number;
  agingOver60?: number;
  bars?: { labels: string[]; series: Series[] };
};

export default function MasterDashboard() {
  const [data, setData] = useState<MasterDashData | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let alive = true;
    fetch('/api/dashboard/masters')
      .then(r => r.json())
      .then(j => { if (alive) setData(j?.data ?? j); })
      .catch(e => { if (alive) setErr(String(e?.message || e)); });
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <AppLayout role="master">
        <div style={{ padding:16, color:'#b00' }}>Error: {err}</div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Líderes en Seguros | Dashboard (Master)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <AppLayout role="master">
        <div style={{ padding:'8px 16px' }}>
          <h1 style={{ color:'#0b2b2b', fontWeight:800, margin:'16px 0' }}>
            Bienvenido de vuelta {data?.userName ? data.userName : '(Master)'}
          </h1>

          {/* KPIs superiores para master */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:16 }}>
            <KpiCard title="Base de datos" value={String(data?.dbCount ?? 0)} />
            <KpiCard title="Corredores" value={String(data?.brokersCount ?? 0)} />
            <KpiCard title="Aseguradoras" value={String(data?.insurersCount ?? 0)} />
            <KpiCard title="Comisiones oficina (YTD)" value={`B/. ${Number(data?.commissionsYearOffice ?? 0).toFixed(2)}`} />
            <KpiCard title="Morosidad +60 Días" value={`B/. ${Number(data?.agingOver60 ?? 0).toFixed(2)}`} />
          </div>

          {/* Barras año vs meta/oficina */}
          <div style={{ marginTop:16 }}>
            <h2 style={{ textAlign:'center', fontWeight:800, margin:'8px 0' }}>
              Producción mensual (oficina)
              <span style={{ fontSize:14, fontWeight:600, marginLeft:8 }}>
                {data?.bars?.series?.map(s => s.label).filter(Boolean).join(' • ')}
              </span>
            </h2>
            <Bars
              labels={data?.bars?.labels ?? ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']}
              series={data?.bars?.series ?? [
                { label: '2024', data: Array(12).fill(0) },
                { label: '2025', data: Array(12).fill(0) },
              ]}
            />
          </div>
        </div>
      </AppLayout>
    </>
  );
}

