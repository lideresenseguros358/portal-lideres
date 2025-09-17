// components/AppLayout.tsx
import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import SideMenu from './SideMenu';
import NotificationsBell from './NotificationsBell';
import { supabase } from '../lib/supabase';

type Props = {
  role: 'master' | 'broker';
  children: React.ReactNode;
  title?: string;
};

export default function AppLayout({ role, children, title }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (accRef.current && !accRef.current.contains(e.target as Node)) setAccountOpen(false);
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="app">
      <header className="hdr">
        <button className="burger" aria-label="Abrir menú" onClick={() => setOpen(true)}>☰</button>
        <div className="left">
          <Image src="/logo.png" alt="LISSA" width={120} height={40} />
        </div>
        <div className="spacer" />
        <NotificationsBell />
        <div ref={accRef} className="account">
          <button className="accBtn" onClick={() => setAccountOpen(v => !v)} aria-haspopup="menu" aria-expanded={accountOpen}>
            Mi cuenta ▾
          </button>
          {accountOpen && (
            <div className="accMenu" role="menu">
              <a href="/app/auth/update-password" role="menuitem">Actualizar contraseña</a>
              <button onClick={logout} role="menuitem">Cerrar sesión</button>
            </div>
          )}
        </div>
      </header>

      <SideMenu open={open} onClose={() => setOpen(false)} role={role} />

      <main className="content">
        {title && <h1 className="pageTitle">{title}</h1>}
        {children}
      </main>

      <footer className="foot">
        <div className="footMain">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá — Licencia PJ750</div>
        <div className="footSub">Desarrollado por Líderes en Seguros | Todos los derechos reservados</div>
      </footer>

      <style jsx global>{`
        * { box-sizing: border-box; font-family: Arial, Helvetica, sans-serif; }
        body { background:#e6e6e6; }
      `}</style>

      <style jsx>{`
        .app { min-height: 100vh; display:flex; flex-direction: column; }
        .hdr { position: sticky; top:0; z-index: 50; display:flex; align-items:center; gap:12px; padding: 8px 12px; background:#fff; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
        .burger { background:#010139; color:#fff; border:0; border-radius:8px; padding:6px 8px; cursor:pointer; }
        .left { display:flex; align-items:center; }
        .spacer { flex:1; }
        .account { position: relative; }
        .accBtn { background:transparent; border:0; font-weight:700; cursor:pointer; }
        .accMenu { position:absolute; right:0; margin-top:6px; background:#fff; border:1px solid #e5e5e5; border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.15); padding:8px; display:flex; flex-direction:column; z-index:60; min-width:200px; }
        .accMenu a, .accMenu button { padding:8px 10px; border:0; background:none; text-align:left; font-size:14px; cursor:pointer; border-radius:6px; }
        .accMenu a:hover, .accMenu button:hover { background:#f3f5ff; }
        .content { flex:1; padding: 16px; }
        .pageTitle { margin: 10px 0 16px; }
        .foot { background:#010139; color:#bfbfbf; text-align:center; padding:10px 12px; line-height:1.2; }
        .footSub { font-size:12px; color:#a9a9a9; }
      `}</style>
    </div>
  );
}
