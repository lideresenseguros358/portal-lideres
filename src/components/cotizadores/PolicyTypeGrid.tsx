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
    description: 'Protección familiar garantizada',
    badge: 'Termino',
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 lg:gap-6">
      {policyTypes.map(policy => {
        const Icon = policy.icon;
        
        return (
          <Link
            key={policy.id}
            href={policy.href}
            className="group block"
          >
            <div className={`relative bg-white rounded-xl sm:rounded-2xl shadow-lg border-2 border-gray-200 p-5 sm:p-6 hover:shadow-2xl ${policy.hoverBorder} active:scale-95 sm:hover:-translate-y-2 transition-all duration-300 overflow-hidden h-full min-h-[280px] sm:min-h-[300px] lg:min-h-[320px] flex flex-col`}>
              {/* Badge */}
              <div className="absolute top-3 right-3 z-10">
                <span className="inline-block px-2.5 py-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-bold rounded-full shadow-md">
                  {policy.badge}
                </span>
              </div>
              
              {/* Icon */}
              <div className={`w-16 h-16 sm:w-18 sm:h-18 rounded-xl ${policy.iconBg} flex items-center justify-center mb-3 sm:mb-4 mx-auto sm:mx-0 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                <Icon className={`text-3xl sm:text-4xl ${policy.iconColor}`} />
              </div>
              
              {/* Content */}
              <div className="flex-1 flex flex-col text-center sm:text-left">
                {/* Title */}
                <h3 className="text-xl sm:text-2xl font-bold text-[#010139] mb-2 group-hover:text-[#8AAA19] transition-colors">
                  {policy.title}
                </h3>
                
                {/* Description */}
                <p className="text-gray-600 text-sm sm:text-base mb-4 flex-1 leading-snug">
                  {policy.description}
                </p>
                
                {/* CTA Button */}
                <div className="mt-auto">
                  <div className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-gradient-to-r ${policy.gradient} text-white text-xs sm:text-sm font-bold shadow-lg group-hover:shadow-xl transition-all group-hover:scale-105 w-full`}>
                    {policy.id === 'auto' ? (
                      <span>COTIZAR Y EMITIR</span>
                    ) : (
                      <span>COTIZAR</span>
                    )}
                    <span className="text-white font-bold text-lg group-hover:translate-x-1 transition-transform">
                      →
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Decorative Element */}
              <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded-full opacity-30 group-hover:opacity-60 transition-opacity"></div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
