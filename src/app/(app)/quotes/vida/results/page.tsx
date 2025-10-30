'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import InsurerLogo from '@/components/shared/InsurerLogo';

export default function VidaResultsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const coverage = searchParams.get('coverage') || '100000';
  const name = searchParams.get('name') || 'Cliente';

  // Mock: calcular prima aproximada (super simple, solo para visual)
  const coverageAmount = parseInt(coverage);
  const monthlyPremium = Math.round((coverageAmount * 0.002) / 12); // 0.2% anual
  const annualPremium = monthlyPremium * 12;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes/vida"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Nueva cotización</span>
          </Link>

          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h1 className="text-3xl font-bold text-[#010139] mb-2">
              Cotización de Seguro de Vida
            </h1>
            <p className="text-gray-600">
              Resultados para: <strong>{name}</strong>
            </p>
          </div>
        </div>

        {/* Banner Preliminar */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Cotización Preliminar</p>
              <p>Esta es una estimación. La prima final se determinará después de la evaluación médica y revisión de antecedentes.</p>
            </div>
          </div>
        </div>

        {/* Resultado ASSA */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden mb-6">
          {/* Header con logo */}
          <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-6 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <InsurerLogo 
                  logoUrl={null}
                  insurerName="ASSA"
                  size="xl"
                />
                <div>
                  <h2 className="text-2xl font-bold">ASSA</h2>
                  <p className="text-white/80 text-sm">Seguro de Vida Individual</p>
                </div>
              </div>
              <div className="bg-green-500 px-4 py-2 rounded-lg">
                <p className="text-xs font-semibold">RECOMENDADO</p>
              </div>
            </div>
          </div>

          {/* Detalles */}
          <div className="p-6">
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Cobertura */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Suma Asegurada</p>
                <p className="text-3xl font-bold text-[#010139]">
                  B/. {coverageAmount.toLocaleString()}
                </p>
              </div>

              {/* Prima */}
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Prima Mensual Estimada</p>
                <p className="text-3xl font-bold text-green-700">
                  B/. {monthlyPremium.toFixed(2)}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Anual: B/. {annualPremium.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Coberturas Incluidas */}
            <div className="mb-6">
              <h3 className="font-semibold text-[#010139] mb-3">✓ Coberturas Incluidas:</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Muerte por cualquier causa</span>
                </div>
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Muerte accidental (doble indemnización)</span>
                </div>
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Invalidez total y permanente</span>
                </div>
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Exención de prima por invalidez</span>
                </div>
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Enfermedades graves (opcional)</span>
                </div>
                <div className="flex items-start gap-2">
                  <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-gray-700">Gastos funerarios</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={() => {
                alert('Esta funcionalidad se habilitará cuando se integre con el sistema de casos. Por ahora es solo visual.');
              }}
              className="w-full px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-bold text-lg"
            >
              Solicitar Esta Póliza
            </button>
          </div>
        </div>

        {/* Próximos Pasos */}
        <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
          <h3 className="font-bold text-[#010139] mb-4 text-xl">📋 Próximos Pasos:</h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Evaluación Médica</h4>
                <p className="text-sm text-gray-600">
                  Completarás un cuestionario de salud y, dependiendo de la suma asegurada, 
                  podrías necesitar exámenes médicos básicos.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Revisión y Aprobación</h4>
                <p className="text-sm text-gray-600">
                  ASSA revisará tu solicitud y antecedentes médicos. 
                  Este proceso toma entre 3-5 días hábiles.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Confirmación de Prima</h4>
                <p className="text-sm text-gray-600">
                  Recibirás la prima final confirmada según tu perfil de riesgo.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                4
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Emisión de Póliza</h4>
                <p className="text-sm text-gray-600">
                  Una vez aprobada, recibirás tu póliza y la cobertura iniciará de inmediato.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <Link
            href="/quotes/vida"
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold text-center"
          >
            Nueva Cotización
          </Link>
          <Link
            href="/quotes"
            className="flex-1 px-6 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold text-center"
          >
            Otros Seguros
          </Link>
        </div>
      </div>
    </div>
  );
}
