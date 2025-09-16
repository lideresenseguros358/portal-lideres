// /components/SideMenu.tsx
import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  role: 'master' | 'broker';
};

const itemsByRole: Record<'master'|'broker', { label: string; href: string }[]> = {
  broker: [
    { label: 'Dashboard', href: '/app/broker' },
    { label: 'Comisiones', href: '/app/broker?tab=commissions' },
    { label: 'Mis clientes', href: '/app/broker?tab=clients' },
    { label: 'Morosidad', href: '/app/broker?tab=aging' },
    { label: 'Producción', href: '/app/broker?tab=production' },
    { label: 'Descargas', href: '/app/broker?tab=downloads' },
    { label: 'Knowledge', href: '/app/broker?tab=knowledge' },
    { label: 'Agenda', href: '/app/broker?tab=agenda' },
  ],
  master: [
    { label: 'Dashboard', href: '/app/master' },
    { label: 'Base de datos', href: '/app/master?tab=db' },
    { label: 'Corredores', href: '/app/master?tab=brokers' },
    { label: 'Aseguradoras', href: '/app/master?tab=insurers' },
    { label: 'Comisiones', href: '/app/master?tab=commissions' },
    { label: 'Morosidad', href: '/app/master?tab=aging' },
    // 👇 nuevo item:
    { label: 'Solicitudes', href: '/app/master/solicitudes' },
    { label: 'Producción', href: '/app/master?tab=production' },
    { label: 'Descargas', href: '/app/master?tab=downloads' },
    { label: 'Knowledge', href: '/app/master?tab=knowledge' },
    { label: 'Agenda', href: '/app/master?tab=agenda' },
  ],
};

export default function SideMenu({ open, onClose, role }: Props) {
  const items = itemsByRole[role];

  return (
    <aside className={`sidenav ${open ? 'open' : ''}`}>
      <div className="header">
        <img src="/logo_alternativo.png" className="logo" alt="LISSA" />
        <button className="close" onClick={onClose} aria-label="Cerrar menú">✕</button>
      </div>

      <nav>
        {items.map((it) => (
          <a key={it.href} href={it.href} onClick={onClose}>{it.label}</a>
        ))}
      </nav>

      <a className="logout" href="/api/logout">Cerrar sesión</a>

      <style jsx>{`
        .sidenav { position: fixed; top: 0; left: 0; width: 300px;
          transform: translateX(-102%); transition: 255ms ease; background:#fff;
          height: 100vh; box-shadow: 0 0 16px rgba(0,0,0,.25); z-index: 1000; padding:12px; }
        .sidenav.open { transform: translateX(0); }
        .header { display:flex; align-items:center; justify-content:space-between; }
        .logo { height:42px; }
        .close { background:none; border:0; color:#fff; cursor:pointer; }
        nav { display:flex; flex-direction:column; margin-top:12px; gap: 8px; }
        nav a { color:#010139; text-decoration:none; font-weight:700; padding:12px 12px; border-radius:6px; transition: transform .1s ease, color .1s; }
        nav a:hover { transform: scale(1.02); color:#8aaa19; }
        .logout { position:absolute; bottom:12px; left:12px; color:#ff0b33; text-decoration:none; }
        @media (max-width:420px) { .sidenav { width: 80vw; } }
      `}</style>
    </aside>
  );
}

