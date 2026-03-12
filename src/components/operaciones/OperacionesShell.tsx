'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaTachometerAlt,
  FaSync,
  FaInbox,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaUsers,
  FaClipboardList,
  FaCog,
} from 'react-icons/fa';

type BadgeKey = 'renovaciones' | 'peticiones' | 'urgencias' | 'morosidad';

const NAV_ITEMS: { label: string; shortLabel: string; href: string; icon: typeof FaTachometerAlt; badgeKey?: BadgeKey }[] = [
  { label: 'Resumen', shortLabel: 'Resumen', href: '/operaciones', icon: FaTachometerAlt },
  { label: 'Renovaciones', shortLabel: 'Renov.', href: '/operaciones/renovaciones', icon: FaSync, badgeKey: 'renovaciones' },
  { label: 'Peticiones', shortLabel: 'Petic.', href: '/operaciones/peticiones', icon: FaInbox, badgeKey: 'peticiones' },
  { label: 'Urgencias', shortLabel: 'Urgenc.', href: '/operaciones/urgencias', icon: FaExclamationTriangle, badgeKey: 'urgencias' },
  { label: 'Morosidad', shortLabel: 'Morosi.', href: '/operaciones/morosidad', icon: FaMoneyBillWave, badgeKey: 'morosidad' },
  { label: 'Equipo', shortLabel: 'Equipo', href: '/operaciones/equipo', icon: FaUsers },
  { label: 'Logs', shortLabel: 'Logs', href: '/operaciones/logs', icon: FaClipboardList },
  { label: 'Config', shortLabel: 'Config', href: '/operaciones/config', icon: FaCog },
];

interface Props {
  children: React.ReactNode;
}

export default function OperacionesShell({ children }: Props) {
  const pathname = usePathname();
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';
  const isDev = env !== 'production';

  // ── Badge counts ──
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ renovaciones: 0, peticiones: 0, urgencias: 0, morosidad: 0 });

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/operaciones/badges');
      if (res.ok) {
        const data = await res.json();
        setBadges({ renovaciones: data.renovaciones || 0, peticiones: data.peticiones || 0, urgencias: data.urgencias || 0, morosidad: data.morosidad || 0 });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  return (
    <div className="space-y-2 sm:space-y-3 lg:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#010139] mb-1 flex items-center gap-2 sm:gap-3 flex-wrap">
            ⚙️ Operaciones
          </h1>
          <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
            Centro de operaciones y gestión integral
          </p>
        </div>
        <span
          className={`self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
            isDev
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-green-100 text-green-800 border border-green-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isDev ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
          {isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}
        </span>
      </div>

      {/* Tab Navigation — Same style as ADM COT */}
      <div className="bg-white rounded-2xl shadow-lg p-1.5 sm:p-2 flex gap-1 sm:gap-2 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/operaciones'
              ? pathname === '/operaciones'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 lg:px-4 py-2 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-xs sm:text-sm lg:text-base ${
                isActive
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon className={`flex-shrink-0 text-sm sm:text-base ${isActive ? 'text-white' : 'text-gray-600'}`} />
              <span className={`hidden lg:inline ${isActive ? 'text-white' : 'text-gray-600'}`}>{item.label}</span>
              <span className={`lg:hidden ${isActive ? 'text-white' : 'text-gray-600'}`}>{item.shortLabel}</span>
              {item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold ${
                  isActive ? 'bg-[#8AAA19]' : 'bg-red-500 text-white'
                }`}>
                  {badges[item.badgeKey] > 99 ? '99+' : badges[item.badgeKey]}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
