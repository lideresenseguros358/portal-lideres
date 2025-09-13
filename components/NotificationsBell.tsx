// components/NotificationsBell.tsx
import React, { useEffect, useState } from 'react';

type Notif = { id: string; title: string; created_at: string; read_at: string|null };

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    let alive = true;
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : [])
      .then((rows: Notif[]) => { if (alive) setItems(rows || []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const unread = items.filter(n => !n.read_at).length;

  return (
    <div className="bell-wrap">
      <button className="bell" onClick={() => setOpen(v => !v)} aria-label="Notificaciones">
        🔔{unread>0 && <span className="dot">{unread}</span>}
      </button>

      {open && (
        <div className="panel" role="menu">
          {items.length === 0 ? <div className="empty">Sin notificaciones</div> : items.map(n => (
            <div key={n.id} className="row">
              <div className="t">{n.title}</div>
              <div className="d">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .bell-wrap { position:relative; }
        .bell { position:relative; background:none; border:0; font-size:20px; cursor:pointer; }
        .dot { position:absolute; top:-6px; right:-8px; background:#8aaa19; color:#fff; border-radius:10px; padding:0 6px; font-size:12px; }
        .panel { position:absolute; right:0; top:36px; width:300px; background:#fff; box-shadow:0 10px 28px rgba(0,0,0,.2); border-radius:10px; padding:8px; z-index:200; }
        .row { padding:8px; border-bottom: 1px solid #eee; }
        .row:last-child { border-bottom:0; }
        .t { font-weight:700; color:#010139; }
        .d { font-size:12px; color:#777; }
        .empty { padding:16px; color:#777; text-align:center; }
      `}</style>
    </div>
  );
}
