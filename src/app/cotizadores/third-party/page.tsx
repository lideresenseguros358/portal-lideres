'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaShieldAlt, FaClock, FaCheckCircle, FaCar } from 'react-icons/fa';
import ThirdPartyComparison from '@/components/quotes/ThirdPartyComparison';
import { AutoThirdPartyPlan } from '@/lib/constants/auto-quotes';
import Breadcrumb from '@/components/ui/Breadcrumb';

export default function ThirdPartyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [minPriceDT, setMinPriceDT] = useState<number | null>(null);
  const [loadingPrice, setLoadingPrice] = useState(true);
  const [fedpaSelection, setFedpaSelection] = useState<{ planType: 'basic' | 'premium'; plan: AutoThirdPartyPlan } | null>(null);
  const [fedpaPaymentMode, setFedpaPaymentMode] = useState<'contado' | 'cuotas'>('contado');

  // Cargar precio mínimo dinámico de Daños a Terceros
  useEffect(() => {
    const fetchMinPrice = async () => {
      try {
        const response = await fetch('/api/quotes/third-party-min-price');
        const data = await response.json();
        if (data.success && data.minPrice) {
          setMinPriceDT(data.minPrice);
        }
      } catch (error) {
        console.error('Error cargando precio mínimo:', error);
      } finally {
        setLoadingPrice(false);
      }
    };

    fetchMinPrice();
  }, []);

  const proceedToEmission = (
    insurerId: string,
    planType: 'basic' | 'premium',
    plan: AutoThirdPartyPlan,
    paymentMode: 'contado' | 'cuotas' = 'contado'
  ) => {
    setLoading(true);
    
    // Leer datos de cotización generados por ThirdPartyComparison (IS, FEDPA, etc.)
    const tpQuoteRaw = sessionStorage.getItem('thirdPartyQuote');
    const tpQuote = tpQuoteRaw ? JSON.parse(tpQuoteRaw) : null;
    
    if (insurerId === 'fedpa') {
      const cuotasDisponibles = !!plan.installments?.available;
      const cuotas = cuotasDisponibles ? (plan.installments?.payments || 1) : 1;
      const montoCuota = cuotasDisponibles ? (plan.installments?.amount || 0) : 0;
      const totalCuotas = cuotasDisponibles
        ? (plan.installments?.totalWithInstallments || (montoCuota * cuotas))
        : plan.annualPremium;

      // FEDPA: usar flujo completo con secciones
      sessionStorage.setItem('selectedQuote', JSON.stringify({
        insurerName: 'FEDPA Seguros',
        planType: planType === 'basic' ? 'Plan Básico' : 'Plan Premium',
        annualPremium: plan.annualPremium,
        _isReal: true,
        _isFEDPA: true,
        _planCode: plan.planCode || 426,
        _includedCoverages: plan.includedCoverages,
        _endosoPdf: plan.endosoPdf,
        _paymentMode: paymentMode,
        _installmentsCount: cuotas,
        _installmentAmount: montoCuota,
        _totalWithInstallments: totalCuotas,
        installments: plan.installments,
        quoteData: {
          cobertura: 'TERCEROS',
          policyType: 'AUTO',
          marca: '',
          modelo: '',
          ano: new Date().getFullYear(),
          uso: '10',
        },
      }));
      router.push('/cotizadores/emitir-danos-terceros');
    } else if (insurerId === 'internacional' && tpQuote?.isRealAPI) {
      // INTERNACIONAL: usar flujo completo con secciones (mismo wizard que FEDPA)
      sessionStorage.setItem('selectedQuote', JSON.stringify({
        insurerName: 'INTERNACIONAL de Seguros',
        planType: planType === 'basic' ? 'Plan Básico' : 'Plan Premium',
        annualPremium: plan.annualPremium,
        _isReal: true,
        _idCotizacion: tpQuote.idCotizacion,
        _vcodmarca: tpQuote.vcodmarca || 156,
        _vcodmodelo: tpQuote.vcodmodelo || 2563,
        _vcodplancobertura: tpQuote.vcodplancobertura,
        _vcodgrupotarifa: tpQuote.vcodgrupotarifa || 20,
        _includedCoverages: plan.includedCoverages,
        quoteData: {
          cobertura: 'TERCEROS',
          policyType: 'AUTO',
          marca: '',
          modelo: '',
          ano: new Date().getFullYear(),
          uso: '10',
        },
      }));
      router.push('/cotizadores/emitir-danos-terceros');
    } else {
      // Otras aseguradoras: flujo existente (formulario simple)
      router.push(`/cotizadores/third-party/issue?insurer=${insurerId}&plan=${planType}`);
    }
  };

  const handleSelectPlan = (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => {
    if (insurerId === 'fedpa') {
      setFedpaSelection({ planType, plan });
      setFedpaPaymentMode('contado');
      return;
    }

    proceedToEmission(insurerId, planType, plan);
  };

  const handleConfirmFedpaPaymentMode = () => {
    if (!fedpaSelection) return;
    proceedToEmission('fedpa', fedpaSelection.planType, fedpaSelection.plan, fedpaPaymentMode);
    setFedpaSelection(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white py-8 px-4 shadow-xl">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <Breadcrumb 
            items={[
              { label: 'Auto', href: '/cotizadores/auto' },
              { label: 'Daños a Terceros', icon: <FaCar /> },
            ]}
          />

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mt-6">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-4">
                <FaShieldAlt className="text-[#8AAA19]" />
                <span className="text-sm font-semibold">Seguro Obligatorio</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                Daños a Terceros
              </h1>
              <p className="text-xl text-white/90 mb-6 max-w-2xl">
                Compara y elige tu plan. <strong className="text-[#8AAA19]">Emisión inmediata</strong> sin inspección del vehículo.
              </p>
            </div>

            <div className="flex-shrink-0">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-white/20">
                {loadingPrice ? (
                  <div className="text-3xl text-white/60 mb-2">Cargando...</div>
                ) : (
                  <div className="text-5xl md:text-6xl font-black text-[#8AAA19] mb-2">
                    B/.{minPriceDT || 130}
                  </div>
                )}
                <div className="text-sm text-white/80">Desde / año</div>
              </div>
            </div>
          </div>

          {/* Benefits Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <FaCheckCircle className="text-[#8AAA19] text-2xl mb-2" />
              <div className="font-bold mb-1">Cobertura Legal</div>
              <div className="text-sm text-white/80">Cumple requisitos de tránsito</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <FaClock className="text-[#8AAA19] text-2xl mb-2" />
              <div className="font-bold mb-1">Emisión Inmediata</div>
              <div className="text-sm text-white/80">Sin inspección previa</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
              <FaShieldAlt className="text-[#8AAA19] text-2xl mb-2" />
              <div className="font-bold mb-1">4 Aseguradoras</div>
              <div className="text-sm text-white/80">Compara y elige la mejor</div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Notice */}
      <div className="py-6 px-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-y-2 border-yellow-200">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start gap-4 bg-white rounded-xl shadow-md p-6 border-2 border-yellow-300">
            <div className="text-4xl flex-shrink-0">💳</div>
            <div>
              <h3 className="text-xl font-bold text-[#010139] mb-2">Forma de Pago</h3>
              <p className="text-gray-700">
                Todas las emisiones de <strong>Daños a Terceros</strong> se realizan únicamente mediante 
                <strong className="text-[#010139]"> pago con Tarjeta de Crédito (TCR)</strong>. 
                El proceso de emisión es inmediato una vez se procese el pago.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-[#010139] mb-3">
              Elige tu Plan
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Selecciona el plan que mejor se adapte a tus necesidades y procede a emitir tu póliza
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#010139] border-t-[#8AAA19] mb-4"></div>
              <p className="text-gray-600 font-semibold">Cargando información...</p>
            </div>
          ) : (
            <ThirdPartyComparison onSelectPlan={handleSelectPlan} />
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 py-12 px-4 mt-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="text-5xl flex-shrink-0">💡</div>
              <div>
                <h3 className="text-2xl font-bold text-[#010139] mb-4">¿Cómo elegir tu plan?</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <div className="font-bold text-[#010139] mb-2 text-lg">Plan Básico</div>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      Cumple con los <strong>requisitos legales mínimos</strong>. 
                      Perfecto si buscas <strong className="text-blue-600">economía</strong> y solo necesitas la cobertura obligatoria para circular.
                    </p>
                  </div>
                  <div className="border-l-4 border-[#8AAA19] pl-4">
                    <div className="font-bold text-[#010139] mb-2 text-lg">Plan Premium</div>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      <strong>Coberturas ampliadas</strong> con mayores límites. 
                      Incluye <strong className="text-[#8AAA19]">grúa y asistencia vial</strong>. 
                      Mayor tranquilidad en carretera.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {fedpaSelection && (
        <div className="fixed inset-0 z-50 bg-[#010139]/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-2xl bg-gradient-to-b from-white to-[#f7f9ff] rounded-3xl shadow-2xl border border-white/70 overflow-hidden">
            <div className="bg-gradient-to-r from-[#010139] to-[#020270] px-5 py-5 sm:px-7 sm:py-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9d95a] mb-2">FEDPA Seguros</p>
              <h3 className="text-2xl sm:text-3xl font-black leading-tight">¿Cómo desea pagar su póliza?</h3>
              <p className="text-sm text-white/85 mt-2 max-w-lg">
                Elija una opción para continuar. La mantendremos durante todo el proceso de emisión.
              </p>
            </div>

            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
              <button
                type="button"
                onClick={() => setFedpaPaymentMode('contado')}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  fedpaPaymentMode === 'contado'
                    ? 'border-[#8AAA19] bg-gradient-to-br from-[#f4f9e4] to-[#e9f3c8] shadow-lg scale-[1.01]'
                    : 'border-gray-300 bg-white hover:border-[#8AAA19]'
                }`}
              >
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">Al contado</p>
                <p className="text-3xl sm:text-4xl font-black text-[#010139] leading-none mt-2">B/.{fedpaSelection.plan.annualPremium.toFixed(2)}</p>
                <p className="text-xs text-gray-600 mt-2">Pago único</p>
              </button>

              <button
                type="button"
                onClick={() => setFedpaPaymentMode('cuotas')}
                disabled={!fedpaSelection.plan.installments?.available}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  fedpaPaymentMode === 'cuotas'
                    ? 'border-[#8AAA19] bg-gradient-to-br from-[#f4f9e4] to-[#e9f3c8] shadow-lg scale-[1.01]'
                    : 'border-gray-300 bg-white hover:border-[#8AAA19]'
                } ${!fedpaSelection.plan.installments?.available ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <p className="text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">En cuotas</p>
                <p className="text-2xl sm:text-3xl font-black text-[#010139] leading-none mt-2">
                  {fedpaSelection.plan.installments?.payments || 0} x B/.{(fedpaSelection.plan.installments?.amount || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  Total: B/.{(fedpaSelection.plan.installments?.totalWithInstallments || 0).toFixed(2)}
                </p>
              </button>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setFedpaSelection(null)}
                  className="px-5 py-3 rounded-xl border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmFedpaPaymentMode}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white font-bold hover:shadow-xl"
                >
                  Continuar a emisión
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
