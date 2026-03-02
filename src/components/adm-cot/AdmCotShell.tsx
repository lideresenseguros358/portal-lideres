'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaTachometerAlt,
  FaListAlt,
  FaMoneyBillWave,
  FaComments,
} from 'react-icons/fa';

type BadgeKey = 'pagos' | 'chats';

const NAV_ITEMS: { label: string; shortLabel: string; href: string; icon: typeof FaTachometerAlt; badgeKey?: BadgeKey }[] = [
  { label: 'Dashboard', shortLabel: 'Dashboard', href: '/adm-cot', icon: FaTachometerAlt },
  { label: 'Cotizaciones', shortLabel: 'Cotiz.', href: '/adm-cot/cotizaciones', icon: FaListAlt },
  { label: 'Pagos', shortLabel: 'Pagos', href: '/adm-cot/pagos', icon: FaMoneyBillWave, badgeKey: 'pagos' },
  { label: 'Chats', shortLabel: 'Chats', href: '/adm-cot/chats', icon: FaComments, badgeKey: 'chats' },
];

interface Props {
  children: React.ReactNode;
}

export default function AdmCotShell({ children }: Props) {
  const pathname = usePathname();
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';
  const isDev = env !== 'production';

  // ── Badge counts ──
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ pagos: 0, chats: 0 });

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/adm-cot/badges');
      if (res.ok) {
        const data = await res.json();
        setBadges({ pagos: data.pagos || 0, chats: data.chats || 0 });
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2 flex items-center gap-3 flex-wrap">
            📊 ADM COT
          </h1>
          <p className="text-gray-600 text-base sm:text-lg">
            Módulo administrativo de cotizadores
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

      {/* Tab Navigation — Comisiones style blue card */}
      <div className="bg-white rounded-2xl shadow-lg p-2 flex gap-2 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/adm-cot'
              ? pathname === '/adm-cot'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-sm sm:text-base ${
                isActive
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={14} className={`sm:hidden ${isActive ? 'text-white' : 'text-gray-600'}`} />
              <Icon size={16} className={`hidden sm:block ${isActive ? 'text-white' : 'text-gray-600'}`} />
              <span className={`hidden sm:inline ${isActive ? 'text-white' : 'text-gray-600'}`}>{item.label}</span>
              <span className={`sm:hidden ${isActive ? 'text-white' : 'text-gray-600'}`}>{item.shortLabel}</span>
              {item.badgeKey && badges[item.badgeKey] > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
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
