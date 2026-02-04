"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  FaHome,
  FaMoneyBillWave,
  FaDatabase,
  FaCalendarAlt,
  FaFileAlt,
  FaClipboardList,
  FaCog,
  FaDownload,
  FaUser,
  FaChartLine,
  FaUsers,
  FaBuilding,
  FaUserTie,
  FaClock,
  FaTachometerAlt,
  FaMoneyCheckAlt,
  FaFileInvoiceDollar,
  FaBookOpen,
  FaChartBar,
  FaExclamationTriangle,
  FaCalculator,
  FaSync,
} from "react-icons/fa";

type MenuRole = "MASTER" | "BROKER";

interface MenuItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const menuItems: Record<MenuRole, MenuItem[]> = {
  MASTER: [
    { label: "Dashboard", href: "/dashboard", icon: <FaTachometerAlt /> },
    { label: "Base de datos", href: "/db", icon: <FaDatabase /> },
    { label: "Aseguradoras", href: "/insurers", icon: <FaBuilding /> },
    { label: "Comisiones", href: "/commissions", icon: <FaMoneyCheckAlt /> },
    { label: "Cheques", href: "/checks", icon: <FaFileInvoiceDollar /> },
    { label: "Morosidad", href: "/delinquency", icon: <FaExclamationTriangle /> },
    { label: "Pendientes", href: "/cases", icon: <FaClock /> },
    { label: "Renovaciones LISSA", href: "/renovaciones-lissa", icon: <FaSync /> },
    { label: "Descargas", href: "/downloads", icon: <FaDownload /> },
    { label: "Guías", href: "/guides", icon: <FaBookOpen /> },
    { label: "Cotizadores", href: "/cotizadores", icon: <FaCalculator /> },
    { label: "Agenda", href: "/agenda", icon: <FaCalendarAlt /> },
    { label: "Producción", href: "/production", icon: <FaChartBar /> },
    { label: "Corredores", href: "/brokers", icon: <FaUserTie /> },
    { label: "Configuración", href: "/config", icon: <FaCog /> },
    { label: "Solicitudes", href: "/requests", icon: <FaClipboardList /> },
  ],
  BROKER: [
    { label: "Dashboard", href: "/dashboard", icon: <FaTachometerAlt /> },
    { label: "Base de datos", href: "/db", icon: <FaDatabase /> },
    { label: "Comisiones", href: "/commissions", icon: <FaMoneyCheckAlt /> },
    { label: "Pendientes", href: "/cases", icon: <FaClock /> },
    { label: "Morosidad", href: "/delinquency", icon: <FaExclamationTriangle /> },
    { label: "Descargas", href: "/downloads", icon: <FaDownload /> },
    { label: "Guías", href: "/guides", icon: <FaBookOpen /> },
    { label: "Agenda", href: "/agenda", icon: <FaCalendarAlt /> },
    { label: "Producción", href: "/production", icon: <FaChartBar /> },
    { label: "Configuración", href: "/account", icon: <FaCog /> },
  ],
};

interface SideMenuProps {
  role: MenuRole;
}
export default function SideMenu({ role }: SideMenuProps) {
  const pathname = usePathname();
  const items = menuItems[role] || menuItems.BROKER;

  return (
    <>
      <aside className="side-menu">
        {/* Menu header with logo */}
        <div className="side-menu__header">
          <Image
            src="/logo_alternativo.png"
            alt="LISSA"
            width={120}
            height={30}
            priority
            className="side-menu__logo"
          />
        </div>

        {/* Navigation */}
        <nav className="side-menu__nav">
          <ul>
            {items.map((item) => {
              const isActive = pathname === item.href;
              
              return (
                <li key={item.href} className={isActive ? "active" : ""}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      // Close sidemenu on mobile after clicking
                      const toggle = document.getElementById("app-sidemenu-toggle") as HTMLInputElement;
                      if (toggle) toggle.checked = false;
                    }}
                  >
                    <span className="icon">{item.icon}</span>
                    <span className="label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <style>{`
        .side-menu {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;
          width: 260px;
          background: #010139;
          transform: translateX(-100%);
          transition: transform 0.2s ease;
          z-index: 999;
          overflow-y: auto;
          /* Ocultar scrollbar en todos los navegadores */
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE y Edge */
        }

        /* Ocultar scrollbar en Chrome, Safari y Opera */
        .side-menu::-webkit-scrollbar {
          display: none;
        }

        /* When the checkbox is checked, show the menu */

        .side-menu__header {
          padding: 32px 24px;
          text-align: center;
        }

        .side-menu__logo {
          max-width: 100%;
          height: auto;
        }

        .side-menu__nav {
          padding: 0 16px;
        }

        .side-menu__nav ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .side-menu__nav a {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          color: #ffffff;
          text-decoration: none;
          border-radius: 12px;
          transition: all 0.2s ease;
          font-size: 12px;
        }

        .side-menu__nav a .icon {
          font-size: 18px;
          width: 24px;
          text-align: center;
        }

        .side-menu__nav a .label {
          flex: 1;
        }

        .side-menu__nav a:hover {
          transform: scale(1.03);
          color: #8aaa19;
        }

        .side-menu__nav li.active a {
          color: #8aaa19;
        }

        @media (max-width: 768px) {
          .side-menu {
            width: 240px;
          }
        }
      `}</style>
    </>
  );
}
