/**
 * Página de Emisión - Resumen y datos faltantes
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import EmissionDataForm, { type EmissionData } from '@/components/cotizadores/EmissionDataForm';
import VehicleDataForm, { type VehicleData } from '@/components/cotizadores/VehicleDataForm';
import VehicleInspection from '@/components/cotizadores/VehicleInspection';
import CreditCardInput from '@/components/is/CreditCardInput';
import FinalQuoteSummary from '@/components/cotizadores/FinalQuoteSummary';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type EmissionStep } from '@/components/cotizadores/EmissionBreadcrumb';

export default function EmitirPage() {
  // A7: Scroll to top al montar
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get('step') || 'payment'; // payment, emission-data, inspection, payment-info, review
  
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [installments, setInstallments] = useState(1);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [emissionData, setEmissionData] = useState<EmissionData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [inspectionPhotos, setInspectionPhotos] = useState<any[]>([]);
  const [paymentToken, setPaymentToken] = useState<string>('');
  const [cardData, setCardData] = useState<{ last4: string; brand: string } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<EmissionStep[]>([]);

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
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'payment']);
    
    // Ir a datos de emisión
    router.push('/cotizadores/emitir?step=emission-data');
  };

  const handleEmissionDataComplete = (data: EmissionData) => {
    setEmissionData(data);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'emission-data']);
    
    // Ir a datos del vehículo
    router.push('/cotizadores/emitir?step=vehicle');
    toast.success('Datos guardados correctamente');
  };

  const handleVehicleDataComplete = (data: VehicleData) => {
    setVehicleData(data);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'vehicle']);
    
    // Ir a inspección vehicular
    router.push('/cotizadores/emitir?step=inspection');
    toast.success('Datos del vehículo guardados');
  };

  const handleInspectionComplete = (photos: any[]) => {
    setInspectionPhotos(photos);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'inspection']);
    
    // Ir a información de pago
    router.push('/cotizadores/emitir?step=payment-info');
    toast.success('Inspección completada');
  };

  const handlePaymentTokenReceived = (token: string, last4: string, brand: string) => {
    setPaymentToken(token);
    setCardData({ last4, brand });
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'payment-info']);
    
    // Ir al resumen final
    router.push('/cotizadores/emitir?step=review');
    toast.success('Información de pago guardada');
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  // Helper: Convertir fecha YYYY-MM-DD a dd/mm/yyyy (formato FEDPA)
  const convertToFedpaDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const handleConfirmEmission = async () => {
    try {
      setIsConfirming(true);
      
      // Detectar aseguradora
      const isFedpaReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('FEDPA');
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');
      
      // EMISIÓN FEDPA
      if (isFedpaReal) {
        console.log('[EMISIÓN FEDPA] Iniciando emisión con API real...');
        
        if (!emissionData || !inspectionPhotos.length) {
          throw new Error('Faltan datos de emisión o fotos de inspección');
        }

        // Datos comunes de emisión
        const emisionCommon = {
          IdCotizacion: selectedPlan._idCotizacion || '',
          Plan: selectedPlan._planCode || 1,
          PrimerNombre: emissionData.primerNombre,
          PrimerApellido: emissionData.primerApellido,
          SegundoNombre: emissionData.segundoNombre || '',
          SegundoApellido: emissionData.segundoApellido || '',
          Identificacion: emissionData.cedula,
          FechaNacimiento: convertToFedpaDate(emissionData.fechaNacimiento),
          Sexo: emissionData.sexo,
          Email: emissionData.email,
          Telefono: parseInt(emissionData.telefono.replace(/\D/g, '') || '0'),
          Celular: parseInt(emissionData.celular.replace(/\D/g, '') || '0'),
          Direccion: emissionData.direccion,
          esPEP: emissionData.esPEP ? 1 : 0,
          Acreedor: emissionData.acreedor || '',
          sumaAsegurada: quoteData.valorVehiculo || 0,
          Uso: quoteData.uso || '10',
          Marca: selectedPlan._marcaCodigo || quoteData.marca,
          Modelo: selectedPlan._modeloCodigo || quoteData.modelo,
          Ano: quoteData.anno?.toString() || quoteData.anio?.toString() || new Date().getFullYear().toString(),
          Motor: vehicleData!.motor,
          Placa: vehicleData!.placa,
          Vin: vehicleData!.vinChasis,
          Color: vehicleData!.color,
          Pasajero: vehicleData!.pasajeros,
          Puerta: vehicleData!.puertas,
          PrimaTotal: selectedPlan.annualPremium,
        };

        // EmisorPlan (2024) — upload docs + emit con token Bearer
        toast.info('Subiendo documentos...');
        
        const docsFormData = new FormData();
        docsFormData.append('environment', 'DEV');
        docsFormData.append('documento_identidad', emissionData.cedulaFile!, emissionData.cedulaFile!.name || 'documento_identidad.pdf');
        docsFormData.append('licencia_conducir', emissionData.licenciaFile!, emissionData.licenciaFile!.name || 'licencia_conducir.pdf');
        if (vehicleData?.registroVehicular) {
          docsFormData.append('registro_vehicular', vehicleData.registroVehicular, vehicleData.registroVehicular.name || 'registro_vehicular.pdf');
        }
        
        const docsResponse = await fetch('/api/fedpa/documentos/upload', {
          method: 'POST',
          body: docsFormData,
        });
        
        if (!docsResponse.ok) {
          const errorData = await docsResponse.json();
          throw new Error(errorData.error || 'Error subiendo documentos');
        }
        
        const docsResult = await docsResponse.json();
        console.log('[EMISIÓN FEDPA] Documentos subidos:', docsResult.idDoc);
        
        toast.info('Emitiendo póliza...');
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: 'DEV',
            ...emisionCommon,
            idDoc: docsResult.idDoc,
          }),
        });
        
        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          throw new Error(errorData.error || 'Error emitiendo póliza');
        }
        
        const emisionResult = await emisionResponse.json();
        console.log('[EMISIÓN FEDPA] Póliza emitida:', emisionResult.nroPoliza || emisionResult.poliza);
        
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza || emisionResult.poliza,
          insurer: 'FEDPA Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          method: 'emisor_plan',
        }));
        
        toast.success(`¡Póliza FEDPA emitida! Nº ${emisionResult.nroPoliza || emisionResult.poliza}`);
        router.push('/cotizadores/confirmacion');
        
      } else if (isInternacionalReal) {
        console.log('[EMISIÓN INTERNACIONAL] Iniciando emisión con API real...');
        
        if (!emissionData || !inspectionPhotos.length) {
          throw new Error('Faltan datos de emisión o fotos de inspección');
        }
        
        // Preparar nombre completo
        const nombreCompleto = `${emissionData.primerNombre} ${emissionData.segundoNombre || ''} ${emissionData.primerApellido} ${emissionData.segundoApellido || ''}`.trim();
        
        // Emitir con API real de INTERNACIONAL
        toast.info('Emitiendo póliza...');
        const emisionResponse = await fetch('/api/is/auto/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vIdPv: selectedPlan._idCotizacion,
            // Datos del cliente
            vcodtipodoc: 1, // 1=Cédula, 2=RUC, 3=Pasaporte
            vnrodoc: emissionData.cedula,
            vnombre: emissionData.primerNombre,
            vapellido: `${emissionData.primerApellido} ${emissionData.segundoApellido || ''}`.trim(),
            vtelefono: emissionData.telefono,
            vcorreo: emissionData.email,
            vfecnacimiento: convertToFedpaDate(emissionData.fechaNacimiento),
            vsexo: emissionData.sexo,
            vdireccion: emissionData.direccion,
            // Datos del vehículo
            vcodmarca: selectedPlan._vcodmarca,
            vcodmodelo: selectedPlan._vcodmodelo,
            vanioauto: quoteData.anio || new Date().getFullYear(),
            vsumaaseg: quoteData.valorVehiculo || 15000,
            vcodplancobertura: selectedPlan._vcodplancobertura,
            vcodgrupotarifa: selectedPlan._vcodgrupotarifa,
            vplaca: vehicleData?.placa || '',
            vmotor: vehicleData?.motor || '',
            vchasis: vehicleData?.vinChasis || '',
            vcolor: vehicleData?.color || '',
            vcantpasajeros: vehicleData?.pasajeros || 5,
            vcantpuertas: vehicleData?.puertas || 4,
            // Pago
            paymentToken,
            formaPago: installments === 1 ? 1 : 2,
            cantCuotas: installments,
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
            className="px-6 py-3 bg-[#010139] hover:bg-[#8AAA19] text-white rounded-lg font-semibold transition-colors cursor-pointer"
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

  // Mapeo de steps: determinar número de paso actual
  const getStepNumber = (currentStep: EmissionStep): number => {
    const stepMap: Record<EmissionStep, number> = {
      'payment': 1,
      'emission-data': 2,
      'vehicle': 3,
      'inspection': 4,
      'payment-info': 5,
      'review': 6,
    };
    return stepMap[currentStep] || 1;
  };

  // Step 1: Selección de plan de pago (solo para auto completa)
  if (currentStep === 'payment' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Progress Bar */}
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('payment')} totalSteps={6} />
        </div>
        
        {/* Breadcrumb */}
        <EmissionBreadcrumb 
          currentStep="payment" 
          completedSteps={completedSteps}
        />
        
        {/* Contenido */}
        <div className="py-8 px-4">
          <PaymentPlanSelector
            annualPremium={selectedPlan.annualPremium}
            priceBreakdown={selectedPlan._priceBreakdown}
            onContinue={handlePaymentPlanSelected}
          />
        </div>
      </div>
    );
  }

  // Step 2: Datos de emisión (solo para auto completa)
  if (currentStep === 'emission-data' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Progress Bar */}
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('emission-data')} totalSteps={6} />
        </div>
        
        {/* Breadcrumb */}
        <EmissionBreadcrumb 
          currentStep="emission-data" 
          completedSteps={completedSteps}
        />
        
        {/* Contenido */}
        <div className="py-8 px-4">
          <EmissionDataForm
            quoteData={quoteData}
            onContinue={handleEmissionDataComplete}
          />
        </div>
      </div>
    );
  }

  // Step 3: Datos del Vehículo (solo para auto completa)
  if (currentStep === 'vehicle' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Progress Bar */}
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('vehicle')} totalSteps={6} />
        </div>
        
        {/* Breadcrumb */}
        <EmissionBreadcrumb 
          currentStep="vehicle" 
          completedSteps={completedSteps}
        />
        
        {/* Contenido */}
        <div className="py-8 px-4">
          <VehicleDataForm
            quoteData={quoteData}
            onContinue={handleVehicleDataComplete}
          />
        </div>
      </div>
    );
  }

  // Step 4: Inspección vehicular (solo para auto completa)
  if (currentStep === 'inspection' && isAutoCompleta) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Progress Bar */}
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('inspection')} totalSteps={6} />
        </div>
        
        {/* Breadcrumb */}
        <EmissionBreadcrumb 
          currentStep="inspection" 
          completedSteps={completedSteps}
        />
        
        {/* Contenido */}
        <div className="py-8 px-4">
          <VehicleInspection
            onContinue={handleInspectionComplete}
          />
        </div>
      </div>
    );
  }

  // Step 5: Información de pago con tarjeta 3D (todos los tipos)
  if (currentStep === 'payment-info') {
    const amount = installments === 1 ? selectedPlan.annualPremium : monthlyPayment;
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Progress Bar */}
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('payment-info')} totalSteps={6} />
        </div>
        
        {/* Breadcrumb */}
        <EmissionBreadcrumb 
          currentStep="payment-info" 
          completedSteps={completedSteps}
        />
        
        {/* Contenido */}
        <div className="py-8 px-4">
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
            onTokenReceived={(token: string, last4: string, brand: string) => {
              setPaymentToken(token);
              setCardData({ last4, brand });
              setCompletedSteps(prev => [...prev, 'payment-info']);
              toast.success(`Tarjeta ${brand} ****${last4} registrada`);
            }}
            onError={handlePaymentError}
            environment="development"
          />

          {/* Confirmación de tarjeta */}
          {cardData && (
            <div className="flex items-center gap-2 p-4 mt-4 bg-green-50 border-2 border-green-300 rounded-xl">
              <svg className="w-5 h-5 text-[#8AAA19] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              <p className="text-sm font-semibold text-green-800">
                Tarjeta {cardData.brand} ****{cardData.last4} registrada correctamente
              </p>
            </div>
          )}

          {/* Botón Continuar al Resumen */}
          <div className="mt-6">
            <button
              onClick={() => router.push('/cotizadores/emitir?step=review')}
              disabled={!paymentToken}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 ${
                paymentToken
                  ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105 cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              type="button"
            >
              Continuar al Resumen
            </button>
            {!paymentToken && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Ingresa los datos de tu tarjeta para continuar
              </p>
            )}
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Step 6: Resumen final y confirmación (todos los tipos)
  if (currentStep === 'review') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        {/* Progress Bar */}
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('review')} totalSteps={6} />
        </div>
        
        {/* Breadcrumb */}
        <EmissionBreadcrumb 
          currentStep="review" 
          completedSteps={completedSteps}
        />
        
        {/* Contenido */}
        <div className="py-8 px-4">
          <FinalQuoteSummary
            quoteData={quoteData}
            selectedPlan={selectedPlan}
            installments={installments}
            monthlyPayment={monthlyPayment}
            emissionData={emissionData}
            vehicleData={vehicleData}
            inspectionPhotos={inspectionPhotos}
            onConfirm={handleConfirmEmission}
          />
        </div>
      </div>
    );
  }

  return <LoadingSkeleton />;
}
