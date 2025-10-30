/**
 * Página de Emisión - Resumen y datos faltantes
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import FinalQuoteSummary from '@/components/cotizadores/FinalQuoteSummary';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';

export default function EmitirPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get('step') || 'payment'; // payment, review
  
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [installments, setInstallments] = useState(1);
  const [monthlyPayment, setMonthlyPayment] = useState(0);

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
    
    // Ir al resumen final
    router.push('/cotizadores/emitir?step=review');
  };

  const handleConfirmEmission = async () => {
    try {
      // TODO: Llamar a API para crear póliza/caso
      console.log('Emitiendo póliza:', {
        selectedPlan,
        quoteData,
        installments,
        monthlyPayment
      });
      
      // Simular delay de API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('¡Póliza emitida exitosamente!');
      router.push('/cotizadores/confirmacion');
      
    } catch (error) {
      console.error('Error emitiendo póliza:', error);
      toast.error('Error al emitir póliza');
    }
  };

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

  // Step 1: Selección de plan de pago (solo para auto completa)
  if (step === 'payment' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <PaymentPlanSelector
          annualPremium={selectedPlan.annualPremium}
          onContinue={handlePaymentPlanSelected}
        />
      </div>
    );
  }

  // Step 2: Resumen final y confirmación
  if (step === 'review' || !isAutoCompleta) {

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
        <FinalQuoteSummary
          quoteData={quoteData}
          selectedPlan={selectedPlan}
          installments={installments}
          monthlyPayment={monthlyPayment}
          onConfirm={handleConfirmEmission}
        />
      </div>
    );
  }

  return <LoadingSkeleton />;
}
