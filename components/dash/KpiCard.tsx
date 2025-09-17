// components/dash/KpiCard.tsx
import React from 'react';
const OLIVE = '#8aaa19';

export default function KpiCard({ title, value, onClick }:{
  title: string; value: string | number; onClick?: () => void;
}) {
  return (
    <div className="kpi" onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>

      <style jsx>{`
        .kpi { background:#fff; border-radius:12px; box-shadow:0 6px 16px rgba(0,0,0,.12);
               padding:16px; transition:.12s; cursor:${onClick ? 'pointer' : 'default'}; }
        .kpi:hover { transform:${onClick ? 'translateY(-1px)' : 'none'}; }
        .kpi-title { color:#878b96; font-weight:700; text-align:center; }
        .kpi-value { color:${OLIVE}; font-weight:800; font-size:24px; margin-top:6px; text-align:center; }
      `}</style>
    </div>
  );
}
