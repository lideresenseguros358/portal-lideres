/**
 * Comparación de Cotizaciones de Aseguradoras
 * Auto Cobertura Completa: 5 aseguradoras, 2 planes cada una
 * Incendio/Contenido: 2 aseguradoras (Ancón e Internacional)
 */

'use client';

import { useState, useEffect } from 'react';
import { FaStar, FaShieldAlt, FaCheckCircle, FaCog } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import InsurerLogo from '@/components/shared/InsurerLogo';

interface Coverage {
  name: string;
  included: boolean;
}

interface QuotePlan {
  id: string;
  insurerName: string;
  insurerLogo?: string;
  planType: 'basico' | 'premium';
  isRecommended?: boolean;
  annualPremium: number;
  coverages: Coverage[];
  deductible: number;
}

interface QuoteComparisonProps {
  policyType: 'auto-completa' | 'incendio' | 'contenido';
  quotes: QuotePlan[];
  quoteData: any;
}

export default function QuoteComparison({ policyType, quotes, quoteData }: QuoteComparisonProps) {
  const router = useRouter();
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [insurerLogos, setInsurerLogos] = useState<Record<string, string | null>>({});

  useEffect(() => {
    // Cargar logos de aseguradoras desde la API
    fetch('/api/insurers')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.insurers)) {
          const logos: Record<string, string | null> = {};
          
          data.insurers.forEach((ins: any) => {
            // Guardar con múltiples variaciones del nombre
            const variations = [
              ins.name.toUpperCase(),
              ins.name.toUpperCase().replace(/\s+SEGUROS$/i, '').trim(),
              ins.name.toUpperCase().replace(/\s+DE\s+/gi, ' ').trim(),
              ins.name.toUpperCase().replace(/PANAMÁ/gi, 'PANAMA').trim(),
              ins.name.toUpperCase().split(' ')[0], // Primera palabra
            ];
            
            variations.forEach(variation => {
              if (variation && !logos[variation]) {
                logos[variation] = ins.logo_url;
              }
            });
          });
          
          setInsurerLogos(logos);
        }
      })
      .catch(err => console.error('Error loading insurer logos:', err));
  }, []);

  const getLogoUrl = (insurerName: string): string | null => {
    // Normalizar el nombre buscado
    const normalized = insurerName
      .toUpperCase()
      .replace(/PANAMÁ/gi, 'PANAMA')
      .replace(/Á/g, 'A')
      .replace(/É/g, 'E')
      .replace(/Í/g, 'I')
      .replace(/Ó/g, 'O')
      .replace(/Ú/g, 'U')
      .trim();
    
    // Intentar múltiples variaciones
    const firstWord = normalized.split(' ')[0] || '';
    const variations = [
      normalized,
      normalized.replace(/\s+SEGUROS$/i, '').trim(),
      normalized.replace(/\s+DE\s+/gi, ' ').trim(),
      normalized.replace(/\s+SEGUROS$/i, '').replace(/\s+DE\s+/gi, ' ').trim(),
      firstWord,
    ].filter(Boolean);

    for (const variation of variations) {
      if (variation && insurerLogos[variation]) {
        return insurerLogos[variation];
      }
    }
    
    return null;
  };

  const handleSelectPlan = (quoteId: string) => {
    setSelectedQuote(quoteId);
    
    // Guardar selección y datos
    const selectedPlan = quotes.find(q => q.id === quoteId);
    sessionStorage.setItem('selectedQuote', JSON.stringify({
      ...selectedPlan,
      quoteData
    }));

    // Redirigir según tipo de póliza
    if (policyType === 'auto-completa') {
      // Auto completa: inicia con selección de cuotas
      router.push('/cotizadores/emitir?step=payment');
    } else {
      // Vida/Incendio/Contenido: directo a información de pago
      router.push('/cotizadores/emitir?step=payment-info');
    }
  };

  const handleImprove = (quoteId: string) => {
    // TODO: Implementar cuando tengamos endpoints
    console.log('Mejorar plan:', quoteId);
  };

  return (
    <>
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #8AAA19;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6d8814;
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #8AAA19 #f1f1f1;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[#010139] mb-3">
            Compara y Elige tu Plan
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            {policyType === 'auto-completa' 
              ? 'Tenemos las mejores opciones de cobertura completa para tu auto'
              : `Las mejores opciones de ${policyType} para proteger tu patrimonio`
            }
          </p>
        </div>

        {/* Quotes Grid */}
        <div className={`grid grid-cols-1 ${
          policyType === 'auto-completa' 
            ? 'sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5' 
            : 'md:grid-cols-2 max-w-4xl mx-auto'
        } gap-4 lg:gap-5`}>
          {quotes.map((quote) => (
            <div
              key={quote.id}
              className={`relative bg-white rounded-xl shadow-lg border-2 transition-all duration-300 overflow-hidden group flex flex-col h-full ${
                quote.isRecommended 
                  ? 'border-[#8AAA19] shadow-[#8AAA19]/20' 
                  : 'border-gray-200 hover:border-[#010139]'
              } ${
                selectedQuote === quote.id ? 'ring-4 ring-[#8AAA19]' : ''
              }`}
            >
              {/* Recommended Badge */}
              {quote.isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                  <div className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white px-4 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1">
                    <FaStar className="text-yellow-300" />
                    RECOMENDADO
                  </div>
                </div>
              )}

              {/* Header con Logo */}
              <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-4 text-white flex-shrink-0">
                <div className="flex items-center gap-2 mb-2">
                  <InsurerLogo 
                    logoUrl={getLogoUrl(quote.insurerName)}
                    insurerName={quote.insurerName}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm leading-tight truncate">{quote.insurerName}</h3>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-semibold ${
                    quote.planType === 'premium' 
                      ? 'bg-[#8AAA19] text-white'
                      : 'bg-white/20 text-white'
                  }`}>
                    {quote.planType === 'premium' ? 'Premium' : 'Básico'}
                  </span>
                  {quote.isRecommended && (
                    <FaStar className="text-[#8AAA19] text-lg" />
                  )}
                </div>
              </div>

              {/* Card Content */}
              <div className="p-3 flex flex-col flex-1">

                {/* Price */}
                <div className="text-center mb-3 py-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex-shrink-0">
                  <div className="text-[10px] text-gray-600 mb-0.5">Prima Anual</div>
                  <div className="text-xl sm:text-2xl font-bold text-[#010139]">
                    ${quote.annualPremium.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-0.5">
                    Deducible: ${quote.deductible.toLocaleString()}
                  </div>
                </div>

                {/* Coverages */}
                <div className="mb-3 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-2">
                    <FaShieldAlt className="text-[#8AAA19] flex-shrink-0 text-sm" />
                    <span className="text-[11px] font-bold text-gray-700">Coberturas:</span>
                  </div>
                  <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                    {quote.coverages.map((coverage, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-start gap-1.5 text-[11px] leading-tight ${
                          coverage.included ? 'text-gray-700' : 'text-gray-400 line-through'
                        }`}
                      >
                        <FaCheckCircle 
                          className={`flex-shrink-0 mt-0.5 text-xs ${
                            coverage.included ? 'text-[#8AAA19]' : 'text-gray-300'
                          }`} 
                        />
                        <span className="break-words">{coverage.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 flex-shrink-0">
                  {/* Improve Button */}
                  <button
                    onClick={() => handleImprove(quote.id)}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-semibold text-[11px] hover:bg-gray-200 transition-colors"
                    disabled
                    title="Próximamente disponible"
                  >
                    <FaCog className="text-gray-400 text-xs" />
                    Mejorar Plan
                  </button>

                  {/* Select Button */}
                  <button
                    onClick={() => handleSelectPlan(quote.id)}
                    className={`w-full px-3 py-2.5 rounded-lg font-bold text-xs transition-all ${
                      quote.isRecommended
                        ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-xl'
                        : 'bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:shadow-xl'
                    }`}
                  >
                    {selectedQuote === quote.id ? '✓ SELECCIONADO' : 'SELECCIONAR'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg max-w-3xl mx-auto">
          <p className="text-sm text-gray-700">
            💡 <strong>Tip:</strong> Los planes Premium incluyen más coberturas y mejores límites. 
            Compara las coberturas incluidas antes de elegir.
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
