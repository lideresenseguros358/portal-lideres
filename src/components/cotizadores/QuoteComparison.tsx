/**
 * Comparación de Cotizaciones de Aseguradoras
 * Auto Cobertura Completa: 5 aseguradoras, 2 planes cada una
 * Incendio/Contenido: 2 aseguradoras (Ancón e Internacional)
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { FaStar, FaShieldAlt, FaCheckCircle, FaCog, FaArrowUp, FaEdit, FaExclamationTriangle, FaChevronDown, FaChevronUp } from 'react-icons/fa';
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
  offlineInsurers?: string[];
}

export default function QuoteComparison({ policyType, quotes, quoteData, offlineInsurers = [] }: QuoteComparisonProps) {
  const router = useRouter();
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);
  const [insurerLogos, setInsurerLogos] = useState<Record<string, string | null>>({});
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedBasicPlan, setSelectedBasicPlan] = useState<QuotePlan | null>(null);
  const [correspondingPremiumPlan, setCorrespondingPremiumPlan] = useState<QuotePlan | null>(null);
  
  // UI Cuotas: Estado global — cambiar uno cambia todos
  const [paymentMode, setPaymentMode] = useState<'contado' | 'tarjeta'>('contado');
  
  const togglePaymentMode = () => {
    setPaymentMode(prev => prev === 'contado' ? 'tarjeta' : 'contado');
  };

  // ── Mobile carousel state (CC) ──
  const [globalPlanCC, setGlobalPlanCC] = useState<'basico' | 'premium'>('basico');
  const [activeCCCardIndex, setActiveCCCardIndex] = useState(0);
  const [expandedBenefitsCC, setExpandedBenefitsCC] = useState<Record<string, boolean>>({});
  const ccCarouselRef = useRef<HTMLDivElement>(null);
  const ccHintIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Scroll hint: doble pulso horizontal cada 60 s ──
  useEffect(() => {
    const nudgeCarousel = () => {
      const el = ccCarouselRef.current;
      if (!el || el.scrollLeft > 20) return;

      const px = 55;
      const delay = (ms: number, fn: () => void) => setTimeout(fn, ms);

      el.style.scrollSnapType = 'none';
      el.scrollTo({ left: px, behavior: 'smooth' });
      delay(350, () => el.scrollTo({ left: 0,  behavior: 'smooth' }));
      delay(700, () => el.scrollTo({ left: px, behavior: 'smooth' }));
      delay(1050, () => {
        el.scrollTo({ left: 0, behavior: 'smooth' });
        delay(450, () => { el.style.scrollSnapType = ''; });
      });
    };

    const initial = setTimeout(nudgeCarousel, 3500);
    ccHintIntervalRef.current = setInterval(nudgeCarousel, 60_000);

    return () => {
      clearTimeout(initial);
      if (ccHintIntervalRef.current) clearInterval(ccHintIntervalRef.current);
    };
  }, []);

  // ── Agrupa las cotizaciones por aseguradora para el carrusel mobile ──
  const insurerGroupsMap = quotes.reduce((acc: Record<string, QuotePlan[]>, q) => {
    if (!acc[q.insurerName]) acc[q.insurerName] = [];
    acc[q.insurerName]!.push(q);
    return acc;
  }, {});
  const insurerGroups = Object.entries(insurerGroupsMap);

  // ── Carousel scroll handler (CC) ──
  const handleCCCarouselScroll = () => {
    const carousel = ccCarouselRef.current;
    if (!carousel) return;
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    let closestIdx = 0, closestDist = Infinity;
    Array.from(carousel.children).forEach((child, idx) => {
      const el = child as HTMLElement;
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
    });
    setActiveCCCardIndex(closestIdx);
  };

  // ── Tooltips de coberturas RC para mobile CC ──
  const CC_COVERAGE_TOOLTIPS: Record<string, string> = {
    bodilyInjury:    'Cubre los gastos médicos de los peatones o personas en el otro vehículo afectados en caso de un accidente.',
    propertyDamage:  'Cubre los daños ocasionados a bienes de terceros ajenos (otros vehículos, muros, postes, propiedad pública o privada).',
    medicalExpenses: 'Cubre tus propios gastos médicos y los de los pasajeros dentro de tu vehículo al momento del accidente.',
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
            const upper = ins.name.toUpperCase();
            const withoutSeguros = upper.replace(/\s+SEGUROS$/i, '').trim();
            const withoutDe = upper.replace(/\s+DE\s+/gi, ' ').trim();
            // Skip articles (LA, EL) for first-word matching
            const words = upper.split(/\s+/).filter((w: string) => !['LA', 'EL', 'LOS', 'LAS', 'DE'].includes(w));
            const variations = [
              upper,
              withoutSeguros,
              withoutDe,
              upper.replace(/PANAMÁ/gi, 'PANAMA').trim(),
              upper.split(' ')[0], // Primera palabra
              words[0] || '', // Primera palabra significativa (sin artículos)
              words.join(' '), // Todas las palabras significativas
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

  // Hardcoded fallback logos for known insurers (in case DB match fails)
  const FALLBACK_LOGOS: Record<string, string> = {
    'REGIONAL': '/aseguradoras/regional.png',
    'INTERNACIONAL': '/aseguradoras/internacional.png',
    'FEDPA': '/aseguradoras/fedpa.png',
    'ANCON': '/aseguradoras/ancon.png',
  };

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
    // Skip articles for meaningful first word
    const words = normalized.split(/\s+/).filter(w => !['LA', 'EL', 'LOS', 'LAS', 'DE'].includes(w));
    const meaningfulFirst = words[0] || '';
    const variations = [
      normalized,
      normalized.replace(/\s+SEGUROS$/i, '').trim(),
      normalized.replace(/\s+DE\s+/gi, ' ').trim(),
      normalized.replace(/\s+SEGUROS$/i, '').replace(/\s+DE\s+/gi, ' ').trim(),
      firstWord,
      meaningfulFirst,
      words.join(' '),
    ].filter(Boolean);

    for (const variation of variations) {
      if (variation && insurerLogos[variation]) {
        return insurerLogos[variation];
      }
    }
    
    // Fallback: check known insurer keywords
    for (const [keyword, url] of Object.entries(FALLBACK_LOGOS)) {
      if (normalized.includes(keyword)) {
        return url;
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

        /* ═══════════════════════════════════════════════════════
           MOBILE CAROUSEL — Cobertura Completa (CC)
           Aplica SOLO en pantallas < 768px.
        ═══════════════════════════════════════════════════════ */
        .cc-carousel {
          display: flex;
          overflow-x: scroll;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          gap: 12px;
          /* scroll-padding-inline + padding-inline hacen que el primer y último
             card se centren correctamente mientras dejan visible el peek */
          padding: 8px 20px 14px;
          /* Rompe el px-4 del contenedor padre para usar el ancho completo del viewport */
          margin-left: -1rem;
          margin-right: -1rem;
          width: calc(100% + 2rem);
        }
        .cc-carousel::-webkit-scrollbar { display: none; }

        .cc-carousel-item {
          flex-shrink: 0;
          scroll-snap-align: center;
          /* 82vw deja ~9% de peek en cada lado una vez centrado el card */
          width: calc(82vw);
          max-width: 340px;
          transition: transform 0.35s cubic-bezier(.25,.46,.45,.94),
                      opacity  0.35s ease;
          will-change: transform, opacity;
        }
        .cc-carousel-item.cc-active   { transform: scale(1);   opacity: 1;   }
        .cc-carousel-item.cc-inactive { transform: scale(0.9); opacity: 0.6; }

        /* Toggle de plan CC */
        .cc-plan-toggle {
          display: flex;
          background: #f3f4f6;
          border-radius: 10px;
          padding: 3px;
          margin: 12px 12px 4px;
        }
        .cc-plan-toggle button {
          flex: 1;
          padding: 7px 6px;
          font-size: 11px;
          font-weight: 700;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          background: transparent;
          color: #6b7280;
          transition: all 0.2s ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cc-plan-toggle button.cc-toggle-basic {
          background: #010139;
          color: white;
          box-shadow: 0 2px 6px rgba(1,1,57,0.25);
        }
        /* ── Estado SELECCIONADO del botón Premium ── */
        .cc-plan-toggle button.cc-toggle-premium {
          background: linear-gradient(135deg, #8AAA19, #6d8814);
          color: white;
          box-shadow: 0 2px 8px rgba(138,170,25,0.55);
        }
        /* ── Estado NO seleccionado: shimmer + pop ── */
        @keyframes cc-premium-shine {
          0%        { background-position: -250% center; }
          45%, 100% { background-position: 300% center; }
        }
        @keyframes cc-premium-pop {
          0%, 72%, 100% { transform: scale(1);    box-shadow: 0 2px 8px rgba(138,170,25,0.35); }
          77%            { transform: scale(1.07); box-shadow: 0 0 0 6px rgba(138,170,25,0.18), 0 4px 18px rgba(138,170,25,0.6); }
          83%            { transform: scale(0.97); box-shadow: 0 2px 6px rgba(138,170,25,0.3); }
          88%            { transform: scale(1.03); box-shadow: 0 0 0 3px rgba(138,170,25,0.12), 0 3px 12px rgba(138,170,25,0.45); }
          93%            { transform: scale(1);    box-shadow: 0 2px 8px rgba(138,170,25,0.35); }
        }
        .cc-plan-toggle button.cc-toggle-premium-idle {
          background: linear-gradient(105deg,
            #6d8814 0%, #8AAA19 28%, #d6ec4a 46%, #c0d830 50%, #d6ec4a 54%, #8AAA19 72%, #6d8814 100%);
          background-size: 300% auto;
          color: white;
          animation:
            cc-premium-shine 2.8s ease-in-out infinite,
            cc-premium-pop   4s   ease-in-out infinite;
        }

        /* Dot indicators CC */
        .cc-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #d1d5db;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .cc-dot.cc-dot-active {
          background: #8AAA19;
          width: 20px;
          border-radius: 3px;
        }

        /* Reutiliza los estilos de tooltip y botón info de ThirdParty */
        .cov-info-btn {
          background: none; border: none; padding: 0 2px;
          cursor: pointer; display: inline-flex; align-items: center;
          vertical-align: middle;
        }
        /* position/top/left/transform van inline via JS para escapar overflow:hidden */
        .cov-tooltip-popup {
          width: 215px;
          background: #1f2937;
          color: #f9fafb;
          font-size: 10.5px;
          line-height: 1.5;
          padding: 8px 10px;
          border-radius: 8px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.3);
          pointer-events: none;
          white-space: normal;
          text-align: left;
        }
        .cov-tooltip-popup::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 5px solid transparent;
          border-top-color: #1f2937;
        }
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

        {/* ═══════════════════════════════════════════════════════
            DESKTOP — Grid original sin cambios (md y superior).
            Oculto en mobile con `hidden md:grid`.
        ═══════════════════════════════════════════════════════ */}
        {/* Quotes Grid - 2x2 en desktop para mejor espaciado */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-8 sm:pt-10">
          {quotes.map((quote) => (
            <div key={quote.id} className={`relative overflow-visible ${quote.isRecommended ? 'md:-mt-2 md:mb-2' : ''}`}>
              {/* Recommended Badge - Flotante ARRIBA del card, centrado */}
              {quote.isRecommended && (
                <div className="absolute -top-5 sm:-top-6 left-0 right-0 z-20 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 sm:gap-2 px-4 sm:px-8 py-2 sm:py-2.5 bg-gradient-to-r from-[#8AAA19] via-[#9dbd2e] to-[#8AAA19] text-white text-[11px] sm:text-sm font-extrabold rounded-full border-2 border-white shadow-xl premium-badge whitespace-nowrap tracking-wide">
                    <FaStar className="text-yellow-300 animate-pulse text-sm sm:text-base" />
                    RECOMENDADA
                    <FaStar className="text-yellow-300 animate-pulse text-sm sm:text-base" />
                    <span className="absolute inset-0 premium-badge-shimmer pointer-events-none rounded-full"></span>
                  </span>
                </div>
              )}
              
              {/* Card principal - Premium gets enhanced styling */}
              <div 
                className={`rounded-xl overflow-visible transition-all duration-300 flex flex-col ${
                  quote.isRecommended 
                    ? 'border-2 border-[#8AAA19] shadow-xl shadow-[#8AAA19]/20 ring-1 ring-[#8AAA19]/30 bg-gradient-to-b from-white to-green-50/30' 
                    : 'border-2 border-gray-200 hover:border-[#010139] shadow-md bg-white'
                } ${
                  selectedQuote === quote.id 
                    ? 'shadow-2xl shadow-[#010139]/40 scale-[1.02]' 
                    : ''
                }`}
              >
                {/* Header con Logo - Premium gets golden accent */}
              <div className={`p-4 text-white flex-shrink-0 overflow-visible rounded-t-xl ${
                quote.isRecommended
                  ? 'bg-gradient-to-br from-[#010139] via-[#020270] to-[#0a0a5c] border-b-4 border-[#8AAA19]'
                  : 'bg-gradient-to-br from-[#010139] to-[#020270]'
              }`}>
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
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      quote.planType === 'premium' 
                        ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white shadow-sm'
                        : 'bg-white/20 text-white'
                    }`}>
                      {quote.planType === 'premium' ? 'Premium' : 'Básico'}
                    </span>
                    {quote._endosoIncluido && (
                      <span className="text-[9px] text-white/80 font-medium truncate max-w-[120px]">
                        {quote._endosoIncluido}
                      </span>
                    )}
                  </div>
                  {quote.isRecommended && (
                    <FaStar className="text-[#8AAA19] text-lg drop-shadow-sm" />
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
                            onClick={() => setPaymentMode('contado')}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                              paymentMode === 'contado'
                                ? 'bg-[#8AAA19] text-white shadow-md'
                                : 'bg-white text-gray-600 border border-gray-300 hover:border-[#8AAA19]'
                            }`}
                          >
                            Al Contado
                            {quote._priceBreakdown && quote._priceBreakdown.totalConTarjeta > quote._priceBreakdown.totalAlContado && (() => {
                              const pct = Math.round((quote._priceBreakdown!.totalConTarjeta - quote._priceBreakdown!.totalAlContado) / quote._priceBreakdown!.totalConTarjeta * 100);
                              return pct > 0 ? (
                                <span className={`block text-[9px] font-bold mt-0.5 ${paymentMode === 'contado' ? 'text-white/80' : 'text-[#8AAA19]'}`}>
                                  Ahorra {pct}%
                                </span>
                              ) : null;
                            })()}
                          </button>
                          <p className="text-[10px] text-gray-500 text-center mt-1">(1 cuota)</p>
                        </div>
                        <div className="flex-1">
                          <button
                            onClick={() => setPaymentMode('tarjeta')}
                            className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                              paymentMode === 'tarjeta'
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
                            {paymentMode === 'contado' ? 'Pago al Contado' : 'Pago en Cuotas'}
                          </span>
                          <AutoCloseTooltip 
                            content={paymentMode === 'contado' ? preciosTooltips.contado : preciosTooltips.tarjeta}
                          />
                        </div>
                        <div className={`text-3xl md:text-4xl font-bold mb-2 ${
                          paymentMode === 'contado' ? 'text-[#8AAA19]' : 'text-[#010139]'
                        }`}>
                          ${(paymentMode === 'contado' 
                            ? (quote._priceBreakdown.totalAlContado ?? 0) 
                            : (quote._priceBreakdown.totalConTarjeta ?? 0)
                          ).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </div>
                        
                        {/* Info adicional según modo */}
                        {paymentMode === 'contado' ? (
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
                        ${(quote.annualPremium ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                    </div>
                  )}
                  
                  {/* Deducibles: mostrar Comprensivo + Colisión/Vuelco si disponibles */}
                  {quote._deduciblesReales?.comprensivo || quote._deduciblesReales?.colisionVuelco ? (
                    <div className="mt-3 space-y-1">
                      {quote._deduciblesReales.comprensivo && (
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                          <span className="font-medium">Comprensivo:</span>
                          <span className="font-semibold text-[#010139]">
                            B/.{quote._deduciblesReales.comprensivo.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                      {quote._deduciblesReales.colisionVuelco && (
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-600">
                          <span className="font-medium">Colisión/Vuelco:</span>
                          <span className="font-semibold text-[#010139]">
                            B/.{quote._deduciblesReales.colisionVuelco.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : quote._deducibleInfo?.tooltip ? (
                    <div className="mt-3 space-y-1">
                      {quote._deducibleInfo.tooltip.split('\n').map((line: string, i: number) => (
                        <div key={i} className="flex items-center justify-center gap-1 text-xs text-gray-600">
                          <span className="font-semibold text-[#010139]">{line}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 mt-3 text-xs text-gray-600">
                      <span>Deducible desde ${(quote.deductible ?? 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                      {quote._deducibleOriginal && (
                        <AutoCloseTooltip 
                          content={getDeducibleTooltip(quote._deducibleOriginal as 'bajo' | 'medio' | 'alto')}
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* Endoso Highlight - Visual differentiator */}
                {quote._endosoIncluido && (
                  <div className={`mb-4 p-3 rounded-xl border-2 ${
                    quote.planType === 'premium' 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-[#8AAA19]/40' 
                      : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <FaShieldAlt className={`text-sm ${quote.planType === 'premium' ? 'text-[#8AAA19]' : 'text-gray-400'}`} />
                      <span className="text-xs font-bold text-[#010139]">Endosos del Plan</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(quote._endosos || []).map((endoso: any, eIdx: number) => {
                        const isExclusive = endoso.codigo === 'PORCELANA' || endoso.codigo === 'VA' || endoso.codigo === 'CENTENARIO';
                        return (
                          <span 
                            key={eIdx}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold ${
                              isExclusive && quote.planType === 'premium'
                                ? 'bg-[#8AAA19] text-white shadow-sm'
                                : 'bg-white text-gray-600 border border-gray-200'
                            }`}
                          >
                            {isExclusive && quote.planType === 'premium' ? '⭐' : '✓'} {endoso.nombre}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    className={`w-full py-4 rounded-xl font-bold text-base transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      quote.isRecommended
                        ? 'bg-gradient-to-r from-[#8AAA19] via-[#9dbd2e] to-[#8AAA19] text-white hover:shadow-xl hover:scale-[1.02] shadow-lg shadow-[#8AAA19]/30'
                        : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-xl'
                    }`}
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

        {/* ═══════════════════════════════════════════════════════
            MOBILE CAROUSEL — Solo visible por debajo de md (< 768px).
            Agrupa las cotizaciones por aseguradora y muestra un
            toggle Básico / Premium por tarjeta, con tooltips RC.
        ═══════════════════════════════════════════════════════ */}
        <div className="md:hidden mt-4">
          <div
            ref={ccCarouselRef}
            onScroll={handleCCCarouselScroll}
            className="cc-carousel"
            aria-label="Comparativa de cotizaciones"
          >
            {insurerGroups.map(([insurerName, insurerQuotes], idx) => {
              const isActive   = idx === activeCCCardIndex;
              const basicPlan  = insurerQuotes.find(q => q.planType === 'basico');
              const premiumPlan = insurerQuotes.find(q => q.planType === 'premium');
              const hasBoth    = !!basicPlan && !!premiumPlan;
              const currentPlanType = hasBoth ? globalPlanCC : (premiumPlan ? 'premium' : 'basico');
              const currentPlan = currentPlanType === 'premium' ? (premiumPlan ?? basicPlan) : (basicPlan ?? premiumPlan);
              if (!currentPlan) return null;

              return (
                /* ── Tarjeta de aseguradora en carrusel CC ── */
                <div
                  key={insurerName}
                  className={`cc-carousel-item ${isActive ? 'cc-active' : 'cc-inactive'} rounded-xl overflow-hidden border-2 ${
                    currentPlan.isRecommended
                      ? 'border-[#8AAA19] shadow-xl bg-gradient-to-b from-white to-green-50/30'
                      : 'border-gray-200 shadow-md bg-white'
                  }`}
                >
                  {/* Header */}
                  <div className={`p-3 text-white ${
                    currentPlan.isRecommended
                      ? 'bg-gradient-to-br from-[#010139] via-[#020270] to-[#0a0a5c] border-b-4 border-[#8AAA19]'
                      : 'bg-gradient-to-br from-[#010139] to-[#020270]'
                  }`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <InsurerLogo logoUrl={getLogoUrl(insurerName)} insurerName={insurerName} size="md" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm leading-tight truncate">{insurerName}</h3>
                      </div>
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold flex-shrink-0 ${
                        currentPlanType === 'premium'
                          ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white'
                          : 'bg-white/20 text-white'
                      }`}>
                        {currentPlanType === 'premium' ? '⭐ Premium' : 'Básico'}
                      </span>
                    </div>
                    {currentPlan._endosoIncluido && (
                      <span className="text-[9px] text-white/75 font-medium">{currentPlan._endosoIncluido}</span>
                    )}
                  </div>

                  {/* ── TOGGLE DE PLAN: Básico ↔ Premium ── */}
                  {hasBoth && (
                    <div className="cc-plan-toggle">
                      <button
                        onClick={() => setGlobalPlanCC('basico')}
                        className={currentPlanType === 'basico' ? 'cc-toggle-basic' : ''}
                      >
                        Básico · ${basicPlan!.annualPremium.toFixed(0)}
                      </button>
                      <button
                        onClick={() => setGlobalPlanCC('premium')}
                        className={currentPlanType === 'premium' ? 'cc-toggle-premium' : 'cc-toggle-premium-idle'}
                      >
                        ⭐ Premium · ${premiumPlan!.annualPremium.toFixed(0)}
                      </button>
                    </div>
                  )}

                  {/* Contenido del plan activo */}
                  <div className="p-4">
                    {/* Precio */}
                    <div className="mb-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3">
                      {currentPlan._priceBreakdown ? (
                        <>
                          <div className="flex gap-2 mb-3">
                            <button
                              onClick={() => setPaymentMode('contado')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${paymentMode === 'contado' ? 'bg-[#8AAA19] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-300'}`}
                            >
                              Al Contado
                              {currentPlan._priceBreakdown && currentPlan._priceBreakdown.totalConTarjeta > currentPlan._priceBreakdown.totalAlContado && (() => {
                                const pct = Math.round((currentPlan._priceBreakdown!.totalConTarjeta - currentPlan._priceBreakdown!.totalAlContado) / currentPlan._priceBreakdown!.totalConTarjeta * 100);
                                return pct > 0 ? (
                                  <span className={`block text-[9px] font-bold mt-0.5 ${paymentMode === 'contado' ? 'text-white/80' : 'text-[#8AAA19]'}`}>
                                    Ahorra {pct}%
                                  </span>
                                ) : null;
                              })()}
                            </button>
                            <button
                              onClick={() => setPaymentMode('tarjeta')}
                              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${paymentMode === 'tarjeta' ? 'bg-[#010139] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-300'}`}
                            >En Cuotas</button>
                          </div>
                          <div className="text-center">
                            <div className={`text-3xl font-bold mb-1 ${paymentMode === 'contado' ? 'text-[#8AAA19]' : 'text-[#010139]'}`}>
                              ${(paymentMode === 'contado'
                                ? (currentPlan._priceBreakdown.totalAlContado ?? 0)
                                : (currentPlan._priceBreakdown.totalConTarjeta ?? 0)
                              ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {paymentMode === 'tarjeta' && (
                              <p className="text-xs text-gray-500">Elige de 2 a 10 cuotas en emisión</p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1 font-medium">Prima Anual</div>
                          <div className="text-3xl font-bold text-[#010139]">
                            ${(currentPlan.annualPremium ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}

                      {/* Deducibles */}
                      {currentPlan._deduciblesReales?.comprensivo || currentPlan._deduciblesReales?.colisionVuelco ? (
                        <div className="mt-2 space-y-1">
                          {currentPlan._deduciblesReales.comprensivo && (
                            <div className="flex justify-center gap-1 text-xs text-gray-600">
                              <span className="font-medium">Comprensivo:</span>
                              <span className="font-semibold text-[#010139]">B/.{currentPlan._deduciblesReales.comprensivo.amount.toFixed(2)}</span>
                            </div>
                          )}
                          {currentPlan._deduciblesReales.colisionVuelco && (
                            <div className="flex justify-center gap-1 text-xs text-gray-600">
                              <span className="font-medium">Colisión/Vuelco:</span>
                              <span className="font-semibold text-[#010139]">B/.{currentPlan._deduciblesReales.colisionVuelco.amount.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      ) : currentPlan.deductible > 0 && (
                        <div className="text-center mt-2 text-xs text-gray-600">
                          Deducible desde ${currentPlan.deductible.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* ── COBERTURAS RC con tooltips de información ── */}
                    {currentPlan._limites && currentPlan._limites.length > 0 && (
                      <div className="mb-3">
                        <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
                          <FaShieldAlt className="text-[#010139]" size={11} />
                          Coberturas
                        </h5>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          {currentPlan._limites.map((limite: any, limIdx: number) => {
                            const tooltipKey =
                              limite.tipo === 'lesiones_corporales' ? 'bodilyInjury'
                              : limite.tipo === 'daños_propiedad'   ? 'propertyDamage'
                              : 'medicalExpenses';
                            const tooltipText = CC_COVERAGE_TOOLTIPS[tooltipKey];
                            const icon = limite.tipo === 'lesiones_corporales' ? '🩹'
                              : limite.tipo === 'daños_propiedad' ? '🚗💥'
                              : '🏥';
                            const limiteDisplay = [limite.limitePorPersona, limite.limitePorAccidente]
                              .filter(Boolean).join(' / ');

                            return (
                              <div
                                key={limIdx}
                                className={`flex items-center gap-2 px-3 py-2 text-xs ${limIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} ${limIdx < currentPlan._limites.length - 1 ? 'border-b border-gray-100' : ''}`}
                              >
                                <span className="text-sm flex-shrink-0">{icon}</span>
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                  <span className="font-semibold text-gray-800 text-xs">{limite.descripcion}</span>
                                  {/* ── Icono de info con tooltip ── */}
                                  {tooltipText && (
                                    <AutoCloseTooltip content={tooltipText} />
                                  )}
                                </div>
                                {/* Monto + subtítulo "por persona / por accidente" */}
                                <div className="flex-shrink-0 text-right">
                                  <span className="text-[#010139] font-bold text-xs whitespace-nowrap">
                                    {limiteDisplay || 'Incluido'}
                                  </span>
                                  {(limite.tipo === 'lesiones_corporales' || limite.tipo === 'gastos_medicos') &&
                                    limite.limitePorPersona && limite.limitePorAccidente && (
                                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">p.persona / p.accidente</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Beneficios y Endosos (collapsible) ── */}
                    {currentPlan._isReal && (currentPlan._beneficios?.length > 0 || currentPlan._endosos?.length > 0) && (() => {
                      const benefKey = `${insurerName}-${currentPlanType}`;
                      const isExpanded = expandedBenefitsCC[benefKey] || false;
                      return (
                        <div className="mb-4">
                          <button
                            onClick={() => setExpandedBenefitsCC(prev => ({ ...prev, [benefKey]: !prev[benefKey] }))}
                            className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <FaShieldAlt className="text-[#8AAA19]" size={12} />
                              Beneficios y Asistencia
                            </span>
                            {isExpanded ? <FaChevronUp className="text-gray-400" size={11} /> : <FaChevronDown className="text-gray-400" size={11} />}
                          </button>

                          {isExpanded && (
                            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                              {/* Beneficios */}
                              {(currentPlan._beneficios || []).filter((b: any) => b.incluido).map((b: any, bIdx: number) => (
                                <div key={bIdx} className={`flex items-start gap-2 px-3 py-2 text-xs ${bIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} border-b border-gray-100 last:border-b-0`}>
                                  <span className="text-[#8AAA19] flex-shrink-0 mt-0.5">✓</span>
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-gray-700">{b.nombre}</span>
                                    {b.descripcion && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{b.descripcion}</p>}
                                  </div>
                                </div>
                              ))}
                              {/* Endosos */}
                              {(currentPlan._endosos || []).filter((e: any) => e.incluido).map((e: any, eIdx: number) => {
                                const isExclusive = e.codigo === 'PORCELANA' || e.codigo === 'VA' || e.codigo === 'CENTENARIO';
                                return (
                                  <div key={`e-${eIdx}`} className={`flex items-start gap-2 px-3 py-2 text-xs ${(currentPlan._beneficios?.filter((b: any) => b.incluido).length + eIdx) % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'} border-b border-gray-100 last:border-b-0`}>
                                    <span className={`flex-shrink-0 mt-0.5 ${isExclusive && currentPlanType === 'premium' ? 'text-[#8AAA19]' : 'text-gray-400'}`}>
                                      {isExclusive && currentPlanType === 'premium' ? '⭐' : '✓'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-gray-700">{e.nombre}</span>
                                      {e.descripcion && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{e.descripcion}</p>}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Botón de acción — misma lógica que desktop */}
                    <button
                      onClick={() => handleSelectPlan(currentPlan.id)}
                      className={`w-full py-3 rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        currentPlan.isRecommended
                          ? 'bg-gradient-to-r from-[#8AAA19] via-[#9dbd2e] to-[#8AAA19] text-white shadow-lg shadow-[#8AAA19]/30'
                          : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white'
                      }`}
                    >
                      <FaCheckCircle className="text-white" />
                      Seleccionar Este Plan
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Indicadores de posición (dot pills) ── */}
          <div className="flex justify-center items-center gap-2 mt-3 pb-1">
            {insurerGroups.map((_, idx) => (
              <div key={idx} className={`cc-dot ${idx === activeCCCardIndex ? 'cc-dot-active' : ''}`} />
            ))}
          </div>
        </div>


        {/* Premium Upgrade Modal */}
        {showUpgradeModal && selectedBasicPlan && correspondingPremiumPlan && (
          <PremiumUpgradeModal
            isOpen={showUpgradeModal}
            onClose={() => setShowUpgradeModal(false)}
            onUpgrade={handleUpgradeToPremium}
            onContinueBasic={handleContinueBasic}
            insurerName={selectedBasicPlan.insurerName}
            paymentMode={paymentMode}
            basicPlan={{
              premium: selectedBasicPlan.annualPremium,
              deductible: selectedBasicPlan.deductible,
              coverages: selectedBasicPlan.coverages.map(c => c.name),
              beneficios: selectedBasicPlan._beneficios || [],
              endosos: selectedBasicPlan._endosos || [],
              _priceBreakdown: selectedBasicPlan._priceBreakdown,
            }}
            premiumPlan={{
              premium: correspondingPremiumPlan.annualPremium,
              deductible: correspondingPremiumPlan.deductible,
              coverages: correspondingPremiumPlan.coverages.map(c => c.name),
              beneficios: correspondingPremiumPlan._beneficios || [],
              endosos: correspondingPremiumPlan._endosos || [],
              _priceBreakdown: correspondingPremiumPlan._priceBreakdown,
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
