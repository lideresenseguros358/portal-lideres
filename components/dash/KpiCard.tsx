// /components/dash/KpiCard.tsx
import React from 'react';

export default function KpiCard({ title, value, onClick }: { title: string; value: string | number; onClick?: () => void }) {
  return (
    <div className="kpi" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <style jsx>{`
        .kpi{background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:16px 18px;cursor:${onClick?'pointer':'default'};transition:transform .15s}
        .kpi:hover{transform:${onClick?'scale(1.02)':'none'}}
        .kpi-title{color:#7b7b7b;font-weight:700}
        .kpi-value{color:#8aaa19;font-size:24px;font-weight:800;margin-top:6px}
      `}</style>
    </div>
  );
}
