/**
 * Landing Page - Cotizadores
 * Ruta pública - No requiere autenticación
 */

import { Suspense } from 'react';
import PolicyTypeGrid from '@/components/cotizadores/PolicyTypeGrid';

export const metadata = {
  title: 'Cotizadores - Portal Líderes en Seguros',
  description: 'Cotiza tu póliza en minutos. Auto, Vida, Incendio y Contenido.'
};

export default function CotizadoresPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-[#010139] mb-4">
            Cotiza tu póliza en minutos
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Auto, Vida, Incendio y Contenido. Elige un ramo para empezar.
          </p>
        </div>

        {/* Policy Types Grid */}
        <Suspense fallback={
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
          </div>
        }>
          <PolicyTypeGrid />
        </Suspense>

        {/* Info Footer */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-8 max-w-3xl mx-auto">
            <h3 className="text-2xl font-bold text-[#010139] mb-4">
              ¿Por qué cotizar con nosotros?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div>
                <div className="text-3xl mb-2">⚡</div>
                <h4 className="font-semibold text-[#010139] mb-2">Rápido</h4>
                <p className="text-sm text-gray-600">Cotizaciones en segundos, sin complicaciones</p>
              </div>
              <div>
                <div className="text-3xl mb-2">🔒</div>
                <h4 className="font-semibold text-[#010139] mb-2">Seguro</h4>
                <p className="text-sm text-gray-600">Tus datos están protegidos y encriptados</p>
              </div>
              <div>
                <div className="text-3xl mb-2">💰</div>
                <h4 className="font-semibold text-[#010139] mb-2">Mejor precio</h4>
                <p className="text-sm text-gray-600">Comparamos múltiples aseguradoras por ti</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
