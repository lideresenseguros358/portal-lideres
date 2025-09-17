// components/dash/Donut.tsx
import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';
Chart.register(ArcElement, Tooltip, Legend);

export default function Donut({ label, current, goal }:{
  label: string; current: number; goal: number;
}) {
  const pct = goal > 0 ? Math.min(100, Math.round((current/goal)*100)) : 0;
  const data = { labels:[label], datasets:[{ data:[pct, 100-pct] }] };
  const options = { cutout:'70%', plugins: { tooltip: { enabled:false }, legend: { display:false } } };

  return (
    <div className="card">
      <div className="title">{label}</div>
      <Doughnut data={data as any} options={options as any} />
      <div className="num">{pct}%</div>
      <style jsx>{`
        .card{background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:12px;text-align:center}
        .title{font-weight:700;color:#878b96;margin-bottom:8px}
        .num{margin-top:8px;font-weight:800}
      `}</style>
    </div>
  );
}
