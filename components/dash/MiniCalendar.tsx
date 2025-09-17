// components/dash/MiniCalendar.tsx
import React, { useMemo, useState } from 'react';
import { eachDayOfInterval, endOfMonth, format, getDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

type Event = { date: string; title: string };
type Props = { events?: Event[] };

const OLIVE = '#8aaa19';

export default function MiniCalendar({ events = [] }: Props) {
  const [cursor] = useState(new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const map = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const ev of events) {
      const k = ev.date.slice(0, 10);
      m.set(k, [...(m.get(k) || []), ev.title]);
    }
    return m;
  }, [events]);

  const start = startOfMonth(cursor);
  const end = endOfMonth(cursor);
  const days = eachDayOfInterval({ start, end });
  const pad = (getDay(start) + 6) % 7; // 0=lun

  const selEvents = selected ? map.get(selected) || [] : [];

  return (
    <div className="card">
      <div className="head">Septiembre</div>
      <div className="grid">
        {['lun','mar','mie','jue','vie','sab','dom'].map(d => <div key={d} className="dow">{d}</div>)}
        {Array(pad).fill(null).map((_,i) => <div key={'pad'+i} />)}
      {days.map(d => {
        const k = format(d, 'yyyy-MM-dd');
        const has = map.has(k);
        return (
          <button
            key={k}
            className={'day' + (selected === k ? ' selected' : '')}
            onClick={() => setSelected(k)}
          >
            <span>{format(d, 'd', { locale: es })}</span>
            {has && <i className="dot" />}
          </button>
        );
      })}
      <div className="events">
        {!selected ? <em>Selecciona un día</em> :
          (selEvents.length === 0 ? <em>No hay evento programado</em> :
            <ul>{selEvents.map((t, i) => <li key={i}>{t}</li>)}</ul>
          )
        }
      </div>

      <style jsx>{`
        .card { background:#fff; border-radius:12px; box-shadow: 0 6px 16px rgba(0,0,0,.12); padding:12px; }
        .head { color:#666; font-weight:700; margin-bottom:8px; text-align:center; }
        .grid { display:grid; grid-template-columns: repeat(7, 1fr); gap:6px; }
        .dow { text-align:center; font-size:11px; color:#888; }
        .day { height:36px; border:1px solid #eee; border-radius:8px; background:#fff; cursor:pointer; position:relative; }
        .day:hover { border-color:#ccd6ff; background:#f6f8ff; }
        .day.selected { border-color:${OLIVE}; box-shadow: inset 0 0 0 1px ${OLIVE}; }
        .day span { position:absolute; top:4px; left:6px; font-size:12px; color:#333; }
        .dot { position:absolute; bottom:4px; right:6px; width:6px; height:6px; border-radius:50%; background:${OLIVE}; }
        .events { margin-top:10px; font-size:13px; color:#555; min-height:28px; }
        ul { margin:6px 0 0 18px; }
      `}</style>
      </div>
    </div>
  );
}
