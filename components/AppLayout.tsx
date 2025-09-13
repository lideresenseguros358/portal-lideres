// components/AppLayout.tsx
import React, { useState } from 'react';
import SideMenu from './SideMenu';
import NotificationsBell from './NotificationsBell';

type Props = {
  role: 'master' | 'broker';
  children: React.ReactNode;
};

export default function AppLayout({ role, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app">
      <header className="topbar">
        <button className="burger" onClick={() => setOpen(true)} aria-label="Abrir menú">☰</button>
        <img src="/logo.png" alt="LISSA" className="logo" />
        <div className="spacer" />
        <NotificationsBell />
        <div className="user">Mi cuenta ▾</div>
      </header>

      <SideMenu open={open} onClose={() => setOpen(false)} role={role} />

      <main className="content">{children}</main>

      <style jsx>{`
        .app { min-height:100vh; background: #eef0f4; }
        .topbar { height:64px; background:#fff; display:flex; align-items:center; padding:0 12px; box-shadow:0 2px 8px rgba(0,0,0,.08); position:sticky; top:0; z-index:50; }
        .burger { font-size:22px; background:none; border:0; cursor:pointer; margin-right:8px; }
        .logo { height:36px; margin-right:10px; }
        .spacer { flex:1; }
        .user { margin-left:12px; font-weight:700; color:#010139; }
        .content { padding: 16px; }
      `}</style>
    </div>
  );
}
