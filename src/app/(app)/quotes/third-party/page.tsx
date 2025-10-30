'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft } from 'react-icons/fa';
import ThirdPartyComparison from '@/components/quotes/ThirdPartyComparison';
import { AutoThirdPartyPlan } from '@/lib/constants/auto-quotes';

export default function ThirdPartyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSelectPlan = (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => {
    setLoading(true);
    // Redirigir al formulario de emisión con los datos del plan seleccionado
    router.push(`/quotes/third-party/issue?insurer=${insurerId}&plan=${planType}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Volver a selección de cobertura</span>
          </Link>

          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-4">
              Daños a Terceros
            </h1>
            <p className="text-lg text-gray-600 mb-4">
              Compara planes de las mejores aseguradoras de Panamá. Tarifas fijas, sin sorpresas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-green-700 font-semibold mb-1">✓ Cobertura legal obligatoria</div>
                <div className="text-sm text-green-600">Cumple con requisitos de tránsito</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="text-blue-700 font-semibold mb-1">✓ Emisión inmediata</div>
                <div className="text-sm text-blue-600">Sin inspección del vehículo</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="text-purple-700 font-semibold mb-1">✓ Desde B/.115/año</div>
                <div className="text-sm text-purple-600">Opciones de pago en cuotas</div>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-4 md:p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-[#010139] mb-2">
              Compara Planes y Coberturas
            </h2>
            <p className="text-gray-600 text-sm">
              Revisa detalladamente las coberturas incluidas en cada plan. Los precios son anuales.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
            </div>
          ) : (
            <ThirdPartyComparison onSelectPlan={handleSelectPlan} />
          )}
        </div>

        {/* Info Footer */}
        <div className="mt-8 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="text-4xl">💡</div>
            <div>
              <h3 className="font-bold text-[#010139] mb-2">¿Qué plan elegir?</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold mt-0.5">•</span>
                  <span><strong>Plan Básico:</strong> Cumple con los requisitos legales mínimos. Ideal si buscas economía.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold mt-0.5">•</span>
                  <span><strong>Plan Premium:</strong> Coberturas ampliadas, mayores límites, y servicios adicionales como grúa y asistencia vial.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
