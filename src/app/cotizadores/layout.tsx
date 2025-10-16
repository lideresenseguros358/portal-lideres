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
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link 
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-[#010139] transition-colors"
            >
              <FaArrowLeft />
              <span className="font-semibold">Volver al inicio</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#010139] to-[#8AAA19] flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <div className="hidden sm:block">
                <h2 className="text-sm font-bold text-[#010139]">Líderes en Seguros</h2>
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
      <footer className="bg-[#010139] text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-300">
            © {new Date().getFullYear()} Líderes en Seguros. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Cotizaciones en línea • Seguros de Auto, Vida, Incendio y Contenido
          </p>
        </div>
      </footer>
    </div>
  );
}
