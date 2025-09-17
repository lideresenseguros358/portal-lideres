// components/dash/Bars.tsx
import React from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

type Serie = { label: string; data: number[] };
export default function Bars({ labels, series }:{ labels: string[]; series: Serie[] }) {
  const data = { labels, datasets: series.map(s => ({ label: s.label, data: s.data })) };
  const options = { responsive: true, plugins: { legend: { position: 'top' as const }, tooltip: { enabled: true } } };

  return (
    <div className="card">
      <Bar data={data as any} options={options as any} />
      <style jsx>{`.card{background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:12px;}`}</style>
    </div>
  );
}
