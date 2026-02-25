'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FaTachometerAlt,
  FaListAlt,
  FaFolderOpen,
  FaMoneyBillWave,
  FaComments,
} from 'react-icons/fa';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/adm-cot', icon: <FaTachometerAlt /> },
  { label: 'Cotizaciones', href: '/adm-cot/cotizaciones', icon: <FaListAlt /> },
  { label: 'Expedientes', href: '/adm-cot/expedientes', icon: <FaFolderOpen /> },
  { label: 'Pagos', href: '/adm-cot/pagos', icon: <FaMoneyBillWave /> },
  { label: 'Chats', href: '/adm-cot/chats', icon: <FaComments /> },
];

interface Props {
  children: React.ReactNode;
}

export default function AdmCotShell({ children }: Props) {
  const pathname = usePathname();
  const env = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';
  const isDev = env !== 'production';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#010139]">ADM COT</h1>
          <p className="text-sm text-gray-500">Módulo administrativo de cotizadores</p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide ${
            isDev
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-green-100 text-green-800 border border-green-300'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isDev ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`} />
          {isDev ? 'DESARROLLO' : 'PRODUCCIÓN'}
        </span>
      </div>

      {/* Internal Navigation Tabs */}
      <nav className="flex gap-1 overflow-x-auto pb-1 border-b border-gray-200">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/adm-cot'
              ? pathname === '/adm-cot'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-white text-[#010139] border border-b-0 border-gray-200 shadow-sm -mb-px'
                  : 'text-gray-500 hover:text-[#010139] hover:bg-gray-50'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Page Content */}
      <div>{children}</div>
    </div>
  );
}
