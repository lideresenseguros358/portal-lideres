/**
 * Layout para módulo Cotizadores
 * Público - No requiere autenticación
 */

'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaSignOutAlt } from 'react-icons/fa';

export default function CotizadoresLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
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
            {/* Espacio vacío para mantener estructura */}
            <div></div>
            
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
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-[#010139] via-[#020270] to-[#010139] text-white py-8 sm:py-12 mt-16 sm:mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo y descripción */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/20 to-white/10 flex items-center justify-center backdrop-blur-sm border border-white/30">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <div className="text-left">
                <h3 className="text-lg sm:text-xl font-bold text-white">Líderes en Seguros</h3>
                <p className="text-xs sm:text-sm text-gray-300">Cotizador Digital</p>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 max-w-2xl mx-auto px-4">
              Más de 20 años ofreciendo soluciones de seguros personalizadas para ti y tu familia
            </p>
          </div>
          
          {/* Información */}
          <div className="border-t border-white/20 pt-6 sm:pt-8 text-center">
            <p className="text-xs sm:text-sm text-gray-300 mb-2">
              © {new Date().getFullYear()} Líderes en Seguros. Todos los derechos reservados.
            </p>
            <p className="text-xs text-gray-400">
              Cotizaciones en línea • Auto • Vida • Incendio • Contenido
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Proceso 100% digital y seguro
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
