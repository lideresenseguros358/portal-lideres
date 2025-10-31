/**
 * Página de Emisión - Resumen y datos faltantes
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import EmissionDataForm, { type EmissionData } from '@/components/cotizadores/EmissionDataForm';
import VehicleInspection from '@/components/cotizadores/VehicleInspection';
import CreditCardInput from '@/components/is/CreditCardInput';
import FinalQuoteSummary from '@/components/cotizadores/FinalQuoteSummary';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export default function EmitirPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get('step') || 'payment'; // payment, emission-data, inspection, payment-info, review
  
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [installments, setInstallments] = useState(1);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [emissionData, setEmissionData] = useState<EmissionData | null>(null);
  const [inspectionPhotos, setInspectionPhotos] = useState<any[]>([]);
  const [paymentToken, setPaymentToken] = useState<string>('');
  const [cardData, setCardData] = useState<{ last4: string; brand: string } | null>(null);

  useEffect(() => {
    const loadData = () => {
      try {
        setLoading(true);
        
        // Cargar plan seleccionado y datos de cotización
        const storedQuote = sessionStorage.getItem('selectedQuote');
        if (!storedQuote) {
          router.push('/cotizadores');
          return;
        }

        const data = JSON.parse(storedQuote);
        setSelectedPlan(data);
        setQuoteData(data.quoteData);
        
      } catch (err) {
        console.error('Error cargando datos:', err);
        router.push('/cotizadores');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  const handlePaymentPlanSelected = (numInstallments: number, monthlyPaymentAmount: number) => {
    setInstallments(numInstallments);
    setMonthlyPayment(monthlyPaymentAmount);
    
    // Ir a datos de emisión
    router.push('/cotizadores/emitir?step=emission-data');
  };

  const handleEmissionDataComplete = (data: EmissionData) => {
    setEmissionData(data);
    
    // Ir a inspección vehicular
    router.push('/cotizadores/emitir?step=inspection');
    toast.success('Datos guardados correctamente');
  };

  const handleInspectionComplete = (photos: any[]) => {
    setInspectionPhotos(photos);
    
    // Ir a información de pago
    router.push('/cotizadores/emitir?step=payment-info');
    toast.success('Inspección completada');
  };

  const handlePaymentTokenReceived = (token: string, last4: string, brand: string) => {
    setPaymentToken(token);
    setCardData({ last4, brand });
    
    // Ir al resumen final
    router.push('/cotizadores/emitir?step=review');
    toast.success('Información de pago guardada');
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  const handleConfirmEmission = async () => {
    try {
      setIsConfirming(true);
      
      // Detectar si es INTERNACIONAL con API real
      const isInternacionalReal = selectedPlan?._isReal === true;
      
      if (isInternacionalReal) {
        console.log('[EMISION INTERNACIONAL] Usando API real...');
        
        // Emitir con API real de INTERNACIONAL
        const emisionResponse = await fetch('/api/is/auto/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vIdPv: selectedPlan._idCotizacion,
            vcodtipodoc: 1, // 1=CC (Cédula), 2=RUC, 3=PAS - DEBE SER NÚMERO
            vnrodoc: emissionData?.cedula || quoteData.cedula || '8-999-9999',
            vnombre: quoteData.nombreCompleto?.split(' ')[0] || 'Cliente',
            vapellido: quoteData.nombreCompleto?.split(' ').slice(1).join(' ') || 'Potencial',
            vtelefono: quoteData.telefono || '6000-0000',
            vcorreo: quoteData.email || 'cliente@example.com',
            vcodmarca: selectedPlan._vcodmarca,
            vcodmodelo: selectedPlan._vcodmodelo,
            vanioauto: quoteData.anio || new Date().getFullYear(),
            vsumaaseg: quoteData.valorVehiculo || 15000,
            vcodplancobertura: selectedPlan._vcodplancobertura,
            vcodgrupotarifa: selectedPlan._vcodgrupotarifa,
            paymentToken,
            tipo_cobertura: 'Cobertura Completa',
            vmarca_label: quoteData.marca,
            vmodelo_label: quoteData.modelo,
            environment: 'development',
          }),
        });
        
        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          throw new Error(errorData.error || 'Error al emitir p\u00f3liza');
        }
        
        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          throw new Error(emisionResult.error || 'Error al emitir p\u00f3liza');
        }
        
        console.log('[EMISION INTERNACIONAL] P\u00f3liza emitida:', emisionResult.nroPoliza);
        
        // Guardar datos de la p\u00f3liza para la confirmaci\u00f3n
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza,
          pdfUrl: emisionResult.pdfUrl,
          insurer: 'INTERNACIONAL de Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
        }));
        
        toast.success(`\u00a1P\u00f3liza emitida! N\u00ba ${emisionResult.nroPoliza}`);
        router.push('/cotizadores/confirmacion');
        
      } else {
        // Otras aseguradoras - Flujo simulado
        console.log('[EMISION] Usando flujo simulado...');
        console.log('Emitiendo p\u00f3liza:', {
          selectedPlan,
          quoteData,
          installments,
          monthlyPayment,
          emissionData,
          paymentToken,
        });
        
        // Simular delay de API
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast.success('\u00a1P\u00f3liza emitida exitosamente!');
        router.push('/cotizadores/confirmacion');
      }
      
    } catch (error: any) {
      console.error('Error emitiendo p\u00f3liza:', error);
      toast.error(error.message || 'Error al emitir p\u00f3liza');
      setIsConfirming(false);
    }
  };
  
  const [isConfirming, setIsConfirming] = useState(false);

  if (loading) return <LoadingSkeleton />;
  
  if (!selectedPlan || !quoteData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-4">No hay datos disponibles</h2>
          <button
            onClick={() => router.push('/cotizadores')}
            className="px-6 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold"
          >
            Volver a Cotizar
          </button>
        </div>
      </div>
    );
  }

  const isAutoCompleta = quoteData.cobertura === 'COMPLETA';
  const policyType = quoteData.policyType || 'AUTO'; // VIDA, INCENDIO, CONTENIDO, AUTO

  // Determinar step inicial según tipo
  const initialStep = isAutoCompleta ? 'payment' : 'payment-info';
  const currentStep = step || initialStep;

  // Step 1: Selección de plan de pago (solo para auto completa)
  if (currentStep === 'payment' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <PaymentPlanSelector
          annualPremium={selectedPlan.annualPremium}
          onContinue={handlePaymentPlanSelected}
        />
      </div>
    );
  }

  // Step 2: Datos de emisión (solo para auto completa)
  if (currentStep === 'emission-data' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <EmissionDataForm
          quoteData={quoteData}
          onContinue={handleEmissionDataComplete}
        />
      </div>
    );
  }

  // Step 3: Inspección vehicular (solo para auto completa)
  if (currentStep === 'inspection' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <VehicleInspection
          onContinue={handleInspectionComplete}
        />
      </div>
    );
  }

  // Step 4: Información de pago con tarjeta 3D (todos los tipos)
  if (currentStep === 'payment-info') {
    const amount = installments === 1 ? selectedPlan.annualPremium : monthlyPayment;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
              Información de Pago
            </h2>
            <p className="text-gray-600">
              Completa los datos de tu tarjeta para procesar el pago
            </p>
          </div>

          {/* Monto a Pagar */}
          <div className="bg-gradient-to-r from-[#010139] to-[#020270] rounded-2xl p-6 mb-6 text-white shadow-2xl">
            <div className="text-center">
              <div className="text-sm opacity-80 mb-1">
                {installments === 1 ? 'Pago Único' : `${installments} Cuotas de:`}
              </div>
              <div className="text-4xl sm:text-5xl font-bold mb-2">
                ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              {installments > 1 && (
                <div className="text-xs opacity-70">
                  Total: ${(amount * installments).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta 3D */}
          <CreditCardInput
            onTokenReceived={handlePaymentTokenReceived}
            onError={handlePaymentError}
            environment="development"
          />
        </div>
      </div>
    );
  }

  // Step 5: Resumen final y confirmación (todos los tipos)
  if (currentStep === 'review') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <FinalQuoteSummary
          quoteData={quoteData}
          selectedPlan={selectedPlan}
          installments={installments}
          monthlyPayment={monthlyPayment}
          emissionData={emissionData}
          inspectionPhotos={inspectionPhotos}
          onConfirm={handleConfirmEmission}
        />
      </div>
    );
  }

  return <LoadingSkeleton />;
}
