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
    description: 'Cobertura para tu vehículo',
    icon: FaCar,
    href: '/cotizadores/auto',
    gradient: 'from-blue-500 to-blue-700',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600'
  },
  {
    id: 'vida',
    title: 'Vida',
    description: 'Protección para tu familia',
    icon: FaHeart,
    href: '/cotizadores/vida',
    gradient: 'from-pink-500 to-pink-700',
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600'
  },
  {
    id: 'incendio',
    title: 'Incendio',
    description: 'Seguridad para tu hogar',
    icon: FaFire,
    href: '/cotizadores/incendio',
    gradient: 'from-orange-500 to-orange-700',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600'
  },
  {
    id: 'contenido',
    title: 'Contenido',
    description: 'Protege tus pertenencias',
    icon: FaCouch,
    href: '/cotizadores/contenido',
    gradient: 'from-green-500 to-green-700',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600'
  }
];

export default function PolicyTypeGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {policyTypes.map(policy => {
        const Icon = policy.icon;
        
        return (
          <Link
            key={policy.id}
            href={policy.href}
            className="group block"
          >
            <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 hover:shadow-xl hover:border-[#8AAA19] hover:-translate-y-1 transition-all duration-300">
              <div className={`w-16 h-16 rounded-xl ${policy.iconBg} flex items-center justify-center mb-4`}>
                <Icon className={`text-3xl ${policy.iconColor}`} />
              </div>
              
              <h3 className="text-xl font-bold text-[#010139] mb-2 group-hover:text-[#8AAA19] transition-colors">
                {policy.title}
              </h3>
              
              <p className="text-gray-600 text-sm mb-4">
                {policy.description}
              </p>
              
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r ${policy.gradient} text-white text-sm font-semibold`}>
                COTIZAR
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
