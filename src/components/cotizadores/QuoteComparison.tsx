/**
 * Comparación de Cotizaciones de Aseguradoras
 * Auto Cobertura Completa: 5 aseguradoras, 2 planes cada una
 * Incendio/Contenido: 2 aseguradoras (Ancón e Internacional)
 */

'use client';

import { useState, useEffect } from 'react';
import { FaStar, FaShieldAlt, FaCheckCircle, FaCog, FaArrowUp, FaEdit, FaInfoCircle, FaQuestionCircle } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import InsurerLogo from '@/components/shared/InsurerLogo';
import PremiumUpgradeModal from './PremiumUpgradeModal';
import QuoteDetailsCard from './QuoteDetailsCard';
import AutoCloseTooltip from '@/components/ui/AutoCloseTooltip';
import { preciosTooltips, getDeducibleTooltip, getEndosoTooltip } from '@/lib/cotizadores/fedpa-premium-features';

interface Coverage {
  name: string;
  included: boolean;
}

interface PriceBreakdown {
  primaBase: number;
  descuentoProntoPago?: number;
  impuesto1: number;
  impuesto2?: number;
  totalConTarjeta: number;
  totalAlContado: number;
}

interface PremiumFeature {
  nombre: string;
  descripcion: string;
  valorBasico: string;
  valorPremium: string;
  mejora: string;
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
  _priceBreakdown?: PriceBreakdown;
  _premiumFeatures?: PremiumFeature[];
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
  
  // UI Cuotas: Estado para selector - DEFAULT 'contado'
  const [paymentMode, setPaymentMode] = useState<Record<string, 'contado' | 'tarjeta'>>(
    quotes.reduce((acc, q) => ({ ...acc, [q.id]: 'contado' }), {})
  );
  
  const togglePaymentMode = (quoteId: string) => {
    setPaymentMode(prev => ({
      ...prev,
      [quoteId]: prev[quoteId] === 'contado' ? 'tarjeta' : 'contado'
    }));
  };

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
    
    // REGLA: Solo mostrar modal si seleccionó plan BÁSICO
    const isPlanBasico = selectedPlan.planType === 'basico';
    const isRealQuote = selectedPlan._isReal;
    
    if (isPlanBasico && isRealQuote) {
      // Buscar el plan premium correspondiente de la misma aseguradora
      const premiumPlan = quotes.find(q => 
        q.insurerName === selectedPlan.insurerName && 
        q.planType === 'premium'
      );
      
      if (premiumPlan) {
        // Mostrar modal de upgrade a premium
        setSelectedBasicPlan(selectedPlan);
        setCorrespondingPremiumPlan(premiumPlan);
        setShowUpgradeModal(true);
        return; // No proceder a emitir todavía - esperar decisión del usuario
      }
    }
    
    // Si seleccionó premium o no hay upgrade disponible, proceder directamente
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
    // Agregar flag para indicar que es edición
    const currentData = sessionStorage.getItem('quoteInput');
    if (currentData) {
      sessionStorage.setItem('editMode', 'true');
    }
    // Navegar a la ruta correcta (auto/completa)
    router.push('/cotizadores/auto/completa');
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
        
        /* Badge Premium Mágico */
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        
        @keyframes subtle-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(138, 170, 25, 0.6), 0 0 60px rgba(138, 170, 25, 0.3); }
          50% { box-shadow: 0 0 40px rgba(138, 170, 25, 0.9), 0 0 80px rgba(138, 170, 25, 0.5); }
        }
        
        @keyframes float {
          0%, 100% { transform: translate(-50%, 0); }
          50% { transform: translate(-50%, -4px); }
        }
        
        .premium-badge {
          animation: float 3s ease-in-out infinite, subtle-glow 2s ease-in-out infinite;
        }
        
        .premium-badge-shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.4) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
        }
        
        /* Animaciones para beneficios */
        @keyframes fadeInSlideRight {
          from {
            opacity: 0;
            transform: translateX(-10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .benefit-item {
          animation: fadeInSlideRight 0.3s ease-out forwards;
        }
        
        .benefit-item:nth-child(1) { animation-delay: 0.05s; }
        .benefit-item:nth-child(2) { animation-delay: 0.1s; }
        .benefit-item:nth-child(3) { animation-delay: 0.15s; }
        .benefit-item:nth-child(4) { animation-delay: 0.2s; }
        .benefit-item:nth-child(5) { animation-delay: 0.25s; }
      `}</style>
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 px-4 overflow-visible">
      <div className="max-w-7xl mx-auto overflow-visible">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-12">
          {quotes.map((quote) => (
            <div key={quote.id} className="relative overflow-visible">
              {/* Recommended Badge - Flotante ARRIBA del card SIN RECORTE */}
              {quote.isRecommended && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20" style={{ transform: 'translate(-50%, 0)' }}>
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white text-xs sm:text-sm font-bold rounded-full border-2 border-white premium-badge">
                    <FaStar className="text-yellow-300 animate-pulse text-sm sm:text-base" />
                    RECOMENDADA
                    {/* Shimmer effect */}
                    <span className="absolute inset-0 premium-badge-shimmer pointer-events-none rounded-full"></span>
                  </span>
                </div>
              )}
              
              {/* Card principal SIN RING VERDE - usa sombra */}
              <div 
                className={`bg-white rounded-xl border-2 overflow-visible transition-all duration-300 flex flex-col ${
                  quote.isRecommended 
                    ? 'border-[#8AAA19] shadow-lg shadow-[#8AAA19]/30' 
                    : 'border-gray-200 hover:border-[#010139] shadow-md'
                } ${
                  selectedQuote === quote.id 
                    ? 'shadow-2xl shadow-[#010139]/40 scale-[1.02]' 
                    : ''
                }`}
              >
                {/* Header con Logo */}
              <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-4 text-white flex-shrink-0 overflow-visible rounded-t-xl">
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

                {/* Price Section con Selector Contado/Tarjeta - DEFAULT CONTADO */}
                <div className="mb-5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 flex-shrink-0">
                  {/* Si tiene breakdown, mostrar con selector */}
                  {quote._priceBreakdown ? (
                    <>
                      {/* Selector de Forma de Pago */}
                      <div className="flex gap-2 mb-4">
                        <div className="flex-1">
                          <button
                            onClick={() => setPaymentMode(prev => ({ ...prev, [quote.id]: 'contado' }))}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                              paymentMode[quote.id] === 'contado'
                                ? 'bg-[#8AAA19] text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-300 hover:border-[#8AAA19]'
                            }`}
                          >
                            Al Contado
                          </button>
                          <p className="text-[10px] text-gray-500 text-center mt-1">(1 cuota)</p>
                        </div>
                        <div className="flex-1">
                          <button
                            onClick={() => setPaymentMode(prev => ({ ...prev, [quote.id]: 'tarjeta' }))}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                              paymentMode[quote.id] === 'tarjeta'
                                ? 'bg-[#010139] text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-300 hover:border-[#010139]'
                            }`}
                          >
                            En Cuotas
                          </button>
                          <p className="text-[10px] text-gray-500 text-center mt-1">(2-10 cuotas)</p>
                        </div>
                      </div>
                      
                      {/* Precio Principal Dinámico */}
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <span className="text-xs text-gray-600 font-medium">
                            {paymentMode[quote.id] === 'contado' ? 'Pago al Contado' : 'Pago en Cuotas'}
                          </span>
                          <AutoCloseTooltip 
                            content={paymentMode[quote.id] === 'contado' ? preciosTooltips.contado : preciosTooltips.tarjeta}
                          />
                        </div>
                        <div className={`text-3xl md:text-4xl font-bold mb-2 ${
                          paymentMode[quote.id] === 'contado' ? 'text-[#8AAA19]' : 'text-[#010139]'
                        }`}>
                          ${(paymentMode[quote.id] === 'contado' 
                            ? quote._priceBreakdown.totalAlContado 
                            : quote._priceBreakdown.totalConTarjeta
                          ).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                        
                        {/* Info adicional según modo */}
                        {paymentMode[quote.id] === 'contado' ? (
                          quote._priceBreakdown.descuentoProntoPago && quote._priceBreakdown.descuentoProntoPago > 0 && (
                            <div className="text-xs text-[#8AAA19] font-semibold">
                              ✓ Ahorro: ${quote._priceBreakdown.descuentoProntoPago.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </div>
                          )
                        ) : (
                          <div className="text-xs text-gray-500">
                            Elige de 2 a 10 cuotas en el proceso de emisión
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* Precio simple sin breakdown */
                    <div className="text-center">
                      <div className="text-xs text-gray-600 mb-1 font-medium">Prima Anual</div>
                      <div className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
                        ${quote.annualPremium.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                    </div>
                  )}
                  
                  {/* Deducible con Tooltip */}
                  <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-600">
                    <span>Deducible desde ${quote.deductible.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                    {quote._deducibleOriginal && (
                      <AutoCloseTooltip 
                        content={getDeducibleTooltip(quote._deducibleOriginal as 'bajo' | 'medio' | 'alto')}
                      />
                    )}
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
                        className={`benefit-item flex items-start gap-2 text-sm leading-snug ${
                          coverage.included ? 'text-gray-700' : 'text-gray-400 line-through'
                        }`}
                        style={{ animationDelay: `${idx * 0.05}s`, opacity: 0 }}
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
