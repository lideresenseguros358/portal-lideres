/**
 * Componente Breadcrumb para navegación del flujo de cotizaciones
 */

'use client';

import Link from 'next/link';
import { FaChevronRight, FaHome } from 'react-icons/fa';

export interface BreadcrumbItem {
  label: string;
  href?: string; // Si no tiene href, es el item actual
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center space-x-2 text-sm mb-6" aria-label="Breadcrumb">
      <Link
        href="/cotizadores"
        className="flex items-center text-gray-600 hover:text-[#8AAA19] transition-colors"
      >
        <FaHome className="mr-1" />
        Inicio
      </Link>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={index} className="flex items-center">
            <FaChevronRight className="mx-2 text-gray-400 text-xs" />
            
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="flex items-center text-gray-600 hover:text-[#8AAA19] transition-colors"
              >
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </Link>
            ) : (
              <span className="flex items-center text-[#8AAA19] font-semibold">
                {item.icon && <span className="mr-1">{item.icon}</span>}
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
