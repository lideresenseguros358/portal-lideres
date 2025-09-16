// /components/NotificationsBell.tsx
import React, { useEffect, useState } from 'react';

type Notif = { id: string; title: string; created_at: string; is_read?: boolean };

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    // Llama tu API real; dejo una segura que no rompe si hay error
    fetch('/api/notifications')
      .then(r => r.ok ? r.json() : Promise.resolve({rows:[]}))
      .then(({ rows }) => setItems(rows ?? []))
      .catch(() => setItems([]));
  }, []);

  const unread = items.filter(i => !i.is_read).length;

  return (
    <div className="bellWrap">
      <button className="bell" onClick={() => setOpen(s=>!s)} aria-label="Notificaciones">
        🔔{unread > 0 && <span className="dot" />}
      </button>
      {open && (
        <div className="panel">
          {items.length === 0 ? (
            <div className="empty">Sin notificaciones</div>
          ) : items.map(n => (
            <div className="row" key={n.id}>
              <div className="t">{n.title}</div>
              <div className="d">{new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .bellWrap { position: relative; }
        .bell { background:#ffd24d; border:0; border-radius:8px; padding:6px 8px; cursor:pointer; }
        .dot { display:inline-block; width:8px; height:8px; background:#d00; border-radius:999px; margin-left:4px; }
        .panel {
          position: absolute; right:0; top: calc(100% + 8px); width: 320px; background:#fff; color:#111;
          border-radius:12px; box-shadow: 0 12px 28px rgba(0,0,0,.18); padding:10px; z-index: 120;
        }
        .empty { text-align:center; color:#777; padding: 24px 0; }
        .row { border-bottom: 1px solid #eee; padding:8px 4px; }
        .row:last-child { border-bottom: 0; }
        .t { font-weight: 600; }
        .d { color:#777; font-size:12px; }
      `}</style>
    </div>
  );
}
