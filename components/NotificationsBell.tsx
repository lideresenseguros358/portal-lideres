// components/NotificationsBell.tsx
import React, { useEffect, useRef, useState } from 'react';

type Noti = { id: string; title: string; created_at?: string };

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Noti[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : [])
      .then((rows) => { if (alive) setItems(rows || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  return (
    <div ref={ref} className="wrap">
      <button className="bell" onClick={() => setOpen(v => !v)} aria-label="Notificaciones">🔔</button>
      {open && (
        <div className="panel" role="menu">
          {items.length === 0 ? (
            <div className="empty">Sin notificaciones</div>
          ) : items.map(n => (
            <div key={n.id} className="row">
              <div className="title">{n.title}</div>
              {n.created_at && <div className="date">{new Date(n.created_at).toLocaleString()}</div>}
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .wrap { position:relative; margin-right: 8px; }
        .bell { background:#ffbf00; border:0; width:32px; height:32px; border-radius:8px; cursor:pointer; }
        .panel {
          position:absolute; right:0; top: 40px; width: 320px; max-height: 380px; overflow:auto;
          background:#fff; border-radius:10px; box-shadow: 0 12px 26px rgba(0,0,0,.2); z-index: 120;
          border: 1px solid #eaeaea; padding:8px;
        }
        .row { padding:8px; border-radius:8px; }
        .row:hover { background:#f5f7ff; }
        .title { font-weight:700; font-size:14px; }
        .date { font-size:12px; color:#777; }
        .empty { padding:16px; text-align:center; color:#999; }
      `}</style>
    </div>
  );
}
