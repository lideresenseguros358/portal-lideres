/**
 * Página de Emisión - Daños a Terceros
 * Replica el UX de cobertura completa con URL-based steps.
 * Steps: payment → emission-data → vehicle → payment-info → review
 * Sin inspección, sin paso separado de documentos (se piden en emission-data),
 * declaración de veracidad integrada en review.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaCheckCircle, FaMoneyBillWave, FaUser, FaCar, FaCreditCard, FaClipboardCheck } from 'react-icons/fa';

import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import EmissionDataForm, { type EmissionData } from '@/components/cotizadores/EmissionDataForm';
import VehicleDataForm, { type VehicleData } from '@/components/cotizadores/VehicleDataForm';
import CreditCardInput from '@/components/is/CreditCardInput';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type EmissionStep, type BreadcrumbStepDef } from '@/components/cotizadores/EmissionBreadcrumb';

// 5 steps for DT (no inspection)
const DT_STEPS: BreadcrumbStepDef[] = [
  { key: 'payment', label: 'Cuotas', shortLabel: 'Cuotas', icon: FaMoneyBillWave },
  { key: 'emission-data', label: 'Cliente', shortLabel: 'Cliente', icon: FaUser },
  { key: 'vehicle', label: 'Vehículo', shortLabel: 'Vehículo', icon: FaCar },
  { key: 'payment-info', label: 'Pago', shortLabel: 'Pago', icon: FaCreditCard },
  { key: 'review', label: 'Resumen', shortLabel: 'Resumen', icon: FaClipboardCheck },
];

const DT_TOTAL_STEPS = DT_STEPS.length;
const DT_BASE_PATH = '/cotizadores/emitir-danos-terceros';

export default function EmitirDanosTercerosPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const step = (searchParams.get('step') || 'payment') as EmissionStep;

  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [installments, setInstallments] = useState(1);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [emissionData, setEmissionData] = useState<EmissionData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [paymentToken, setPaymentToken] = useState('');
  const [cardData, setCardData] = useState<{ last4: string; brand: string } | null>(null);
  const [completedSteps, setCompletedSteps] = useState<EmissionStep[]>([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Load initial data
  useEffect(() => {
    try {
      setLoading(true);
      const storedQuote = sessionStorage.getItem('selectedQuote');
      if (!storedQuote) {
        router.push('/cotizadores/third-party');
        return;
      }
      const data = JSON.parse(storedQuote);
      setSelectedPlan(data);
      setQuoteData(data.quoteData || {
        cobertura: 'TERCEROS',
        policyType: 'AUTO',
        marca: '',
        modelo: '',
        ano: new Date().getFullYear(),
        uso: '10',
      });
    } catch (err) {
      console.error('Error cargando datos:', err);
      router.push('/cotizadores/third-party');
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Step number for progress bar
  const getStepNumber = (s: EmissionStep): number => {
    const idx = DT_STEPS.findIndex(st => st.key === s);
    return idx >= 0 ? idx + 1 : 1;
  };

  // Navigation helpers
  const goToStep = (s: EmissionStep) => {
    router.push(`${DT_BASE_PATH}?step=${s}`);
  };

  // Step handlers
  const handlePaymentPlanSelected = (numInstallments: number, monthlyPaymentAmount: number) => {
    setInstallments(numInstallments);
    setMonthlyPayment(monthlyPaymentAmount);
    setCompletedSteps(prev => [...prev.filter(s => s !== 'payment'), 'payment']);
    goToStep('emission-data');
  };

  const handleEmissionDataComplete = (data: EmissionData) => {
    setEmissionData(data);
    setCompletedSteps(prev => [...prev.filter(s => s !== 'emission-data'), 'emission-data']);
    goToStep('vehicle');
    toast.success('Datos guardados correctamente');
  };

  const handleVehicleDataComplete = (data: VehicleData) => {
    setVehicleData(data);
    setCompletedSteps(prev => [...prev.filter(s => s !== 'vehicle'), 'vehicle']);
    goToStep('payment-info');
    toast.success('Datos del vehículo guardados');
  };

  const handlePaymentTokenReceived = (token: string, last4: string, brand: string) => {
    setPaymentToken(token);
    setCardData({ last4, brand });
    setCompletedSteps(prev => [...prev.filter(s => s !== 'payment-info'), 'payment-info']);
    goToStep('review');
    toast.success('Información de pago guardada');
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  // Helper: Convertir fecha YYYY-MM-DD a dd/mm/yyyy (formato FEDPA)
  const convertToFedpaDate = (dateStr: string): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Emission handler
  const handleConfirmEmission = async () => {
    if (isConfirming) return;
    setIsConfirming(true);

    try {
      const isFedpaReal = selectedPlan?._isReal && selectedPlan?._isFEDPA;

      if (isFedpaReal) {
        if (!emissionData) throw new Error('Faltan datos del asegurado');

        // 1. Upload documents
        toast.info('Subiendo documentos...');
        const docsFormData = new FormData();
        docsFormData.append('environment', 'DEV');
        if (emissionData.cedulaFile) {
          docsFormData.append('documento_identidad', emissionData.cedulaFile, emissionData.cedulaFile.name || 'documento_identidad.pdf');
        }
        if (emissionData.licenciaFile) {
          docsFormData.append('licencia_conducir', emissionData.licenciaFile, emissionData.licenciaFile.name || 'licencia_conducir.pdf');
        }

        const docsResponse = await fetch('/api/fedpa/documentos/upload', {
          method: 'POST',
          body: docsFormData,
        });

        let idDoc = 'TEMP_DOC';
        if (docsResponse.ok) {
          const docsResult = await docsResponse.json();
          idDoc = docsResult.idDoc || 'TEMP_DOC';
        }

        // 2. Get idCotizacion from sessionStorage
        const tpQuoteRaw = sessionStorage.getItem('thirdPartyQuote');
        const tpQuote = tpQuoteRaw ? JSON.parse(tpQuoteRaw) : null;

        // 3. Emit policy
        toast.info('Emitiendo póliza...');
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: 'DEV',
            IdCotizacion: tpQuote?.idCotizacion || '',
            Plan: selectedPlan._planCode || 426,
            idDoc,
            PrimerNombre: emissionData.primerNombre,
            PrimerApellido: emissionData.primerApellido,
            SegundoNombre: emissionData.segundoNombre || '',
            SegundoApellido: emissionData.segundoApellido || '',
            Identificacion: emissionData.cedula,
            FechaNacimiento: convertToFedpaDate(emissionData.fechaNacimiento),
            Sexo: emissionData.sexo,
            Email: emissionData.email,
            Telefono: parseInt((emissionData.telefono || '0').replace(/\D/g, '')) || 0,
            Celular: parseInt((emissionData.celular || '0').replace(/\D/g, '')) || 0,
            Direccion: emissionData.direccion || 'Panama',
            esPEP: emissionData.esPEP ? 1 : 0,
            sumaAsegurada: 0,
            Uso: '10',
            Marca: selectedPlan._marcaCodigo || quoteData?.marca || '',
            Modelo: selectedPlan._modeloCodigo || quoteData?.modelo || '',
            Ano: (quoteData?.anno || quoteData?.anio || quoteData?.ano || new Date().getFullYear()).toString(),
            Motor: vehicleData?.motor || '',
            Placa: vehicleData?.placa || '',
            Vin: vehicleData?.vinChasis || '',
            Color: vehicleData?.color || '',
            Pasajero: vehicleData?.pasajeros || 5,
            Puerta: vehicleData?.puertas || 4,
            PrimaTotal: selectedPlan.annualPremium,
          }),
        });

        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          throw new Error(errorData.error || 'Error al emitir póliza');
        }

        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          throw new Error(emisionResult.error || 'Error al emitir póliza');
        }

        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza || emisionResult.poliza,
          insurer: 'FEDPA Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          method: 'emisor_plan',
          tipoCobertura: 'Daños a Terceros',
        }));

        sessionStorage.removeItem('thirdPartyQuote');
        sessionStorage.removeItem('selectedQuote');

        toast.success(`¡Póliza emitida! Nº ${emisionResult.nroPoliza || emisionResult.poliza}`);
        router.push('/cotizadores/confirmacion');
      } else {
        // Simulated flow for other insurers
        await new Promise(resolve => setTimeout(resolve, 2000));
        toast.success('Póliza emitida exitosamente');
        router.push('/cotizadores/confirmacion');
      }
    } catch (error: any) {
      console.error('Error emitiendo:', error);
      toast.error(error.message || 'Error al emitir la póliza');
      setIsConfirming(false);
    }
  };

  if (loading) return <LoadingSkeleton />;

  if (!selectedPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-4">No hay datos disponibles</h2>
          <button
            onClick={() => router.push('/cotizadores/third-party')}
            className="px-6 py-3 bg-[#010139] hover:bg-[#8AAA19] text-white rounded-lg font-semibold transition-colors cursor-pointer"
          >
            Volver a Comparativa
          </button>
        </div>
      </div>
    );
  }

  // ─── STEP 1: PLAN DE PAGO ───
  if (step === 'payment') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('payment')} totalSteps={DT_TOTAL_STEPS} />
        </div>
        <EmissionBreadcrumb
          currentStep="payment"
          completedSteps={completedSteps}
          steps={DT_STEPS}
          basePath={DT_BASE_PATH}
        />
        <div className="py-8 px-4">
          <div className="max-w-2xl mx-auto mb-6">
            <button
              onClick={() => router.push('/cotizadores/third-party')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 
                bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 
                hover:border-gray-400 transition-colors"
              type="button"
            >
              ← Volver a Comparativa
            </button>
          </div>
          <PaymentPlanSelector
            annualPremium={selectedPlan.annualPremium}
            priceBreakdown={selectedPlan._priceBreakdown}
            onContinue={handlePaymentPlanSelected}
          />
        </div>
      </div>
    );
  }

  // ─── STEP 2: DATOS DEL CLIENTE (incluye cédula y licencia) ───
  if (step === 'emission-data') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('emission-data')} totalSteps={DT_TOTAL_STEPS} />
        </div>
        <EmissionBreadcrumb
          currentStep="emission-data"
          completedSteps={completedSteps}
          steps={DT_STEPS}
          basePath={DT_BASE_PATH}
        />
        <div className="py-8 px-4">
          <EmissionDataForm
            quoteData={quoteData}
            onContinue={handleEmissionDataComplete}
          />
        </div>
      </div>
    );
  }

  // ─── STEP 3: DATOS DEL VEHÍCULO ───
  if (step === 'vehicle') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('vehicle')} totalSteps={DT_TOTAL_STEPS} />
        </div>
        <EmissionBreadcrumb
          currentStep="vehicle"
          completedSteps={completedSteps}
          steps={DT_STEPS}
          basePath={DT_BASE_PATH}
        />
        <div className="py-8 px-4">
          <VehicleDataForm
            quoteData={quoteData}
            onContinue={handleVehicleDataComplete}
          />
        </div>
      </div>
    );
  }

  // ─── STEP 4: INFORMACIÓN DE PAGO ───
  if (step === 'payment-info') {
    const amount = installments === 1 ? selectedPlan.annualPremium : monthlyPayment;

    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('payment-info')} totalSteps={DT_TOTAL_STEPS} />
        </div>
        <EmissionBreadcrumb
          currentStep="payment-info"
          completedSteps={completedSteps}
          steps={DT_STEPS}
          basePath={DT_BASE_PATH}
        />
        <div className="py-8 px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
                Información de Pago
              </h2>
              <p className="text-gray-600">
                Completa los datos de tu tarjeta para procesar el pago
              </p>
            </div>

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

            <CreditCardInput
              onTokenReceived={handlePaymentTokenReceived}
              onError={handlePaymentError}
              environment="development"
            />

            {cardData && (
              <div className="flex items-center gap-2 p-4 mt-4 bg-green-50 border-2 border-green-300 rounded-xl">
                <FaCheckCircle className="text-[#8AAA19] flex-shrink-0" />
                <p className="text-sm font-semibold text-green-800">
                  Tarjeta {cardData.brand} ****{cardData.last4} registrada correctamente
                </p>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => goToStep('review')}
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

  // ─── STEP 5: RESUMEN Y CONFIRMACIÓN (con declaración de veracidad) ───
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="pt-6">
          <EmissionProgressBar currentStep={getStepNumber('review')} totalSteps={DT_TOTAL_STEPS} />
        </div>
        <EmissionBreadcrumb
          currentStep="review"
          completedSteps={completedSteps}
          steps={DT_STEPS}
          basePath={DT_BASE_PATH}
        />
        <div className="py-8 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-2">
                Resumen y Confirmación
              </h2>
              <p className="text-gray-600">Revisa todos los datos antes de emitir tu póliza</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 space-y-4">
              {/* Plan Info */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Póliza</h6>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Aseguradora</p>
                    <p className="font-bold">{selectedPlan.insurerName}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cobertura</p>
                    <p className="font-bold text-blue-600">Daños a Terceros</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Prima Anual</p>
                    <p className="font-bold text-lg text-[#8AAA19]">B/.{selectedPlan.annualPremium?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Forma de Pago</p>
                    <p className="font-bold">
                      {installments === 1 ? 'Contado' : `${installments} cuotas de B/.${monthlyPayment.toFixed(2)}`}
                      {cardData && ` • ${cardData.brand} ****${cardData.last4}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Client Data */}
              {emissionData && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Datos del Asegurado</h6>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Nombre</p>
                      <p className="font-bold">{emissionData.primerNombre} {emissionData.segundoNombre} {emissionData.primerApellido} {emissionData.segundoApellido}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Cédula</p>
                      <p className="font-bold">{emissionData.cedula}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-bold">{emissionData.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Teléfono</p>
                      <p className="font-bold">{emissionData.celular || emissionData.telefono}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Vehicle Data */}
              {vehicleData && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Datos del Vehículo</h6>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Vehículo</p>
                      <p className="font-bold">{quoteData?.marca} {quoteData?.modelo} {quoteData?.anno || quoteData?.anio || quoteData?.ano}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Placa</p>
                      <p className="font-bold">{vehicleData.placa}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">VIN/Chasis</p>
                      <p className="font-bold">{vehicleData.vinChasis}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Color</p>
                      <p className="font-bold">{vehicleData.color}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Declaration of Veracity */}
            <div className="mt-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
              <h5 className="font-bold text-[#010139] mb-3 flex items-center gap-2">
                <FaClipboardCheck className="text-yellow-600" />
                Declaración de Veracidad
              </h5>
              <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                Declaro que toda la información proporcionada en esta solicitud es verídica y completa. 
                Entiendo que cualquier omisión o falsedad en los datos suministrados puede resultar en la 
                anulación de la póliza y/o la denegación de cualquier reclamo. Autorizo a la aseguradora 
                a verificar la información proporcionada.
              </p>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-[#8AAA19] 
                    focus:ring-[#8AAA19] cursor-pointer accent-[#8AAA19]"
                />
                <span className="text-sm font-semibold text-gray-800 group-hover:text-[#010139]">
                  Acepto la declaración de veracidad y autorizo el procesamiento de mis datos
                </span>
              </label>
            </div>

            {/* Emit Button */}
            <div className="mt-8">
              <button
                onClick={handleConfirmEmission}
                disabled={isConfirming || !declarationAccepted}
                className={`w-full py-5 px-6 rounded-xl font-bold text-xl
                  flex items-center justify-center gap-3 transition-all duration-200
                  ${isConfirming || !declarationAccepted
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'}`}
                type="button"
              >
                {isConfirming ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    Emitiendo póliza...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="text-2xl" />
                    Confirmar y Emitir Póliza
                  </>
                )}
              </button>
              {!declarationAccepted && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Debes aceptar la declaración de veracidad para continuar
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <LoadingSkeleton />;
}
