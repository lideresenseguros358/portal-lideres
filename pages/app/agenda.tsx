// /pages/app/agenda.tsx
import React, { useEffect, useState } from 'react';
import MiniCalendar from '../../components/dash/MiniCalendar';

const C = { bg:'#e6e6e6', white:'#fff', olive:'#8aaa19', gray:'#666' };

type Event = { date: string; title: string; color?: string };

export default function AgendaPage(){
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(()=>{ fetch('/api/events').then(r=>r.json()).then(j=> j.ok && setEvents(j.items||[])); },[]);
  const legend = [
    { label:'Pago quincena', color:'#8aaa19'},
    { label:'Capacitación', color:'#010139'},
    { label:'Vencimientos', color:'#b11'}
  ];
  return (
    <div className="wrap">
      <div className="card">
        <h2>Agenda</h2>
        <div className="grid">
          <div>
            <MiniCalendar
              events={events}
            />
          </div>
          <div className="legend">
            <h3>Leyenda</h3>
            {legend.map(l=>(
              <div key={l.label} className="row"><span className="dot" style={{background:l.color}}/> {l.label}</div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .wrap{ min-height:100vh; background:${C.bg}; padding:16px; }
        .card{ background:${C.white}; border-radius:16px; box-shadow:0 6px 18px rgba(0,0,0,.06); padding:16px; }
        h2{ color:${C.olive}; }
        .grid{ display:grid; grid-template-columns:2fr 1fr; gap:16px; }
        @media (max-width:900px){ .grid{ grid-template-columns:1fr; } }
        .legend{ background:#fff; border-radius:12px; box-shadow:0 6px 12px rgba(0,0,0,.06); padding:12px; }
        .legend h3{ margin:0 0 8px; color:${C.gray}; }
        .row{ display:flex; align-items:center; gap:8px; padding:4px 0; }
        .dot{ width:12px; height:12px; border-radius:50%; display:inline-block; }
      `}</style>
    </div>
  );
}
