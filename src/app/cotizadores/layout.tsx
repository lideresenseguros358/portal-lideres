/**
 * Layout para módulo Cotizadores
 * Público - No requiere autenticación
 */

'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { FaSignOutAlt } from 'react-icons/fa';
import MobileBottomNav from '@/components/cotizadores/mobile/MobileBottomNav';

export default function CotizadoresLayout({ children }: { children: ReactNode }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const handleExit = () => {
    window.location.href = 'https://www.lideresenseguros.com';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header público */}
      <header className="bg-white shadow-md border-b-2 border-gray-200 sticky top-0 z-40 backdrop-blur-lg bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div />
            
            {/* Contenedor derecho con avatar y texto */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Avatar con logo alternativo clickeable */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="relative focus:outline-none focus:ring-2 focus:ring-[#8AAA19] rounded-xl transition-all hover:scale-105"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-[#010139] flex items-center justify-center shadow-lg p-2">
                    <Image
                      src="/logo_alternativo.png"
                      alt="Líderes en Seguros"
                      width={40}
                      height={40}
                      className="w-full h-full object-contain"
                      priority
                      unoptimized
                    />
                  </div>
                  {/* Ganchito verde */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-[#8AAA19] rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                </button>

                {/* Dropdown Popup */}
                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-lg shadow-xl border-2 border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={handleExit}
                      className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <FaSignOutAlt className="text-[#8AAA19]" />
                      <span className="font-semibold">Salir</span>
                    </button>
                  </div>
                )}
              </div>
              
              {/* Logo Text */}
              <div className="hidden sm:block">
                <h2 className="text-sm sm:text-base font-bold text-[#010139] leading-tight">Líderes en Seguros</h2>
                <p className="text-xs text-gray-600">Cotizador Online</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="pb-4 md:pb-0">
        {children}
      </main>

      {/* Footer — hidden on mobile, Info panel replaces it */}
      <footer className="hidden md:block mt-16 sm:mt-20">
        {/* Regulatory Footer */}
        <div className="bg-[#010139] py-5 px-4 text-center">
          <p className="text-[11px] text-gray-400 leading-relaxed mb-2">
            Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750
          </p>
          <Image
            src="/aseguradoras/logo-SSRP.png"
            alt="SSRP"
            width={90}
            height={30}
            className="inline-block opacity-85"
            unoptimized
          />
        </div>
        {/* Informational Footer */}
        <div className="bg-[#010139]/95 py-4 px-4 text-center border-t border-white/10">
          <p className="text-[11px] text-gray-500">
            © {new Date().getFullYear()} Líderes en Seguros, S.A. — Cotizador Digital
          </p>
        </div>
      </footer>

      {/* Mobile Regulatory Footer — visible only on mobile, above bottom nav */}
      <div className="block md:hidden bg-[#010139] py-4 px-4 text-center mb-16">
        <p className="text-[10px] text-gray-400 leading-relaxed mb-2">
          Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750
        </p>
        <Image
          src="/aseguradoras/logo-SSRP.png"
          alt="SSRP"
          width={70}
          height={24}
          className="inline-block opacity-85"
          unoptimized
        />
      </div>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

    </div>
  );
}
