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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 lg:py-16">

        {/* Hero Header */}
        <div className="text-center mb-8 sm:mb-12 lg:mb-16">

          {/* Main Title */}
          <h1
            data-reveal="down"
            className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-6 leading-tight px-2"
          >
            <span className="text-[#010139]">Cotiza </span>
            <span className="text-[#8AAA19]">y Emite</span>
            <span className="text-[#010139]"> en Minutos</span>
          </h1>

          {/* Subtitle */}
          <p
            data-reveal="fade"
            data-delay="100"
            className="text-sm sm:text-base md:text-lg text-gray-600 max-w-3xl mx-auto mb-4 sm:mb-8 px-4 leading-relaxed"
          >
            <strong className="text-[#010139]">Cotizaciones instantáneas</strong> y{' '}
            <strong className="text-[#8AAA19]">emisión digital</strong>.
            Auto, Vida, Incendio y Contenido.
          </p>

          {/* Feature Badges */}
          <div
            data-reveal="scale"
            data-delay="180"
            className="flex flex-wrap justify-center gap-2 mb-6 sm:mb-8 px-2"
          >
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-full text-xs sm:text-sm font-semibold shadow-lg">
              ⚡ Instantánea
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-full text-xs sm:text-sm font-semibold shadow-lg">
              📄 Digital
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-white border-2 border-[#010139] text-[#010139] rounded-full text-xs sm:text-sm font-semibold shadow-md">
              🔒 Seguro
            </span>
          </div>
        </div>

        {/* Policy Types Grid — scroll-reveal handled inside PolicyTypeGrid */}
        <Suspense fallback={
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]" />
          </div>
        }>
          <PolicyTypeGrid />
        </Suspense>

        {/* Benefits Section */}
        <div
          data-reveal="up"
          className="mt-10 sm:mt-16 lg:mt-20"
        >
          <div className="bg-gradient-to-br from-[#010139] to-[#020270] rounded-xl sm:rounded-2xl lg:rounded-3xl shadow-2xl p-5 sm:p-8 lg:p-10 max-w-5xl mx-auto">
            <div className="text-center mb-5 sm:mb-8">
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2 px-4">
                ¿Por qué elegirnos?
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-gray-300 px-4">
                Más de 20 años protegiendo familias
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {[
                { emoji: '⚡', title: 'Inmediata', sub: 'Resultados en segundos', delay: '0' },
                { emoji: '📄', title: 'Digital',   sub: 'Desde casa, sin papeles', delay: '100' },
                { emoji: '🔒', title: 'Seguro',    sub: 'Datos protegidos',        delay: '200' },
                { emoji: '💰', title: 'Mejor Precio', sub: 'Comparamos por ti',   delay: '300' },
              ].map(({ emoji, title, sub, delay }) => (
                <div
                  key={title}
                  data-reveal="up"
                  data-delay={delay}
                  className="bg-white/10 backdrop-blur-sm rounded-lg sm:rounded-xl p-3 sm:p-5 lg:p-6 border border-white/20 hover:bg-white/20 transition-all duration-300"
                >
                  <div className="text-2xl sm:text-3xl lg:text-4xl mb-2 sm:mb-3">{emoji}</div>
                  <h4 className="font-bold text-white mb-1 sm:mb-2 text-sm sm:text-base lg:text-lg">{title}</h4>
                  <p className="text-xs text-gray-300 hidden sm:block">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
