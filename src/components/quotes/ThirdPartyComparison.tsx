'use client';

import { useState, useEffect, useRef } from 'react';
import { FaCheck, FaTimes, FaStar, FaArrowRight, FaSpinner, FaChevronDown, FaChevronUp, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import { AUTO_THIRD_PARTY_INSURERS, COVERAGE_LABELS, AutoThirdPartyPlan, AutoInsurer, CoverageItem } from '@/lib/constants/auto-quotes';
import InsurerLogo from '@/components/shared/InsurerLogo';

interface ThirdPartyComparisonProps {
  onSelectPlan: (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => void;
}

export default function ThirdPartyComparison({ onSelectPlan }: ThirdPartyComparisonProps) {
  const [insurerLogos, setInsurerLogos] = useState<Record<string, string | null>>({});
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [insurersData, setInsurersData] = useState<AutoInsurer[]>(AUTO_THIRD_PARTY_INSURERS);
  const [expandedBenefits, setExpandedBenefits] = useState<Record<string, boolean>>({});
  const fetchingRef = useRef(false);

  useEffect(() => {
    fetch('/api/insurers')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.insurers)) {
          const logos: Record<string, string | null> = {};
          data.insurers.forEach((ins: any) => {
            const variations = [
              ins.name.toUpperCase(),
              ins.name.toUpperCase().replace(/\s+SEGUROS$/i, '').trim(),
              ins.name.toUpperCase().replace(/\s+DE\s+/gi, ' ').trim(),
              ins.name.toUpperCase().replace(/PANAMÁ/gi, 'PANAMA').trim(),
              ins.name.toUpperCase().split(' ')[0],
            ];
            variations.forEach(variation => {
              if (variation && !logos[variation]) logos[variation] = ins.logo_url;
            });
          });
          setInsurerLogos(logos);
        }
      })
      .catch(err => console.error('Error loading insurer logos:', err));
  }, []);

  // Cargar planes de FEDPA e IS en tiempo real
  useEffect(() => {
    const loadAllPlans = async () => {
      if (plansLoaded || fetchingRef.current) return;
      fetchingRef.current = true;
      setLoadingPlans(true);
      
      try {
        const [fedpaRes, isRes] = await Promise.allSettled([
          fetch('/api/fedpa/third-party').then(r => r.json()),
          fetch('/api/is/third-party').then(r => r.json()),
        ]);

        const fedpaData = fedpaRes.status === 'fulfilled' ? fedpaRes.value : null;
        const isData = isRes.status === 'fulfilled' ? isRes.value : null;

        setInsurersData(prevInsurers => {
          return prevInsurers.map(insurer => {
            // ── FEDPA ──
            if (insurer.id === 'fedpa' && fedpaData?.success && fedpaData.plans?.length > 0) {
              const basicApi = fedpaData.plans.find((p: any) => p.planType === 'basic');
              const premiumApi = fedpaData.plans.find((p: any) => p.planType === 'premium');
              
              const mapFedpaPlan = (apiPlan: any, fallback: AutoThirdPartyPlan): AutoThirdPartyPlan => {
                if (!apiPlan) return fallback;
                const covList: CoverageItem[] = apiPlan.coverageList || [];
                
                // Keep fixed prices and names from constants ($130/$165, Plan Básico/Plan VIP)
                // Only take coverageList, endoso data, and idCotizacion from API
                return {
                  ...fallback,
                  coverageList: covList.length > 0 ? covList : fallback.coverageList,
                  endoso: fallback.endoso || apiPlan.endoso,
                  endosoPdf: fallback.endosoPdf || apiPlan.endosoPdf,
                  endosoBenefits: (fallback.endosoBenefits && fallback.endosoBenefits.length > 0) ? fallback.endosoBenefits : apiPlan.endosoBenefits,
                  planCode: fedpaData.planCode || fallback.planCode || 426,
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

                return {
                  ...fallback,
                  // Update price from API, keep name and coverages (benefits) from constants
                  annualPremium: apiPlan.annualPremium || fallback.annualPremium,
                  coverageList: covList.length > 0 ? covList : undefined,
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

            return insurer;
          });
        });
        
        setPlansLoaded(true);
        if (fedpaData?.success) toast.success('Precios actualizados en tiempo real', { duration: 2000 });
      } catch (error) {
        console.error('[ThirdParty] Error cargando planes:', error);
      } finally {
        setLoadingPlans(false);
      }
    };
    
    loadAllPlans();
  }, [plansLoaded]);

  const handlePlanClick = async (insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium') => {
    // IS: generate quote on-the-fly with correct plan codes (306=SOAT, 307=Intermedio)
    if (insurer.id === 'internacional') {
      try {
        setGeneratingQuote(true);
        toast.loading('Generando cotización...');
        const vcodplancobertura = type === 'basic' ? 306 : 307;
        const quoteResponse = await fetch('/api/is/auto/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vcodtipodoc: 1, vnrodoc: '0-0-0', vnombre: 'Cliente', vapellido: 'Temporal',
            vtelefono: '0000-0000', vcorreo: 'temp@ejemplo.com',
            vcodmarca: 156, vcodmodelo: 2563, vanioauto: new Date().getFullYear(),
            vsumaaseg: 0, vcodplancobertura, vcodgrupotarifa: 20, environment: 'development',
          }),
        });
        if (!quoteResponse.ok) throw new Error('Error al generar cotización');
        const quoteResult = await quoteResponse.json();
        if (!quoteResult.success || !quoteResult.idCotizacion) throw new Error('No se obtuvo ID de cotización');
        sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
          idCotizacion: quoteResult.idCotizacion, insurerId: insurer.id, insurerName: insurer.name,
          planType: type, vcodplancobertura, vcodgrupotarifa: 20, annualPremium: plan.annualPremium, isRealAPI: true,
        }));
        toast.dismiss();
        toast.success('Cotización generada');
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
    
    // FEDPA: store quote data for emission flow
    if (insurer.id === 'fedpa') {
      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        insurerId: insurer.id, insurerName: insurer.name, planType: type,
        annualPremium: plan.annualPremium, isRealAPI: true, isFEDPA: true,
        idCotizacion: plan.idCotizacion, planCode: plan.planCode || 426,
        includedCoverages: plan.includedCoverages, endosoPdf: plan.endosoPdf,
        installments: plan.installments, opcion: plan.opcion,
      }));
    }
    
    // Go directly to emission — payment modal in emission flow handles contado vs cuotas
    onSelectPlan(insurer.id, type, plan);
  };

  const getLogoUrl = (insurerName: string): string | null => {
    const normalized = insurerName.toUpperCase()
      .replace(/PANAMÁ/gi, 'PANAMA').replace(/[ÁÉÍÓÚ]/g, m => ({ 'Á':'A','É':'E','Í':'I','Ó':'O','Ú':'U' }[m] || m)).trim();
    const firstWord = normalized.split(' ')[0] || '';
    for (const v of [normalized, normalized.replace(/\s+SEGUROS$/i,'').trim(), normalized.replace(/\s+DE\s+/gi,' ').trim(), firstWord]) {
      if (v && insurerLogos[v]) return insurerLogos[v];
    }
    return null;
  };

  const toggleBenefits = (key: string) => {
    setExpandedBenefits(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Helper: render a benefit value badge
  const renderBenefitValue = (value: string) => {
    if (value === 'no') {
      return <span className="text-red-400 flex items-center gap-1"><FaTimes size={10} /> No incluido</span>;
    }
    if (value === 'sí') {
      return <span className="text-[#8AAA19] font-semibold flex items-center gap-1"><FaCheck size={10} /> Incluido</span>;
    }
    // "Conexión" and similar partial values → gray to differentiate
    if (value.toLowerCase().includes('conexión')) {
      return <span className="text-gray-400 italic text-xs">{value}</span>;
    }
    return <span className="text-[#8AAA19] font-semibold">{value}</span>;
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

    // All benefit keys to show (including excluded with red X)
    const allBenefitKeys = [
      'accidentAssistance', 'ambulance', 'roadAssistance', 'towing', 'legalAssistance',
      'accidentalDeathDriver', 'accidentalDeathPassengers', 'funeralExpenses',
    ];

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

        {/* Coberturas por accidentes - from API coverageList */}
        <div className="mb-3">
          <h5 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-2">
            <FaShieldAlt className="text-[#010139]" />
            Coberturas por accidentes
          </h5>
          
          {hasCoverageList ? (() => {
            // Filter out endoso rows (FAB, FAV, FAP) — those are shown in the benefits dropdown
            const filteredCovList = plan.coverageList!.filter(
              cov => !['FAB', 'FAV', 'FAP'].includes(cov.code)
            );
            return (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="grid grid-cols-[1fr_auto] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 border-b border-gray-200">
                  <span>Cobertura</span>
                  <span>Límite</span>
                </div>
                {filteredCovList.map((cov, idx) => (
                  <div key={cov.code} className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs sm:text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${idx < filteredCovList.length - 1 ? 'border-b border-gray-100' : ''}`}>
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
            );
          })() : (
            /* Fallback: use coverages object — only monetary coverages */
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {['bodilyInjury', 'propertyDamage', 'medicalExpenses'].map((key, idx) => {
                const value = plan.coverages[key as keyof typeof plan.coverages];
                if (!value) return null;
                return (
                  <div key={key} className={`grid grid-cols-[1fr_auto] gap-2 px-3 py-2 text-xs sm:text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100 last:border-b-0`}>
                    <span className="text-gray-700 font-medium">{COVERAGE_LABELS[key]}</span>
                    <span className="text-right">
                      {value === 'no' ? (
                        <span className="text-red-400 flex items-center gap-1"><FaTimes size={10} /> No incluido</span>
                      ) : (
                        <span className="text-[#8AAA19] font-semibold">{value}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Beneficios y Asistencia — single collapsible dropdown */}
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
              {/* Benefit items table */}
              {allBenefitKeys.map((key, idx) => {
                const value = plan.coverages[key as keyof typeof plan.coverages] || 'no';
                return (
                  <div key={key} className={`flex items-start justify-between gap-2 px-3 py-2 text-xs sm:text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} border-b border-gray-100`}>
                    <span className="text-gray-700 font-medium">{COVERAGE_LABELS[key] || key}</span>
                    <span className="text-right flex-shrink-0">
                      {renderBenefitValue(value)}
                    </span>
                  </div>
                );
              })}

              {/* Endoso benefits list */}
              {plan.endosoBenefits && plan.endosoBenefits.length > 0 && (
                <div className="bg-blue-50/50 p-3 sm:p-4">
                  <p className="text-xs font-bold text-[#010139] mb-2 flex items-center gap-1.5">
                    <FaShieldAlt className="text-blue-500" size={11} />
                    {plan.endoso || 'Endoso de Asistencia'}
                  </p>
                  <ul className="space-y-1.5">
                    {plan.endosoBenefits.map((benefit, idx) => (
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
              )}
            </div>
          )}
        </div>

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
                <InsurerLogo logoUrl={getLogoUrl(insurer.name)} insurerName={insurer.name} size="lg" />
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
