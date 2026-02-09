'use client';

import { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaInfoCircle, FaStar, FaArrowRight, FaSpinner, FaChevronDown, FaChevronUp, FaShieldAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import { AUTO_THIRD_PARTY_INSURERS, COVERAGE_LABELS, AutoThirdPartyPlan, AutoInsurer, CoverageItem } from '@/lib/constants/auto-quotes';
import InsurerLogo from '@/components/shared/InsurerLogo';

interface ThirdPartyComparisonProps {
  onSelectPlan: (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => void;
}

export default function ThirdPartyComparison({ onSelectPlan }: ThirdPartyComparisonProps) {
  const [selectedPlan, setSelectedPlan] = useState<{insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium'} | null>(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [insurerLogos, setInsurerLogos] = useState<Record<string, string | null>>({});
  const [generatingQuote, setGeneratingQuote] = useState(false);
  const [loadingFedpaPlans, setLoadingFedpaPlans] = useState(false);
  const [fedpaPlansLoaded, setFedpaPlansLoaded] = useState(false);
  const [insurersData, setInsurersData] = useState<AutoInsurer[]>(AUTO_THIRD_PARTY_INSURERS);
  const [expandedEndoso, setExpandedEndoso] = useState<Record<string, boolean>>({});

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

  // Cargar planes de FEDPA en tiempo real
  useEffect(() => {
    const loadFedpaPlans = async () => {
      if (fedpaPlansLoaded) return;
      setLoadingFedpaPlans(true);
      
      try {
        const response = await fetch('/api/fedpa/third-party');
        const data = await response.json();
        
        if (data.success && data.plans?.length > 0) {
          setInsurersData(prevInsurers => {
            return prevInsurers.map(insurer => {
              if (insurer.id !== 'fedpa') return insurer;
              
              const basicApi = data.plans.find((p: any) => p.planType === 'basic');
              const premiumApi = data.plans.find((p: any) => p.planType === 'premium');
              
              const mapApiPlan = (apiPlan: any, fallback: AutoThirdPartyPlan): AutoThirdPartyPlan => {
                if (!apiPlan) return fallback;
                
                // Build coverages object from coverageList
                const covList: CoverageItem[] = apiPlan.coverageList || [];
                const findCov = (code: string) => covList.find(c => c.code === code);
                
                return {
                  ...fallback,
                  name: apiPlan.name || fallback.name,
                  opcion: apiPlan.opcion,
                  annualPremium: apiPlan.annualPremium,
                  coverageList: covList,
                  endoso: apiPlan.endoso,
                  endosoPdf: apiPlan.endosoPdf,
                  endosoBenefits: apiPlan.endosoBenefits,
                  planCode: data.planCode || 426,
                  includedCoverages: apiPlan.includedCoverages,
                  idCotizacion: apiPlan.idCotizacion,
                  installments: {
                    available: true,
                    payments: apiPlan.installments?.payments || 2,
                    amount: apiPlan.installments?.amount,
                    totalWithInstallments: apiPlan.installments?.totalWithInstallments,
                    description: `${apiPlan.installments?.payments || 2} cuotas mensuales`,
                  },
                  coverages: {
                    bodilyInjury: findCov('A')?.limit || fallback.coverages.bodilyInjury,
                    propertyDamage: findCov('B')?.limit || fallback.coverages.propertyDamage,
                    medicalExpenses: findCov('C')?.limit || 'no',
                    accidentalDeathDriver: findCov('H-1')?.limit || fallback.coverages.accidentalDeathDriver,
                    accidentalDeathPassengers: findCov('H')?.limit || 'no',
                    funeralExpenses: findCov('K6')?.limit || fallback.coverages.funeralExpenses,
                    accidentAssistance: 'sí',
                    ambulance: 'sí',
                    roadAssistance: 'sí',
                    towing: 'sí',
                    legalAssistance: 'sí',
                    fedpaAsist: findCov('FAB')?.name || findCov('FAV')?.name || fallback.coverages.fedpaAsist,
                  },
                };
              };
              
              return {
                ...insurer,
                basicPlan: mapApiPlan(basicApi, insurer.basicPlan),
                premiumPlan: mapApiPlan(premiumApi, insurer.premiumPlan),
              };
            });
          });
          
          setFedpaPlansLoaded(true);
          toast.success('Precios FEDPA actualizados', { duration: 2000 });
        }
      } catch (error) {
        console.error('[ThirdParty] Error cargando planes de FEDPA:', error);
      } finally {
        setLoadingFedpaPlans(false);
      }
    };
    
    loadFedpaPlans();
  }, [fedpaPlansLoaded]);

  const handlePlanClick = async (insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium') => {
    if (insurer.id === 'internacional') {
      try {
        setGeneratingQuote(true);
        toast.loading('Generando cotización...');
        const vcodplancobertura = type === 'basic' ? 5 : 16;
        const quoteResponse = await fetch('/api/is/auto/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vcodtipodoc: 1, vnrodoc: '0-0-0', vnombre: 'Cliente', vapellido: 'Temporal',
            vtelefono: '0000-0000', vcorreo: 'temp@ejemplo.com',
            vcodmarca: 204, vcodmodelo: 1234, vanioauto: new Date().getFullYear(),
            vsumaaseg: 0, vcodplancobertura, vcodgrupotarifa: 1, environment: 'development',
          }),
        });
        if (!quoteResponse.ok) throw new Error('Error al generar cotización');
        const quoteResult = await quoteResponse.json();
        if (!quoteResult.success || !quoteResult.idCotizacion) throw new Error('No se obtuvo ID de cotización');
        sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
          idCotizacion: quoteResult.idCotizacion, insurerId: insurer.id, insurerName: insurer.name,
          planType: type, vcodplancobertura, vcodgrupotarifa: 1, annualPremium: plan.annualPremium, isRealAPI: true,
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
    
    if (insurer.id === 'fedpa') {
      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        insurerId: insurer.id, insurerName: insurer.name, planType: type,
        annualPremium: plan.annualPremium, isRealAPI: true, isFEDPA: true,
        idCotizacion: plan.idCotizacion, planCode: plan.planCode || 426,
        includedCoverages: plan.includedCoverages, endosoPdf: plan.endosoPdf,
        installments: plan.installments, opcion: plan.opcion,
      }));
    }
    
    if (plan.installments.available) {
      setSelectedPlan({ insurer, plan, type });
      setShowInstallmentsModal(true);
    } else {
      onSelectPlan(insurer.id, type, plan);
    }
  };

  const handleConfirmInstallments = () => {
    if (selectedPlan) {
      setShowInstallmentsModal(false);
      onSelectPlan(selectedPlan.insurer.id, selectedPlan.type, selectedPlan.plan);
    }
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

  const toggleEndoso = (key: string) => {
    setExpandedEndoso(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Render a single plan card section
  const renderPlanSection = (
    insurer: AutoInsurer,
    plan: AutoThirdPartyPlan,
    type: 'basic' | 'premium',
    isPremium: boolean
  ) => {
    const endosoKey = `${insurer.id}-${type}`;
    const isEndosoExpanded = expandedEndoso[endosoKey] || false;
    const hasCoverageList = plan.coverageList && plan.coverageList.length > 0;

    return (
      <div className={`p-6 ${isPremium ? 'bg-gradient-to-br from-green-50 to-white' : 'border-b-2 border-gray-100'}`}>
        {/* Plan Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#010139] text-lg">{plan.name || (isPremium ? 'Plan Premium' : 'Plan Básico')}</span>
            {isPremium && <FaStar className="text-[#8AAA19]" />}
          </div>
          <div className="text-right">
            <div className={`text-3xl font-black ${isPremium ? 'text-[#8AAA19]' : 'text-[#010139]'}`}>
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
        <div className="mb-4">
          <h5 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
            <FaShieldAlt className="text-[#010139]" />
            Coberturas por accidentes
          </h5>
          
          {hasCoverageList ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 border-b border-gray-200">
                <span>Cobertura</span>
                <span>Límite</span>
              </div>
              {plan.coverageList!.map((cov, idx) => (
                <div key={cov.code} className={`grid grid-cols-[1fr_auto] px-3 py-2.5 text-sm ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${idx < plan.coverageList!.length - 1 ? 'border-b border-gray-100' : ''}`}>
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
          ) : (
            /* Fallback: use coverages object */
            <div className="space-y-2">
              {Object.entries(plan.coverages).map(([key, value]) => {
                if (key === 'fedpaAsist') return null;
                return (
                  <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-gray-50">
                    <span className="text-gray-700 font-medium">{COVERAGE_LABELS[key] || key}</span>
                    <span className="text-right">
                      {value === 'no' ? (
                        <span className="text-gray-400 flex items-center gap-1"><FaTimes size={10} /> No incluido</span>
                      ) : value === 'sí' ? (
                        <span className="text-[#8AAA19] font-semibold flex items-center gap-1"><FaCheck size={10} /> Incluido</span>
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

        {/* Endoso expandable dropdown */}
        {plan.endoso && (
          <div className="mb-4">
            <button
              onClick={() => toggleEndoso(endosoKey)}
              className="w-full flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm font-semibold text-[#010139] hover:bg-blue-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <FaShieldAlt className="text-blue-500" />
                {plan.endoso}
              </span>
              {isEndosoExpanded ? <FaChevronUp className="text-blue-500" /> : <FaChevronDown className="text-blue-500" />}
            </button>
            
            {isEndosoExpanded && (
              <div className="mt-2 bg-blue-50/50 border border-blue-100 rounded-lg p-4">
                {plan.endosoBenefits && plan.endosoBenefits.length > 0 ? (
                  <ul className="space-y-2">
                    {plan.endosoBenefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                        <FaCheck className="text-[#8AAA19] flex-shrink-0 mt-0.5" size={12} />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-600">
                    <p className="font-medium mb-2">Beneficios incluidos:</p>
                    <ul className="space-y-1.5">
                      <li className="flex items-start gap-2"><FaCheck className="text-[#8AAA19] flex-shrink-0 mt-0.5" size={12} /><span>Asistencia vial 24/7</span></li>
                      <li className="flex items-start gap-2"><FaCheck className="text-[#8AAA19] flex-shrink-0 mt-0.5" size={12} /><span>Servicio de grúa</span></li>
                      <li className="flex items-start gap-2"><FaCheck className="text-[#8AAA19] flex-shrink-0 mt-0.5" size={12} /><span>Asistencia médica telefónica</span></li>
                      <li className="flex items-start gap-2"><FaCheck className="text-[#8AAA19] flex-shrink-0 mt-0.5" size={12} /><span>Auxilio en carretera (gasolina, batería, llantas)</span></li>
                    </ul>
                    {plan.endosoPdf && (
                      <a
                        href={plan.endosoPdf}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-xs text-blue-600 hover:underline"
                      >
                        Ver documento completo del endoso →
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Emit Button */}
        <button
          onClick={() => handlePlanClick(insurer, plan, type)}
          disabled={generatingQuote}
          className={`w-full px-6 py-3 rounded-xl transition-all font-bold group flex items-center justify-center gap-2 ${
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
      {loadingFedpaPlans && (
        <div className="mb-4 bg-blue-50 border-2 border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <FaSpinner className="animate-spin text-blue-600 text-xl" />
          <div>
            <p className="font-semibold text-blue-900">Actualizando planes de FEDPA...</p>
            <p className="text-sm text-blue-700">Obteniendo datos en tiempo real desde la API</p>
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

      {/* Installments Modal */}
      {showInstallmentsModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto my-4 sm:my-8">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-[#010139] mb-2">Opciones de Pago</h3>
                  <p className="text-gray-600 text-sm">{selectedPlan.insurer.name} - {selectedPlan.plan.name}</p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#8AAA19] transition-all cursor-pointer"
                  onClick={handleConfirmInstallments}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#010139]">Al Contado</span>
                    <span className="text-2xl font-bold text-[#8AAA19]">B/.{selectedPlan.plan.annualPremium.toFixed(2)}</span>
                  </div>
                  <p className="text-sm text-gray-600">Vigencia por 1 año</p>
                </div>

                {selectedPlan.plan.installments.amount && selectedPlan.plan.installments.payments && (
                  <div className="border-2 border-[#8AAA19] bg-green-50 rounded-lg p-4 hover:border-[#6d8814] transition-all cursor-pointer"
                    onClick={handleConfirmInstallments}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#010139]">{selectedPlan.plan.installments.payments} Cuotas/Mensuales</span>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#010139]">
                          B/.{(selectedPlan.plan.installments.totalWithInstallments || (selectedPlan.plan.installments.amount * selectedPlan.plan.installments.payments)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">Vigencia por 1 año</p>
                    <p className="text-xs text-gray-500 mt-1">
                      ({selectedPlan.plan.installments.payments} pagos de B/.{selectedPlan.plan.installments.amount.toFixed(2)})
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowInstallmentsModal(false)}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
