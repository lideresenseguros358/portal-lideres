// /components/dash/Donut.tsx
import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip } from 'chart.js';
Chart.register(ArcElement, Tooltip);

export default function Donut({ label, current, goal, split }: { label: string; current: number; goal: number; split?: number }) {
  const pct = Math.min(1, goal ? current / goal : 0);
  const data = {
    labels: [label],
    datasets: [{
      data: [pct, 1 - pct],
    }],
  };
  const options = { cutout: '70%', plugins: { tooltip: { enabled: false } } };
  return (
    <div className="card">
      <div className="title">{label}</div>
      <Doughnut data={data as any} options={options as any} />
      {typeof split === 'number' && <div className="split">meta intermedia: {(split*100).toFixed(0)}%</div>}
      <div className="num">{current.toLocaleString()}</div>
      <style jsx>{`
        .card{background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:12px}
        .title{font-weight:700;margin-bottom:8px}
        .num{margin-top:8px;font-weight:700}
        .split{font-size:12px;color:#666;margin-top:6px}
      `}</style>
    </div>
  );
}
