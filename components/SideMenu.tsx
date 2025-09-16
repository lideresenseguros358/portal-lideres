// /components/SideMenu.tsx
import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  role: 'master' | 'broker';
};

const itemsByRole: Record<'master'|'broker', { label: string; href: string }[]> = {
  broker: [
    { label: 'Dashboard',   href: '/app/broker' },
    { label: 'Comisiones',  href: '/app/broker/commissions' },
    { label: 'Mis clientes',href: '/app/broker/clients' },
    { label: 'Morosidad',   href: '/app/broker/morosidad' },
    { label: 'Producción',  href: '/app/broker/production' },
    { label: 'Descargas',   href: '/app/broker/downloads' },
    { label: 'Knowledge',   href: '/app/broker/knowledge' },
    { label: 'Agenda',      href: '/app/broker/agenda' },
  ],
  master: [
    { label: 'Dashboard',   href: '/app/master' },
    { label: 'Base de datos', href: '/app/master?tab=db' },
    { label: 'Corredores',  href: '/app/master/brokers' },
    { label: 'Aseguradoras',href: '/app/master/insurers' },
    { label: 'Comisiones',  href: '/app/master/commissions' },
    { label: 'Morosidad',   href: '/app/master/morosidad' },
    { label: 'Solicitudes', href: '/app/master/solicitudes' },
    { label: 'Producción',  href: '/app/master/production' },
    { label: 'Descargas',   href: '/app/master/downloads' },
    { label: 'Knowledge',   href: '/app/master/knowledge' },
    { label: 'Agenda',      href: '/app/master/agenda' },
  ],
};

export default function SideMenu({ open, onClose, role }: Props) {
  const items = itemsByRole[role];
  return (
    <>
      <aside className="sidenav" data-open={open}>
        <div className="header">
          <img src="/logo_alternativo.png" alt="LISSA" className="logo" />
          <button className="close" onClick={onClose} aria-label="Cerrar menú">×</button>
        </div>
        <nav>
          {items.map((it) => (
            <a key={it.href} href={it.href} onClick={onClose}>{it.label}</a>
          ))}
        </nav>
      </aside>

      <style jsx>{`
        .sidenav {
          position: fixed; inset: 0 auto 0 0; width: 280px; transform: translateX(-100%);
          background: #010139; color: #fff; z-index: 50; transition: transform .2s ease;
          box-shadow: 4px 0 12px rgba(0,0,0,.25);
        }
        .sidenav[data-open="true"] { transform: translateX(0); }
        .header { display:flex; align-items:center; gap:8px; padding: 12px; }
        .logo { height: 46px; }
        .close { margin-left:auto; background:transparent; border:0; color:#fff; font-size:20px; cursor:pointer; }
        nav { display:flex; flex-direction:column; padding: 4px 12px 16px; }
        nav a {
          color:#fff; text-decoration:none; padding:10px 8px; border-radius:6px;
        }
        nav a:hover { background: rgba(255,255,255,.08); }
      `}</style>
    </>
  );
}
