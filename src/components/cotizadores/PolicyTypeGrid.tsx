/**
 * Grid de Tipos de Póliza - Landing
 */

'use client';

import Link from 'next/link';
import { FaCar, FaHeart, FaFire, FaCouch } from 'react-icons/fa';

const policyTypes = [
  {
    id: 'auto',
    title: 'Auto',
    description: 'Cobertura completa y daños a terceros',
    badge: 'Populares',
    icon: FaCar,
    href: '/cotizadores/auto',
    gradient: 'from-[#8AAA19] to-[#6d8814]',
    iconBg: 'bg-green-50',
    iconColor: 'text-[#8AAA19]',
    hoverBorder: 'hover:border-[#010139]'
  },
  {
    id: 'vida',
    title: 'Vida',
    description: 'Exclusivo ASSA - Protección familiar garantizada',
    badge: 'Exclusivo ASSA',
    icon: FaHeart,
    href: '/cotizadores/vida',
    gradient: 'from-[#010139] to-[#020270]',
    iconBg: 'bg-blue-50',
    iconColor: 'text-[#010139]',
    hoverBorder: 'hover:border-[#8AAA19]'
  },
  {
    id: 'incendio',
    title: 'Incendio',
    description: 'Proteja la estructura de su hogar',
    badge: 'Recomendado',
    icon: FaFire,
    href: '/cotizadores/incendio',
    gradient: 'from-orange-600 to-orange-700',
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-600',
    hoverBorder: 'hover:border-orange-500'
  },
  {
    id: 'contenido',
    title: 'Contenido',
    description: 'Protege todas tus pertenencias',
    badge: 'Completo',
    icon: FaCouch,
    href: '/cotizadores/contenido',
    gradient: 'from-teal-600 to-teal-700',
    iconBg: 'bg-teal-50',
    iconColor: 'text-teal-600',
    hoverBorder: 'hover:border-teal-500'
  }
];

export default function PolicyTypeGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {policyTypes.map(policy => {
        const Icon = policy.icon;
        
        return (
          <Link
            key={policy.id}
            href={policy.href}
            className="group block"
          >
            <div className={`relative bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 sm:p-6 hover:shadow-2xl ${policy.hoverBorder} hover:-translate-y-2 transition-all duration-300 overflow-hidden`}>
              {/* Badge */}
              <div className="absolute top-3 right-3">
                <span className="inline-block px-2 py-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-bold rounded-full shadow-md">
                  {policy.badge}
                </span>
              </div>
              
              {/* Icon */}
              <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-xl ${policy.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                <Icon className={`text-2xl sm:text-3xl ${policy.iconColor}`} />
              </div>
              
              {/* Title */}
              <h3 className="text-lg sm:text-xl font-bold text-[#010139] mb-2 group-hover:text-[#8AAA19] transition-colors">
                {policy.title}
              </h3>
              
              {/* Description */}
              <p className="text-gray-600 text-xs sm:text-sm mb-4 min-h-[2.5rem]">
                {policy.description}
              </p>
              
              {/* CTA Button */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-gradient-to-r ${policy.gradient} text-white text-xs sm:text-sm font-bold shadow-lg group-hover:shadow-xl transition-shadow`}>
                  COTIZAR Y EMITIR
                </div>
                <span className="text-[#8AAA19] font-bold text-xl group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </div>
              
              {/* Decorative Element */}
              <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"></div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
