'use client';

import { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaInfoCircle, FaStar, FaCheckCircle, FaArrowRight } from 'react-icons/fa';
import { toast } from 'sonner';
import { AUTO_THIRD_PARTY_INSURERS, COVERAGE_LABELS, AutoThirdPartyPlan, AutoInsurer } from '@/lib/constants/auto-quotes';
import InsurerLogo from '@/components/shared/InsurerLogo';

interface ThirdPartyComparisonProps {
  onSelectPlan: (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => void;
}

export default function ThirdPartyComparison({ onSelectPlan }: ThirdPartyComparisonProps) {
  const [selectedPlan, setSelectedPlan] = useState<{insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium'} | null>(null);
  const [showInstallmentsModal, setShowInstallmentsModal] = useState(false);
  const [insurerLogos, setInsurerLogos] = useState<Record<string, string | null>>({});
  const [generatingQuote, setGeneratingQuote] = useState(false);

  useEffect(() => {
    // Cargar logos de aseguradoras
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

  const handlePlanClick = async (insurer: AutoInsurer, plan: AutoThirdPartyPlan, type: 'basic' | 'premium') => {
    // Si es INTERNACIONAL, generar cotización automática con API
    if (insurer.id === 'internacional') {
      try {
        setGeneratingQuote(true);
        toast.loading('Generando cotización...');
        
        // Plan 5 = DAT Particular (básico), Plan 16 = DAT Comercial (premium)
        const vcodplancobertura = type === 'basic' ? 5 : 16;
        
        // Generar cotización automáticamente (sin mostrar al usuario)
        const quoteResponse = await fetch('/api/is/auto/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vcodtipodoc: 1,
            vnrodoc: '0-0-0',  // Temporal, se actualizará en emisión
            vnombre: 'Cliente',
            vapellido: 'Temporal',
            vtelefono: '0000-0000',
            vcorreo: 'temp@ejemplo.com',
            vcodmarca: 204, // Default Toyota
            vcodmodelo: 1234, // Default Corolla
            vanioauto: new Date().getFullYear(),
            vsumaaseg: 0, // ← DAÑOS A TERCEROS SIEMPRE 0
            vcodplancobertura,
            vcodgrupotarifa: 1,
            environment: 'development',
          }),
        });
        
        if (!quoteResponse.ok) {
          throw new Error('Error al generar cotización');
        }
        
        const quoteResult = await quoteResponse.json();
        if (!quoteResult.success || !quoteResult.idCotizacion) {
          throw new Error('No se obtuvo ID de cotización');
        }
        
        // Guardar datos para emisión
        sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
          idCotizacion: quoteResult.idCotizacion,
          insurerId: insurer.id,
          insurerName: insurer.name,
          planType: type,
          vcodplancobertura,
          vcodgrupotarifa: 1,
          annualPremium: plan.annualPremium,
          isRealAPI: true,
        }));
        
        toast.dismiss();
        toast.success('Cotización generada');
        
      } catch (error) {
        console.error('[INTERNACIONAL] Error generando cotización:', error);
        toast.dismiss();
        toast.error('Error al generar cotización. Intenta de nuevo.');
        setGeneratingQuote(false);
        return;
      } finally {
        setGeneratingQuote(false);
      }
    }
    
    // Si es FEDPA, marcar que usa API real
    if (insurer.id === 'fedpa') {
      sessionStorage.setItem('thirdPartyQuote', JSON.stringify({
        insurerId: insurer.id,
        insurerName: insurer.name,
        planType: type,
        annualPremium: plan.annualPremium,
        isRealAPI: true,
        isFEDPA: true, // Flag específico FEDPA
      }));
      toast.success('Plan FEDPA seleccionado');
    }
    
    // Continuar con flujo normal
    if (plan.installments.available) {
      setSelectedPlan({ insurer, plan, type });
      setShowInstallmentsModal(true);
    } else {
      onSelectPlan(insurer.id, type, plan);
    }
  };

  const handleConfirmInstallments = (useInstallments: boolean) => {
    if (selectedPlan) {
      setShowInstallmentsModal(false);
      onSelectPlan(selectedPlan.insurer.id, selectedPlan.type, selectedPlan.plan);
    }
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

  const renderCoverageValue = (value: string) => {
    if (value === 'no') {
      return (
        <span className="inline-flex items-center gap-1 text-gray-400 text-sm">
          <FaTimes size={12} /> No incluido
        </span>
      );
    } else if (value === 'sí') {
      return (
        <span className="inline-flex items-center gap-1 text-[#8AAA19] text-sm font-semibold">
          <FaCheck size={12} /> Incluido
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-[#8AAA19] text-sm">
          <FaCheck size={12} /> {value}
        </span>
      );
    }
  };

  return (
    <>
      {/* Cards View - Mobile First */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {AUTO_THIRD_PARTY_INSURERS.map((insurer) => (
          <div key={insurer.id} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-2xl transition-all duration-300 overflow-hidden group">
            {/* Header con Logo */}
            <div className={`bg-gradient-to-br from-[#010139] to-[#020270] p-6 text-white`}>
              <div className="flex items-center gap-4 mb-4">
                <InsurerLogo 
                  logoUrl={getLogoUrl(insurer.name)}
                  insurerName={insurer.name}
                  size="lg"
                />
                <h3 className="font-bold text-xl flex-1">{insurer.name}</h3>
              </div>
              <div className="text-sm text-white/80 font-medium">
                Emisión inmediata • Sin inspección
              </div>
            </div>

            {/* Plan Básico */}
            <div className="p-6 border-b-2 border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-[#010139] text-lg">Plan Básico</span>
                <div className="text-right">
                  <div className="text-3xl font-black text-[#010139]">
                    B/.{insurer.basicPlan.annualPremium.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-600">/año</div>
                </div>
              </div>

              {insurer.basicPlan.installments.available && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-4 text-xs text-gray-700">
                  💳 {insurer.basicPlan.installments.description}
                </div>
              )}

              {insurer.basicPlan.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4 text-xs text-gray-700">
                  {insurer.basicPlan.notes}
                </div>
              )}

              {/* Todas las coberturas */}
              <div className="space-y-2 mb-4">
                {Object.entries(insurer.basicPlan.coverages).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-700">{COVERAGE_LABELS[key as keyof typeof COVERAGE_LABELS]}</span>
                    <div className="text-right flex-shrink-0">
                      {renderCoverageValue(value)}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handlePlanClick(insurer, insurer.basicPlan, 'basic')}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#010139] to-[#020270] hover:shadow-lg text-white rounded-xl transition-all font-bold group flex items-center justify-center gap-2"
              >
                <span>Emitir Ahora</span>
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Plan Premium */}
            <div className="p-6 bg-gradient-to-br from-green-50 to-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#010139] text-lg">Plan Premium</span>
                  <FaStar className="text-[#8AAA19]" />
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-[#8AAA19]">
                    B/.{insurer.premiumPlan.annualPremium.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-600">/año</div>
                </div>
              </div>

              {insurer.premiumPlan.installments.available && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-4 text-xs text-gray-700">
                  💳 {insurer.premiumPlan.installments.description}
                </div>
              )}

              {insurer.premiumPlan.notes && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-4 text-xs text-gray-700">
                  {insurer.premiumPlan.notes}
                </div>
              )}

              {/* Todas las coberturas */}
              <div className="space-y-2 mb-4">
                {Object.entries(insurer.premiumPlan.coverages).map(([key, value]) => (
                  <div key={key} className="flex items-start justify-between gap-2 text-sm">
                    <span className="text-gray-700 font-medium">{COVERAGE_LABELS[key as keyof typeof COVERAGE_LABELS]}</span>
                    <div className="text-right flex-shrink-0">
                      {renderCoverageValue(value)}
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handlePlanClick(insurer, insurer.premiumPlan, 'premium')}
                className="w-full px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:shadow-2xl text-white rounded-xl transition-all font-bold group flex items-center justify-center gap-2"
              >
                <span>Emitir Ahora</span>
                <FaArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Installments Modal */}
      {showInstallmentsModal && selectedPlan && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start gap-3 mb-6">
                <FaInfoCircle className="text-blue-500 flex-shrink-0 mt-1" size={24} />
                <div>
                  <h3 className="text-xl font-bold text-[#010139] mb-2">
                    Opciones de Pago
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {selectedPlan.insurer.name} - {selectedPlan.plan.name}
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                {/* Annual Payment */}
                <div className="border-2 border-gray-200 rounded-lg p-4 hover:border-[#8AAA19] transition-all cursor-pointer"
                  onClick={() => handleConfirmInstallments(false)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-[#010139]">Pago Anual</span>
                    <span className="text-2xl font-bold text-[#8AAA19]">
                      B/.{selectedPlan.plan.annualPremium.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Pago único al año</p>
                </div>

                {/* Installments Payment */}
                {selectedPlan.plan.installments.amount && selectedPlan.plan.installments.payments && (
                  <div className="border-2 border-[#8AAA19] bg-green-50 rounded-lg p-4 hover:border-[#6d8814] transition-all cursor-pointer"
                    onClick={() => handleConfirmInstallments(true)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-[#010139]">Pago en Cuotas</span>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-[#010139]">
                          B/.{selectedPlan.plan.installments.amount.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-600">
                          × {selectedPlan.plan.installments.payments} pagos
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{selectedPlan.plan.installments.description}</p>
                    <p className="text-xs text-[#8AAA19] font-semibold">
                      Total: B/.{(selectedPlan.plan.installments.amount * selectedPlan.plan.installments.payments).toFixed(2)}
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
