// /pages/app/broker/index.tsx
import React, { useEffect, useState } from 'react';
import AppLayout from '../../../components/AppLayout';
import KpiCard from '../../../components/dash/KpiCard';
import Donut from '../../../components/dash/Donut';
import MiniCalendar from '../../../components/dash/MiniCalendar';
import Bars from '../../../components/dash/Bars';

type BrokerDash = {
  last_fortnight: number;
  aging_60: number;
  pending_to_identify: number;
  donut_conv: { current: number; goal: number; split: number };
  donut_contest: { current: number; goal: number; split: number };
  chart: { labels: string[]; series: { label: string; data: number[] }[] };
};

export default function BrokerDashboard() {
  const [data, setData] = useState<BrokerDash | null>(null);
  const [name, setName] = useState<string>('');

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch('/api/dashboard/brokers').then(r => r.ok ? r.json() : Promise.reject()),
      fetch('/api/me').then(r => r.ok ? r.json() : { name: '' })
    ])
      .then(([d, me]) => { if (alive) { setData(d); setName(me?.name || ''); } })
      .catch(() => {
        if (alive) setData({
          last_fortnight: 0, aging_60: 0, pending_to_identify: 0,
          donut_conv: { current: 0, goal: 10000, split: 0 },
          donut_contest: { current: 0, goal: 10000, split: 0 },
          chart: { labels: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'], series: [
            { label: '2024', data: Array(12).fill(0) },
            { label: '2025', data: Array(12).fill(0) },
          ]},
        });
      });
    return () => { alive = false; };
  }, []);

  return (
    <AppLayout role="broker" userName={name}>
      <h1 style={{margin:'4px 0 14px', color:'#010139'}}>Bienvenido de vuelta {name || '(Broker)'}</h1>

      {!data ? <div>Cargando…</div> : (
        <>
          <div className="grid kpis">
            <KpiCard title="Última Quincena" value={`B/. ${data.last_fortnight.toFixed(2)}`} />
            <KpiCard title="Morosidad +60 Días" value={`B/. ${data.aging_60.toFixed(2)}`} />
            <KpiCard title="Pendientes de identificar" value={String(data.pending_to_identify)} />
          </div>

          <div className="grid donuts">
            <Donut label="Convivio LISSA" current={data.donut_conv.current} goal={data.donut_conv.goal} split={data.donut_conv.split} />
            <Donut label="Concurso ASSA" current={data.donut_contest.current} goal={data.donut_contest.goal} split={data.donut_contest.split} />
            <MiniCalendar events={[]} />
          </div>

          <div className="block">
            <h2 style={{textAlign:'center'}}>Acumulado Anual PMA <span style={{color:'#666'}}>2024 • 2025</span></h2>
            <Bars labels={data.chart.labels} series={data.chart.series} />
          </div>
        </>
      )}

      <style jsx>{`
        .grid { display:grid; gap:16px; }
        .kpis { grid-template-columns: repeat(auto-fit, minmax(220px,1fr)); margin-bottom: 12px; }
        .donuts { grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); margin-bottom: 12px; }
        .block { background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:12px; }
      `}</style>
    </AppLayout>
  );
}
