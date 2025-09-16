// /pages/app/broker/index.tsx
import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Donut from '../../../components/dash/Donut';
import Bars from '../../../components/dash/Bars';
import MiniCalendar from '../../../components/dash/MiniCalendar';

type CalEvt = { date: string; title: string };
type Series = { label: string; data: number[] };

type BrokerDashData = {
  userName?: string;
  lastFortnightAmount?: number;         // “Última Quincena”
  morosidadOver60?: number;            // “Morosidad +60 Días”
  pendingIdentify?: number;            // “Pendientes de identificar”
  convivo?: { current: number; goal: number; split: number }; // donut
  assa?:    { current: number; goal: number; split: number }; // donut
  calendar?: CalEvt[];
  // barras: meses 1..12 y dos series (2024, 2025) o similar
  bars?: { labels: string[]; series: Series[] };
};

export default function BrokerDashboard() {
  const [data, setData] = useState<BrokerDashData | null>(null);
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    let alive = true;
    // Llama a tu endpoint actual
    fetch('/api/dashboard/brokers')
      .then(r => r.json())
      .then(j => { if (alive) setData(j?.data ?? j); })
      .catch(e => { if (alive) setErr(String(e?.message || e)); });
    return () => { alive = false; };
  }, []);

  if (err) {
    return (
      <AppLayout role="broker">
        <div style={{ padding:16, color:'#b00' }}>Error: {err}</div>
      </AppLayout>
    );
  }

  return (
    <>
      <Head>
        <title>Líderes en Seguros | Dashboard (Broker)</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <AppLayout role="broker">
        <div style={{ padding:'8px 16px' }}>
          <h1 style={{ color:'#0b2b2b', fontWeight:800, margin:'16px 0' }}>
            Bienvenido de vuelta {data?.userName ? data.userName : '(Broker)'}
          </h1>

          {/* KPIs superiores */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16 }}>
            <KpiCard title="Última Quincena" value={`B/. ${Number(data?.lastFortnightAmount ?? 0).toFixed(2)}`} />
            <KpiCard title="Morosidad +60 Días" value={`B/. ${Number(data?.morosidadOver60 ?? 0).toFixed(2)}`} />
            <KpiCard title="Pendientes de identificar" value={String(data?.pendingIdentify ?? 0)} />
          </div>

          {/* Donuts + Calendario */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:16, marginTop:16 }}>
            <Donut label="Convivio LISSA"
                   current={Number(data?.convivo?.current ?? 0)}
                   goal={Number(data?.convivo?.goal ?? 0)}
                   split={Number(data?.convivo?.split ?? 0)} />
            <Donut label="Concurso ASSA"
                   current={Number(data?.assa?.current ?? 0)}
                   goal={Number(data?.assa?.goal ?? 0)}
                   split={Number(data?.assa?.split ?? 0)} />
            <MiniCalendar events={(data?.calendar ?? []).map(evt => ({
              date: evt.date,
              count: 1 // or another logic to determine count
            }))} />
          </div>

          {/* Barras PMA anual */}
          <div style={{ marginTop:16 }}>
            <h2 style={{ textAlign:'center', fontWeight:800, margin:'8px 0' }}>
              Acumulado Anual PMA <span style={{ fontSize:14, fontWeight:600, marginLeft:8 }}>
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
