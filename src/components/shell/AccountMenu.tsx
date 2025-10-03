'use client';

import { useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { FaUserCircle, FaCog, FaSignOutAlt } from 'react-icons/fa';
import LogoutButton from './LogoutButton';

interface AccountMenuProps {
  displayName: string;
  role: string;
  avatarUrl: string | null;
}

export default function AccountMenu({ displayName, role, avatarUrl }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const handleToggle = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setOpen((prev) => !prev);
  };

  return (
    <div className="user-menu account-menu" ref={containerRef}>
      <button
        type="button"
        className="user-avatar"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
      >
        {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <FaUserCircle />}
      </button>

      <div className={`dropdown-menu${open ? ' open' : ''}`} role="menu">
        <div className="dropdown-header">
          <span className="user-name">{displayName}</span>
          <span className="user-role">{role}</span>
        </div>
        <Link
          href="/account"
          className="dropdown-item"
          role="menuitem"
          onClick={() => setOpen(false)}
        >
          <FaCog className="dropdown-icon" />
          <span>Configuración</span>
        </Link>
        <LogoutButton onAfterLogout={() => setOpen(false)}>
          <FaSignOutAlt className="dropdown-icon" />
          <span>Cerrar sesión</span>
        </LogoutButton>
      </div>

      <style jsx>{`
        .account-menu {
          position: relative;
        }

        .account-menu .dropdown-menu {
          padding: 8px 0;
        }

        .account-menu .dropdown-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 1px 18px 5px;
          border-bottom: 1px solid #f0f0f0;
          gap: 4px;
        }

        .account-menu .user-name {
          margin: 6px 0 0;
          font-weight: 600;
          color: #010139;
        }

        .account-menu .user-role {
          font-size: 12px;
          color: #8aaa19;
          letter-spacing: 0.04em;
        }



      `}</style>
    </div>
  );
}
