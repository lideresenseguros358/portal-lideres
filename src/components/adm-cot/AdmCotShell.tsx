'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaTachometerAlt,
  FaListAlt,
  FaMoneyBillWave,
  FaComments,
} from 'react-icons/fa';

const NAV_ITEMS = [
  { label: 'Dashboard', shortLabel: 'Dashboard', href: '/adm-cot', icon: FaTachometerAlt },
  { label: 'Cotizaciones', shortLabel: 'Cotiz.', href: '/adm-cot/cotizaciones', icon: FaListAlt },
  { label: 'Pagos', shortLabel: 'Pagos', href: '/adm-cot/pagos', icon: FaMoneyBillWave },
  { label: 'Chats', shortLabel: 'Chats', href: '/adm-cot/chats', icon: FaComments },
];

interface Props {
  children: React.ReactNode;
}

export default function AdmCotShell({ children }: Props) {
  const pathname = usePathname();
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';
  const isDev = env !== 'production';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] flex items-center gap-3 flex-wrap">
            📊 ADM COT
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
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
      <div className="bg-white rounded-2xl shadow-lg p-1.5 sm:p-2 flex gap-1.5 sm:gap-2 overflow-x-auto">
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
              className={`flex-1 min-w-[80px] sm:min-w-[140px] flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-xs sm:text-sm ${
                isActive
                  ? 'bg-gradient-to-r from-[#010139] to-[#020270] text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={14} className={`sm:hidden flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              <Icon size={16} className={`hidden sm:block flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
