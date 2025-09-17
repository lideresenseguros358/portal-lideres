// pages/app/master/index.tsx
import Head from 'next/head';
import React, { useEffect, useState } from 'react';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Bars from '../../../components/dash/Bars';

type Dash = {
  last_fortnight_total: number;
  pma_acumulado: number;
  signup_pending: number;
  bars?: { labels: string[]; s1: number[]; s2: number[] };
};

export default function MasterDashboard() {
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch('/api/dashboard/master');
        const j = r.ok ? await r.json() : null;
        if (!alive) return;
        setData(j || { last_fortnight_total:0, pma_acumulado:0, signup_pending:0, bars:{ labels:[], s1:[], s2:[] }});
      } catch {
        if (alive) setData({ last_fortnight_total:0, pma_acumulado:0, signup_pending:0, bars:{ labels:[], s1:[], s2:[] }});
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <>
      <Head><title>Líderes en Seguros | Panel Administrativo</title></Head>
      <AppLayout role="master" title="Panel Administrativo">
        <section className="grid3">
          <KpiCard title="Última quincena (pagado)" value={`B/. ${Number(data?.last_fortnight_total||0).toFixed(2)}`} />
          <KpiCard title="PMA acumulado" value={`B/. ${Number(data?.pma_acumulado||0).toFixed(2)}`} />
          <KpiCard title="Solicitudes pendientes" value={String(data?.signup_pending||0)} />
        </section>

        <section className="panel">
          <h2 className="panelTitle">Acumulado Anual PMA <small>2024 • 2025</small></h2>
          <Bars
            labels={data?.bars?.labels || []}
            series={[
              { label:'2024', data:data?.bars?.s1 || [] },
              { label:'2025', data:data?.bars?.s2 || [] },
            ]}
          />
        </section>

        <style jsx>{`
          .grid3 { display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:16px; margin-bottom:16px; }
          @media (max-width: 900px){ .grid3{ grid-template-columns:1fr; } }
          .panelTitle { font-size:22px; margin: 10px 0; }
          .panelTitle small { font-weight:700; margin-left:8px; }
        `}</style>
      </AppLayout>
    </>
  );
}
