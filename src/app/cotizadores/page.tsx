/**
 * Landing Page - Cotizadores
 * Ruta pública - No requiere autenticación
 */

import { Suspense } from 'react';
import PolicyTypeGrid from '@/components/cotizadores/PolicyTypeGrid';

export const metadata = {
  title: 'Cotiza y Emite en Minutos - Portal Líderes en Seguros',
  description: 'Cotiza y emite tu póliza en minutos. Auto, Vida, Incendio y Contenido. Proceso 100% digital.'
};

export default function CotizadoresPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Hero Header */}
        <div className="text-center mb-10 sm:mb-12 lg:mb-16">
          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
            <span className="text-[#010139]">Cotiza </span>
            <span className="text-[#8AAA19]">y Emite</span>
            <span className="text-[#010139]"> en Minutos</span>
          </h1>
          
          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-6 sm:mb-8 px-4">
            <strong className="text-[#010139]">Cotizaciones instantáneas</strong> y <strong className="text-[#8AAA19]">emisión digital</strong>. 
            Auto, Vida, Incendio y Contenido.
          </p>
          
          {/* Feature Badges */}
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8">
            <span className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-full text-xs sm:text-sm font-semibold shadow-lg">
              ⚡ Cotización Instantánea
            </span>
            <span className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-full text-xs sm:text-sm font-semibold shadow-lg">
              📄 Emisión Digital
            </span>
            <span className="inline-flex items-center gap-1 px-3 sm:px-4 py-1.5 sm:py-2 bg-white border-2 border-[#010139] text-[#010139] rounded-full text-xs sm:text-sm font-semibold shadow-md">
              🔒 100% Seguro
            </span>
          </div>
        </div>

        {/* Policy Types Grid */}
        <Suspense fallback={
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
          </div>
        }>
          <PolicyTypeGrid />
        </Suspense>

        {/* Benefits Section */}
        <div className="mt-12 sm:mt-16 lg:mt-20">
          <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-2xl sm:rounded-3xl shadow-2xl p-6 sm:p-8 lg:p-10 max-w-5xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-2 sm:mb-3">
                ¿Por qué elegir Líderes en Seguros?
              </h3>
              <p className="text-sm sm:text-base text-gray-300">
                Más de 20 años protegiendo a miles de familias panameñas
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="text-3xl sm:text-4xl mb-3">⚡</div>
                <h4 className="font-bold text-white mb-2 text-base sm:text-lg">Cotización Inmediata</h4>
                <p className="text-xs sm:text-sm text-gray-300">Resultados en segundos, compara y elige</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="text-3xl sm:text-4xl mb-3">📄</div>
                <h4 className="font-bold text-white mb-2 text-base sm:text-lg">Emisión Digital</h4>
                <p className="text-xs sm:text-sm text-gray-300">Emite tu póliza desde casa, sin papeleos</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="text-3xl sm:text-4xl mb-3">🔒</div>
                <h4 className="font-bold text-white mb-2 text-base sm:text-lg">100% Seguro</h4>
                <p className="text-xs sm:text-sm text-gray-300">Tus datos protegidos y encriptados</p>
              </div>
              
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-white/20 hover:bg-white/20 transition-all duration-300">
                <div className="text-3xl sm:text-4xl mb-3">💰</div>
                <h4 className="font-bold text-white mb-2 text-base sm:text-lg">Mejor Precio</h4>
                <p className="text-xs sm:text-sm text-gray-300">Comparamos aseguradoras por ti</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
