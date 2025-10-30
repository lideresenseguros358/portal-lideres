'use client';

import Link from 'next/link';
import { FaShieldAlt, FaCheckCircle } from 'react-icons/fa';
import { COMPREHENSIVE_COVERAGE_INSURERS } from '@/lib/constants/auto-quotes';

// Mock results - En producción esto vendría de la API
const mockResults = [
  { insurer: 'ASSA', premium: 850.00, recommended: true },
  { insurer: 'ANCÓN', premium: 920.00, recommended: false },
  { insurer: 'MAPFRE', premium: 895.00, recommended: false },
  { insurer: 'FEDPA', premium: 910.00, recommended: false },
  { insurer: 'INTERNACIONAL', premium: 950.00, recommended: false },
];

export default function ComprehensiveResultsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-8">
            <FaShieldAlt className="text-[#8AAA19] mx-auto mb-4" size={48} />
            <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-4">
              Resultados de tu Cotización
            </h1>
            <p className="text-lg text-gray-600">
              Encontramos 5 opciones de cobertura completa para tu vehículo
            </p>

            {/* API Notice */}
            <div className="mt-6 bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 inline-block">
              <p className="text-sm text-yellow-800">
                <strong>🚧 Cotización Preliminar:</strong> Precios estimados. Integración con APIs en proceso.
              </p>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-4">
          {mockResults.map((result, index) => (
            <div
              key={result.insurer}
              className={`bg-white rounded-xl shadow-lg border-2 transition-all hover:shadow-xl ${
                result.recommended ? 'border-[#8AAA19]' : 'border-gray-100'
              }`}
            >
              <div className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-gradient-to-br from-[#010139] to-[#020270] text-white w-12 h-12 rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-[#010139]">
                        {result.insurer}
                      </h3>
                      {result.recommended && (
                        <span className="inline-flex items-center gap-1 text-sm text-green-600 font-semibold mt-1">
                          <FaCheckCircle />
                          Recomendado
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row items-center gap-4">
                    <div className="text-center md:text-right">
                      <div className="text-4xl font-bold text-[#010139]">
                        B/.{result.premium.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">/año</div>
                    </div>

                    <Link
                      href={`/quotes/comprehensive/issue?insurer=${result.insurer.toLowerCase()}`}
                      className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                        result.recommended
                          ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-lg'
                          : 'bg-[#010139] text-white hover:bg-[#020270]'
                      }`}
                    >
                      Seleccionar
                    </Link>
                  </div>
                </div>

                {/* Features Preview */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="text-center">
                      <div className="text-[#8AAA19] font-semibold">✓ Colisión</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#8AAA19] font-semibold">✓ Robo Total</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#8AAA19] font-semibold">✓ Incendio</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[#8AAA19] font-semibold">✓ + Más</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Las primas mostradas son estimadas y pueden variar según inspección del vehículo
          </p>
          <Link
            href="/quotes"
            className="inline-block mt-4 text-[#010139] hover:text-[#8AAA19] font-semibold"
          >
            ← Volver a cotizaciones
          </Link>
        </div>
      </div>
    </div>
  );
}
