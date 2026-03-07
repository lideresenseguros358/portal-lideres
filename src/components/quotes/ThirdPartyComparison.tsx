'use client';

import { useState, useEffect, useRef } from 'react';
import { FaCheck, FaStar, FaArrowRight, FaSpinner, FaChevronDown, FaChevronUp, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import { AUTO_THIRD_PARTY_INSURERS, AutoThirdPartyPlan, AutoInsurer, CoverageItem } from '@/lib/constants/auto-quotes';
import InsurerLogo from '@/components/shared/InsurerLogo';
import { trackQuoteCreated } from '@/lib/adm-cot/track-quote';

interface ThirdPartyComparisonProps {
  onSelectPlan: (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => void;
}

// ── Cache helpers ──
const CACHE_KEY = 'tp_plans_cache_v2';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours — matches server-side TTL

interface ApiCache {
  fedpa: any | null;
  is: any | null;
  regional: any | null;
  timestamp: number;
}

function readCache(): ApiCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: ApiCache = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function writeCache(fedpa: any, is: any, regional: any) {
  try {
    const entry: ApiCache = { fedpa, is, regional, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
}

/** Merge API responses into the base insurer list */
function mergeApiData(
  baseInsurers: AutoInsurer[],
  fedpaData: any | null,
  isData: any | null,
  regionalData: any | null,
): AutoInsurer[] {
  return baseInsurers.map(insurer => {
    // ── FEDPA ──
    if (insurer.id === 'fedpa' && fedpaData?.success && fedpaData.plans?.length > 0) {
      const basicApi = fedpaData.plans.find((p: any) => p.planType === 'basic');
      const premiumApi = fedpaData.plans.find((p: any) => p.planType === 'premium');

      const mapFedpaPlan = (apiPlan: any, fallback: AutoThirdPartyPlan): AutoThirdPartyPlan => {
        if (!apiPlan) return fallback;
        const covList: CoverageItem[] = apiPlan.coverageList || [];

        return {
          ...fallback,
          coverageList: covList.length > 0 ? covList : fallback.coverageList,
          endoso: apiPlan.endoso || fallback.endoso,
          endosoPdf: apiPlan.endosoPdf || fallback.endosoPdf,
          endosoBenefits: apiPlan.endosoBenefits || [],
          planCode: apiPlan.emissionPlanCode || fedpaData.planCode || fallback.planCode || 1000,
          includedCoverages: apiPlan.includedCoverages || fallback.includedCoverages,
          idCotizacion: apiPlan.idCotizacion || fallback.idCotizacion,
        };
      };

      return {
        ...insurer,
        basicPlan: mapFedpaPlan(basicApi, insurer.basicPlan),
        premiumPlan: mapFedpaPlan(premiumApi, insurer.premiumPlan),
      };
    }

    // ── INTERNACIONAL DE SEGUROS ──
    if (insurer.id === 'internacional' && isData?.success && isData.plans?.length > 0) {
      const basicApi = isData.plans.find((p: any) => p.planType === 'basic');
      const premiumApi = isData.plans.find((p: any) => p.planType === 'premium');

      const mapIsPlan = (apiPlan: any, fallback: AutoThirdPartyPlan): AutoThirdPartyPlan => {
        if (!apiPlan) return fallback;
        const covList: CoverageItem[] = apiPlan.coverageList || [];
        const apiBenefits: string[] = apiPlan.endosoBenefits || [];

        return {
          ...fallback,
          annualPremium: apiPlan.annualPremium || fallback.annualPremium,
          coverageList: covList.length > 0 ? covList : undefined,
          endosoBenefits: apiBenefits.length > 0 ? apiBenefits : fallback.endosoBenefits,
          endoso: apiBenefits.length > 0 ? apiPlan.name || fallback.name : fallback.endoso,
          idCotizacion: apiPlan.idCotizacion || fallback.idCotizacion,
          vcodplancobertura: apiPlan.codPlanCobertura || fallback.vcodplancobertura,
          vcodgrupotarifa: apiPlan.vcodgrupotarifa || fallback.vcodgrupotarifa,
          vcodmarca: apiPlan.vcodmarca || fallback.vcodmarca,
          vcodmodelo: apiPlan.vcodmodelo || fallback.vcodmodelo,
          installments: {
            available: false,
            description: 'Solo al contado',
          },
        };
      };

      return {
        ...insurer,
        basicPlan: mapIsPlan(basicApi, insurer.basicPlan),
        premiumPlan: mapIsPlan(premiumApi, insurer.premiumPlan),
      };
    }

    // ── REGIONAL ──
    if (insurer.id === 'regional' && regionalData?.success && regionalData.plans?.length > 0) {
      const basicApi = regionalData.plans.find((p: any) => p.planType === 'basic');
      const premiumApi = regionalData.plans.find((p: any) => p.planType === 'premium');

      const mapRegionalPlan = (apiPlan: any, fallback: AutoThirdPartyPlan): AutoThirdPartyPlan => {
        if (!apiPlan) return fallback;
        const covList: CoverageItem[] = (apiPlan.coverageList || []).map((c: any) => ({
          code: String(c.code || ''),
          name: c.name || '',
          limit: c.limit || '',
          prima: Number(c.prima) || 0,
        }));
        return {
          ...fallback,
          annualPremium: apiPlan.annualPremium || fallback.annualPremium,
          coverageList: covList.length > 0 ? covList : fallback.coverageList,
          endosoBenefits: apiPlan.endosoBenefits || [],
          endoso: apiPlan.endoso || fallback.endoso,
          idCotizacion: apiPlan.numcot || fallback.idCotizacion,
          planCode: apiPlan.codplan ? parseInt(apiPlan.codplan) : fallback.planCode,
          installments: {
            available: false,
            description: 'Solo al contado',
          },
        };
      };

      return {
        ...insurer,
        basicPlan: mapRegionalPlan(basicApi, insurer.basicPlan),
        premiumPlan: mapRegionalPlan(premiumApi, insurer.premiumPlan),
      };
    }

    return insurer;
  });
}

export default function ThirdPartyComparison({ onSelectPlan }: ThirdPartyComparisonProps) {
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const hasCacheRef = useRef(!!readCache());
  const [loadingPlans, setLoadingPlans] = useState(!hasCacheRef.current);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [insurersData, setInsurersData] = useState<AutoInsurer[]>(() => {
    // Inicializar con cache si existe — coberturas y beneficios se muestran de inmediato
    const cached = readCache();
    if (cached) {
      return mergeApiData(AUTO_THIRD_PARTY_INSURERS, cached.fedpa, cached.is, cached.regional);
    }
    return AUTO_THIRD_PARTY_INSURERS;
  });
  const [expandedBenefits, setExpandedBenefits] = useState<Record<string, boolean>>({});
  const fetchingRef = useRef(false);

  // Cargar planes de FEDPA, IS y REGIONAL (silent refresh si hay cache, loading si no)
  useEffect(() => {
    const loadAllPlans = async () => {
      if (plansLoaded || fetchingRef.current) return;
      fetchingRef.current = true;
      // Only show loading spinner if we DON'T have a cache (first visit)
      if (!hasCacheRef.current) setLoadingPlans(true);
      
      try {
        const [fedpaRes, isRes, regionalRes] = await Promise.allSettled([
          fetch('/api/fedpa/third-party').then(r => r.json()),
          fetch('/api/is/third-party').then(r => r.json()),
          fetch('/api/regional/third-party').then(r => r.json()),
        ]);

        const fedpaData = fedpaRes.status === 'fulfilled' ? fedpaRes.value : null;
        const isData = isRes.status === 'fulfilled' ? isRes.value : null;
        const regionalData = regionalRes.status === 'fulfilled' ? regionalRes.value : null;

        // Guardar en localStorage para carga instantánea en próxima visita
        writeCache(fedpaData, isData, regionalData);

        setInsurersData(mergeApiData(AUTO_THIRD_PARTY_INSURERS, fedpaData, isData, regionalData));
        
        setPlansLoaded(true);
      } catch (error) {
        console.error('[ThirdParty] Error cargando planes:', error);
      } finally {
        setLoadingPlans(false);
      }
    };
    
    loadAllPlans();
  }, [plansLoaded]);

  const handlePlanClick = async (insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium') => {
    // IS: reuse idCotizacion from initial load, only fetch if missing
    if (insurer.id === 'internacional') {
      const vcodplancobertura = plan.vcodplancobertura || (type === 'basic' ? 306 : 307);
      const vcodgrupotarifa = plan.vcodgrupotarifa || 20;
      const vcodmarca = plan.vcodmarca || 156;
      const vcodmodelo = plan.vcodmodelo || 2563;
      let idCotizacion = plan.idCotizacion;

      // Only call the slow API if we don't have an idCotizacion from the initial load
      if (!idCotizacion) {
        try {
          setGeneratingQuote(true);
          toast.loading('Generando cotización...');
          const quoteResponse = await fetch('/api/is/auto/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vcodtipodoc: 1, vnrodoc: '0-0-0', vnombre: 'Cliente', vapellido: 'Temporal',
              vtelefono: '0000-0000', vcorreo: 'temp@ejemplo.com',
              vcodmarca, vcodmodelo, vanioauto: new Date().getFullYear(),
              vsumaaseg: 0, vcodplancobertura, vcodgrupotarifa, environment: 'development',
            }),
          });
          if (!quoteResponse.ok) throw new Error('Error al generar cotización');
          const quoteResult = await quoteResponse.json();
          if (!quoteResult.success || !quoteResult.idCotizacion) throw new Error('No se obtuvo ID de cotización');
          idCotizacion = quoteResult.idCotizacion;
          toast.dismiss();
        } catch (error) {
          console.error('[INTERNACIONAL] Error:', error);
          toast.dismiss();
          toast.error('Error al generar cotización. Intenta de nuevo.');
          setGeneratingQuote(false);
          return;
        } finally {
          setGeneratingQuote(false);
        }
      }

      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        idCotizacion, insurerId: insurer.id, insurerName: insurer.name,
        planType: type, vcodplancobertura, vcodgrupotarifa, vcodmarca, vcodmodelo,
        annualPremium: plan.annualPremium, isRealAPI: true,
      }));

      // ═══ ADM COT: Track IS DT quote ═══
      trackQuoteCreated({
        quoteRef: `IS-${idCotizacion}-DT-${type === 'premium' ? 'P' : 'B'}`,
        insurer: 'INTERNACIONAL',
        clientName: 'Anónimo',
        ramo: 'AUTO',
        coverageType: 'Daños a Terceros',
        planName: type === 'premium' ? 'Intermedio DT' : 'SOAT DT',
        annualPremium: plan.annualPremium,
      });
    }
    
    // REGIONAL: store quote data for emission flow
    if (insurer.id === 'regional') {
      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        insurerId: insurer.id, insurerName: insurer.name, planType: type,
        annualPremium: plan.annualPremium, isRealAPI: true, isREGIONAL: true,
        idCotizacion: plan.idCotizacion,
        planCode: plan.planCode || (type === 'basic' ? 30 : 31),
        installments: plan.installments,
      }));

      // ═══ ADM COT: Track REGIONAL DT quote ═══
      trackQuoteCreated({
        quoteRef: `REGIONAL-DT-${type === 'premium' ? 'P' : 'B'}`,
        insurer: 'REGIONAL',
        clientName: 'Anónimo',
        ramo: 'AUTO',
        coverageType: 'Daños a Terceros',
        planName: type === 'premium' ? 'Plan Premium DT' : 'Plan Básico DT',
        annualPremium: plan.annualPremium,
      });
    }

    // FEDPA: store quote data for emission flow
    if (insurer.id === 'fedpa') {
      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        insurerId: insurer.id, insurerName: insurer.name, planType: type,
        annualPremium: plan.annualPremium, isRealAPI: true, isFEDPA: true,
        idCotizacion: plan.idCotizacion, planCode: plan.emissionPlanCode || plan.planCode || 1000,
        includedCoverages: plan.includedCoverages, endosoPdf: plan.endosoPdf,
        installments: plan.installments, opcion: plan.opcion,
      }));

      // ═══ ADM COT: Track FEDPA DT quote ═══
      trackQuoteCreated({
        quoteRef: `FEDPA-${plan.idCotizacion || 'DT'}-DT-${type === 'premium' ? 'P' : 'B'}`,
        insurer: 'FEDPA',
        clientName: 'Anónimo',
        ramo: 'AUTO',
        coverageType: 'Daños a Terceros',
        planName: type === 'premium' ? 'Plan VIP DT' : 'Plan Básico DT',
        annualPremium: plan.annualPremium,
      });
    }
    
    // Go directly to emission — payment modal in emission flow handles contado vs cuotas
    onSelectPlan(insurer.id, type, plan);
  };

  const INSURER_LOGOS: Record<string, string> = {
    fedpa: '/aseguradoras/fedpa.png',
    internacional: '/aseguradoras/internacional.png',
    regional: '/aseguradoras/regional.png',
  };

  const getLogoUrl = (insurerId: string): string | null => {
    return INSURER_LOGOS[insurerId] || null;
  };

  const toggleBenefits = (key: string) => {
    setExpandedBenefits(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Render a single plan card section
  const renderPlanSection = (
    insurer: AutoInsurer,
    plan: AutoThirdPartyPlan,
    type: 'basic' | 'premium',
    isPremium: boolean
  ) => {
    const benefitsKey = `${insurer.id}-${type}-benefits`;
    const isBenefitsExpanded = expandedBenefits[benefitsKey] || false;
    const hasCoverageList = plan.coverageList && plan.coverageList.length > 0;
    const hasEndosoBenefits = plan.endosoBenefits && plan.endosoBenefits.length > 0;

    return (
      <div className={`p-4 sm:p-6 ${isPremium ? 'bg-gradient-to-br from-green-50 to-white' : 'border-b-2 border-gray-100'}`}>
        {/* Plan Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-[#010139] text-base sm:text-lg truncate">{plan.name || (isPremium ? 'Plan Premium' : 'Plan Básico')}</span>
            {isPremium && <FaStar className="text-[#8AAA19] flex-shrink-0" />}
          </div>
          <div className="text-right flex-shrink-0 ml-2">
            <div className={`text-2xl sm:text-3xl font-black ${isPremium ? 'text-[#8AAA19]' : 'text-[#010139]'}`}>
              B/.{plan.annualPremium.toFixed(0)}
            </div>
            <div className="text-xs text-gray-600">/año</div>
          </div>
        </div>

        {/* Installments info */}
        {plan.installments.available && plan.installments.amount && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-4 text-xs text-gray-700">
            💳 B/.{plan.annualPremium.toFixed(2)} al contado o {plan.installments.payments} cuotas de B/.{plan.installments.amount.toFixed(2)}
          </div>
        )}

        {plan.notes && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4 text-xs text-gray-700">
            {plan.notes}
          </div>
        )}

        {/* Coberturas — from API coverageList (cached or live) */}
        {hasCoverageList ? (
          <div className="mb-3">
            <h5 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
              <FaShieldAlt className="text-[#010139]" />
              Coberturas incluidas
            </h5>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 border-b border-gray-200">
                <span>Cobertura</span>
                <span>Límite</span>
              </div>
              {plan.coverageList!.map((cov, idx) => (
                <div key={cov.code || idx} className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs sm:text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${idx < plan.coverageList!.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <span className="text-gray-700 font-medium">{cov.name}</span>
                  <span className="text-[#8AAA19] font-semibold text-right whitespace-nowrap">
                    {cov.limit === 'INCLUIDO' ? (
                      <span className="inline-flex items-center gap-1"><FaCheck size={10} /> INCLUIDO</span>
                    ) : (
                      cov.limit
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : loadingPlans && (
          <div className="mb-3">
            <h5 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
              <FaShieldAlt className="text-[#010139]" />
              Coberturas incluidas
            </h5>
            <div className="border border-gray-200 rounded-lg overflow-hidden animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${i < 4 ? 'border-b border-gray-100' : ''}`}>
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-16"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Beneficios y Asistencia — from API endosoBenefits (cached or live) */}
        {hasEndosoBenefits && (
          <div className="mb-3">
            <button
              onClick={() => toggleBenefits(benefitsKey)}
              className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FaShieldAlt className="text-[#8AAA19]" size={14} />
                Beneficios y Asistencia
              </span>
              {isBenefitsExpanded ? <FaChevronUp className="text-gray-500" size={12} /> : <FaChevronDown className="text-gray-500" size={12} />}
            </button>

            {isBenefitsExpanded && (
              <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-50/50 p-3 sm:p-4">
                  {plan.endoso && (
                    <p className="text-xs font-bold text-[#010139] mb-2 flex items-center gap-1.5">
                      <FaShieldAlt className="text-blue-500" size={11} />
                      {plan.endoso}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {plan.endosoBenefits!.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-gray-700">
                        <FaCheck className="text-[#8AAA19] flex-shrink-0 mt-0.5" size={10} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  {plan.endosoPdf && (
                    <a
                      href={plan.endosoPdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Ver documento completo del endoso →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Emit Button */}
        <button
          onClick={() => handlePlanClick(insurer, plan, type)}
          disabled={generatingQuote}
          className={`w-full px-4 sm:px-6 py-3 rounded-xl transition-all font-bold group flex items-center justify-center gap-2 text-sm sm:text-base ${
            isPremium
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:shadow-2xl text-white'
              : 'bg-gradient-to-r from-[#010139] to-[#020270] hover:shadow-lg text-white'
          } ${generatingQuote ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {generatingQuote ? (
            <><FaSpinner className="animate-spin" /> Procesando...</>
          ) : (
            <><span>Emitir Ahora</span><FaArrowRight className="group-hover:translate-x-1 transition-transform" /></>
          )}
        </button>
      </div>
    );
  };

  return (
    <>
      {loadingPlans && (
        <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <FaSpinner className="animate-spin text-blue-600 text-xl" />
          <div>
            <p className="font-semibold text-blue-900">Actualizando planes...</p>
            <p className="text-sm text-blue-700">Obteniendo precios en tiempo real desde las aseguradoras</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {insurersData.map((insurer) => (
          <div key={insurer.id} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl transition-all duration-300 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#010139] to-[#020270] p-6 text-white">
              <div className="flex items-center gap-4 mb-4">
                <InsurerLogo logoUrl={getLogoUrl(insurer.id)} insurerName={insurer.name} size="lg" />
                <h3 className="font-bold text-xl flex-1">{insurer.name}</h3>
              </div>
              <div className="text-sm text-white/80 font-medium">
                Emisión inmediata • Sin inspección
              </div>
            </div>

            {renderPlanSection(insurer, insurer.basicPlan, 'basic', false)}
            {renderPlanSection(insurer, insurer.premiumPlan, 'premium', true)}
          </div>
        ))}
      </div>

    </>
  );
}
