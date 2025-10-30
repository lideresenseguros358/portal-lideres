/**
 * Layout para módulo Cotizadores
 * Público - No requiere autenticación
 */

import { ReactNode } from 'react';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';

export default function CotizadoresLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header público */}
      <header className="bg-white shadow-md border-b-2 border-gray-200 sticky top-0 z-40 backdrop-blur-lg bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Back Button */}
            <a 
              href="https://www.lideresenseguros.com"
              className="flex items-center gap-2 text-gray-600 hover:text-[#010139] transition-colors group"
            >
              <FaArrowLeft className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-semibold text-sm sm:text-base hidden xs:inline">Volver al sitio web</span>
              <span className="font-semibold text-sm xs:hidden">Volver</span>
            </a>
            
            {/* Logo */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Logo Icon */}
              <div className="relative">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#010139] via-[#020270] to-[#8AAA19] flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg sm:text-xl">L</span>
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 bg-[#8AAA19] rounded-full border-2 border-white flex items-center justify-center">
                  <span className="text-white text-xs font-bold">✓</span>
                </div>
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
