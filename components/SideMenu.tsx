// components/SideMenu.tsx
import React, { useEffect } from 'react';
import { useRouter } from 'next/router';

type Props = {
  open: boolean;
  onClose: () => void;
  role: 'master' | 'broker';
};

const OLIVE = '#8aaa19';
const BLUE = '#010139';

const itemsByRole: Record<'master' | 'broker', { label: string; href: string }[]> = {
  broker: [
    { label: 'Dashboard',       href: '/app/broker' },
    { label: 'Comisiones',      href: '/app/broker/commissions' },
    { label: 'Mis clientes',    href: '/app/broker/clients' },
    { label: 'Morosidad',       href: '/app/broker/morosidad' },
    { label: 'Producción',      href: '/app/broker/production' },
    { label: 'Descargas',       href: '/app/broker/downloads' },
    { label: 'Knowledge',       href: '/app/broker/knowledge' },
    { label: 'Agenda',          href: '/app/broker/agenda' },
  ],
  master: [
    { label: 'Dashboard',       href: '/app/master' },
    { label: 'Base de datos',   href: '/app/master?tab=db' },
    { label: 'Corredores',      href: '/app/master/brokers' },
    { label: 'Aseguradoras',    href: '/app/master/insurers' },
    { label: 'Comisiones',      href: '/app/master/commissions' },
    { label: 'Morosidad',       href: '/app/master/morosidad' },
    { label: 'Solicitudes',     href: '/app/master/solicitudes' },
    { label: 'Producción',      href: '/app/master/production' },
    { label: 'Descargas',       href: '/app/master/downloads' },
    { label: 'Knowledge',       href: '/app/master/knowledge' },
    { label: 'Agenda',          href: '/app/master/agenda' },
  ],
};

export default function SideMenu({ open, onClose, role }: Props) {
  const router = useRouter();
  const items = itemsByRole[role];

  // cerrar con ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <aside className="side" role="dialog" aria-label="Menú lateral">
        <nav>
          {items.map(it => {
            const active = router.asPath === it.href || router.asPath.startsWith(it.href + '?');
            return (
              <a key={it.href} href={it.href} className={active ? 'active' : ''} onClick={onClose}>
                {it.label}
              </a>
            );
          })}
        </nav>
      </aside>

      <style jsx>{`
        .backdrop { position:fixed; inset:0; background: rgba(0,0,0,.3); z-index: 90; }
        .side {
          position:fixed; top:0; left:0; bottom:0; width: 300px;
          background:${BLUE}; color:#fff; z-index: 100; padding: 18px 12px;
          box-shadow: 6px 0 24px rgba(0,0,0,.35);
        }
        nav { display:flex; flex-direction:column; gap:12px; margin-top: 22px; }
        a { color:#fff; font-size:18px; text-decoration:none; padding:8px 10px; border-radius:8px; }
        a:hover { background: rgba(255,255,255,.08); }
        a.active { color:${OLIVE}; font-weight: 700; }
      `}</style>
    </>
  );
}
