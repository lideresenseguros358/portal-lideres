// /components/dash/MiniCalendar.tsx
import React from 'react';
import { startOfMonth, endOfMonth, eachDayOfInterval, getDay, format } from 'date-fns';

export default function MiniCalendar({ events }: { events: { date: string; count: number }[] }) {
  const now = new Date();
  const days = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) });
  const map = new Map(events.map(e => [e.date.slice(0,10), e.count]));
  const pad = Array(getDay(days[0]) === 0 ? 6 : getDay(days[0]) - 1).fill(null);

  return (
    <div className="card">
      <div className="head">{format(now, 'MMMM')}</div>
      <div className="grid">
        {['lun','mar','mie','jue','vie','sab','dom'].map(d=><div key={d} className="dw">{d}</div>)}
        {pad.map((_,i)=><div key={`p${i}`} />)}
        {days.map(d=>{
          const key = format(d,'yyyy-MM-dd');
          const c = map.get(key) ?? 0;
          return <div key={key} className={`day ${c>0?'has':''}`} title={`${c} evento(s)`}>
            <span>{format(d,'d')}</span>
            {c>0 && <div className="dots">{Array(c).fill(0).map((_,i)=><i key={i}/>)}</div>}
          </div>;
        })}
      </div>
      <style jsx>{`
        .card{background:#fff;border-radius:12px;box-shadow:0 6px 16px rgba(0,0,0,.12);padding:12px}
        .head{font-weight:800;margin-bottom:8px}
        .grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
        .dw{font-size:12px;color:#666;text-align:center}
        .day{height:48px;border-radius:8px;background:#f6f6f6;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .day.has{outline:2px solid #8aaa19;background:#fff}
        .dots{display:flex;gap:3px;margin-top:3px}
        .dots i{width:5px;height:5px;border-radius:50%;background:#8aaa19;display:block}
      `}</style>
    </div>
  );
}
