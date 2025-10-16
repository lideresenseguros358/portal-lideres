/**
 * Página de Comparación de Cotizaciones
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { quoteByPolicyType } from '@/lib/cotizadores/serviceRouter';
import { saveQuote } from '@/lib/cotizadores/storage';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import ErrorState from '@/components/cotizadores/ErrorState';
import EmptyState from '@/components/cotizadores/EmptyState';
import InsurerBadge from '@/components/cotizadores/InsurerBadge';
import type { QuoteResult, QuoteOption } from '@/lib/cotizadores/types';
// Helper para generar ID único
function generateQuoteId(): string {
  return `quote-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default function ComparePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteResult | null>(null);
  const [quoteId] = useState(() => generateQuoteId());
  const [selectedOption, setSelectedOption] = useState<QuoteOption | null>(null);

  useEffect(() => {
    loadQuote();
  }, []);

  const loadQuote = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Obtener input del sessionStorage
      const storedInput = sessionStorage.getItem('quoteInput');
      if (!storedInput) {
        throw new Error('No se encontró información de cotización');
      }

      const input = JSON.parse(storedInput);
      
      console.log('[Analytics] quote_generated:', { quoteId, policyType: input.policyType });
      
      // Llamar al servicio de cotización
      const quoteResult = await quoteByPolicyType(input);
      setResult(quoteResult);
      
      // Guardar en storage
      saveQuote({
        quoteId,
        policyType: quoteResult.policyType,
        input: quoteResult.input,
        optionsCount: quoteResult.options.length,
        createdAt: new Date().toISOString(),
        status: 'DRAFT'
      });
      
    } catch (err: any) {
      console.error('[Comparar] Error:', err);
      setError(err.message || 'Error al generar cotización');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (option: QuoteOption) => {
    setSelectedOption(option);
    
    // Guardar selección
    saveQuote({
      quoteId,
      policyType: result!.policyType,
      input: result!.input,
      optionsCount: result!.options.length,
      selectedOption: option,
      createdAt: new Date().toISOString(),
      status: 'SELECTED'
    });
    
    console.log('[Analytics] select_option:', {
      quoteId,
      insurerId: option.insurerId,
      prima: option.prima
    });
    
    // Guardar en sessionStorage y navegar
    sessionStorage.setItem('selectedOption', JSON.stringify(option));
    router.push(`/cotizadores/emitir?quoteId=${quoteId}`);
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={loadQuote} />;
  if (!result || result.options.length === 0) return <EmptyState />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
          Opciones Disponibles
        </h1>
        <p className="text-gray-600">
          {result.options.length} {result.options.length === 1 ? 'opción encontrada' : 'opciones encontradas'} para {result.policyType}
        </p>
      </div>
      
      {/* Desktop: Tabla */}
      <div className="hidden lg:block overflow-x-auto bg-white rounded-2xl shadow-lg border-2 border-gray-100">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white">
              <th className="px-6 py-4 text-left font-semibold">Aseguradora</th>
              <th className="px-6 py-4 text-left font-semibold">Plan</th>
              <th className="px-6 py-4 text-right font-semibold">Prima Anual</th>
              <th className="px-6 py-4 text-left font-semibold">Deducible</th>
              <th className="px-6 py-4 text-left font-semibold">Coberturas</th>
              <th className="px-6 py-4 text-center font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {result.options.map((option, idx) => (
              <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <InsurerBadge 
                    name={option.insurerName}
                    logoUrl={option.insurerLogoUrl}
                    size="md"
                  />
                </td>
                <td className="px-6 py-4">
                  <span className="font-semibold text-gray-800">{option.planName}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="text-2xl font-bold text-[#8AAA19]">
                    ${option.prima.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">USD/año</div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-gray-700">{option.deducible || 'N/A'}</span>
                </td>
                <td className="px-6 py-4">
                  <ul className="text-sm space-y-1">
                    {option.coberturasClave.slice(0, 4).map((cob, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-[#8AAA19]">✓</span>
                        <span>{cob}</span>
                      </li>
                    ))}
                  </ul>
                  {option.observaciones && (
                    <p className="text-xs text-gray-500 mt-2 italic">{option.observaciones}</p>
                  )}
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={() => handleSelect(option)}
                    className="px-6 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
                  >
                    PROCEDER
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Mobile/Tablet: Cards */}
      <div className="lg:hidden space-y-4">
        {result.options.map((option, idx) => (
          <div key={idx} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <InsurerBadge 
                name={option.insurerName}
                logoUrl={option.insurerLogoUrl}
                size="lg"
              />
              <div className="text-right">
                <div className="text-2xl font-bold text-[#8AAA19]">
                  ${option.prima.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500">USD/año</div>
              </div>
            </div>

            {/* Plan y Deducible */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-[#010139] mb-1">{option.planName}</h3>
              <p className="text-sm text-gray-600">
                Deducible: <span className="font-semibold">{option.deducible || 'N/A'}</span>
              </p>
            </div>

            {/* Coberturas */}
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Coberturas principales:</h4>
              <ul className="text-sm space-y-1">
                {option.coberturasClave.map((cob, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#8AAA19] mt-0.5">✓</span>
                    <span>{cob}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Observaciones */}
            {option.observaciones && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 italic">{option.observaciones}</p>
              </div>
            )}

            {/* Button */}
            <button
              onClick={() => handleSelect(option)}
              className="w-full px-6 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
              PROCEDER A EMITIR
            </button>
          </div>
        ))}
      </div>

      {/* Info Footer */}
      <div className="mt-8 text-center">
        <p className="text-sm text-gray-500">
          💡 Las primas mostradas son aproximadas. El precio final puede variar según evaluación.
        </p>
      </div>
    </div>
  );
}
