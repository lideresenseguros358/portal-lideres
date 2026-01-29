/**
 * Comparación de Cotizaciones de Aseguradoras
 * Auto Cobertura Completa: 5 aseguradoras, 2 planes cada una
 * Incendio/Contenido: 2 aseguradoras (Ancón e Internacional)
 */

'use client';

import { useState, useEffect } from 'react';
import { FaStar, FaShieldAlt, FaCheckCircle, FaCog, FaArrowUp, FaEdit, FaInfoCircle } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import InsurerLogo from '@/components/shared/InsurerLogo';
import PremiumUpgradeModal from './PremiumUpgradeModal';
import QuoteDetailsCard from './QuoteDetailsCard';

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
  // Propiedades adicionales para cotizaciones reales
  _isReal?: boolean;
  _idCotizacion?: string;
  _vIdOpt?: number;
  _endosoIncluido?: string;
  _deducibleOriginal?: string;
  [key: string]: any; // Para otras propiedades dinámicas
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedBasicPlan, setSelectedBasicPlan] = useState<QuotePlan | null>(null);
  const [correspondingPremiumPlan, setCorrespondingPremiumPlan] = useState<QuotePlan | null>(null);

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
    
    const selectedPlan = quotes.find(q => q.id === quoteId);
    if (!selectedPlan) return;
    
    // Si seleccionó un plan básico Y no escogió manualmente el endoso premium
    const isPlanBasico = selectedPlan.planType === 'basico';
    const isRealQuote = selectedPlan._isReal;
    const manuallySelectedPremium = selectedPlan._deducibleOriginal === 'alto';
    
    if (isPlanBasico && isRealQuote && !manuallySelectedPremium) {
      // Buscar el plan premium correspondiente de la misma aseguradora
      const premiumPlan = quotes.find(q => 
        q.insurerName === selectedPlan.insurerName && 
        q.planType === 'premium'
      );
      
      if (premiumPlan) {
        // Mostrar modal de upgrade
        setSelectedBasicPlan(selectedPlan);
        setCorrespondingPremiumPlan(premiumPlan);
        setShowUpgradeModal(true);
        return; // No proceder a emitir todavía
      }
    }
    
    // Si no hay upgrade disponible o seleccionó premium, proceder directamente
    proceedToEmission(selectedPlan);
  };
  
  const proceedToEmission = (selectedPlan: QuotePlan) => {
    // Guardar selección y datos
    sessionStorage.setItem('selectedQuote', JSON.stringify({
      ...selectedPlan,
      quoteData
    }));

    // Redirigir según tipo de póliza
    if (policyType === 'auto-completa') {
      router.push('/cotizadores/emitir?step=payment');
    } else {
      router.push('/cotizadores/emitir?step=payment-info');
    }
  };

  const handleImprove = (quoteId: string) => {
    const selectedPlan = quotes.find(q => q.id === quoteId);
    if (!selectedPlan) return;
    
    // Buscar el plan premium correspondiente
    const premiumPlan = quotes.find(q => 
      q.insurerName === selectedPlan.insurerName && 
      q.planType === 'premium'
    );
    
    if (premiumPlan) {
      setSelectedBasicPlan(selectedPlan);
      setCorrespondingPremiumPlan(premiumPlan);
      setShowUpgradeModal(true);
    } else {
      toast.error('No hay plan premium disponible para esta aseguradora');
    }
  };
  
  const handleUpgradeToPremium = () => {
    if (correspondingPremiumPlan) {
      setShowUpgradeModal(false);
      proceedToEmission(correspondingPremiumPlan);
    }
  };
  
  const handleContinueBasic = () => {
    if (selectedBasicPlan) {
      setShowUpgradeModal(false);
      proceedToEmission(selectedBasicPlan);
    }
  };

  const handleEdit = () => {
    // Los datos ya están en sessionStorage como 'quoteInput'
    // Solo necesitamos navegar de regreso al formulario
    router.push('/cotizadores/auto-cobertura-completa');
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
          <p className="text-sm sm:text-base text-gray-600 mb-4">
            {policyType === 'auto-completa' 
              ? 'Tenemos las mejores opciones de cobertura completa para tu auto'
              : `Las mejores opciones de ${policyType} para proteger tu patrimonio`
            }
          </p>
          
          {/* Botón Editar Información */}
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-[#010139] text-[#010139] rounded-lg font-semibold hover:bg-[#010139] hover:text-white transition-all cursor-pointer shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Editar Información
          </button>
        </div>

        {/* Quotes Grid - 2x2 en desktop para mejor espaciado */}
        <div className={`grid grid-cols-1 ${
          policyType === 'auto-completa' 
            ? 'md:grid-cols-2 gap-6 lg:gap-8 max-w-6xl mx-auto' 
            : 'md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto'
        }`}>
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
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs font-bold rounded-full shadow-md">
                  <FaStar className="text-white" />
                  RECOMENDADA
                </span>
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
              <div className="p-5 md:p-6 flex flex-col flex-1">

                {/* Price */}
                <div className="text-center mb-5 py-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl flex-shrink-0">
                  <div className="text-xs text-gray-600 mb-1 font-medium">Prima Anual</div>
                  <div className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
                    ${quote.annualPremium.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </div>
                  <div className="text-xs text-gray-500">
                    Deducible desde ${quote.deductible.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </div>
                </div>

                {/* Coverages Summary */}
                <div className="mb-5 flex-1 overflow-hidden">
                  <div className="flex items-center gap-2 mb-3">
                    <FaShieldAlt className="text-[#8AAA19] flex-shrink-0 text-base" />
                    <span className="text-sm font-bold text-gray-700">Protecciones Incluidas</span>
                  </div>
                  <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-2 custom-scrollbar">
                    {quote.coverages.slice(0, 5).map((coverage, idx) => (
                      <div 
                        key={idx} 
                        className={`flex items-start gap-2 text-sm leading-snug ${
                          coverage.included ? 'text-gray-700' : 'text-gray-400 line-through'
                        }`}
                      >
                        <FaCheckCircle 
                          className={`flex-shrink-0 mt-0.5 text-sm ${
                            coverage.included ? 'text-[#8AAA19]' : 'text-gray-300'
                          }`} 
                        />
                        <span className="break-words">{coverage.name}</span>
                      </div>
                    ))}
                    {quote.coverages.length > 5 && (
                      <p className="text-xs text-[#8AAA19] font-semibold flex items-center gap-1.5 mt-2">
                        <FaInfoCircle />
                        +{quote.coverages.length - 5} protecciones adicionales
                      </p>
                    )}
                  </div>
                </div>

                {/* Detalle Completo */}
                {quote._isReal && (quote._coberturasDetalladas || quote._limites || quote._beneficios || quote._endosos) && (
                  <QuoteDetailsCard
                    aseguradora={quote.insurerName}
                    coberturasDetalladas={quote._coberturasDetalladas}
                    limites={quote._limites}
                    beneficios={quote._beneficios}
                    endosos={quote._endosos}
                    deducibleInfo={quote._deducibleInfo}
                    sumaAsegurada={quote._sumaAsegurada}
                    primaBase={quote._primaBase}
                    impuesto1={quote._impuesto1}
                    impuesto2={quote._impuesto2}
                    primaTotal={quote.annualPremium}
                  />
                )}

                {/* Actions */}
                <div className="space-y-3 flex-shrink-0 mt-4">
                  <button
                    onClick={() => handleSelectPlan(quote.id)}
                    className="w-full py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-base hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <FaCheckCircle className="text-white text-lg" />
                    Seleccionar Este Plan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Premium Upgrade Modal */}
        {showUpgradeModal && selectedBasicPlan && correspondingPremiumPlan && (
          <PremiumUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            onUpgrade={handleUpgradeToPremium}
            onContinueBasic={handleContinueBasic}
            insurerName={selectedBasicPlan.insurerName}
            basicPlan={{
              premium: selectedBasicPlan.annualPremium,
              deductible: selectedBasicPlan.deductible,
              coverages: selectedBasicPlan.coverages.map(c => c.name),
              beneficios: selectedBasicPlan._beneficios || [],
              endosos: selectedBasicPlan._endosos || [],
            }}
            premiumPlan={{
              premium: correspondingPremiumPlan.annualPremium,
              deductible: correspondingPremiumPlan.deductible,
              coverages: correspondingPremiumPlan.coverages.map(c => c.name),
              beneficios: correspondingPremiumPlan._beneficios || [],
              endosos: correspondingPremiumPlan._endosos || [],
            }}
          />
        )}

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
