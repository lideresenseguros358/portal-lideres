// /components/AppLayout.tsx
import React, { useEffect, useRef, useState } from 'react';
import SideMenu from './SideMenu';
import NotificationsBell from './NotificationsBell';

type Props = {
  role: 'master' | 'broker';
  children: React.ReactNode;
  userName?: string;
};

export default function AppLayout({ role, children, userName }: Props) {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Cerrar al click fuera
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (open && overlayRef.current && e.target instanceof Node && overlayRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="burger" onClick={() => setOpen(true)} aria-label="Abrir menú">☰</button>
        <div className="space" />
        <NotificationsBell />
        <div className="user">Mi cuenta {userName ? `• ${userName}` : ''}</div>
      </header>

      {open && <div className="overlay" ref={overlayRef} />}

      <SideMenu open={open} onClose={() => setOpen(false)} role={role} />

      <main className="content">{children}</main>

      <style jsx>{`
        .app { min-height: 100vh; background: #eef0f4; }
        .topbar {
          background: #fff; display:flex; align-items:center; gap:8px;
          padding: 8px 12px; position: sticky; top:0; z-index: 100;
          box-shadow: 0 2px 8px rgba(0,0,0,.08);
        }
        .burger { background:#010139; color:#fff; border:0; border-radius:6px; padding:6px 10px; cursor:pointer; }
        .space { flex: 1; }
        .user { font-weight:700; color:#010139; }
        .content { padding: 16px; }
        .overlay { position: fixed; inset: 0; z-index: 40; }
      `}</style>
    </div>
  );
}

