'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import InsurerLogo from '@/components/shared/InsurerLogo';

export default function ContenidoResultsPage() {
  const searchParams = useSearchParams();
  
  const propertyType = searchParams.get('propertyType') || 'propiedad';
  const contentValue = parseInt(searchParams.get('contentValue') || '50000');

  // Mock: calcular primas (0.25% - 0.30% del valor asegurado anual)
  const quotes = [
    {
      insurer: 'INTERNACIONAL',
      rate: 0.0025, // 0.25%
      recommended: true,
    },
    {
      insurer: 'ANCÓN',
      rate: 0.0028, // 0.28%
      recommended: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes/contenido"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Nueva cotización</span>
          </Link>

          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h1 className="text-3xl font-bold text-[#010139] mb-2">
              Cotizaciones - Seguro de Contenido
            </h1>
            <p className="text-gray-600">
              Tipo de propiedad: <strong className="capitalize">{propertyType.replace('_', ' ')}</strong>
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Valor del contenido: <strong>B/. {contentValue.toLocaleString()}</strong>
            </p>
          </div>
        </div>

        {/* Banner Preliminar */}
        <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold mb-1">Cotización Preliminar</p>
              <p>Las primas mostradas son estimadas. Puede requerirse inventario detallado o fotos para confirmar valores finales.</p>
            </div>
          </div>
        </div>

        {/* Cotizaciones */}
        <div className="space-y-6">
          {quotes.map((quote) => {
            const annualPremium = Math.round(contentValue * quote.rate);
            const monthlyPremium = Math.round(annualPremium / 12);

            return (
              <div key={quote.insurer} className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
                {/* Header con logo */}
                <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <InsurerLogo 
                        logoUrl={null}
                        insurerName={quote.insurer}
                        size="xl"
                      />
                      <div>
                        <h2 className="text-2xl font-bold">{quote.insurer}</h2>
                        <p className="text-white/80 text-sm">Seguro de Contenido</p>
                      </div>
                    </div>
                    {quote.recommended && (
                      <div className="bg-green-500 px-4 py-2 rounded-lg">
                        <p className="text-xs font-semibold">MEJOR TARIFA</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detalles */}
                <div className="p-6">
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    {/* Cobertura */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-1">Suma Asegurada</p>
                      <p className="text-2xl font-bold text-[#010139]">
                        B/. {contentValue.toLocaleString()}
                      </p>
                    </div>

                    {/* Prima Mensual */}
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-1">Prima Mensual</p>
                      <p className="text-2xl font-bold text-green-700">
                        B/. {monthlyPremium.toFixed(2)}
                      </p>
                    </div>

                    {/* Prima Anual */}
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-xs text-gray-600 mb-1">Prima Anual</p>
                      <p className="text-2xl font-bold text-purple-700">
                        B/. {annualPremium.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Coberturas */}
                  <div className="mb-6">
                    <h3 className="font-semibold text-[#010139] mb-3">✓ Incluye:</h3>
                    <div className="grid md:grid-cols-2 gap-2">
                      <div className="flex items-start gap-2">
                        <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm text-gray-700">Incendio y rayos</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm text-gray-700">Robo con violencia</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm text-gray-700">Daños por agua</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm text-gray-700">Explosión</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm text-gray-700">Daños eléctricos</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCheckCircle className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                        <span className="text-sm text-gray-700">Remoción de escombros</span>
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
            );
          })}
        </div>

        {/* Info Adicional */}
        <div className="mt-8 bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
          <h3 className="font-bold text-[#010139] mb-4 text-xl">📋 Proceso de Contratación:</h3>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Inventario de Contenido</h4>
                <p className="text-sm text-gray-600">
                  Proporciona un listado detallado de los artículos a asegurar con sus valores aproximados.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Fotos de Artículos de Alto Valor</h4>
                <p className="text-sm text-gray-600">
                  Para joyas, obras de arte u objetos valiosos, se requieren fotos y/o tasaciones.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Confirmación de Prima</h4>
                <p className="text-sm text-gray-600">
                  Se ajusta la prima según el inventario detallado proporcionado.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="bg-[#8AAA19] text-white w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="font-semibold text-[#010139]">Emisión de Póliza</h4>
                <p className="text-sm text-gray-600">
                  Una vez aprobado, recibirás tu póliza y la cobertura iniciará de inmediato.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recomendaciones */}
        <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">💡 Recomendaciones:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Mantén un inventario actualizado con fotos de tus pertenencias</li>
            <li>• Guarda facturas de artículos de alto valor</li>
            <li>• Considera aumentar la cobertura si adquieres nuevos equipos</li>
            <li>• Para joyas u obras de arte, solicita tasación profesional</li>
          </ul>
        </div>

        {/* Botones */}
        <div className="mt-6 flex flex-col sm:flex-row gap-4">
          <Link
            href="/quotes/contenido"
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
