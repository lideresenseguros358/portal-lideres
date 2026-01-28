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

  const handleSelectPlan = (insurerId: string, planType: 'basic' | 'premium', plan: AutoThirdPartyPlan) => {
    setLoading(true);
    // Redirigir al formulario de emisión con los datos del plan seleccionado
    router.push(`/cotizadores/third-party/issue?insurer=${insurerId}&plan=${planType}`);
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
    </div>
  );
}
