/**
 * Página de Emisión - Resumen y datos faltantes
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaLock } from 'react-icons/fa';
import { useCotizadorEdit } from '@/context/CotizadorEditContext';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import EmissionDataForm, { type EmissionData } from '@/components/cotizadores/EmissionDataForm';
import VehicleDataForm, { type VehicleData } from '@/components/cotizadores/VehicleDataForm';
import VehicleInspection from '@/components/cotizadores/VehicleInspection';
import CreditCardInput, { type CardData } from '@/components/is/CreditCardInput';
import FinalQuoteSummary from '@/components/cotizadores/FinalQuoteSummary';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type EmissionStep } from '@/components/cotizadores/EmissionBreadcrumb';
import SignaturePad from '@/components/cotizadores/SignaturePad';
import Image from 'next/image';
import { trackQuoteEmitted, trackQuoteFailed, trackStepUpdate } from '@/lib/adm-cot/track-quote';
import { createPaymentOnEmission } from '@/lib/adm-cot/create-payment-on-emission';
import { buscarOcupacion } from '@/lib/fedpa/catalogos-complementarios';
import { mapLesionesACodigo, mapDanosPropiedadACodigo, mapGastosMedicosACodigo } from '@/lib/cotizadores/catalog-normalizer';
import { resolveAcreedorREGIONAL } from '@/lib/constants/acreedores';
import { formatISPolicyNumber } from '@/lib/utils/policy-number';
import EmissionLoadingModal from '@/components/cotizadores/EmissionLoadingModal';

export default function EmitirPage() {
  // A7: Scroll to top al montar
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const step = searchParams.get('step') || 'payment'; // payment, emission-data, inspection, payment-info, review

  // ═══ Master privileges ═══
  const { isMaster } = useCotizadorEdit();
  const [availableBrokers, setAvailableBrokers] = useState<{id: string, name: string}[]>([]);
  const [masterBrokerId, setMasterBrokerId] = useState<string>('');
  
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
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [pfCardData, setPfCardData] = useState<CardData | null>(null);
  const signatureRef = useRef<string>('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // ═══ Emission Loading Modal state ═══
  const [showEmissionModal, setShowEmissionModal] = useState(false);
  const [emissionProgress, setEmissionProgress] = useState(0);
  const [emissionStep, setEmissionStep] = useState('');
  const [emissionError, setEmissionError] = useState<string | null>(null);
  const [paymentCharged, setPaymentCharged] = useState(false);
  const [emissionBlocked, setEmissionBlocked] = useState(false);
  const [emissionBlockedMessage, setEmissionBlockedMessage] = useState('');

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

  // ═══ Load available brokers for master users ═══
  useEffect(() => {
    if (isMaster && !loading) {
      fetch('/api/brokers')
        .then(r => r.json())
        .then(d => {
          const active = (d.brokers || []).filter((b: any) => b.active !== false);
          setAvailableBrokers(active);
        })
        .catch(err => console.error('Error loading brokers:', err));
    }
  }, [isMaster, loading]);

  // ═══ ADM COT: Helper to get quote ref for step tracking ═══
  const getTrackingInfo = () => {
    const refId = selectedPlan?._idCotizacion;
    if (!refId) return null;
    const isFedpa = selectedPlan?.insurerName?.includes('FEDPA');
    const isRegional = selectedPlan?._isREGIONAL || selectedPlan?.insurerName?.includes('Regional');
    const isAncon = selectedPlan?._isANCON || selectedPlan?.insurerName?.includes('ANCÓN') || selectedPlan?.insurerName?.includes('Ancon');
    const prefix = isFedpa ? 'FEDPA' : isRegional ? 'REGIONAL' : isAncon ? 'ANCON' : 'IS';
    const insurer = isFedpa ? 'FEDPA' : isRegional ? 'REGIONAL' : isAncon ? 'ANCON' : 'INTERNACIONAL';
    const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
    return { quoteRef: `${prefix}-${refId}-${planSuffix}`, insurer };
  };

  // ═══ ADM COT: Detect abandonment — if user entered data and leaves page ═══
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (emissionData && !isConfirming) {
        const t = getTrackingInfo();
        if (t) {
          trackQuoteFailed({
            quoteRef: t.quoteRef,
            insurer: t.insurer,
            errorMessage: 'Proceso abandonado por el usuario',
            lastStep: step,
            clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim() || undefined,
            cedula: emissionData.cedula || undefined,
            email: emissionData.email || undefined,
            phone: emissionData.telefono || emissionData.celular || undefined,
          });
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emissionData, isConfirming, step]);

  const handlePaymentPlanSelected = (numInstallments: number, monthlyPaymentAmount: number) => {
    setInstallments(numInstallments);
    setMonthlyPayment(monthlyPaymentAmount);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'payment']);
    
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    if (t) trackStepUpdate({ ...t, step: 'payment' });
    
    // Ir a datos de emisión
    router.push('/cotizadores/emitir?step=emission-data');
  };

  const handleEmissionDataComplete = (data: EmissionData) => {
    setEmissionData(data);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'emission-data']);
    
    // ═══ ADM COT: Track step + save client data ═══
    const t = getTrackingInfo();
    if (t) trackStepUpdate({
      ...t,
      step: 'emission-data',
      clientName: `${data.primerNombre || ''} ${data.primerApellido || ''}`.trim() || undefined,
      cedula: data.cedula || undefined,
      email: data.email || undefined,
      phone: data.telefono || data.celular || undefined,
    });
    
    // Ir a datos del vehículo
    router.push('/cotizadores/emitir?step=vehicle');
    toast.success('Datos guardados correctamente');
  };

  const handleVehicleDataComplete = (data: VehicleData) => {
    setVehicleData(data);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'vehicle']);
    
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    if (t) trackStepUpdate({ ...t, step: 'vehicle' });
    
    // Only CC (Cobertura Completa) needs inspection step
    // IS DT (Daños a Terceros) skips inspection and goes to payment
    const isCC = quoteData?.cobertura === 'COMPLETA';
    if (isCC) {
      router.push('/cotizadores/emitir?step=inspection');
    } else {
      // Skip inspection for DT
      setCompletedSteps(prev => [...prev, 'inspection']);
      router.push('/cotizadores/emitir?step=payment-info');
    }
    toast.success('Datos del vehículo guardados');
  };

  const handleInspectionComplete = (photos: any[]) => {
    setInspectionPhotos(photos);
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'inspection']);
    
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    if (t) trackStepUpdate({ ...t, step: 'inspection' });
    
    // Ir a información de pago
    router.push('/cotizadores/emitir?step=payment-info');
    toast.success('Inspección completada');
  };

  const handlePaymentTokenReceived = (token: string, last4: string, brand: string) => {
    setPaymentToken(token);
    setCardData({ last4, brand });
    
    // Marcar paso completado
    setCompletedSteps(prev => [...prev, 'payment-info']);
    
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    if (t) trackStepUpdate({ ...t, step: 'payment-info' });
    
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
    if (isConfirming) return; // Prevent double-click
    try {
      setIsConfirming(true);
      setShowEmissionModal(true);
      setEmissionProgress(0);
      setEmissionStep('Preparando datos del cliente...');
      setEmissionError(null);
      setPaymentCharged(false);
      setEmissionBlocked(false);
      setEmissionBlockedMessage('');
      
      // Detectar aseguradora
      const isFedpaReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('FEDPA');
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');
      const isRegionalReal = selectedPlan?._isReal && (selectedPlan?._isREGIONAL || selectedPlan?.insurerName?.includes('Regional'));
      const isAnconReal = selectedPlan?._isReal && (selectedPlan?._isANCON || selectedPlan?.insurerName?.includes('ANCÓN') || selectedPlan?.insurerName?.includes('Ancon'));

      // PagueloFacil tracking vars (scoped to emission function)
      let pfCodOper: string | undefined;
      let pfRecCodOper: string | undefined;
      let pfCardType: string | undefined;
      let pfCardDisplay: string | undefined;

      // ═══ IDEMPOTENCY GUARD: Check for duplicate charges BEFORE processing ═══
      if (!isMaster && pfCardData && emissionData) {
        setEmissionProgress(1);
        setEmissionStep('Verificando estado de su solicitud...');

        try {
          const guardRes = await fetch('/api/paguelofacil/charge-guard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              numcot: selectedPlan?._numcot || selectedPlan?._idCotizacion,
              placa: vehicleData?.placa,
              cedula: emissionData.cedula,
              insurer: selectedPlan?.insurerName,
            }),
          });
          const guardData = await guardRes.json();

          if (!guardData.allowed) {
            console.log('[CHARGE-GUARD] ⛔ Emission blocked:', guardData.reason);
            setEmissionBlocked(true);
            setEmissionBlockedMessage(guardData.blockedMessage || 'Su caso está siendo revisado. Por favor espere a ser contactado.');
            setEmissionStep('Caso en revisión');
            return; // Stop — do NOT charge
          }
        } catch (guardErr) {
          console.warn('[CHARGE-GUARD] Guard check failed, proceeding anyway:', guardErr);
        }
      }

      // ═══ PAGUELOFACIL: Cobrar tarjeta ANTES de emitir ═══
      if (!isMaster && pfCardData && emissionData) {
        setEmissionProgress(2);
        setEmissionStep('Procesando pago con tarjeta...');

        const chargeAmount = installments > 1 ? monthlyPayment : (selectedPlan?.annualPremium || 0);

        const chargeRes = await fetch('/api/paguelofacil/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: chargeAmount,
            description: `Póliza CC - ${selectedPlan?.insurerName || 'Seguro'} - ${emissionData.primerNombre} ${emissionData.primerApellido}`,
            concept: `Prima ${installments > 1 ? 'cuota 1/' + installments : 'contado'} - Cobertura Completa`,
            cardNumber: pfCardData.cardNumber,
            expMonth: pfCardData.expMonth,
            expYear: pfCardData.expYear,
            cvv: pfCardData.cvv,
            cardholderName: pfCardData.cardName,
            cardType: pfCardData.brand,
            email: emissionData.email,
            phone: emissionData.celular || emissionData.telefono,
          }),
        });

        const chargeData = await chargeRes.json();

        if (!chargeData.success) {
          throw new Error(chargeData.error || 'Error procesando el pago. Verifique los datos de su tarjeta.');
        }

        // Store PF data for ADM COT payment tracking
        pfCodOper = chargeData.codOper;
        pfCardType = pfCardData.brand;
        pfCardDisplay = pfCardData.cardNumber ? `****${pfCardData.cardNumber.slice(-4)}` : undefined;

        console.log('[PAGUELOFACIL] ✅ Pago aprobado:', chargeData.codOper, '- $' + chargeData.totalPay);
        toast.success(`Pago aprobado: $${chargeData.totalPay} USD`);
        setPaymentCharged(true);

        // ═══ PAGUELOFACIL: Registrar recurrencia para cuotas futuras ═══
        if (installments > 1 && pfCodOper) {
          setEmissionStep('Registrando pagos recurrentes...');
          try {
            const recRes = await fetch('/api/paguelofacil/recurrent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                codOper: pfCodOper,
                amount: monthlyPayment,
                description: `Póliza - ${selectedPlan?.insurerName || 'Seguro'} - ${emissionData.primerNombre} ${emissionData.primerApellido}`,
                concept: `Cuota recurrente - ${selectedPlan?.planType === 'dt' ? 'Daños a Terceros' : 'Cobertura Completa'}`,
                email: emissionData.email,
                phone: emissionData.celular || emissionData.telefono,
                totalInstallments: installments,
                policyNumber: '',
              }),
            });
            const recData = await recRes.json();
            if (recData.success) {
              pfRecCodOper = recData.codOper;
              console.log('[PAGUELOFACIL] ✅ Recurrencia registrada:', recData.codOper);
            } else {
              console.error('[PAGUELOFACIL] ⚠️ Error registrando recurrencia:', recData.error);
            }
          } catch (recErr: any) {
            console.error('[PAGUELOFACIL] ⚠️ Recurrent registration error:', recErr.message);
          }
        }
      }

      // EMISIÓN FEDPA
      if (isFedpaReal) {
        console.log('[EMISIÓN FEDPA] Iniciando emisión con API real...');
        setEmissionProgress(5);
        setEmissionStep('Validando datos de emisión...');
        
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
          Ocupacion: buscarOcupacion(emissionData.actividadEconomica).codigo,
          Acreedor: emissionData.acreedor || '',
          sumaAsegurada: quoteData.valorVehiculo || 0,
          Uso: quoteData.uso || '10',
          Marca: vehicleData?.marcaCodigo || selectedPlan._marcaCodigo || quoteData.marcaCodigo || quoteData.marca || '',
          Modelo: vehicleData?.modeloCodigo || selectedPlan._modeloCodigo || quoteData.modeloCodigo || quoteData.modelo || '',
          MarcaNombre: vehicleData?.marca || selectedPlan._marcaNombre || quoteData.marca || '',
          ModeloNombre: vehicleData?.modelo || selectedPlan._modeloNombre || quoteData.modelo || '',
          Ano: (vehicleData?.anio || quoteData.anno || quoteData.anio || new Date().getFullYear()).toString(),
          Motor: vehicleData!.motor,
          Placa: vehicleData!.placa,
          Vin: vehicleData!.vinChasis,
          Color: vehicleData!.color,
          Pasajero: vehicleData!.pasajeros,
          Puerta: vehicleData!.puertas,
          PrimaTotal: selectedPlan.annualPremium, // Always contado price — FedPa calculates cuotas surcharge internally
          cantidadPago: 1, // Always emit as contado to FEDPA CC — PF recurrence handles client's installments
        };

        // ── Emisor Externo (2021): get_cotizacion → get_nropoliza → crear_poliza_auto_cc_externos ──
        let emisionResult: any = null;

        setEmissionProgress(15);
        setEmissionStep('Cotizando y preparando emisión con FEDPA...');

        // Build multipart: emisionData JSON + File1/File2/File3
        const extFormData = new FormData();
        if (isMaster && masterBrokerId) {
          extFormData.append('masterBrokerId', masterBrokerId);
        }
        extFormData.append('emisionData', JSON.stringify({
          ...emisionCommon,
          CodPlan: selectedPlan._planCode || 411,
          CodLimiteLesiones: quoteData.codLimiteLesiones || mapLesionesACodigo(
            quoteData.lesionCorporalPersona || 10000, quoteData.lesionCorporalAccidente || 20000
          ),
          CodLimitePropiedad: quoteData.codLimitePropiedad || mapDanosPropiedadACodigo(
            quoteData.danoPropiedad || 10000
          ),
          CodLimiteGastosMedico: quoteData.codLimiteGastosMedico || mapGastosMedicosACodigo(
            quoteData.gastosMedicosPersona || 2000, quoteData.gastosMedicosAccidente || 10000
          ),
          EndosoIncluido: 'S',
        }));

        // File1 = cédula/documento identidad
        if (emissionData.cedulaFile) {
          extFormData.append('File1', emissionData.cedulaFile, emissionData.cedulaFile.name || 'documento_identidad.pdf');
        }
        // File2 = licencia de conducir
        if (emissionData.licenciaFile) {
          extFormData.append('File2', emissionData.licenciaFile, emissionData.licenciaFile.name || 'licencia_conducir.pdf');
        }
        // File3 = registro vehicular
        if (vehicleData?.registroVehicular) {
          extFormData.append('File3', vehicleData.registroVehicular, vehicleData.registroVehicular.name || 'registro_vehicular.pdf');
        }

        setEmissionProgress(25);
        setEmissionStep('Emitiendo póliza con FEDPA (Emisor Externo)...');

        const emisionResponse = await fetch('/api/fedpa/emision-externo', {
          method: 'POST',
          body: extFormData,
        });
        const emisionResponseData = await emisionResponse.json();

        if (!emisionResponse.ok || !emisionResponseData.success) {
          throw new Error(emisionResponseData.error || 'Error emitiendo póliza');
        }

        emisionResult = emisionResponseData;

        console.log('[EMISIÓN CC FEDPA] Póliza emitida:', emisionResult.nroPoliza || emisionResult.poliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');
        
        // ═══ ADM COT: Track successful FEDPA emission ═══
        const fedpaRef = selectedPlan?._idCotizacion;
        if (fedpaRef) {
          const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
          trackQuoteEmitted({ quoteRef: `FEDPA-${fedpaRef}-${planSuffix}`, insurer: 'FEDPA', policyNumber: emisionResult.nroPoliza || emisionResult.poliza, clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(), cedula: emissionData.cedula, email: emissionData.email, phone: emissionData.telefono || emissionData.celular });
        }
        
        // ═══ ADM COT: Auto-create pending payment + recurrence (skip for master) ═══
        // FEDPA CC: always emitted as contado to insurer, but client pays via PF on their chosen schedule
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'FEDPA',
            policyNumber: emisionResult.nroPoliza || emisionResult.poliza || '',
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: selectedPlan?.annualPremium || 0,
            installments,
            ramo: 'AUTO',
            cobertura: 'COMPLETA',
            pfCodOper,
            pfRecCodOper,
          pfCardType,
          pfCardDisplay,
          insurerPaymentPlan: installments > 1 ? {
            insurerCuotas: 1,
            insurerFrequency: 'CONTADO',
            clientCuotas: installments,
            mismatch: true,
          } : undefined,
          });
        }

        // ═══ ENVIAR BIENVENIDA AL CLIENTE POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const welcomeForm = new FormData();
          welcomeForm.append('tipoCobertura', 'CC');
          welcomeForm.append('environment', 'development');
          welcomeForm.append('nroPoliza', emisionResult.nroPoliza || emisionResult.poliza || '');
          welcomeForm.append('insurerName', 'FEDPA Seguros');
          welcomeForm.append('firmaDataUrl', signatureRef.current || '');
          if (emisionResult.clientId) welcomeForm.append('clientId', emisionResult.clientId);
          if (emisionResult.policyId) welcomeForm.append('policyId', emisionResult.policyId);
          if (emisionResult.cotizacion) welcomeForm.append('codCotizacion', String(emisionResult.cotizacion));
          
          welcomeForm.append('clientData', JSON.stringify({
            primerNombre: emissionData.primerNombre,
            segundoNombre: emissionData.segundoNombre,
            primerApellido: emissionData.primerApellido,
            segundoApellido: emissionData.segundoApellido,
            cedula: emissionData.cedula,
            email: emissionData.email,
            telefono: emissionData.telefono,
            celular: emissionData.celular,
            direccion: emissionData.direccion,
            fechaNacimiento: emissionData.fechaNacimiento,
            sexo: emissionData.sexo,
            estadoCivil: emissionData.estadoCivil,
            nacionalidad: emissionData.nacionalidad,
            esPEP: emissionData.esPEP,
            pepEsUsted: emissionData.pepEsUsted,
            pepCargoUsted: emissionData.pepCargoUsted,
            pepEsFamiliar: emissionData.pepEsFamiliar,
            pepNombreFamiliar: emissionData.pepNombreFamiliar,
            pepCargoFamiliar: emissionData.pepCargoFamiliar,
            pepRelacionFamiliar: emissionData.pepRelacionFamiliar,
            pepEsColaborador: emissionData.pepEsColaborador,
            pepNombreColaborador: emissionData.pepNombreColaborador,
            pepCargoColaborador: emissionData.pepCargoColaborador,
            pepRelacionColaborador: emissionData.pepRelacionColaborador,
            actividadEconomica: emissionData.actividadEconomica,
            dondeTrabaja: emissionData.dondeTrabaja,
            nivelIngresos: emissionData.nivelIngresos,
          }));
          
          welcomeForm.append('vehicleData', JSON.stringify({
            placa: vehicleData?.placa,
            vinChasis: vehicleData?.vinChasis,
            motor: vehicleData?.motor,
            color: vehicleData?.color,
            pasajeros: vehicleData?.pasajeros,
            puertas: vehicleData?.puertas,
            tipoTransmision: vehicleData?.tipoTransmision,
            marca: vehicleData?.marca || quoteData?.marca || '',
            modelo: vehicleData?.modelo || quoteData?.modelo || '',
            anio: vehicleData?.anio || quoteData?.anio || quoteData?.anno || '',
          }));
          
          // FEDPA CC: always emitted as contado to insurer. If client chose cuotas, there's a mismatch.
          const isFedpaCCMismatch = installments > 1;
          welcomeForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca || vehicleData?.marca || '',
            modelo: quoteData?.modelo || vehicleData?.modelo || '',
            anio: quoteData?.anio || quoteData?.anno || vehicleData?.anio || '',
            valorVehiculo: quoteData.valorVehiculo || 0,
            cobertura: 'Cobertura Completa',
            primaTotal: installments > 1 ? (monthlyPayment * installments) : (selectedPlan?.annualPremium || 0),
            primaContado: selectedPlan?.annualPremium || 0,
            formaPago: installments > 1 ? 'cuotas' : 'contado',
            cantidadCuotas: installments,
            montoCuota: installments > 1 ? monthlyPayment : undefined,
            insurerPaymentPlan: isFedpaCCMismatch ? {
              insurerCuotas: 1,
              insurerFrequency: 'contado',
              clientCuotas: installments,
            } : undefined,
          }));
          
          if (emissionData.cedulaFile) {
            welcomeForm.append('cedulaFile', emissionData.cedulaFile);
          }
          if (emissionData.licenciaFile) {
            welcomeForm.append('licenciaFile', emissionData.licenciaFile);
          }
          if (vehicleData?.registroVehicular) {
            welcomeForm.append('registroVehicularFile', vehicleData.registroVehicular);
          }
          
          const welcomeResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: welcomeForm,
          });
          const welcomeResult = await welcomeResponse.json();
          if (welcomeResult.success) {
            console.log('[FEDPA CC] ✅ Bienvenida enviada:', welcomeResult.messageId);
          } else {
            console.error('[FEDPA CC] Error bienvenida:', welcomeResult.error);
          }
        } catch (welcomeErr: any) {
          console.error('[FEDPA CC] Error enviando bienvenida:', welcomeErr);
        }
        
        setEmissionProgress(92);
        setEmissionStep('Preparando confirmación...');
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza || emisionResult.poliza,
          insurer: 'FEDPA Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          amb: emisionResult.amb || 'PROD',
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData.marca} ${quoteData.modelo} ${quoteData.anio || quoteData.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan?.annualPremium,
          tipoCobertura: 'Cobertura Completa',
          method: 'emisor_externo',
        }));
        
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');
        
      } else if (isInternacionalReal) {
        console.log('[EMISIÓN INTERNACIONAL] Iniciando emisión con API real...');
        setEmissionProgress(10);
        setEmissionStep('Validando datos de emisión...');
        
        if (!emissionData) {
          throw new Error('Faltan datos de emisión');
        }
        
        const isCC = quoteData.cobertura === 'COMPLETA';
        const tipoCobertura = isCC ? 'Cobertura Completa' : 'Daños a Terceros';
        
        if (isCC && !inspectionPhotos.length) {
          throw new Error('Faltan fotos de inspección para Cobertura Completa');
        }
        
        // Emitir con API real de INTERNACIONAL
        setEmissionProgress(20);
        setEmissionStep('Conectando con Internacional de Seguros...');
        const emisionResponse = await fetch('/api/is/auto/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vIdPv: selectedPlan._idCotizacion,
            vcodtipodoc: 1,
            vnrodoc: emissionData.cedula,
            vnombre: `${emissionData.primerNombre} ${emissionData.segundoNombre || ''}`.trim(),
            vapellido1: emissionData.primerApellido,
            vapellido2: emissionData.segundoApellido || '',
            vtelefono: emissionData.telefono,
            vcelular: emissionData.celular || emissionData.telefono,
            vcorreo: emissionData.email,
            vfecnacimiento: convertToFedpaDate(emissionData.fechaNacimiento),
            vsexo: emissionData.sexo,
            vdireccion: emissionData.direccion,
            vestadocivil: emissionData.estadoCivil || 'soltero',
            // Dirección estructurada IS
            vcodprovincia: emissionData.codProvincia,
            vcoddistrito: emissionData.codDistrito,
            vcodcorregimiento: emissionData.codCorregimiento,
            vcodurbanizacion: emissionData.codUrbanizacion || 0,
            vcasaapto: emissionData.casaApto || '',
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
            vtipotransmision: vehicleData?.tipoTransmision || 'AUTOMATICO',
            vcantpasajeros: vehicleData?.pasajeros || 5,
            vcantpuertas: vehicleData?.puertas || 4,
            paymentToken,
            formaPago: installments === 1 ? 1 : 2,
            cantCuotas: installments,
            opcion: selectedPlan._vIdOpt || 1,
            pjeBexp: selectedPlan._descuentoPorcentaje || 0,
            vacreedor: emissionData.acreedor || '',
            vendosoTexto: selectedPlan._endosoTexto || '',
            vcodplancoberturadadic: selectedPlan._codPlanCoberturaAdic || 0,
            tipo_cobertura: tipoCobertura,
            vmarca_label: quoteData.marca,
            vmodelo_label: quoteData.modelo,
            ...(isMaster && masterBrokerId ? { masterBrokerId } : {}),
          }),
        });
        
        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          const errMsg = errorData.error || 'Error al emitir póliza';
          // Si la regeneración automática también falló, redirigir al usuario
          if (errMsg.includes('no se pudo regenerar')) {
            sessionStorage.removeItem('selectedQuote');
            toast.error('No se pudo generar la cotización. Intente nuevamente.');
            router.push('/cotizadores');
            return;
          }
          throw new Error(errMsg);
        }
        
        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          const errMsg = emisionResult.error || 'Error al emitir póliza';
          if (errMsg.includes('no se pudo regenerar')) {
            sessionStorage.removeItem('selectedQuote');
            toast.error('No se pudo generar la cotización. Intente nuevamente.');
            router.push('/cotizadores');
            return;
          }
          throw new Error(errMsg);
        }
        
        // ═══ Prefix IS policy number with 1-30- ═══
        emisionResult.nroPoliza = formatISPolicyNumber(emisionResult.nroPoliza);
        console.log('[EMISION INTERNACIONAL] Póliza emitida:', emisionResult.nroPoliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');
        
        // ═══ ADM COT: Track successful IS emission ═══
        const isRef = selectedPlan?._idCotizacion;
        if (isRef) {
          const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
          trackQuoteEmitted({ quoteRef: `IS-${isRef}-${planSuffix}`, insurer: 'INTERNACIONAL', policyNumber: emisionResult.nroPoliza, clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(), cedula: emissionData.cedula, email: emissionData.email, phone: emissionData.telefono || emissionData.celular });
        }
        
        // ═══ ADM COT: Auto-create pending payment + recurrence (skip for master) ═══
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'INTERNACIONAL',
            policyNumber: emisionResult.nroPoliza || '',
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: selectedPlan?.annualPremium || 0,
            installments,
            ramo: 'AUTO',
            cobertura: 'COMPLETA',
            pfCodOper,
            pfRecCodOper,
            pfCardType,
            pfCardDisplay,
          });
        }
        
        // ═══ ENVIAR EXPEDIENTE POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', isCC ? 'CC' : 'DT');
          expedienteForm.append('environment', 'development');
          expedienteForm.append('nroPoliza', emisionResult.nroPoliza || '');
          expedienteForm.append('pdfUrl', emisionResult.pdfUrl || '');
          expedienteForm.append('insurerName', 'Internacional de Seguros');
          expedienteForm.append('firmaDataUrl', signatureRef.current || '');
          if (emisionResult.clientId) expedienteForm.append('clientId', emisionResult.clientId);
          if (emisionResult.policyId) expedienteForm.append('policyId', emisionResult.policyId);
          
          // Client data
          expedienteForm.append('clientData', JSON.stringify({
            primerNombre: emissionData.primerNombre,
            segundoNombre: emissionData.segundoNombre,
            primerApellido: emissionData.primerApellido,
            segundoApellido: emissionData.segundoApellido,
            cedula: emissionData.cedula,
            email: emissionData.email,
            telefono: emissionData.telefono,
            celular: emissionData.celular,
            direccion: emissionData.direccion,
            fechaNacimiento: emissionData.fechaNacimiento,
            sexo: emissionData.sexo,
            estadoCivil: emissionData.estadoCivil,
            nacionalidad: emissionData.nacionalidad,
            esPEP: emissionData.esPEP,
            pepEsUsted: emissionData.pepEsUsted,
            pepCargoUsted: emissionData.pepCargoUsted,
            pepEsFamiliar: emissionData.pepEsFamiliar,
            pepNombreFamiliar: emissionData.pepNombreFamiliar,
            pepCargoFamiliar: emissionData.pepCargoFamiliar,
            pepRelacionFamiliar: emissionData.pepRelacionFamiliar,
            pepEsColaborador: emissionData.pepEsColaborador,
            pepNombreColaborador: emissionData.pepNombreColaborador,
            pepCargoColaborador: emissionData.pepCargoColaborador,
            pepRelacionColaborador: emissionData.pepRelacionColaborador,
            actividadEconomica: emissionData.actividadEconomica,
            dondeTrabaja: emissionData.dondeTrabaja,
            nivelIngresos: emissionData.nivelIngresos,
          }));
          
          // Vehicle data
          expedienteForm.append('vehicleData', JSON.stringify({
            placa: vehicleData?.placa,
            vinChasis: vehicleData?.vinChasis,
            motor: vehicleData?.motor,
            color: vehicleData?.color,
            pasajeros: vehicleData?.pasajeros,
            puertas: vehicleData?.puertas,
            kilometraje: vehicleData?.kilometraje,
            tipoCombustible: vehicleData?.tipoCombustible,
            tipoTransmision: vehicleData?.tipoTransmision,
            aseguradoAnteriormente: vehicleData?.aseguradoAnteriormente,
            aseguradoraAnterior: vehicleData?.aseguradoraAnterior,
            marca: vehicleData?.marca || quoteData?.marca || '',
            modelo: vehicleData?.modelo || quoteData?.modelo || '',
            anio: vehicleData?.anio || quoteData?.anio || quoteData?.anno || '',
          }));
          
          // Quote data
          expedienteForm.append('quoteData', JSON.stringify({
            marca: quoteData.marca,
            modelo: quoteData.modelo,
            anio: quoteData.anio || quoteData.anno,
            valorVehiculo: quoteData.valorVehiculo,
            tipoVehiculo: quoteData.tipoVehiculo || 'SEDAN',
            cobertura: quoteData.cobertura,
            primaTotal: selectedPlan?.annualPremium || 0,
            // IS-specific for quotation PDF
            _idCotizacion: selectedPlan?._idCotizacion,
            _nroCotizacion: selectedPlan?._nroCotizacion,
            _vIdOpt: selectedPlan?._vIdOpt,
            _deducibleOriginal: selectedPlan?._deducibleOriginal,
            _allCoberturas: selectedPlan?._allCoberturas,
            _apiPrimaTotal: selectedPlan?._apiPrimaTotal,
            _descuentoFactor: selectedPlan?._descuentoFactor,
            _descuentoPorcentaje: selectedPlan?._descuentoPorcentaje,
            _descuentoBuenaExp: selectedPlan?._descuentoBuenaExp,
            _endosoTexto: selectedPlan?._endosoTexto,
            _planType: selectedPlan?.planType,
            _priceBreakdown: selectedPlan?._priceBreakdown,
          }));
          
          // IS inspection data (extras, physical condition) — send always, API handles defaults for DT
          const isInspData = sessionStorage.getItem('isInspectionData');
          if (isInspData) {
            expedienteForm.append('inspectionData', isInspData);
          }
          
          // Document files
          if (emissionData.cedulaFile) {
            expedienteForm.append('cedulaFile', emissionData.cedulaFile);
          }
          if (emissionData.licenciaFile) {
            expedienteForm.append('licenciaFile', emissionData.licenciaFile);
          }
          if (vehicleData?.registroVehicular) {
            expedienteForm.append('registroVehicularFile', vehicleData.registroVehicular);
          }
          
          // Inspection photos (only for CC)
          if (isCC && inspectionPhotos.length > 0) {
            for (const photo of inspectionPhotos) {
              if (photo.file) {
                expedienteForm.append(`photo_${photo.id}`, photo.file);
              }
            }
          }
          
          const expedienteResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: expedienteForm,
          });
          
          const expedienteResult = await expedienteResponse.json();
          if (expedienteResult.emails?.allOk) {
            console.log('[IS EXPEDIENTE] ✅ Emails enviados:', JSON.stringify(expedienteResult.emails));
            toast.success('Expediente enviado por correo');
          } else if (expedienteResult.success) {
            console.warn('[IS EXPEDIENTE] ⚠️ Correos fallaron:', JSON.stringify(expedienteResult.emails));
            toast.warning('Póliza emitida pero hubo un error enviando los correos');
          } else {
            console.error('[IS EXPEDIENTE] Error:', expedienteResult.error);
            toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
          }
        } catch (expError: any) {
          console.error('[IS EXPEDIENTE] Error enviando expediente:', expError);
          toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
        }
        
        // Guardar datos completos de la póliza para la confirmación y carátula
        setEmissionProgress(92);
        setEmissionStep('Preparando confirmación...');
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza,
          pdfUrl: emisionResult.pdfUrl,
          insurer: 'INTERNACIONAL de Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData.marca} ${quoteData.modelo} ${quoteData.anio || quoteData.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan.annualPremium,
          planType: selectedPlan.planType,
          tipoCobertura: tipoCobertura,
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
        }));
        
        // Limpiar cotización usada para evitar re-emisión con idPv stale
        sessionStorage.removeItem('selectedQuote');
        
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');
        
      } else if (isRegionalReal) {
        // ═══ EMISIÓN REGIONAL CC ═══
        console.log('[EMISIÓN REGIONAL CC] Iniciando emisión con API real...');
        setEmissionProgress(10);
        setEmissionStep('Validando datos de emisión...');
        
        if (!emissionData) {
          throw new Error('Faltan datos de emisión');
        }
        if (!inspectionPhotos.length) {
          throw new Error('Faltan fotos de inspección para Cobertura Completa');
        }
        
        setEmissionProgress(20);
        setEmissionStep('Conectando con La Regional de Seguros...');
        
        // Build emission request — field names accepted by /api/regional/auto/emit-cc
        const regionalEmitBody = {
          numcot: selectedPlan._numcot || selectedPlan._idCotizacion || '',
          // Cliente (for Supabase record creation)
          nombre: emissionData.primerNombre || '',
          apellido: emissionData.primerApellido || '',
          cedula: emissionData.cedula || '',
          email: emissionData.email || '',
          celular: emissionData.celular || emissionData.telefono || '',
          fechaNacimiento: emissionData.fechaNacimiento || '',
          // Dirección (Regional API catalog codes)
          codpais: 507,
          codestado: emissionData.codProvincia || 8,
          codciudad: emissionData.codDistrito || 1,
          codmunicipio: emissionData.codCorregimiento || 1,
          codurb: emissionData.codUrbanizacion || 1,
          dirhab: emissionData.direccion || 'Ciudad de Panamá',
          // Datos cumplimiento
          ocupacion: 1,
          ingresoAnual: ({ 'menos de 10mil': 1, '10mil a 30mil': 2, '30mil a 50mil': 3, 'mas de 50mil': 4 } as Record<string, number>)[emissionData.nivelIngresos] ?? 1,
          paisTributa: 507,
          pep: emissionData.esPEP ? 'S' : 'N',
          // Vehículo
          vehnuevo: 'N',
          numplaca: vehicleData?.placa || '',
          serialcarroceria: vehicleData?.vinChasis || '',
          serialmotor: vehicleData?.motor || '',
          color: vehicleData?.color || '',
          usoveh: 'P',
          peso: 'L',
          // Acreedor
          acreedor: resolveAcreedorREGIONAL(emissionData.acreedor || ''),
          // Cuotas
          cuotas: installments || 1,
          opcionPrima: 1,
          ...(isMaster && masterBrokerId ? { masterBrokerId } : {}),
        };
        
        setEmissionProgress(30);
        setEmissionStep('Emitiendo póliza con La Regional...');
        
        const emisionResponse = await fetch('/api/regional/auto/emit-cc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(regionalEmitBody),
        });
        
        // Handle non-JSON responses (e.g. 504 gateway timeout returns plain text)
        let emisionResult: any;
        const responseText = await emisionResponse.text();
        try {
          emisionResult = JSON.parse(responseText);
        } catch {
          console.error('[EMISIÓN REGIONAL CC] Non-JSON response:', emisionResponse.status, responseText.slice(0, 200));
          throw new Error(
            emisionResponse.status === 504
              ? 'El servidor de La Regional no respondió a tiempo. Por favor intente nuevamente.'
              : `Error del servidor de La Regional (HTTP ${emisionResponse.status})`
          );
        }
        
        if (!emisionResponse.ok || !emisionResult.success) {
          throw new Error(emisionResult.error || 'Error emitiendo póliza con REGIONAL');
        }
        
        console.log('[EMISIÓN REGIONAL CC] Póliza emitida:', emisionResult.nroPoliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');
        
        // ═══ ADM COT: Track successful REGIONAL CC emission ═══
        const regionalRef = selectedPlan?._idCotizacion;
        if (regionalRef) {
          const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
          trackQuoteEmitted({
            quoteRef: `REGIONAL-${regionalRef}-${planSuffix}`,
            insurer: 'REGIONAL',
            policyNumber: emisionResult.nroPoliza,
            clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(),
            cedula: emissionData.cedula,
            email: emissionData.email,
            phone: emissionData.telefono || emissionData.celular,
          });
        }
        
        // ═══ ADM COT: Auto-create pending payment + recurrence (skip for master) ═══
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'REGIONAL',
            policyNumber: emisionResult.nroPoliza || '',
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: selectedPlan?.annualPremium || 0,
            installments,
            ramo: 'AUTO',
            cobertura: 'COMPLETA',
            pfCodOper,
            pfRecCodOper,
            pfCardType,
            pfCardDisplay,
          });
        }
        
        // ═══ ENVIAR EXPEDIENTE POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', 'CC');
          expedienteForm.append('environment', 'development');
          expedienteForm.append('nroPoliza', emisionResult.nroPoliza || '');
          expedienteForm.append('pdfUrl', emisionResult.pdfUrl || '');
          expedienteForm.append('insurerName', 'La Regional de Seguros');
          expedienteForm.append('firmaDataUrl', signatureRef.current || '');
          if (emisionResult.clientId) expedienteForm.append('clientId', emisionResult.clientId);
          if (emisionResult.policyId) expedienteForm.append('policyId', emisionResult.policyId);
          
          expedienteForm.append('clientData', JSON.stringify({
            primerNombre: emissionData.primerNombre,
            segundoNombre: emissionData.segundoNombre,
            primerApellido: emissionData.primerApellido,
            segundoApellido: emissionData.segundoApellido,
            cedula: emissionData.cedula,
            email: emissionData.email,
            telefono: emissionData.telefono,
            celular: emissionData.celular,
            direccion: emissionData.direccion,
            fechaNacimiento: emissionData.fechaNacimiento,
            sexo: emissionData.sexo,
            estadoCivil: emissionData.estadoCivil,
            nacionalidad: emissionData.nacionalidad,
            esPEP: emissionData.esPEP,
            actividadEconomica: emissionData.actividadEconomica,
            dondeTrabaja: emissionData.dondeTrabaja,
            nivelIngresos: emissionData.nivelIngresos,
          }));
          
          expedienteForm.append('vehicleData', JSON.stringify({
            placa: vehicleData?.placa,
            vinChasis: vehicleData?.vinChasis,
            motor: vehicleData?.motor,
            color: vehicleData?.color,
            pasajeros: vehicleData?.pasajeros,
            puertas: vehicleData?.puertas,
            tipoTransmision: vehicleData?.tipoTransmision,
            marca: vehicleData?.marca || quoteData?.marca || '',
            modelo: vehicleData?.modelo || quoteData?.modelo || '',
            anio: vehicleData?.anio || quoteData?.anio || quoteData?.anno || '',
          }));
          
          expedienteForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca || vehicleData?.marca || '',
            modelo: quoteData?.modelo || vehicleData?.modelo || '',
            anio: quoteData?.anio || quoteData?.anno || vehicleData?.anio || '',
            valorVehiculo: quoteData?.valorVehiculo || 0,
            cobertura: 'Cobertura Completa',
            primaTotal: installments > 1 ? (monthlyPayment * installments) : (selectedPlan?.annualPremium || 0),
            primaContado: selectedPlan?.annualPremium || 0,
            formaPago: installments > 1 ? 'cuotas' : 'contado',
            cantidadCuotas: installments || 1,
            montoCuota: installments > 1 ? monthlyPayment : undefined,
          }));
          
          if (emissionData.cedulaFile) {
            expedienteForm.append('cedulaFile', emissionData.cedulaFile);
          }
          if (emissionData.licenciaFile) {
            expedienteForm.append('licenciaFile', emissionData.licenciaFile);
          }
          if (vehicleData?.registroVehicular) {
            expedienteForm.append('registroVehicularFile', vehicleData.registroVehicular);
          }
          if (inspectionPhotos.length > 0) {
            for (const photo of inspectionPhotos) {
              if (photo.file) {
                expedienteForm.append(`photo_${photo.id}`, photo.file);
              }
            }
          }
          
          const expedienteResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: expedienteForm,
          });
          const expedienteResult = await expedienteResponse.json();
          if (expedienteResult.emails?.allOk) {
            console.log('[REGIONAL CC] ✅ Emails enviados:', JSON.stringify(expedienteResult.emails));
          } else if (expedienteResult.success) {
            console.warn('[REGIONAL CC] ⚠️ Correos fallaron:', JSON.stringify(expedienteResult.emails));
          } else {
            console.error('[REGIONAL CC] Error expediente:', expedienteResult.error);
          }
        } catch (expError: any) {
          console.error('[REGIONAL CC] Error enviando expediente:', expError);
          toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
        }
        
        setEmissionProgress(92);
        setEmissionStep('Preparando confirmación...');
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza,
          pdfUrl: emisionResult.pdfUrl || '',
          insurer: 'La Regional de Seguros',
          regionalPoliza: emisionResult.nroPoliza,
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData?.marca || ''} ${quoteData?.modelo || ''} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: installments > 1 ? (monthlyPayment * installments) : (selectedPlan?.annualPremium || 0),
          primaContado: selectedPlan?.annualPremium,
          formaPago: installments > 1 ? 'cuotas' : 'contado',
          cantidadCuotas: installments,
          montoCuota: installments > 1 ? monthlyPayment : undefined,
          planType: selectedPlan?.planType,
          tipoCobertura: 'Cobertura Completa',
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
        }));
        
        sessionStorage.removeItem('selectedQuote');
        
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');
        
      } else if (isAnconReal) {
        // ═══ EMISIÓN ANCON CC ═══
        console.log('[EMISIÓN ANCON CC] Iniciando emisión con API real...');
        setEmissionProgress(10);
        setEmissionStep('Validando datos de emisión...');

        if (!emissionData || !vehicleData) {
          throw new Error('Faltan datos de cliente o vehículo');
        }

        setEmissionProgress(20);
        setEmissionStep('Conectando con ANCÓN Seguros...');

        const anconEmitBody = {
          no_cotizacion: selectedPlan._idCotizacion || '',
          opcion: selectedPlan._opcion || 'A',
          cod_producto: selectedPlan?._codProducto || '00312',
          nombre_producto: selectedPlan?._nombreProducto || 'AUTO COMPLETA',
          suma_asegurada: String(selectedPlan._sumaAsegurada || quoteData?.valorVehiculo || 15000),
          primer_nombre: emissionData.primerNombre,
          segundo_nombre: emissionData.segundoNombre || '',
          primer_apellido: emissionData.primerApellido,
          segundo_apellido: emissionData.segundoApellido || '',
          tipo_de_cliente: 'N',
          cedula: emissionData.cedula,
          fecha_nacimiento: emissionData.fechaNacimiento || '',
          sexo: emissionData.sexo || 'M',
          telefono_celular: emissionData.celular || emissionData.telefono || '',
          telefono_residencial: emissionData.telefono || '',
          email: emissionData.email || '',
          direccion: emissionData.direccion || 'PANAMA',
          direccion_cobros: emissionData.direccion || 'PANAMA',
          cod_marca_agt: quoteData?.marcaCodigo || '',
          nombre_marca: quoteData?.marca || '',
          cod_modelo_agt: quoteData?.modeloCodigo || '',
          nombre_modelo: quoteData?.modelo || '',
          placa: vehicleData.placa || '',
          no_chasis: vehicleData.vinChasis || '',
          vin: vehicleData.vinChasis || '',
          no_motor: vehicleData.motor || '',
          ano: String(quoteData?.anio || quoteData?.anno || new Date().getFullYear()),
          cantidad_de_pago: String(installments || 1),
          nacionalidad: emissionData.nacionalidad || 'PANAMA',
          pep: '0',
          nombre_acreedor: emissionData.acreedor || '',
          codigo_acreedor: '', // resolved server-side from nombre_acreedor via GenerarAcreedores
        };

        setEmissionProgress(25);
        setEmissionStep('Subiendo documentos e inspección...');

        // Build FormData with emission data + inspection photos + documents
        const anconForm = new FormData();
        anconForm.append('emissionData', JSON.stringify(anconEmitBody));
        if (isMaster && masterBrokerId) {
          anconForm.append('masterBrokerId', masterBrokerId);
        }

        // Attach inspection photos
        if (inspectionPhotos.length > 0) {
          for (const photo of inspectionPhotos) {
            if (photo.file) {
              anconForm.append(`photo_${photo.id}`, photo.file);
            }
          }
        }

        // Attach document files
        if (emissionData.cedulaFile) {
          anconForm.append('cedulaFile', emissionData.cedulaFile);
        }
        if (emissionData.licenciaFile) {
          anconForm.append('licenciaFile', emissionData.licenciaFile);
        }
        if (vehicleData?.registroVehicular) {
          anconForm.append('registroVehicularFile', vehicleData.registroVehicular);
        }

        setEmissionProgress(35);
        setEmissionStep('Emitiendo póliza con ANCÓN...');

        const anconEmisionResponse = await fetch('/api/ancon/emision', {
          method: 'POST',
          body: anconForm,
        });

        const anconEmisionResult = await anconEmisionResponse.json();

        if (!anconEmisionResponse.ok || !anconEmisionResult.success) {
          throw new Error(anconEmisionResult.error || 'Error emitiendo póliza con ANCON');
        }

        console.log('[EMISIÓN ANCON CC] Póliza emitida:', anconEmisionResult.poliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');

        // ═══ ADM COT: Track successful ANCON CC emission ═══
        const anconRef = selectedPlan?._idCotizacion;
        if (anconRef) {
          const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
          trackQuoteEmitted({
            quoteRef: `ANCON-${anconRef}-${planSuffix}`,
            insurer: 'ANCON',
            policyNumber: anconEmisionResult.poliza,
            clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(),
            cedula: emissionData.cedula,
          });
        }

        // ═══ ADM COT: Auto-create pending payment (skip for master) ═══
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'ANCON',
            policyNumber: anconEmisionResult.poliza || '',
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: installments > 1 ? (monthlyPayment * installments) : (selectedPlan?.annualPremium || 0),
            installments: installments || 1,
            ramo: 'AUTO',
            cobertura: 'COMPLETA',
          });
        }

        // ═══ ENVIAR EXPEDIENTE POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', 'CC');
          expedienteForm.append('environment', 'development');
          expedienteForm.append('nroPoliza', anconEmisionResult.poliza || '');
          expedienteForm.append('pdfUrl', anconEmisionResult.pdfUrl || '');
          expedienteForm.append('insurerName', 'ANCÓN Seguros');
          expedienteForm.append('firmaDataUrl', signatureRef.current || '');
          if (anconEmisionResult.clientId) expedienteForm.append('clientId', anconEmisionResult.clientId);
          if (anconEmisionResult.policyId) expedienteForm.append('policyId', anconEmisionResult.policyId);

          expedienteForm.append('clientData', JSON.stringify({
            primerNombre: emissionData.primerNombre,
            segundoNombre: emissionData.segundoNombre,
            primerApellido: emissionData.primerApellido,
            segundoApellido: emissionData.segundoApellido,
            cedula: emissionData.cedula,
            email: emissionData.email,
            telefono: emissionData.telefono,
            celular: emissionData.celular,
            direccion: emissionData.direccion,
            fechaNacimiento: emissionData.fechaNacimiento,
            sexo: emissionData.sexo,
            estadoCivil: emissionData.estadoCivil,
            nacionalidad: emissionData.nacionalidad,
            esPEP: emissionData.esPEP,
            actividadEconomica: emissionData.actividadEconomica,
            dondeTrabaja: emissionData.dondeTrabaja,
            nivelIngresos: emissionData.nivelIngresos,
          }));

          expedienteForm.append('vehicleData', JSON.stringify({
            placa: vehicleData?.placa,
            vinChasis: vehicleData?.vinChasis,
            motor: vehicleData?.motor,
            color: vehicleData?.color,
            pasajeros: vehicleData?.pasajeros,
            puertas: vehicleData?.puertas,
            tipoTransmision: vehicleData?.tipoTransmision,
            marca: vehicleData?.marca || quoteData?.marca || '',
            modelo: vehicleData?.modelo || quoteData?.modelo || '',
            anio: vehicleData?.anio || quoteData?.anio || quoteData?.anno || '',
          }));

          expedienteForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca || vehicleData?.marca || '',
            modelo: quoteData?.modelo || vehicleData?.modelo || '',
            anio: quoteData?.anio || quoteData?.anno || vehicleData?.anio || '',
            valorVehiculo: quoteData?.valorVehiculo || 0,
            cobertura: 'Cobertura Completa',
            primaTotal: installments > 1 ? (monthlyPayment * installments) : (selectedPlan?.annualPremium || 0),
            primaContado: selectedPlan?.annualPremium || 0,
            formaPago: installments > 1 ? 'cuotas' : 'contado',
            cantidadCuotas: installments || 1,
            montoCuota: installments > 1 ? monthlyPayment : undefined,
          }));

          if (emissionData.cedulaFile) {
            expedienteForm.append('cedulaFile', emissionData.cedulaFile);
          }
          if (emissionData.licenciaFile) {
            expedienteForm.append('licenciaFile', emissionData.licenciaFile);
          }
          if (vehicleData?.registroVehicular) {
            expedienteForm.append('registroVehicularFile', vehicleData.registroVehicular);
          }
          if (inspectionPhotos.length > 0) {
            for (const photo of inspectionPhotos) {
              if (photo.file) {
                expedienteForm.append(`photo_${photo.id}`, photo.file);
              }
            }
          }

          const expedienteResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: expedienteForm,
          });
          const expedienteResult = await expedienteResponse.json();
          if (expedienteResult.emails?.allOk) {
            console.log('[ANCON CC] ✅ Emails enviados:', JSON.stringify(expedienteResult.emails));
          } else if (expedienteResult.success) {
            console.warn('[ANCON CC] ⚠️ Correos fallaron:', JSON.stringify(expedienteResult.emails));
          } else {
            console.error('[ANCON CC] Error expediente:', expedienteResult.error);
          }
        } catch (expError: any) {
          console.error('[ANCON CC] Error enviando expediente:', expError);
          toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
        }

        setEmissionProgress(92);
        setEmissionStep('Preparando confirmación...');
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: anconEmisionResult.poliza,
          pdfUrl: anconEmisionResult.pdfUrl || `/api/ancon/print?poliza=${encodeURIComponent(anconEmisionResult.poliza)}`,
          insurer: 'ANCÓN Seguros',
          anconPoliza: anconEmisionResult.poliza,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData?.marca || ''} ${quoteData?.modelo || ''} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: installments > 1 ? (monthlyPayment * installments) : (selectedPlan?.annualPremium || 0),
          primaContado: selectedPlan?.annualPremium,
          formaPago: installments > 1 ? 'cuotas' : 'contado',
          cantidadCuotas: installments,
          montoCuota: installments > 1 ? monthlyPayment : undefined,
          planType: selectedPlan?.planType,
          tipoCobertura: 'Cobertura Completa',
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
        }));

        sessionStorage.removeItem('selectedQuote');

        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');

      } else {
        // Otras aseguradoras - Flujo simulado (futuras integraciones)
        console.log('[EMISION] Flujo simulado para:', selectedPlan?.insurerName);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: `DEMO-${Date.now()}`,
          insurer: selectedPlan?.insurerName || 'Demo',
          asegurado: emissionData ? `${emissionData.primerNombre} ${emissionData.primerApellido}` : '',
          cedula: emissionData?.cedula || '',
          vehiculo: `${quoteData?.marca || ''} ${quoteData?.modelo || ''} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan?.annualPremium,
          planType: selectedPlan?.planType,
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
          tipoCobertura: quoteData?.cobertura === 'COMPLETA' ? 'Cobertura Completa' : 'Daños a Terceros',
          isDemo: true,
        }));
        
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');
      }
      
    } catch (error: any) {
      console.error('Error emitiendo póliza:', error);
      setEmissionError(error.message || 'Error al emitir póliza');
      // ═══ ADM COT: Track emission failure ═══
      const refId = selectedPlan?._idCotizacion;
      if (refId) {
        const isFedpa = selectedPlan?.insurerName?.includes('FEDPA');
        const isRegional = selectedPlan?._isREGIONAL || selectedPlan?.insurerName?.includes('Regional');
        const prefix = isFedpa ? 'FEDPA' : isRegional ? 'REGIONAL' : 'IS';
        const insurer = isFedpa ? 'FEDPA' : isRegional ? 'REGIONAL' : 'INTERNACIONAL';
        const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
        trackQuoteFailed({
          quoteRef: `${prefix}-${refId}-${planSuffix}`,
          insurer,
          errorMessage: error.message,
          lastStep: step,
          clientName: emissionData ? `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim() : undefined,
          cedula: emissionData?.cedula || undefined,
          email: emissionData?.email || undefined,
          phone: emissionData?.telefono || emissionData?.celular || undefined,
        });
      }
      setIsConfirming(false);
    }
  };

  const handleEmissionModalClose = () => {
    setShowEmissionModal(false);
    setEmissionError(null);
    setPaymentCharged(false);
    setIsConfirming(false);
  };

  const handleEmissionReport = async () => {
    try {
      const isRegional = selectedPlan?._isREGIONAL || selectedPlan?.insurerName?.includes('Regional');
      const isFedpa = selectedPlan?.insurerName?.includes('FEDPA');
      const insurerName = isRegional ? 'La Regional de Seguros' : isFedpa ? 'FEDPA Seguros' : (selectedPlan?.insurerName || 'Aseguradora');
      const cobertura = selectedPlan?.planType ? 'CC' : 'CC';

      const reportBody: Record<string, any> = {
        insurerName,
        ramo: 'AUTO',
        cobertura,
        clientData: emissionData ? {
          primerNombre: emissionData.primerNombre,
          primerApellido: emissionData.primerApellido,
          segundoNombre: emissionData.segundoNombre,
          segundoApellido: emissionData.segundoApellido,
          cedula: emissionData.cedula,
          fechaNacimiento: emissionData.fechaNacimiento,
          sexo: emissionData.sexo,
          email: emissionData.email,
          telefono: emissionData.telefono,
          celular: emissionData.celular,
          direccion: emissionData.direccion,
          esPEP: emissionData.esPEP,
          actividadEconomica: emissionData.actividadEconomica,
          nivelIngresos: emissionData.nivelIngresos,
          acreedor: emissionData.acreedor,
          codProvincia: emissionData.codProvincia,
          codDistrito: emissionData.codDistrito,
          codCorregimiento: emissionData.codCorregimiento,
        } : {},
        vehicleData: vehicleData ? {
          placa: vehicleData.placa,
          vinChasis: vehicleData.vinChasis,
          motor: vehicleData.motor,
          color: vehicleData.color,
          marca: vehicleData.marca || quoteData?.marca,
          modelo: vehicleData.modelo || quoteData?.modelo,
          anio: vehicleData.anio || quoteData?.anno || quoteData?.anio,
          pasajeros: vehicleData.pasajeros,
          puertas: vehicleData.puertas,
        } : {},
        quoteData: {
          numcot: selectedPlan?._numcot || selectedPlan?._idCotizacion,
          planType: selectedPlan?.planType,
          annualPremium: selectedPlan?.annualPremium,
          deducible: quoteData?.deducible,
          valorVehiculo: quoteData?.valorVehiculo,
          endoso: quoteData?.endoso,
        },
        paymentData: {
          pfCodOper: pfCardData ? 'charged' : undefined,
          pfCardType: pfCardData?.brand,
          pfCardDisplay: pfCardData?.cardNumber ? `****${pfCardData.cardNumber.slice(-4)}` : undefined,
          amount: installments > 1 ? monthlyPayment : (selectedPlan?.annualPremium || 0),
          installments,
        },
        emissionError: emissionError || 'Error desconocido',
        expedienteDocs: {
          photos: inspectionPhotos?.map((_: any, i: number) => `foto_inspeccion_${i + 1}`) || [],
          firma: signatureRef.current ? 'firma_presente' : 'sin_firma',
        },
      };

      const res = await fetch('/api/operaciones/emission-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportBody),
      });

      const result = await res.json();
      if (!result.success) {
        console.error('[EMISSION REPORT] Failed:', result.error);
      } else {
        console.log('[EMISSION REPORT] Caso creado:', result.ticket);
      }
    } catch (err) {
      console.error('[EMISSION REPORT] Error:', err);
    }
  };

  const handleEmissionModalComplete = () => {
    setShowEmissionModal(false);
    router.push('/cotizadores/confirmacion');
  };

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
  const isInternacional = !!(selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL'));
  const isRegional = !!(selectedPlan?._isReal && (selectedPlan?._isREGIONAL || selectedPlan?.insurerName?.includes('Regional')));
  const isAncon = !!(selectedPlan?._isReal && (selectedPlan?._isANCON || selectedPlan?.insurerName?.includes('ANCÓN') || selectedPlan?.insurerName?.includes('Ancon')));

  // Determinar step inicial según tipo
  // IS DT still needs emission-data and vehicle steps (for documents), just no inspection
  const needsFullWizard = isAutoCompleta || isInternacional || isRegional || isAncon;
  const initialStep = needsFullWizard ? 'payment' : 'payment-info';
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

  // Step 1: Selección de plan de pago (auto completa o IS)
  if (currentStep === 'payment' && needsFullWizard) {
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

  // Step 2: Datos de emisión (auto completa o IS)
  if (currentStep === 'emission-data' && needsFullWizard) {
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
            quoteData={{ ...quoteData, insurerName: selectedPlan?.insurerName }}
            onContinue={handleEmissionDataComplete}
          />
        </div>
      </div>
    );
  }

  // Step 3: Datos del Vehículo (auto completa o IS)
  if (currentStep === 'vehicle' && needsFullWizard) {
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
            isInternacional={isInternacional}
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
            isInternacional={isInternacional}
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
              {isMaster ? 'Emisión Master' : 'Información de Pago'}
            </h2>
            <p className="text-gray-600">
              {isMaster ? 'La emisión master no requiere pago con tarjeta' : 'Completa los datos de tu tarjeta para procesar el pago'}
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

          {/* Tarjeta 3D o Overlay Master */}
          {isMaster ? (
            <div className="flex flex-col items-center justify-center gap-4 p-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 min-h-40">
              <FaLock className="text-4xl text-blue-600" />
              <p className="text-lg font-bold text-[#010139]">Usuario master detectado</p>
              <p className="text-sm text-gray-600 text-center">La emisión no requiere pago con tarjeta.<br/>Presiona Continuar para ir al resumen.</p>
            </div>
          ) : (
            <>
              <CreditCardInput
                onTokenReceived={(token: string, last4: string, brand: string) => {
                  setPaymentToken(token);
                  setCardData({ last4, brand });
                  setCompletedSteps(prev => [...prev, 'payment-info']);
                  toast.success(`Tarjeta ${brand} ****${last4} registrada`);
                }}
                onCardDataReady={(data: CardData) => setPfCardData(data)}
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
            </>
          )}

          {/* Botón Continuar al Resumen */}
          <div className="mt-6">
            <button
              onClick={() => {
                if (isMaster) {
                  setCompletedSteps(prev => [...prev.filter(s => s !== 'payment-info'), 'payment-info']);
                }
                router.push('/cotizadores/emitir?step=review');
              }}
              disabled={!isMaster && !paymentToken}
              className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 ${
                isMaster || paymentToken
                  ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105 cursor-pointer'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
              type="button"
            >
              Continuar al Resumen
            </button>
            {!isMaster && !paymentToken && (
              <p className="text-xs text-gray-500 text-center mt-2">
                Ingresa los datos de tu tarjeta para continuar
              </p>
            )}
            <div className="flex items-center justify-center gap-3 mt-3">
              <span className="text-xs text-gray-500 font-medium">🔒 100% Secure Check out</span>
              <Image src="/paguelo_facil_logo.svg" alt="Paguelo Fácil" width={80} height={20} className="object-contain opacity-70" />
            </div>
          </div>
        </div>
        </div>
      </div>
    );
  }

  // Step 6: Resumen final y confirmación (todos los tipos)
  if (currentStep === 'review') {
    // For IS Internacional: require signature before emitting (unless master)
    const handleEmitClick = () => {
      if (!isMaster && !signatureDataUrl) {
        setShowSignaturePad(true);
        return;
      }
      handleConfirmEmission();
    };

    const handleSignatureComplete = (dataUrl: string) => {
      signatureRef.current = dataUrl;
      setSignatureDataUrl(dataUrl);
      setShowSignaturePad(false);
      toast.success('Firma capturada correctamente');
      // Auto-proceed with emission after signing
      setTimeout(() => handleConfirmEmission(), 300);
    };

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
          {/* Broker selector for master users */}
          {isMaster && availableBrokers.length > 0 && (
            <div className="max-w-2xl mx-auto mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">🏢</span>
                <label className="text-sm font-semibold text-gray-700">Asignar a Corredor</label>
              </div>
              <select
                value={masterBrokerId}
                onChange={e => setMasterBrokerId(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:border-gray-400 focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 transition-colors outline-none"
              >
                <option value="">Portal Líderes (por defecto)</option>
                {availableBrokers.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <FinalQuoteSummary
            quoteData={quoteData}
            selectedPlan={selectedPlan}
            installments={installments}
            monthlyPayment={monthlyPayment}
            emissionData={emissionData}
            vehicleData={vehicleData}
            inspectionPhotos={inspectionPhotos}
            onConfirm={handleEmitClick}
          />

          {/* Signature indicator for IS */}
          {signatureDataUrl && (
            <div className="max-w-2xl mx-auto mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
              <span className="text-green-600 text-lg">✅</span>
              <span className="text-sm text-green-800 font-semibold">Firma digital capturada</span>
              <button
                onClick={() => setShowSignaturePad(true)}
                className="ml-auto text-xs text-blue-600 underline"
                type="button"
              >
                Cambiar firma
              </button>
            </div>
          )}
        </div>

        {/* Signature Pad Modal */}
        {showSignaturePad && (
          <SignaturePad
            onSignatureComplete={handleSignatureComplete}
            onCancel={() => setShowSignaturePad(false)}
          />
        )}

        {/* Emission Loading Modal with Mascot */}
        <EmissionLoadingModal
          isOpen={showEmissionModal}
          progress={emissionProgress}
          currentStep={emissionStep}
          error={emissionError}
          paymentCharged={paymentCharged}
          blocked={emissionBlocked}
          blockedMessage={emissionBlockedMessage}
          onClose={handleEmissionModalClose}
          onComplete={handleEmissionModalComplete}
          onReport={handleEmissionReport}
        />
      </div>
    );
  }

  return <LoadingSkeleton />;
}
