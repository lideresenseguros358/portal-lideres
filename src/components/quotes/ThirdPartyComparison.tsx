'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaTimes, FaStar, FaArrowRight, FaSpinner, FaChevronDown, FaChevronUp, FaShieldAlt, FaExclamationTriangle, FaQuestionCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import { AUTO_THIRD_PARTY_INSURERS, AutoThirdPartyPlan, AutoInsurer, CoverageItem } from '@/lib/constants/auto-quotes';
import InsurerLogo from '@/components/shared/InsurerLogo';
import { trackQuoteCreated } from '@/lib/adm-cot/track-quote';
import { normalizePlanBenefits, type StandardBenefit } from '@/lib/normalizers/third-party-benefits';
import AutoCloseTooltip from '@/components/ui/AutoCloseTooltip';
import { CotizadorInsurerSetting } from '@/context/CotizadorEditContext';

interface ThirdPartyComparisonProps {
  onSelectPlan: (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => void;
  editMode?: boolean;
  insurerSettings?: CotizadorInsurerSetting[];
  onToggleInsurer?: (slug: string, active: boolean) => Promise<void>;
  loadingSettings?: boolean;
}

// ── Cache helpers ──
const CACHE_KEY = 'tp_plans_cache_v6';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24h — plans/benefits rarely change
const API_TIMEOUT = 60_000; // 60s max per API call — IS needs time for token + retries on slow server

interface ApiCache {
  fedpa: any | null;
  is: any | null;
  regional: any | null;
  ancon: any | null;
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

function writeCache(fedpa: any, is: any, regional: any, ancon: any = null) {
  try {
    const entry: ApiCache = { fedpa, is, regional, ancon, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch { /* quota exceeded — ignore */ }
}

/** Merge API responses into the base insurer list */
function mergeApiData(
  baseInsurers: AutoInsurer[],
  fedpaData: any | null,
  isData: any | null,
  regionalData: any | null,
  anconData: any | null = null,
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
          endosoBenefits: apiPlan.endosoBenefits?.length > 0 ? apiPlan.endosoBenefits : fallback.endosoBenefits,
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
          coverageList: covList.length > 0 ? covList : fallback.coverageList,
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
          endosoBenefits: apiPlan.endosoBenefits?.length > 0 ? apiPlan.endosoBenefits : fallback.endosoBenefits,
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

    // ── ANCON ──
    if (insurer.id === 'ancon' && anconData?.success && anconData.plans?.length > 0) {
      const basicApi = anconData.plans.find((p: any) => p.planType === 'basic');
      const premiumApi = anconData.plans.find((p: any) => p.planType === 'premium');

      const mapAnconPlan = (apiPlan: any, fallback: AutoThirdPartyPlan): AutoThirdPartyPlan => {
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
          endosoBenefits: apiPlan.endosoBenefits?.length > 0 ? apiPlan.endosoBenefits : fallback.endosoBenefits,
          endoso: apiPlan.endoso || fallback.endoso,
          idCotizacion: apiPlan.idCotizacion || apiPlan.noCotizacion || fallback.idCotizacion,
          _codProducto: apiPlan._codProducto,
          _nombreProducto: apiPlan._nombreProducto,
          _sumaAsegurada: apiPlan._sumaAsegurada,
          installments: {
            available: false,
            description: 'Solo al contado',
          },
        } as AutoThirdPartyPlan;
      };

      return {
        ...insurer,
        basicPlan: mapAnconPlan(basicApi, insurer.basicPlan),
        premiumPlan: mapAnconPlan(premiumApi, insurer.premiumPlan),
      };
    }

    return insurer;
  });
}

/** Fetch with timeout — returns null on failure instead of blocking */
function fetchWithTimeout(url: string, ms = API_TIMEOUT): Promise<any> {
  return Promise.race([
    fetch(url).then(r => r.json()),
    new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]).catch(() => null);
}

export default function ThirdPartyComparison({
  onSelectPlan,
  editMode = false,
  insurerSettings = [],
  onToggleInsurer,
  loadingSettings = false,
}: ThirdPartyComparisonProps) {
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [togglingInsurer, setTogglingInsurer] = useState<string | null>(null);
  const [insurersData, setInsurersData] = useState<AutoInsurer[]>(() => {
    // Always start with cached data merged into base — instant render
    const cached = readCache();
    if (cached) {
      return mergeApiData(AUTO_THIRD_PARTY_INSURERS, cached.fedpa, cached.is, cached.regional, cached.ancon);
    }
    return AUTO_THIRD_PARTY_INSURERS;
  });
  const [expandedBenefits, setExpandedBenefits] = useState(false);
  const [offlineInsurers, setOfflineInsurers] = useState<Record<string, boolean>>({});
  const [conexionTip, setConexionTip] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  // ── Mobile carousel state: single global plan so all cards sync ──
  const [globalPlan, setGlobalPlan] = useState<'basic' | 'premium'>('basic');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const hintIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Portal mounting guard (SSR-safe) ──
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => { setIsMounted(true); }, []);

  // ── Scroll hint: doble pulso horizontal cada 60 s ──
  // Solo se activa si el usuario aún no ha scrolleado (está en la primera tarjeta).
  useEffect(() => {
    const nudgeCarousel = () => {
      const el = carouselRef.current;
      if (!el || el.scrollLeft > 20) return; // ya scrolleó — no molestar

      const px = 55; // píxeles de cada pulso
      const delay = (ms: number, fn: () => void) => setTimeout(fn, ms);

      el.style.scrollSnapType = 'none'; // desactivar snap durante el pulso
      el.scrollTo({ left: px, behavior: 'smooth' });
      delay(350, () => el.scrollTo({ left: 0,  behavior: 'smooth' }));
      delay(700, () => el.scrollTo({ left: px, behavior: 'smooth' }));
      delay(1050, () => {
        el.scrollTo({ left: 0, behavior: 'smooth' });
        delay(450, () => { el.style.scrollSnapType = ''; }); // re-activar snap
      });
    };

    const initial = setTimeout(nudgeCarousel, 3500); // primer pulso al cargar
    hintIntervalRef.current = setInterval(nudgeCarousel, 60_000); // cada 60 s

    return () => {
      clearTimeout(initial);
      if (hintIntervalRef.current) clearInterval(hintIntervalRef.current);
    };
  }, []);

  // ── Premium hint: solo muestra la primera visita, dura 2 s ──
  const [showPremiumHint, setShowPremiumHint] = useState(false);
  const firstPremiumBtnRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!isMounted) return;
    try {
      if (!localStorage.getItem('tp_premium_hint_seen')) {
        const t1 = setTimeout(() => setShowPremiumHint(true), 900);
        const t2 = setTimeout(() => {
          setShowPremiumHint(false);
          localStorage.setItem('tp_premium_hint_seen', '1');
        }, 2900);
        return () => { clearTimeout(t1); clearTimeout(t2); };
      }
    } catch { /* localStorage bloqueado en algunos browsers */ }
  }, [isMounted]);

  // In edit mode, skip all API calls and just show insurers list
  useEffect(() => {
    if (editMode && insurerSettings.length > 0) {
      // Skip carousel hints in edit mode
      if (hintIntervalRef.current) {
        clearInterval(hintIntervalRef.current);
      }
    }
  }, [editMode, insurerSettings.length]);

  // Silent background refresh — NEVER shows loading/skeleton/banner (skip if in edit mode)
  useEffect(() => {
    if (editMode) return; // Skip API calls in edit mode

    const refreshPlans = async () => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        const [fedpaData, isData, regionalData, anconData] = await Promise.all([
          fetchWithTimeout('/api/fedpa/third-party'),
          fetchWithTimeout('/api/is/third-party'),
          fetchWithTimeout('/api/regional/third-party'),
          fetchWithTimeout('/api/ancon/third-party'),
        ]);

        // Only update cache & UI if we got at least one valid response
        if (fedpaData || isData || regionalData || anconData) {
          // Merge: keep previous cached data for providers that timed out
          const prev = readCache();
          const finalFedpa = fedpaData || prev?.fedpa || null;
          const finalIs = isData || prev?.is || null;
          const finalRegional = regionalData || prev?.regional || null;
          const finalAncon = anconData || prev?.ancon || null;

          writeCache(finalFedpa, finalIs, finalRegional, finalAncon);
          setInsurersData(mergeApiData(AUTO_THIRD_PARTY_INSURERS, finalFedpa, finalIs, finalRegional, finalAncon));

          // Detect offline insurers from API responses
          const offline: Record<string, boolean> = {};
          // FEDPA: null response = fetch failed/timeout, or success:false
          if (!finalFedpa || finalFedpa.online === false || !finalFedpa.success) offline['fedpa'] = true;
          // IS: online flag explicitly set by backend
          if (!finalIs || finalIs.online === false) offline['internacional'] = true;
          // REGIONAL: online flag explicitly set by backend
          if (!finalRegional || finalRegional.online === false) offline['regional'] = true;
          // ANCON: online flag
          if (!finalAncon || finalAncon.online === false) offline['ancon'] = true;
          setOfflineInsurers(offline);
        }
      } catch (error) {
        console.error('[ThirdParty] Error refrescando planes:', error);
      } finally {
        fetchingRef.current = false;
      }
    };

    refreshPlans();
  }, []);

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
        quoteRef: `REGIONAL-${plan.idCotizacion || 'DT'}-DT-${type === 'premium' ? 'P' : 'B'}`,
        insurer: 'REGIONAL',
        clientName: 'Anónimo',
        ramo: 'AUTO',
        coverageType: 'Daños a Terceros',
        planName: type === 'premium' ? 'Plan Premium DT' : 'Plan Básico DT',
        annualPremium: plan.annualPremium,
      });
    }

    // ANCON: store quote data for emission flow
    if (insurer.id === 'ancon') {
      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        insurerId: insurer.id, insurerName: insurer.name, planType: type,
        annualPremium: plan.annualPremium, isRealAPI: true, isANCON: true,
        idCotizacion: plan.idCotizacion,
        installments: plan.installments,
      }));

      // ═══ ADM COT: Track ANCON DT quote ═══
      trackQuoteCreated({
        quoteRef: `ANCON-${plan.idCotizacion || 'DT'}-DT-${type === 'premium' ? 'P' : 'B'}`,
        insurer: 'ANCON',
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
    ancon: '/aseguradoras/ancon.png',
  };

  const getLogoUrl = (insurerId: string): string | null => {
    return INSURER_LOGOS[insurerId] || null;
  };

  const toggleBenefits = () => {
    setExpandedBenefits(prev => !prev);
  };

  // ── Definiciones de tooltip por cobertura RC ──
  const COVERAGE_TOOLTIPS: Record<string, string> = {
    bodilyInjury:    'Cubre los gastos médicos de los peatones o personas en el otro vehículo afectados en caso de un accidente.',
    propertyDamage:  'Cubre los daños ocasionados a bienes de terceros ajenos (otros vehículos, muros, postes, propiedad pública o privada).',
    medicalExpenses: 'Cubre tus propios gastos médicos y los de los pasajeros dentro de tu vehículo al momento del accidente.',
  };

  // ── Carousel: detecta la tarjeta más centrada al hacer scroll ──
  const handleCarouselScroll = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const center = carousel.scrollLeft + carousel.clientWidth / 2;
    let closestIdx = 0;
    let closestDist = Infinity;
    Array.from(carousel.children).forEach((child, idx) => {
      const el = child as HTMLElement;
      const cardCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < closestDist) { closestDist = dist; closestIdx = idx; }
    });
    setActiveCardIndex(closestIdx);
  };

  // ── Render a single benefit row (with detail inline) ──
  const renderBenefitRow = (benefit: StandardBenefit, idx: number, isLast: boolean) => {
    const { status } = benefit;
    const isExcluded = status.type === 'excluded';
    const isConexion = status.type === 'conexion';
    const detail = status.type === 'included' ? status.detail : status.type === 'conexion' ? status.detail : undefined;

    return (
      <div
        key={benefit.key}
        className={`flex items-start gap-2.5 px-3 py-2 text-xs sm:text-sm ${
          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'
        } ${!isLast ? 'border-b border-gray-100' : ''}`}
      >
        {/* Icon */}
        <span className="text-base flex-shrink-0 leading-5">{benefit.icon}</span>

        {/* Label + detail underneath */}
        <div className="flex-1 min-w-0">
          <span className={`font-medium leading-5 block ${isExcluded ? 'text-gray-400' : 'text-gray-700'}`}>
            {benefit.label}
          </span>
          {detail && (
            <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{detail}</p>
          )}
        </div>

        {/* Status */}
        <div className="flex-shrink-0 text-right min-w-[70px]">
          {isExcluded && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50">
              <FaTimes className="text-red-400" size={11} />
            </span>
          )}
          {isConexion && (
            <span className="inline-flex items-center gap-1">
              <span className="text-amber-600 font-semibold text-xs">Conexión</span>
              <span className="relative">
                <FaQuestionCircle
                  className="text-amber-400 cursor-help"
                  size={12}
                  onClick={(e) => { e.stopPropagation(); setConexionTip(prev => prev === benefit.key ? null : benefit.key); }}
                />
                {conexionTip === benefit.key && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setConexionTip(null)} />
                    <span className="absolute bottom-full right-0 mb-1 w-52 p-2 bg-gray-900 text-white text-[10px] leading-tight rounded-lg shadow-lg z-50">
                      La aseguradora no cubre el gasto, pero le ayuda a contactar el servicio. El costo lo cubre el cliente.
                    </span>
                  </>
                )}
              </span>
            </span>
          )}
          {status.type === 'included' && !status.amount && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50">
              <FaCheck className="text-[#8AAA19]" size={11} />
            </span>
          )}
          {status.type === 'included' && status.amount && (
            <div className="text-right">
              <span className="text-[#8AAA19] font-bold text-xs sm:text-sm whitespace-nowrap">
                {status.amount.startsWith('$') ? status.amount : `$${status.amount}`}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render a single coverage row (top 3: always visible) ──
  const renderCoverageRow = (benefit: StandardBenefit, idx: number, isLast: boolean) => {
    const { status } = benefit;
    const isExcluded = status.type === 'excluded';
    const tooltipText = COVERAGE_TOOLTIPS[benefit.key];

    return (
      <div
        key={benefit.key}
        className={`flex items-start gap-2.5 px-3 py-2.5 ${
          idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'
        } ${!isLast ? 'border-b border-gray-100' : ''}`}
      >
        <span className="text-base flex-shrink-0 leading-5">{benefit.icon}</span>

        {/* Label + icono de información con tooltip ── */}
        <div className="flex-1 min-w-0 flex items-center gap-1">
          <span className={`font-semibold leading-5 text-xs sm:text-sm ${isExcluded ? 'text-gray-400' : 'text-gray-800'}`}>
            {benefit.label}
          </span>
          {tooltipText && (
            <AutoCloseTooltip content={tooltipText} />
          )}
        </div>

        <div className="flex-shrink-0 text-right min-w-[80px]">
          {isExcluded ? (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50">
              <FaTimes className="text-red-400" size={11} />
            </span>
          ) : status.type === 'included' && status.amount ? (
            <div>
              <span className="text-[#010139] font-bold text-xs sm:text-sm whitespace-nowrap">
                {status.amount.startsWith('$') ? status.amount : `$${status.amount}`}
              </span>
              {status.detail && (
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{status.detail}</p>
              )}
            </div>
          ) : (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-50">
              <FaCheck className="text-[#8AAA19]" size={11} />
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render a single plan card section
  const renderPlanSection = (
    insurer: AutoInsurer,
    plan: AutoThirdPartyPlan,
    type: 'basic' | 'premium',
    isPremium: boolean
  ) => {
    const isBenefitsExpanded = expandedBenefits;

    // Normalize to standard benefit list
    const normalized = normalizePlanBenefits(insurer.id, plan, type);

    return (
      <div className={`p-4 sm:p-6 ${isPremium ? 'bg-gradient-to-br from-green-50 to-white' : 'border-b-2 border-gray-100'}`}>
        {/* Plan Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-[#010139] text-base sm:text-lg truncate">{isPremium ? 'Plan Premium' : 'Plan Básico'}</span>
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

        {/* ── Coberturas principales (siempre visibles) ── */}
        <div className="mb-3">
          <h5 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
            <FaShieldAlt className="text-[#010139]" size={11} />
            Coberturas
          </h5>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {normalized.coverages.map((cov, idx) =>
              renderCoverageRow(cov, idx, idx === normalized.coverages.length - 1)
            )}
          </div>
        </div>

        {/* ── Beneficios y Asistencia (collapsible) ── */}
        <div className="mb-4">
          <button
            onClick={() => toggleBenefits()}
            className="w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <span className="flex items-center gap-2">
              <FaShieldAlt className="text-[#8AAA19]" size={12} />
              Beneficios y Asistencia
            </span>
            {isBenefitsExpanded ? <FaChevronUp className="text-gray-400" size={11} /> : <FaChevronDown className="text-gray-400" size={11} />}
          </button>

          {isBenefitsExpanded && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
              {normalized.benefits.map((ben, idx) =>
                renderBenefitRow(ben, idx, idx === normalized.benefits.length - 1)
              )}
              {plan.endosoPdf && (
                <div className="px-3 py-2 bg-blue-50/50 border-t border-gray-100">
                  <a
                    href={plan.endosoPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                  >
                    Ver documento completo del endoso →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Emit Button */}
        {offlineInsurers[insurer.id] ? (
          <div className="w-full px-4 sm:px-6 py-3 rounded-xl bg-gray-200 text-gray-500 font-bold flex items-center justify-center gap-2 text-sm sm:text-base cursor-not-allowed">
            <FaExclamationTriangle className="text-red-400" />
            <span>No disponible — servidor offline</span>
          </div>
        ) : (
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
        )}
      </div>
    );
  };

  // ── Edit Mode: Show insurer cards with toggle active/inactive ──
  if (editMode) {
    if (loadingSettings) {
      return (
        <div className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#010139] border-t-[#8AAA19] mb-4 mx-auto"></div>
            <p className="text-gray-600 font-semibold">Cargando configuración de aseguradoras...</p>
          </div>
        </div>
      );
    }

    if (insurerSettings.length === 0) {
      return (
        <div className="py-20 px-4">
          <div className="max-w-7xl mx-auto text-center">
            <p className="text-gray-600 font-semibold">No hay aseguradoras disponibles</p>
          </div>
        </div>
      );
    }

    return (
      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-[#010139] mb-3">
              Modo Edición: Daños a Terceros
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Activa o desactiva cada aseguradora para esta sección
            </p>
          </div>

          {/* Grid of insurer cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {insurerSettings.map((setting) => {
              const isActive = setting.tp_activo;
              return (
                <div
                  key={setting.slug}
                  className={`rounded-2xl shadow-lg border-2 p-6 transition-all ${
                    isActive
                      ? 'border-[#8AAA19] bg-white'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  {/* Logo */}
                  <div className="mb-4 flex justify-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center">
                      <InsurerLogo logoUrl={`/aseguradoras/${setting.slug}.png`} insurerName={setting.display_name} size="lg" />
                    </div>
                  </div>

                  {/* Name */}
                  <h3 className="text-center font-bold text-gray-900 mb-4 text-sm">{setting.display_name}</h3>

                  {/* Status badge + Toggle */}
                  <div className="flex items-center justify-between mb-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                      isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {isActive ? '✓ Activo' : '✕ Inactivo'}
                    </div>
                  </div>

                  {/* Toggle button */}
                  <button
                    onClick={async () => {
                      setTogglingInsurer(setting.slug);
                      try {
                        await onToggleInsurer?.(setting.slug, !isActive);
                      } catch (err) {
                        console.error('Failed to toggle insurer:', err);
                      } finally {
                        setTogglingInsurer(null);
                      }
                    }}
                    disabled={togglingInsurer === setting.slug}
                    className={`w-full py-2 rounded-xl font-semibold text-sm transition-all ${
                      togglingInsurer === setting.slug
                        ? 'opacity-50 cursor-not-allowed'
                        : isActive
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {togglingInsurer === setting.slug ? 'Actualizando...' : (isActive ? 'Desactivar' : 'Activar')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Filter insurers based on tp_activo setting if available
  const filteredInsurersData = insurersData.filter((insurer) => {
    if (!insurerSettings || insurerSettings.length === 0) return true;
    const setting = insurerSettings.find(s => s.slug === insurer.id);
    return setting?.tp_activo !== false;
  });

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════
          CSS: Carrusel móvil + Toggle de plan + Tooltip de cobertura
          Todos los estilos aplican ÚNICAMENTE en mobile (< 768px).
          El desktop NO se ve afectado por estas reglas.
      ═══════════════════════════════════════════════════════════ */}
      <style>{`
        /* ── Contenedor del carrusel horizontal ── */
        .tp-carousel {
          display: flex;
          overflow-x: scroll;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          gap: 12px;
          padding: 4px 20px 12px;
        }
        .tp-carousel::-webkit-scrollbar { display: none; }

        /* ── Tarjeta individual del carrusel ── */
        .tp-carousel-item {
          flex-shrink: 0;
          scroll-snap-align: center;
          width: calc(88vw);
          max-width: 340px;
          transition: transform 0.35s cubic-bezier(.25,.46,.45,.94),
                      opacity  0.35s ease;
          will-change: transform, opacity;
        }
        /* Efecto coverflow: tarjeta central al 100%, laterales reducidas */
        .tp-carousel-item.tp-active   { transform: scale(1);   opacity: 1;   }
        .tp-carousel-item.tp-inactive { transform: scale(0.9); opacity: 0.6; }

        /* ── Toggle segmentado Básico / Premium ── */
        .tp-plan-toggle {
          display: flex;
          background: #f3f4f6;
          border-radius: 10px;
          padding: 3px;
          margin: 0 12px;
        }
        .tp-plan-toggle button {
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
        .tp-plan-toggle button.tp-toggle-basic {
          background: #010139;
          color: white;
          box-shadow: 0 2px 6px rgba(1,1,57,0.25);
        }
        /* ── Estado SELECCIONADO del botón Premium ── */
        .tp-plan-toggle button.tp-toggle-premium {
          background: linear-gradient(135deg, #8AAA19, #6d8814);
          color: white;
          box-shadow: 0 2px 8px rgba(138,170,25,0.55);
        }

        /* ── Estado NO seleccionado del botón Premium: shimmer + pop ──
           Shimmer: barre un destello luminoso de izquierda a derecha.
           Pop: cada 4 s el botón se infla y rebota para llamar atención. */
        @keyframes tp-premium-shine {
          0%        { background-position: -250% center; }
          22%, 100% { background-position:  300% center; }
        }
        @keyframes tp-premium-pop {
          0%, 72%, 100% { transform: scale(1);    box-shadow: 0 2px 8px rgba(138,170,25,0.35); }
          77%            { transform: scale(1.07); box-shadow: 0 0 0 6px rgba(138,170,25,0.18), 0 4px 18px rgba(138,170,25,0.6); }
          83%            { transform: scale(0.97); box-shadow: 0 2px 6px rgba(138,170,25,0.3); }
          88%            { transform: scale(1.03); box-shadow: 0 0 0 3px rgba(138,170,25,0.12), 0 3px 12px rgba(138,170,25,0.45); }
          93%            { transform: scale(1);    box-shadow: 0 2px 8px rgba(138,170,25,0.35); }
        }
        .tp-plan-toggle button.tp-toggle-premium-idle {
          background: linear-gradient(105deg,
            #6d8814 0%, #8AAA19 28%, #d6ec4a 46%, #c0d830 50%, #d6ec4a 54%, #8AAA19 72%, #6d8814 100%);
          background-size: 300% auto;
          color: white;
          animation:
            tp-premium-shine 7s ease-in-out infinite,
            tp-premium-pop   4s   ease-in-out infinite;
        }

        /* Hint tooltip de primera visita */
        @keyframes tp-hint-in {
          from { opacity: 0; transform: translate(-50%, calc(-100% - 2px)) scale(0.85); }
          to   { opacity: 1; transform: translate(-50%, calc(-100% - 8px)) scale(1);    }
        }
        @keyframes tp-hint-out {
          from { opacity: 1; }
          to   { opacity: 0; }
        }
        .tp-hint-bubble {
          animation: tp-hint-in 0.3s cubic-bezier(.34,1.56,.64,1) forwards;
        }
        .tp-hint-bubble.hiding {
          animation: tp-hint-out 0.25s ease forwards;
        }

        /* ── Botón de info de cobertura ── */
        .cov-info-btn {
          background: none;
          border: none;
          padding: 0 2px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          vertical-align: middle;
        }

        /* ── Popover del tooltip de cobertura ──
           position/top/left/transform se aplican inline via JS
           para escapar cualquier overflow:hidden del padre.        */
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

        /* ── Indicador de posición (dot pills) ── */
        .tp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #d1d5db;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }
        .tp-dot.tp-dot-active {
          background: #8AAA19;
          width: 20px;
          border-radius: 3px;
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          DESKTOP — Grid original sin ningún cambio (md y superior).
          Se oculta en mobile con `hidden md:grid`.
      ═══════════════════════════════════════════════════════════ */}
      <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredInsurersData.map((insurer) => {
          const isOffline = !!offlineInsurers[insurer.id];
          if (isOffline) return null;
          return (
            <div key={insurer.id} className="bg-white rounded-2xl shadow-lg border-2 transition-all duration-300 overflow-hidden border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl">
              {/* Header */}
              <div className="p-6 text-white bg-gradient-to-br from-[#010139] to-[#020270]">
                <div className="flex items-center gap-4 mb-4">
                  <InsurerLogo logoUrl={getLogoUrl(insurer.id)} insurerName={insurer.name} size="lg" />
                  <h3 className="font-bold text-xl flex-1">{insurer.name}</h3>
                </div>
                <div className="text-sm text-white/80 font-medium">Emisión inmediata • Sin inspección</div>
              </div>
              {renderPlanSection(insurer, insurer.basicPlan, 'basic', false)}
              {renderPlanSection(insurer, insurer.premiumPlan, 'premium', true)}
            </div>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MOBILE CAROUSEL — Solo visible por debajo de md (< 768px).
          Carrusel horizontal con:
            • Efecto coverflow (tarjeta central al 100%, laterales 90%)
            • Toggle Básico / Premium por aseguradora
            • Indicadores de posición (dots)
      ═══════════════════════════════════════════════════════════ */}
      <div className="md:hidden">
        {/* ── Carrusel horizontal con scroll snap ── */}
        <div
          ref={carouselRef}
          onScroll={handleCarouselScroll}
          className="tp-carousel"
          aria-label="Comparativa de aseguradoras"
        >
          {filteredInsurersData.map((insurer, idx) => {
            if (!!offlineInsurers[insurer.id]) return null;
            const isActive   = idx === activeCardIndex;
            const currentPlan = globalPlan;

            return (
              /* ── Tarjeta de aseguradora (con coverflow) ── */
              <div
                key={insurer.id}
                className={`tp-carousel-item ${isActive ? 'tp-active' : 'tp-inactive'} bg-white rounded-2xl shadow-lg border-2 overflow-hidden border-gray-100`}
              >
                {/* Header compacto */}
                <div className="px-4 py-3 text-white bg-gradient-to-br from-[#010139] to-[#020270]">
                  <div className="flex items-center gap-3">
                    <InsurerLogo logoUrl={getLogoUrl(insurer.id)} insurerName={insurer.name} size="lg" />
                    <h3 className="font-bold text-base flex-1 leading-tight">{insurer.name}</h3>
                  </div>
                  <div className="text-xs text-white/75 font-medium mt-1">Emisión inmediata · Sin inspección</div>
                </div>

                {/* ── TOGGLE DE PLAN: Básico ↔ Premium ── */}
                <div className="pt-3 pb-1">
                    <div className="tp-plan-toggle">
                      <button
                        onClick={() => setGlobalPlan('basic')}
                        className={currentPlan === 'basic' ? 'tp-toggle-basic' : ''}
                      >
                        Básico · B/.{insurer.basicPlan.annualPremium.toFixed(0)}
                      </button>
                      <button
                        ref={idx === 0 ? firstPremiumBtnRef : undefined}
                        onClick={() => setGlobalPlan('premium')}
                        className={currentPlan === 'premium' ? 'tp-toggle-premium' : 'tp-toggle-premium-idle'}
                      >
                        ⭐ Premium · B/.{insurer.premiumPlan.annualPremium.toFixed(0)}
                      </button>
                    </div>
                  </div>

                {/* ── Solo muestra el plan activo seleccionado en el toggle ── */}
                {currentPlan === 'basic'
                  ? renderPlanSection(insurer, insurer.basicPlan,   'basic',   false)
                  : renderPlanSection(insurer, insurer.premiumPlan, 'premium', true)
                }
              </div>
            );
          })}
        </div>

        {/* ── Indicadores de posición (dot pills) ── */}
        <div className="flex justify-center items-center gap-2 mt-3 pb-1">
          {filteredInsurersData.map((_, idx) => (
            <div key={idx} className={`tp-dot ${idx === activeCardIndex ? 'tp-dot-active' : ''}`} />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PORTAL — Hint de primera visita sobre el botón Premium
          Solo aparece una vez, durante 2 s, luego queda silenciado
          en localStorage.
      ═══════════════════════════════════════════════════════════ */}
      {isMounted && showPremiumHint && (() => {
        const rect = firstPremiumBtnRef.current?.getBoundingClientRect();
        if (!rect) return null;
        return createPortal(
          <div
            className="tp-hint-bubble"
            style={{
              position: 'absolute',
              top: rect.top + window.scrollY,
              left: rect.left + rect.width / 2 + window.scrollX,
              transform: 'translate(-50%, calc(-100% - 8px))',
              zIndex: 9999,
              background: '#010139',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 700,
              padding: '6px 12px',
              borderRadius: '20px',
              boxShadow: '0 4px 16px rgba(1,1,57,0.4)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              letterSpacing: '0.01em',
            }}
          >
            ¿Necesitas más coberturas? 👆
            {/* Flecha apuntando hacia el botón */}
            <div style={{
              position: 'absolute', top: '100%', left: '50%',
              transform: 'translateX(-50%)',
              width: 0, height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #010139',
            }} />
          </div>,
          document.body
        );
      })()}
    </>
  );
}
