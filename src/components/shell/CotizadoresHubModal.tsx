'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCalculator, FaHeadset, FaShieldAlt, FaTimes } from 'react-icons/fa';
import type { IconType } from 'react-icons';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface HubOption {
  label: string;
  description: string;
  href: string;
  icon: IconType;
  color: string;
}

const HUB_OPTIONS: HubOption[] = [
  {
    label: 'Cotizadores',
    description: 'Cotizadores públicos de Auto, Vida, Incendio y Contenido',
    href: '/cotizadores',
    icon: FaCalculator,
    color: '#8AAA19',
  },
  {
    label: 'Operaciones',
    description: 'Centro de operaciones: renovaciones, peticiones, urgencias y más',
    href: '/operaciones',
    icon: FaHeadset,
    color: '#010139',
  },
  {
    label: 'ADM COT',
    description: 'Administración de cotizadores: cotizaciones, pagos y chats',
    href: '/adm-cot',
    icon: FaShieldAlt,
    color: '#4F46E5',
  },
];

function HubButton({ opt, onClick }: { opt: HubOption; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const Icon = opt.icon;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-transparent hover:shadow-lg transition-all duration-200 cursor-pointer text-left"
    >
      <div
        className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-200"
        style={{ background: hovered ? opt.color : `${opt.color}20` }}
      >
        <Icon
          className="text-xl sm:text-2xl transition-colors duration-200"
          style={{ color: hovered ? '#fff' : opt.color }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm sm:text-base font-bold text-gray-800 transition-colors">
          {opt.label}
        </p>
        <p className="text-[11px] sm:text-xs text-gray-500 leading-tight mt-0.5">
          {opt.description}
        </p>
      </div>
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
        style={{ background: hovered ? opt.color : '#f3f4f6' }}
      >
        <svg
          className="w-4 h-4 transition-colors"
          style={{ color: hovered ? '#fff' : '#9ca3af' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

export default function CotizadoresHubModal({ open, onClose }: Props) {
  const router = useRouter();

  if (!open) return null;

  const handleNav = (href: string) => {
    onClose();
    const toggle = document.getElementById('app-sidemenu-toggle') as HTMLInputElement;
    if (toggle) toggle.checked = false;
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">Centro de Cotizadores</h2>
            <p className="text-[11px] sm:text-xs text-white/70">Selecciona a dónde deseas ir</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <FaTimes className="text-sm" />
          </button>
        </div>

        {/* Options */}
        <div className="p-4 sm:p-5 space-y-3">
          {HUB_OPTIONS.map((opt) => (
            <HubButton key={opt.href} opt={opt} onClick={() => handleNav(opt.href)} />
          ))}
        </div>
      </div>
    </div>
  );
}
