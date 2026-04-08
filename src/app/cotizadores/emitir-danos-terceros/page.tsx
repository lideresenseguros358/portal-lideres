/**
 * Página de Emisión - Daños a Terceros
 * Replica el UX de cobertura completa con URL-based steps.
 * Steps: emission-data → vehicle → payment-info → review
 * Sin inspección, sin cuotas (modal de pago maneja contado vs cuotas),
 * sin paso separado de documentos (se piden en emission-data),
 * declaración de veracidad integrada en review.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaCheckCircle, FaUser, FaCar, FaCreditCard, FaClipboardCheck, FaTimes, FaLock } from 'react-icons/fa';
import { useCotizadorEdit } from '@/context/CotizadorEditContext';
import EmissionDataForm, { type EmissionData } from '@/components/cotizadores/EmissionDataForm';
import VehicleDataForm, { type VehicleData } from '@/components/cotizadores/VehicleDataForm';
import CreditCardInput, { type CardData } from '@/components/is/CreditCardInput';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type EmissionStep, type BreadcrumbStepDef } from '@/components/cotizadores/EmissionBreadcrumb';
import SignaturePad from '@/components/cotizadores/SignaturePad';
import Image from 'next/image';
import { buscarOcupacion } from '@/lib/fedpa/catalogos-complementarios';
import { trackQuoteEmitted, trackQuoteFailed, trackStepUpdate } from '@/lib/adm-cot/track-quote';
import { createPaymentOnEmission } from '@/lib/adm-cot/create-payment-on-emission';
import { formatISPolicyNumber } from '@/lib/utils/policy-number';
import EmissionLoadingModal from '@/components/cotizadores/EmissionLoadingModal';
import EmissionTimeoutModal from '@/components/cotizadores/EmissionTimeoutModal';
import { useEmissionTimeout } from '@/hooks/useEmissionTimeout';

// 4 steps for DT (no inspection, no cuotas — payment modal handles contado vs cuotas)
const DT_STEPS: BreadcrumbStepDef[] = [
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
  const step = (searchParams.get('step') || 'emission-data') as EmissionStep;

  // ═══ Master privileges ═══
  const { isMaster } = useCotizadorEdit();
  const [availableBrokers, setAvailableBrokers] = useState<{id: string, name: string}[]>([]);
  const [masterBrokerId, setMasterBrokerId] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  const [emissionData, setEmissionData] = useState<EmissionData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [paymentToken, setPaymentToken] = useState('');
  const [cardData, setCardData] = useState<{ last4: string; brand: string } | null>(null);
  const [paymentMode, setPaymentMode] = useState<'contado' | 'cuotas'>('contado');
  const [completedSteps, setCompletedSteps] = useState<EmissionStep[]>([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [pfCardData, setPfCardData] = useState<CardData | null>(null);
  const signatureRef = useRef<string>('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // ═══ Session timeout (30 min) ═══
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  useEmissionTimeout(() => {
    // Clear all emission-related session data
    const KEYS = [
      'thirdPartyQuote', 'selectedQuote', 'emittedPolicy', 'fedpaEmissionPayload',
      'isInspectionData', 'inspectionPhotosIndex', 'emissionFormData',
      'emissionCedulaFile', 'emissionLicenciaFile', 'vehicleFormData', 'vehicleRegistroFile',
    ];
    KEYS.forEach(k => sessionStorage.removeItem(k));
    setShowTimeoutModal(true);
  });

  // ═══ Emission Loading Modal state ═══
  const [showEmissionModal, setShowEmissionModal] = useState(false);
  const [emissionProgress, setEmissionProgress] = useState(0);
  const [emissionStep, setEmissionStep] = useState('');
  const [emissionError, setEmissionError] = useState<string | null>(null);
  const [paymentCharged, setPaymentCharged] = useState(false);
  const [emissionBlocked, setEmissionBlocked] = useState(false);
  const [emissionBlockedMessage, setEmissionBlockedMessage] = useState('');

  // ═══ ADM COT: Helper to get quote ref for step tracking ═══
  const getTrackingInfo = () => {
    const isFedpa = selectedPlan?._isFEDPA || selectedPlan?.insurerName?.includes('FEDPA');
    const isRegional = selectedPlan?.isREGIONAL || selectedPlan?.insurerName?.includes('Regional');
    const isAncon = selectedPlan?.isANCON || selectedPlan?.insurerName?.includes('ANCÓN') || selectedPlan?.insurerName?.includes('Ancon');
    const prefix = isFedpa ? 'FEDPA' : isRegional ? 'REGIONAL' : isAncon ? 'ANCON' : 'IS';
    const insurer = isFedpa ? 'FEDPA' : isRegional ? 'REGIONAL' : isAncon ? 'ANCON' : 'INTERNACIONAL';
    const tpQuoteRaw = typeof window !== 'undefined' ? sessionStorage.getItem('thirdPartyQuote') : null;
    const tpQuote = tpQuoteRaw ? JSON.parse(tpQuoteRaw) : null;
    const refId = selectedPlan?._idCotizacion || tpQuote?.idCotizacion || 'DT';
    const planSuffix = selectedPlan?.planType?.includes('Premium') || selectedPlan?.planType?.includes('VIP') ? 'P' : 'B';
    return { quoteRef: `${prefix}-${refId}-DT-${planSuffix}`, insurer };
  };

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
      setPaymentMode(data?._paymentMode === 'cuotas' ? 'cuotas' : 'contado');
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

  // ═══ ADM COT: Detect abandonment — if user entered data and leaves page ═══
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (emissionData && !isConfirming) {
        // User entered client data but is leaving without completing emission
        const t = getTrackingInfo();
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
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emissionData, isConfirming, step]);

  const selectedPaymentMode: 'contado' | 'cuotas' = paymentMode;
  const installmentCount = selectedPlan?._installmentsCount || selectedPlan?.installments?.payments || 1;
  const installmentAmount = selectedPlan?._installmentAmount || selectedPlan?.installments?.amount || selectedPlan?.annualPremium || 0;
  const installmentsTotal = selectedPlan?._totalWithInstallments || selectedPlan?.installments?.totalWithInstallments || (installmentAmount * installmentCount);
  const selectedInstallmentsCount = selectedPaymentMode === 'cuotas' ? installmentCount : 1;
  const selectedInstallmentAmount = selectedPaymentMode === 'cuotas' ? installmentAmount : (selectedPlan?.annualPremium || 0);
  const selectedInstallmentsTotal = selectedPaymentMode === 'cuotas' ? installmentsTotal : (selectedPlan?.annualPremium || 0);
  const hasFedpaInstallments = !!(selectedPlan?._isFEDPA && selectedPlan?.installments?.available);

  const handlePaymentModeChange = (mode: 'contado' | 'cuotas') => {
    if (mode === 'cuotas' && !hasFedpaInstallments) return;
    setPaymentMode(mode);
    setSelectedPlan((prev: any) => (prev ? { ...prev, _paymentMode: mode } : prev));

    const storedQuote = sessionStorage.getItem('selectedQuote');
    if (!storedQuote) return;

    try {
      const parsed = JSON.parse(storedQuote);
      sessionStorage.setItem('selectedQuote', JSON.stringify({ ...parsed, _paymentMode: mode }));
    } catch (err) {
      console.error('Error actualizando forma de pago en sesión:', err);
    }
  };

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
  const handleEmissionDataComplete = (data: EmissionData) => {
    setEmissionData(data);
    setCompletedSteps(prev => [...prev.filter(s => s !== 'emission-data'), 'emission-data']);
    // ═══ ADM COT: Track step + save client data ═══
    const t = getTrackingInfo();
    trackStepUpdate({
      ...t,
      step: 'emission-data',
      clientName: `${data.primerNombre || ''} ${data.primerApellido || ''}`.trim() || undefined,
      cedula: data.cedula || undefined,
      email: data.email || undefined,
      phone: data.telefono || data.celular || undefined,
    });
    goToStep('vehicle');
    toast.success('Datos guardados correctamente');
  };

  const handleVehicleDataComplete = (data: VehicleData) => {
    setVehicleData(data);
    setCompletedSteps(prev => [...prev.filter(s => s !== 'vehicle'), 'vehicle']);
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    trackStepUpdate({ ...t, step: 'vehicle' });
    goToStep('payment-info');
    toast.success('Datos del vehículo guardados');
  };

  const handlePaymentTokenReceived = (token: string, last4: string, brand: string) => {
    setPaymentToken(token);
    setCardData({ last4, brand });
    setCompletedSteps(prev => [...prev.filter(s => s !== 'payment-info'), 'payment-info']);
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    trackStepUpdate({ ...t, step: 'payment-info' });
    toast.success('Tarjeta registrada. Presiona "Continuar al Resumen" para seguir.');
  };

  const handleCardDataReady = (data: CardData) => {
    setPfCardData(data);
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

  // Emission handler — supports FEDPA, IS Internacional, and future insurers
  const handleConfirmEmission = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    setShowEmissionModal(true);
    setEmissionProgress(0);
    setEmissionStep('Preparando datos del cliente...');
    setEmissionError(null);
    setPaymentCharged(false);
    setEmissionBlocked(false);
    setEmissionBlockedMessage('');

    try {
      const isFedpaReal = selectedPlan?._isReal && (selectedPlan?._isFEDPA || selectedPlan?.insurerName?.includes('FEDPA'));
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');

      if (!emissionData) throw new Error('Faltan datos del asegurado');

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
      if (!isMaster && pfCardData) {
        setEmissionProgress(2);
        setEmissionStep('Procesando pago con tarjeta...');

        const chargeAmount = selectedPaymentMode === 'cuotas'
          ? selectedInstallmentAmount
          : (selectedPlan.annualPremium || 0);

        const chargeRes = await fetch('/api/paguelofacil/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: chargeAmount,
            description: `Póliza DT - ${selectedPlan?.insurerName || 'Seguro'} - ${emissionData.primerNombre} ${emissionData.primerApellido}`,
            concept: `Prima ${selectedPaymentMode === 'cuotas' ? 'cuota 1/' + selectedInstallmentsCount : 'contado'} - Daños a Terceros`,
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
        if (selectedPaymentMode === 'cuotas' && selectedInstallmentsCount > 1 && pfCodOper) {
          setEmissionStep('Registrando pagos recurrentes...');
          try {
            const recRes = await fetch('/api/paguelofacil/recurrent', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                codOper: pfCodOper,
                amount: selectedInstallmentAmount,
                description: `Póliza DT - ${selectedPlan?.insurerName || 'Seguro'} - ${emissionData.primerNombre} ${emissionData.primerApellido}`,
                concept: `Cuota recurrente - Daños a Terceros`,
                email: emissionData.email,
                phone: emissionData.celular || emissionData.telefono,
                totalInstallments: selectedInstallmentsCount,
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

      setEmissionProgress(5);
      setEmissionStep('Validando información del vehículo...');

      // ═══════════════════════════════════════════════════════
      // EMISIÓN FEDPA — Daños a Terceros
      // ═══════════════════════════════════════════════════════
      if (isFedpaReal) {
        // Get idCotizacion from sessionStorage
        const tpQuoteRaw = sessionStorage.getItem('thirdPartyQuote');
        const tpQuote = tpQuoteRaw ? JSON.parse(tpQuoteRaw) : null;

        const emisionCommon = {
          IdCotizacion: tpQuote?.idCotizacion || '',
          Plan: selectedPlan._planCode || 1000,
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
          Ocupacion: buscarOcupacion(emissionData.actividadEconomica).codigo,
          sumaAsegurada: 0,
          Uso: '10',
          Marca: vehicleData?.marcaCodigo || selectedPlan._marcaCodigo || quoteData?.marcaCodigo || quoteData?.marca || '',
          Modelo: vehicleData?.modeloCodigo || selectedPlan._modeloCodigo || quoteData?.modeloCodigo || quoteData?.modelo || '',
          MarcaNombre: vehicleData?.marca || selectedPlan._marcaNombre || quoteData?.marca || '',
          ModeloNombre: vehicleData?.modelo || selectedPlan._modeloNombre || quoteData?.modelo || '',
          Ano: (vehicleData?.anio || quoteData?.anno || quoteData?.anio || quoteData?.ano || new Date().getFullYear()).toString(),
          Motor: vehicleData?.motor || '',
          Placa: vehicleData?.placa || '',
          Vin: vehicleData?.vinChasis || '',
          Color: vehicleData?.color || '',
          Pasajero: vehicleData?.pasajeros || 5,
          Puerta: vehicleData?.puertas || 4,
          PrimaTotal: selectedPlan.annualPremium, // Always contado price — FedPa calculates cuotas surcharge internally
          cantidadPago: selectedPaymentMode === 'cuotas' ? 2 : 1,
        };

        let emisionResult: any = null;
        const usedMethod = 'emisor_plan';

        // ── EmisorPlan (2024): upload docs → emitirpoliza ──
        // DT uses EmisorPlan API (token-based, separate doc upload + emission).
        // CC uses Emisor Externo API (multipart with get_cotizacion → get_nropoliza_emitir → crear_poliza).
        setEmissionProgress(15);
        setEmissionStep('Subiendo documentos a la aseguradora...');
        const docsFormData = new FormData();
        docsFormData.append('environment', 'PROD');
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

        const docsResponseData = await docsResponse.json();
        const isTokenBlocked = docsResponse.status === 424 || docsResponseData.code === 'TOKEN_NOT_AVAILABLE';

        if (isTokenBlocked) {
          throw new Error(
            'El token de FEDPA está bloqueado temporalmente (~50 min). ' +
            'Por favor intente nuevamente en unos minutos. ' +
            'Si el problema persiste, contacte a soporte.'
          );
        }

        if (!docsResponse.ok || !docsResponseData.success) {
          throw new Error(docsResponseData.error || 'Error subiendo documentos');
        }

        console.log('[EMISIÓN DT FEDPA] Documentos subidos (EmisorPlan):', docsResponseData.idDoc);
        setEmissionProgress(35);
        setEmissionStep('Emitiendo póliza con FEDPA...');
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: 'PROD',
            ...emisionCommon,
            idDoc: docsResponseData.idDoc,
            ...(isMaster && masterBrokerId ? { masterBrokerId } : {}),
          }),
        });
        const emisionResponseData = await emisionResponse.json();

        if (!emisionResponse.ok || !emisionResponseData.success) {
          if (emisionResponse.status === 424 || emisionResponseData.code === 'TOKEN_NOT_AVAILABLE') {
            throw new Error(
              'El token de FEDPA expiró durante la emisión. ' +
              'Por favor intente nuevamente en unos minutos.'
            );
          }
          throw new Error(emisionResponseData.error || 'Error emitiendo póliza');
        }

        emisionResult = emisionResponseData;

        // Save the emission payload for carátula download on confirmation page
        try {
          sessionStorage.setItem('fedpaEmissionPayload', JSON.stringify({
            ...emisionCommon,
            idDoc: docsResponseData.idDoc,
          }));
        } catch { /* quota */ }

        console.log(`[EMISIÓN DT FEDPA] Póliza emitida (${usedMethod}):`, emisionResult.nroPoliza || emisionResult.poliza);
        setEmissionProgress(60);
        setEmissionStep('Póliza emitida — guardando en sistema...');

        // ═══ ADM COT: Track successful FEDPA DT emission ═══
        const tFedpa = getTrackingInfo();
        trackQuoteEmitted({
          quoteRef: tFedpa.quoteRef,
          insurer: 'FEDPA',
          policyNumber: emisionResult.nroPoliza || emisionResult.poliza,
          clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(),
          cedula: emissionData.cedula,
          email: emissionData.email,
          phone: emissionData.telefono || emissionData.celular,
        });
        
        // ═══ ADM COT: Auto-create pending payment + recurrence (skip for master) ═══
        // FEDPA DT: cantidadPago=2 means "mensual 10 pagos" in the insurer's system,
        // but the client pays via PF on their chosen schedule (e.g. 2 cuotas semestrales).
        if (!isMaster) {
          const isFedpaCuotasMismatch = selectedPaymentMode === 'cuotas' && selectedInstallmentsCount !== 10;
          createPaymentOnEmission({
          insurer: 'FEDPA',
          policyNumber: emisionResult.nroPoliza || emisionResult.poliza || '',
          insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          totalPremium: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
          installments: selectedInstallmentsCount,
          ramo: 'AUTO',
          cobertura: 'TERCEROS',
          pfCodOper,
          pfRecCodOper,
          pfCardType,
          pfCardDisplay,
            insurerPaymentPlan: selectedPaymentMode === 'cuotas' ? {
              insurerCuotas: 10,
              insurerFrequency: 'MENSUAL',
              clientCuotas: selectedInstallmentsCount,
              mismatch: isFedpaCuotasMismatch,
            } : undefined,
          });
        }

        // ═══ ENVIAR BIENVENIDA AL CLIENTE POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const welcomeForm = new FormData();
          welcomeForm.append('tipoCobertura', 'DT');
          welcomeForm.append('environment', 'development');
          welcomeForm.append('nroPoliza', emisionResult.nroPoliza || emisionResult.poliza || '');
          welcomeForm.append('insurerName', 'FEDPA Seguros');
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
          
          welcomeForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca || vehicleData?.marca || '',
            modelo: quoteData?.modelo || vehicleData?.modelo || '',
            anio: quoteData?.anio || quoteData?.anno || vehicleData?.anio || '',
            valorVehiculo: quoteData?.valorVehiculo || 0,
            cobertura: 'Daños a Terceros',
            primaTotal: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
            primaContado: selectedPlan.annualPremium || 0,
            formaPago: selectedPaymentMode,
            cantidadCuotas: selectedPaymentMode === 'cuotas' ? selectedInstallmentsCount : 1,
            montoCuota: selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : undefined,
            // Insurer payment plan mismatch info for welcome email
            insurerPaymentPlan: selectedPaymentMode === 'cuotas' && selectedInstallmentsCount !== 10 ? {
              insurerCuotas: 10,
              insurerFrequency: 'mensual',
              clientCuotas: selectedInstallmentsCount,
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
          if (signatureRef.current) {
            welcomeForm.append('firmaDataUrl', signatureRef.current);
          }

          console.log('[FEDPA DT EXPEDIENTE] Docs enviados:', {
            cedulaFile: emissionData.cedulaFile ? `${emissionData.cedulaFile.name} (${emissionData.cedulaFile.size}b)` : 'NO',
            licenciaFile: emissionData.licenciaFile ? `${emissionData.licenciaFile.name} (${emissionData.licenciaFile.size}b)` : 'NO',
            registroVehicular: vehicleData?.registroVehicular ? `${vehicleData.registroVehicular.name} (${vehicleData.registroVehicular.size}b)` : 'NO',
            firmaDataUrl: signatureRef.current ? `${signatureRef.current.length} chars` : 'NO',
            clientId: emisionResult.clientId || 'NO',
            policyId: emisionResult.policyId || 'NO',
          });
          
          const welcomeResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: welcomeForm,
          });
          const welcomeResult = await welcomeResponse.json();
          if (welcomeResult.emails?.allOk) {
            console.log('[FEDPA DT] ✅ Emails enviados. Portal:', welcomeResult.emails.portal.ok, '| Bienvenida:', welcomeResult.emails.welcome.ok);
          } else if (welcomeResult.success) {
            console.warn('[FEDPA DT] ⚠️ Correos fallaron:', JSON.stringify(welcomeResult.emails));
          } else {
            console.error('[FEDPA DT] Error expediente:', welcomeResult.error);
          }
        } catch (welcomeErr: any) {
          console.error('[FEDPA DT] Error enviando bienvenida:', welcomeErr);
        }

        setEmissionProgress(92);
        setEmissionStep('Preparando confirmación...');
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza || emisionResult.poliza,
          insurer: 'FEDPA Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          amb: emisionResult.amb || 'PROD',
          codCotizacion: emisionResult.cotizacion,
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${quoteData?.anno || quoteData?.anio || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : selectedPlan.annualPremium,
          primaContado: selectedPlan.annualPremium,
          formaPago: selectedPaymentMode,
          cantidadCuotas: selectedPaymentMode === 'cuotas' ? 2 : 1,
          montoCuota: selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : undefined,
          tipoCobertura: 'Daños a Terceros',
          method: usedMethod,
        }));
        sessionStorage.removeItem('thirdPartyQuote');
        sessionStorage.removeItem('selectedQuote');
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');

      // ═══════════════════════════════════════════════════════
      // EMISIÓN INTERNACIONAL — Daños a Terceros
      // ═══════════════════════════════════════════════════════
      } else if (isInternacionalReal) {
        console.log('[EMISIÓN DT INTERNACIONAL] Iniciando emisión con API real...');
        setEmissionProgress(15);
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
            // Vehículo
            vcodmarca: vehicleData?.marcaCodigo || selectedPlan._vcodmarca,
            vmarca_label: vehicleData?.marca || quoteData?.marca,
            vcodmodelo: vehicleData?.modeloCodigo || selectedPlan._vcodmodelo,
            vmodelo_label: vehicleData?.modelo || quoteData?.modelo,
            vanioauto: vehicleData?.anio || quoteData?.anio || quoteData?.anno || new Date().getFullYear(),
            vsumaaseg: 0, // DT no tiene suma asegurada
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
            formaPago: 1, // DT = contado
            cantCuotas: 1,
            tipo_cobertura: 'Daños a Terceros',
            ...(isMaster && masterBrokerId ? { masterBrokerId } : {}),
          }),
        });

        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          const errMsg = errorData.error || 'Error al emitir póliza';
          if (errMsg.includes('ya fue emitida') || errMsg.includes('nueva cotización')) {
            sessionStorage.removeItem('selectedQuote');
            sessionStorage.removeItem('thirdPartyQuote');
            toast.error('Esta cotización ya fue emitida. Debe generar una nueva cotización.');
            router.push('/cotizadores');
            return;
          }
          throw new Error(errMsg);
        }

        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          const errMsg = emisionResult.error || 'Error al emitir póliza';
          if (errMsg.includes('ya fue emitida') || errMsg.includes('nueva cotización')) {
            sessionStorage.removeItem('selectedQuote');
            sessionStorage.removeItem('thirdPartyQuote');
            toast.error('Esta cotización ya fue emitida. Debe generar una nueva cotización.');
            router.push('/cotizadores');
            return;
          }
          throw new Error(errMsg);
        }

        // ═══ Prefix IS policy number with 1-30- ═══
        emisionResult.nroPoliza = formatISPolicyNumber(emisionResult.nroPoliza);
        console.log('[EMISIÓN DT INTERNACIONAL] Póliza emitida:', emisionResult.nroPoliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');

        // ═══ ADM COT: Track successful IS DT emission ═══
        const tIs = getTrackingInfo();
        trackQuoteEmitted({
          quoteRef: tIs.quoteRef,
          insurer: 'INTERNACIONAL',
          policyNumber: emisionResult.nroPoliza,
          clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(),
          cedula: emissionData.cedula,
          email: emissionData.email,
          phone: emissionData.telefono || emissionData.celular,
        });

        // ═══ ADM COT: Auto-create pending payment + recurrence (skip for master) ═══
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'INTERNACIONAL',
            policyNumber: emisionResult.nroPoliza || '',
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: selectedPlan.annualPremium || 0,
            installments: 1,
            ramo: 'AUTO',
            cobertura: 'TERCEROS',
          });
        }

        // ═══ ENVIAR EXPEDIENTE Y BIENVENIDA POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', 'DT');
          expedienteForm.append('environment', 'development');
          expedienteForm.append('nroPoliza', emisionResult.nroPoliza || '');
          expedienteForm.append('pdfUrl', emisionResult.pdfUrl || '');
          expedienteForm.append('insurerName', 'Internacional de Seguros');
          expedienteForm.append('firmaDataUrl', signatureRef.current || '');
          if (emisionResult.clientId) expedienteForm.append('clientId', emisionResult.clientId);
          if (emisionResult.policyId) expedienteForm.append('policyId', emisionResult.policyId);
          
          // IS inspection data from sessionStorage (defaults for DT: no extras, buenEstadoFisico=true)
          const isInspData = sessionStorage.getItem('isInspectionData');
          if (isInspData) {
            expedienteForm.append('inspectionData', isInspData);
          }
          
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
          
          expedienteForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca || vehicleData?.marca || '',
            modelo: quoteData?.modelo || vehicleData?.modelo || '',
            anio: quoteData?.anio || quoteData?.anno || vehicleData?.anio || '',
            valorVehiculo: quoteData?.valorVehiculo || 0,
            tipoVehiculo: quoteData?.tipoVehiculo || 'SEDAN',
            cobertura: 'Daños a Terceros',
            primaTotal: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
            primaContado: selectedPlan.annualPremium || 0,
            formaPago: selectedPaymentMode,
            cantidadCuotas: selectedPaymentMode === 'cuotas' ? selectedInstallmentsCount : 1,
            montoCuota: selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : undefined,
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
          
          const expedienteResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: expedienteForm,
          });
          
          const expedienteResult = await expedienteResponse.json();
          if (expedienteResult.emails?.allOk) {
            console.log('[IS EXPEDIENTE DT] ✅ Emails enviados:', JSON.stringify(expedienteResult.emails));
            toast.success('Expediente y confirmación enviados por correo');
          } else if (expedienteResult.success) {
            console.warn('[IS EXPEDIENTE DT] ⚠️ Correos fallaron:', JSON.stringify(expedienteResult.emails));
            toast.warning('Póliza emitida pero hubo un error enviando los correos');
          } else {
            console.error('[IS EXPEDIENTE DT] Error:', expedienteResult.error);
            toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
          }
        } catch (expError: any) {
          console.error('[IS EXPEDIENTE DT] Error enviando expediente:', expError);
          toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
        }

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
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan.annualPremium,
          planType: selectedPlan.planType,
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
          tipoCobertura: 'Daños a Terceros',
        }));

        // Limpiar cotización usada para evitar re-emisión con idPv stale
        sessionStorage.removeItem('selectedQuote');
        sessionStorage.removeItem('thirdPartyQuote');
        
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');

      // ═══════════════════════════════════════════════════════
      // EMISIÓN REGIONAL — Daños a Terceros
      // ═══════════════════════════════════════════════════════
      } else if (selectedPlan?._isReal && (selectedPlan?.isREGIONAL || selectedPlan?.insurerName?.includes('Regional'))) {
        console.log('[EMISIÓN DT REGIONAL] Iniciando emisión con API real...');
        setEmissionProgress(15);
        setEmissionStep('Conectando con La Regional de Seguros...');

        const tpQuoteRaw = sessionStorage.getItem('thirdPartyQuote');
        const tpQuote = tpQuoteRaw ? JSON.parse(tpQuoteRaw) : null;

        // Parse cedula parts (formato panameño: P-T-A o PE-T-A)
        const cedulaParts = (emissionData.cedula || '').split('-');
        let cedulaProv: number | null = null;
        let cedulaLetra: string | null = null;
        let cedulaTomo: number | null = null;
        let cedulaAsiento: number | null = null;
        if (cedulaParts.length >= 3) {
          const first = cedulaParts[0] || '';
          if (/^\d+$/.test(first)) {
            cedulaProv = parseInt(first);
          } else {
            cedulaLetra = first || null;
          }
          cedulaTomo = parseInt(cedulaParts[1] || '') || null;
          cedulaAsiento = parseInt(cedulaParts[2] || '') || null;
        }

        const emisionResponse = await fetch('/api/regional/auto/emit-rc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan: tpQuote?.planCode || selectedPlan._planCode || '',
            nombre: emissionData.primerNombre,
            apellido: `${emissionData.primerApellido} ${emissionData.segundoApellido || ''}`.trim(),
            fechaNacimiento: emissionData.fechaNacimiento,
            edad: emissionData.fechaNacimiento
              ? Math.floor((Date.now() - new Date(emissionData.fechaNacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : 35,
            sexo: emissionData.sexo === 'M' ? 'M' : 'F',
            edocivil: emissionData.estadoCivil === 'casado' ? 'C' : 'S',
            telefono: emissionData.telefono,
            celular: emissionData.celular || emissionData.telefono,
            email: emissionData.email,
            // Dirección
            codpais: 507,
            codestado: emissionData.codProvincia || 8,
            codciudad: emissionData.codDistrito || 1,
            codmunicipio: emissionData.codCorregimiento || 1,
            codurb: emissionData.codUrbanizacion || 1,
            dirhab: emissionData.direccion || 'Ciudad de Panamá',
            // Identificación
            tppersona: 'N',
            tpodoc: 'C',
            prov: cedulaProv,
            letra: cedulaLetra,
            tomo: cedulaTomo,
            asiento: cedulaAsiento,
            // Vehículo
            codmarca: vehicleData?.marcaCodigo || selectedPlan._vcodmarca || 74,
            codmodelo: vehicleData?.modeloCodigo || selectedPlan._vcodmodelo || 1,
            marca: vehicleData?.marca || quoteData?.marca || '',   // Brand name for IS→Regional normalization
            modelo: vehicleData?.modelo || quoteData?.modelo || '', // Model name for IS→Regional normalization
            anio: vehicleData?.anio || quoteData?.anio || quoteData?.anno || new Date().getFullYear(),
            numplaca: vehicleData?.placa || '',
            serialcarroceria: vehicleData?.vinChasis || '',
            serialmotor: vehicleData?.motor || '',
            color: vehicleData?.color || '',
            // Conductor habitual (same as client)
            condHabNombre: emissionData.primerNombre,
            condHabApellido: `${emissionData.primerApellido} ${emissionData.segundoApellido || ''}`.trim(),
            condHabSexo: emissionData.sexo === 'M' ? 'M' : 'F',
            condHabEdocivil: emissionData.estadoCivil === 'casado' ? 'C' : 'S',
            ...(isMaster && masterBrokerId ? { masterBrokerId } : {}),
          }),
        });

        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          throw new Error(errorData.error || 'Error al emitir póliza REGIONAL');
        }

        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          throw new Error(emisionResult.error || 'Error al emitir póliza REGIONAL');
        }

        console.log('[EMISIÓN DT REGIONAL] Póliza emitida:', emisionResult.poliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');

        // ═══ ADM COT: Track successful REGIONAL DT emission ═══
        const tRegional = getTrackingInfo();
        trackQuoteEmitted({
          quoteRef: tRegional.quoteRef,
          insurer: 'REGIONAL',
          policyNumber: emisionResult.poliza,
          clientName: `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim(),
          cedula: emissionData.cedula,
          email: emissionData.email,
          phone: emissionData.telefono || emissionData.celular,
        });

        // ═══ ADM COT: Auto-create pending payment + recurrence (skip for master) ═══
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'REGIONAL',
            policyNumber: emisionResult.poliza || '',
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: selectedPlan.annualPremium || 0,
            installments: 1,
            ramo: 'AUTO',
            cobertura: 'TERCEROS',
          });
        }

        // ═══ ENVIAR EXPEDIENTE Y BIENVENIDA POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', 'DT');
          expedienteForm.append('environment', 'development');
          const regionalPoliza = emisionResult.poliza || '';
          expedienteForm.append('nroPoliza', regionalPoliza);
          expedienteForm.append('insurerName', 'La Regional de Seguros');
          expedienteForm.append('firmaDataUrl', signatureRef.current || '');
          if (regionalPoliza) expedienteForm.append('pdfUrl', `/api/regional/auto/print?poliza=${encodeURIComponent(regionalPoliza)}`);
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
          }));

          expedienteForm.append('vehicleData', JSON.stringify({
            placa: vehicleData?.placa,
            vinChasis: vehicleData?.vinChasis,
            motor: vehicleData?.motor,
            color: vehicleData?.color,
            marca: vehicleData?.marca || quoteData?.marca || '',
            modelo: vehicleData?.modelo || quoteData?.modelo || '',
            anio: vehicleData?.anio || quoteData?.anio || quoteData?.anno || '',
          }));

          expedienteForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca || vehicleData?.marca || '',
            modelo: quoteData?.modelo || vehicleData?.modelo || '',
            anio: quoteData?.anio || quoteData?.anno || vehicleData?.anio || '',
            cobertura: 'Daños a Terceros',
            primaTotal: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
            primaContado: selectedPlan.annualPremium || 0,
            formaPago: selectedPaymentMode,
            cantidadCuotas: selectedPaymentMode === 'cuotas' ? selectedInstallmentsCount : 1,
            montoCuota: selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : undefined,
          }));

          if (emissionData.cedulaFile) expedienteForm.append('cedulaFile', emissionData.cedulaFile);
          if (emissionData.licenciaFile) expedienteForm.append('licenciaFile', emissionData.licenciaFile);
          if (vehicleData?.registroVehicular) expedienteForm.append('registroVehicularFile', vehicleData.registroVehicular);

          const expedienteResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: expedienteForm,
          });
          const expedienteResult = await expedienteResponse.json();
          if (expedienteResult.emails?.allOk) {
            console.log('[REGIONAL EXPEDIENTE DT] ✅ Emails enviados:', JSON.stringify(expedienteResult.emails));
          } else if (expedienteResult.success) {
            console.warn('[REGIONAL EXPEDIENTE DT] ⚠️ Correos fallaron:', JSON.stringify(expedienteResult.emails));
          } else {
            console.warn('[REGIONAL EXPEDIENTE DT] Error:', expedienteResult.error);
          }
        } catch (expError: any) {
          console.warn('[REGIONAL EXPEDIENTE DT] Error enviando expediente:', expError);
        }

        setEmissionProgress(92);
        setEmissionStep('Preparando confirmación...');
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.poliza,
          insurer: 'La Regional de Seguros',
          regionalPoliza: emisionResult.poliza,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan.annualPremium,
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
          tipoCobertura: 'Daños a Terceros',
        }));

        sessionStorage.removeItem('selectedQuote');
        sessionStorage.removeItem('thirdPartyQuote');
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');

      // ═══════════════════════════════════════════════════════
      // EMISIÓN ANCON — Daños a Terceros
      // ═══════════════════════════════════════════════════════
      } else if (selectedPlan?._isReal && (selectedPlan?.isANCON || selectedPlan?.insurerName?.includes('ANCÓN') || selectedPlan?.insurerName?.includes('Ancon'))) {
        console.log('[EMISIÓN DT ANCON] Iniciando emisión con API real...');
        setEmissionProgress(15);
        setEmissionStep('Conectando con ANCÓN Seguros...');

        const tpQuoteRaw2 = sessionStorage.getItem('thirdPartyQuote');
        const tpQuote2 = tpQuoteRaw2 ? JSON.parse(tpQuoteRaw2) : null;
        const noCotizacion = selectedPlan._idCotizacion || tpQuote2?.idCotizacion || '';

        if (!noCotizacion) {
          throw new Error('No se encontró número de cotización ANCON');
        }

        setEmissionProgress(20);
        setEmissionStep('Subiendo documentos...');

        // Map nivelIngresos portal label → ANCON-friendly label for solicitud PDF
        const nivelIngresoMap: Record<string, string> = {
          'menos de 10mil': 'Menos de $10,000',
          '10mil a 30mil':  'De $10,000 a $30,000',
          '30mil a 50mil':  'De $30,000 a $50,000',
          'mas de 50mil':   'Más de $50,000',
        };
        const nivelIngresoLabel = nivelIngresoMap[emissionData.nivelIngresos || ''] || emissionData.nivelIngresos || '';

        // Map optionName (opcion1-opcion4) → ANCON opcion letter (A-D)
        const opcionLetterMap: Record<string, string> = {
          opcion1: 'A', opcion2: 'B', opcion3: 'C', opcion4: 'D',
        };
        const anconOpcion = opcionLetterMap[selectedPlan?.optionName || ''] || 'A';

        // ── Ensure plan is loaded from current third-party selection ──
        // Fallback to old values (07159 / WEB-AUTORC) is no longer allowed.
        if (!selectedPlan?._codProducto) {
          throw new Error('Invalid plan selection. Please reload the third-party comparison page and select a plan.');
        }

        const anconEmitBody = {
          no_cotizacion: noCotizacion,
          opcion: anconOpcion,
          cod_producto: selectedPlan._codProducto,
          nombre_producto: selectedPlan._nombreProducto || '',
          suma_asegurada: String(selectedPlan?._sumaAsegurada || '0'),
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
          cod_marca_agt: '',  // resolved server-side from nombre_marca
          nombre_marca: vehicleData?.marca || '',
          cod_modelo_agt: '',  // resolved server-side from nombre_modelo
          nombre_modelo: vehicleData?.modelo || '',
          placa: vehicleData?.placa || '',
          no_chasis: vehicleData?.vinChasis || '',
          vin: vehicleData?.vinChasis || '',
          no_motor: vehicleData?.motor || '',
          ano: String(vehicleData?.anio || quoteData?.anio || quoteData?.anno || new Date().getFullYear()),
          cantidad_de_pago: '1',
          nacionalidad: emissionData.nacionalidad || 'PANAMA',
          pep: '0',
          // Extra fields for Solicitud de Seguros PDF
          estado_civil: emissionData.estadoCivil || '',
          // ANCON catalog codes (selected by user from ListaOcupacion / ListaProfesion dropdowns)
          ocupacion: emissionData.anconOcupacion || '',
          profesion: emissionData.anconProfesion || '',
          actividad_economica: '',
          empresa: emissionData.dondeTrabaja || '',
          nivel_ingreso: nivelIngresoLabel,
        };

        // Build FormData with emission data + documents + firma
        const anconForm = new FormData();
        anconForm.append('emissionData', JSON.stringify(anconEmitBody));

        // Master broker override
        if (isMaster && masterBrokerId) {
          anconForm.append('masterBrokerId', masterBrokerId);
        }

        // Firma digital para la Solicitud de Seguros PDF
        if (signatureRef.current) {
          anconForm.append('firmaDataUrl', signatureRef.current);
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

        setEmissionProgress(30);
        setEmissionStep('Emitiendo póliza ANCON...');

        const anconEmisionResponse = await fetch('/api/ancon/emision', {
          method: 'POST',
          body: anconForm,
        });

        if (!anconEmisionResponse.ok && anconEmisionResponse.status === 413) {
          throw new Error('Los archivos adjuntos son demasiado grandes. Intente con imágenes de menor tamaño (menos de 5 MB en total).');
        }

        let anconEmisionResult: Record<string, any>;
        try {
          anconEmisionResult = await anconEmisionResponse.json();
        } catch {
          throw new Error(`Error del servidor ANCÓN (${anconEmisionResponse.status}). Intente nuevamente.`);
        }

        if (!anconEmisionResult.success) {
          throw new Error(anconEmisionResult.error || 'Error al emitir póliza ANCON');
        }

        console.log('[EMISIÓN DT ANCON] Póliza emitida:', anconEmisionResult.poliza);
        setEmissionProgress(55);
        setEmissionStep('Póliza emitida — guardando en sistema...');

        // ═══ ADM COT: Track ANCON DT emission ═══
        const tAncon = getTrackingInfo();
        trackQuoteEmitted({
          quoteRef: tAncon.quoteRef,
          insurer: 'ANCON',
          policyNumber: anconEmisionResult.poliza,
          clientName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
        });

        // ═══ ADM COT: Auto-create pending payment (skip for master) ═══
        if (!isMaster) {
          createPaymentOnEmission({
            insurer: 'ANCON',
            policyNumber: anconEmisionResult.poliza,
            insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
            cedula: emissionData.cedula,
            totalPremium: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
            installments: selectedInstallmentsCount,
            ramo: 'AUTO',
            cobertura: 'TERCEROS',
          });
        }

        // ═══ ENVIAR EXPEDIENTE Y BIENVENIDA POR CORREO ═══
        setEmissionProgress(75);
        setEmissionStep('Enviando expediente y bienvenida por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', 'DT');
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
            cobertura: 'Daños a Terceros',
            primaTotal: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
            primaContado: selectedPlan.annualPremium || 0,
            formaPago: selectedPaymentMode,
            cantidadCuotas: selectedPaymentMode === 'cuotas' ? selectedInstallmentsCount : 1,
            montoCuota: selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : undefined,
          }));

          if (emissionData.cedulaFile) expedienteForm.append('cedulaFile', emissionData.cedulaFile);
          if (emissionData.licenciaFile) expedienteForm.append('licenciaFile', emissionData.licenciaFile);
          if (vehicleData?.registroVehicular) expedienteForm.append('registroVehicularFile', vehicleData.registroVehicular);

          const expedienteResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: expedienteForm,
          });
          const expedienteResult = await expedienteResponse.json();
          if (expedienteResult.emails?.allOk) {
            console.log('[ANCON DT] ✅ Emails enviados:', JSON.stringify(expedienteResult.emails));
          } else if (expedienteResult.success) {
            console.warn('[ANCON DT] ⚠️ Correos fallaron:', JSON.stringify(expedienteResult.emails));
          } else {
            console.warn('[ANCON DT] Error expediente:', expedienteResult.error);
          }
        } catch (expError: any) {
          console.warn('[ANCON DT] Error enviando expediente:', expError);
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
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPaymentMode === 'cuotas' ? selectedInstallmentsTotal : (selectedPlan.annualPremium || 0),
          primaContado: selectedPlan.annualPremium,
          formaPago: selectedPaymentMode,
          cantidadCuotas: selectedPaymentMode === 'cuotas' ? selectedInstallmentsCount : 1,
          montoCuota: selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : undefined,
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
          tipoCobertura: 'Daños a Terceros',
        }));

        sessionStorage.removeItem('selectedQuote');
        sessionStorage.removeItem('thirdPartyQuote');
        setEmissionProgress(100);
        setEmissionStep('¡Emisión completada!');

      // ═══════════════════════════════════════════════════════
      // OTRAS ASEGURADORAS — Flujo simulado (futuras integraciones)
      // ═══════════════════════════════════════════════════════
      } else {
        console.log('[EMISIÓN DT] Flujo simulado para:', selectedPlan?.insurerName);
        await new Promise(resolve => setTimeout(resolve, 2000));

        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: `DEMO-${Date.now()}`,
          insurer: selectedPlan?.insurerName || 'Demo',
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${quoteData?.anio || quoteData?.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan?.annualPremium,
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
          tipoCobertura: 'Daños a Terceros',
          isDemo: true,
        }));

        toast.success('Póliza emitida exitosamente (Demo)');
        router.push('/cotizadores/confirmacion');
      }
    } catch (error: any) {
      console.error('Error emitiendo:', error);
      setEmissionError(error.message || 'Error al emitir la póliza');
      // ═══ ADM COT: Track DT emission failure ═══
      const tFail = getTrackingInfo();
      trackQuoteFailed({
        quoteRef: tFail.quoteRef,
        insurer: tFail.insurer,
        errorMessage: error.message,
        lastStep: step,
        clientName: emissionData ? `${emissionData.primerNombre || ''} ${emissionData.primerApellido || ''}`.trim() : undefined,
        cedula: emissionData?.cedula || undefined,
        email: emissionData?.email || undefined,
        phone: emissionData?.telefono || emissionData?.celular || undefined,
      });
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
      const tInfo = getTrackingInfo();
      const insurerName = tInfo.insurer === 'FEDPA' ? 'FEDPA Seguros' : tInfo.insurer === 'REGIONAL' ? 'La Regional de Seguros' : (selectedPlan?.insurerName || 'Aseguradora');

      const reportBody: Record<string, any> = {
        insurerName,
        ramo: 'AUTO',
        cobertura: 'DT',
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
        } : {},
        vehicleData: vehicleData ? {
          placa: vehicleData.placa,
          vinChasis: vehicleData.vinChasis,
          motor: vehicleData.motor,
          color: vehicleData.color,
          marca: vehicleData.marca || quoteData?.marca,
          modelo: vehicleData.modelo || quoteData?.modelo,
          anio: vehicleData.anio || quoteData?.anno || quoteData?.anio,
        } : {},
        quoteData: {
          numcot: selectedPlan?._numcot || selectedPlan?._idCotizacion,
          planType: selectedPlan?.planType,
          annualPremium: selectedPlan?.annualPremium,
        },
        paymentData: {
          pfCodOper: pfCardData ? 'charged' : undefined,
          pfCardType: pfCardData?.brand,
          pfCardDisplay: pfCardData?.cardNumber ? `****${pfCardData.cardNumber.slice(-4)}` : undefined,
          amount: selectedPlan?.annualPremium || 0,
          installments: 1,
        },
        emissionError: emissionError || 'Error desconocido',
        expedienteDocs: {
          cedula: 'requerida',
          licencia: 'requerida',
          registroVehicular: 'requerido',
          debidaDiligencia: 'requerida',
        },
      };

      const res = await fetch('/api/operaciones/emission-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportBody),
      });

      const result = await res.json();
      if (!result.success) {
        console.error('[EMISSION REPORT DT] Failed:', result.error);
      } else {
        console.log('[EMISSION REPORT DT] Caso creado:', result.ticket);
      }
    } catch (err) {
      console.error('[EMISSION REPORT DT] Error:', err);
    }
  };

  const handleEmissionModalComplete = () => {
    setShowEmissionModal(false);
    router.push('/cotizadores/confirmacion');
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

  // ─── STEP 1: DATOS DEL CLIENTE (incluye cédula y licencia) ───
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
          <EmissionDataForm
            quoteData={{ ...quoteData, insurerName: selectedPlan?.insurerName }}
            onContinue={handleEmissionDataComplete}
            showAcreedor={false}
          />
        </div>
      </div>
    );
  }

  // ─── STEP 2: DATOS DEL VEHÍCULO ───
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
            isInternacional={!!(selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL'))}
            isThirdPartyMode
          />
        </div>
      </div>
    );
  }

  // ─── STEP 3: INFORMACIÓN DE PAGO ───
  if (step === 'payment-info') {
    const amount = selectedPaymentMode === 'cuotas' ? selectedInstallmentAmount : selectedPlan.annualPremium;

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
                {isMaster ? 'Emisión Master' : 'Información de Pago'}
              </h2>
              <p className="text-gray-600">
                {isMaster ? 'La emisión master no requiere pago con tarjeta' : 'Completa los datos de tu tarjeta para procesar el pago'}
              </p>
            </div>

            <div className="bg-gradient-to-r from-[#010139] to-[#020270] rounded-2xl p-6 mb-6 text-white shadow-2xl">
              <div className="text-center">
                <div className="text-sm opacity-80 mb-1">
                  {selectedPaymentMode === 'cuotas' ? `${selectedInstallmentsCount} Cuotas de:` : 'Pago Único'}
                </div>
                <div className="text-4xl sm:text-5xl font-bold mb-2">
                  ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                {selectedPaymentMode === 'cuotas' && (
                  <div className="text-xs opacity-70">
                    Total: ${selectedInstallmentsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            </div>

            {isMaster ? (
              <div className="flex flex-col items-center justify-center gap-4 p-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 min-h-40">
                <FaLock className="text-4xl text-blue-600" />
                <p className="text-lg font-bold text-[#010139]">Usuario master detectado</p>
                <p className="text-sm text-gray-600 text-center">La emisión no requiere pago con tarjeta.<br/>Presiona Continuar para ir al resumen.</p>
              </div>
            ) : (
              <>
                <CreditCardInput
                  onTokenReceived={handlePaymentTokenReceived}
                  onCardDataReady={handleCardDataReady}
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
              </>
            )}

            <div className="mt-6">
              <button
                onClick={() => {
                  if (isMaster) {
                    setCompletedSteps(prev => [...prev.filter(s => s !== 'payment-info'), 'payment-info']);
                  }
                  goToStep('review');
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

  // ─── STEP 4: RESUMEN Y CONFIRMACIÓN (con declaración de veracidad) ───
  if (step === 'review') {
    const isInternacionalDT = !!(selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL'));

    const handleEmitClick = () => {
      if (isMaster && !masterBrokerId) {
        toast.error('Por favor, asigna un corredor antes de emitir');
        return;
      }
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
      setTimeout(() => handleConfirmEmission(), 300);
    };

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
                      {selectedPaymentMode === 'cuotas'
                        ? `${selectedInstallmentsCount} cuotas de B/.${selectedInstallmentAmount.toFixed(2)} (Total B/.${selectedInstallmentsTotal.toFixed(2)})`
                        : `Contado B/.${selectedPlan.annualPremium?.toFixed(2)}`}
                      {cardData && ` • ${cardData.brand} ****${cardData.last4}`}
                    </p>
                  </div>
                </div>
              </div>

              {hasFedpaInstallments && (
                <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-[#8AAA19]">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Forma de Pago Seleccionada</h6>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handlePaymentModeChange('contado')}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedPaymentMode === 'contado'
                          ? 'border-[#8AAA19] bg-[#f6fbe8] shadow-md'
                          : 'border-gray-300 bg-gray-50 hover:border-[#8AAA19]'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Al contado</p>
                      <p className="text-2xl font-black text-[#010139]">B/.{selectedPlan.annualPremium?.toFixed(2)}</p>
                      <p className="text-xs text-gray-600">Pago único</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePaymentModeChange('cuotas')}
                      className={`text-left p-4 rounded-xl border-2 transition-all ${
                        selectedPaymentMode === 'cuotas'
                          ? 'border-[#8AAA19] bg-[#f6fbe8] shadow-md'
                          : 'border-gray-300 bg-gray-50 hover:border-[#8AAA19]'
                      }`}
                    >
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">En cuotas</p>
                      <p className="text-xl font-black text-[#010139]">
                        {installmentCount} x B/.{installmentAmount.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-600">Total: B/.{installmentsTotal.toFixed(2)}</p>
                    </button>
                  </div>
                </div>
              )}

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
                    <div className="min-w-0">
                      <p className="text-gray-500">Email</p>
                      <p className="font-bold truncate" title={emissionData.email}>{emissionData.email}</p>
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
                      <p className="text-gray-500">Marca</p>
                      <p className="font-bold">{vehicleData.marca || quoteData?.marca}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Modelo</p>
                      <p className="font-bold">{vehicleData.modelo || quoteData?.modelo}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Año</p>
                      <p className="font-bold">{vehicleData.anio || quoteData?.anno || quoteData?.anio || quoteData?.ano}</p>
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
                      <p className="text-gray-500">Motor</p>
                      <p className="font-bold">{vehicleData.motor}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Color</p>
                      <p className="font-bold">{vehicleData.color}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Términos y Condiciones */}
            <div className="mt-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6">
              <h5 className="font-bold text-[#010139] mb-3 flex items-center gap-2">
                <FaClipboardCheck className="text-yellow-600" />
                Términos y Condiciones
              </h5>

              <label className="flex items-start gap-3 cursor-pointer group mb-3">
                <input
                  type="checkbox"
                  checked={declarationAccepted}
                  onChange={(e) => setDeclarationAccepted(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-[#8AAA19] 
                    focus:ring-[#8AAA19] cursor-pointer accent-[#8AAA19]"
                />
                <span className="text-sm text-gray-700 group-hover:text-[#010139] transition-colors">
                  He leído y acepto los{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                    className="text-[#8AAA19] font-semibold underline hover:text-[#6d8814]"
                  >
                    Términos y Condiciones completos
                  </button>
                </span>
              </label>

              <p className="text-xs text-gray-500 italic">
                La aceptación es requisito obligatorio para la emisión de la póliza.
              </p>
            </div>

            {/* Signature indicator for IS */}
            {signatureDataUrl && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
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

            {/* Master-exclusive broker dropdown */}
            {isMaster && availableBrokers.length > 0 && (
              <div className="mt-6 bg-white rounded-lg p-5 mb-6 shadow-sm border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🏢</span>
                  <label className="text-sm font-bold text-[#010139]">Asignar a Corredor</label>
                </div>
                <select
                  value={masterBrokerId}
                  onChange={e => setMasterBrokerId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:border-gray-400 focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 transition-colors outline-none appearance-none cursor-pointer"
                  style={{backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22currentColor%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3e%3cpolyline points=%226 9 12 15 18 9%22%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem'}}
                >
                  {availableBrokers.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {!masterBrokerId && (
                  <p className="text-xs text-red-600 mt-2 font-semibold">⚠️ Debes asignar un corredor antes de emitir</p>
                )}
              </div>
            )}

            {/* Emit Button */}
            <div className="mt-8">
              <button
                onClick={handleEmitClick}
                disabled={isConfirming || (!isMaster && !declarationAccepted) || (isMaster && !masterBrokerId)}
                className={`w-full py-5 px-6 rounded-xl font-bold text-xl
                  flex items-center justify-center gap-3 transition-all duration-200
                  ${isConfirming || (!isMaster && !declarationAccepted) || (isMaster && !masterBrokerId)
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
              {!isMaster && !declarationAccepted && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Debes aceptar los Términos y Condiciones para continuar
                </p>
              )}
              {!isMaster && declarationAccepted && !signatureDataUrl && (
                <p className="text-xs text-blue-600 text-center mt-2">
                  Al emitir se solicitará tu firma digital para la carta de autorización
                </p>
              )}
              {isMaster && (
                <p className="text-xs text-blue-600 text-center mt-2">
                  Emisión master: la firma será saltada
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Términos y Condiciones */}
        {showTermsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-4 sm:my-8">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                <h3 className="text-xl font-bold text-[#010139] flex items-center gap-2">
                  <span>📋</span> Términos y Condiciones
                </h3>
                <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <FaTimes className="text-gray-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-700 leading-relaxed space-y-5">
                <p className="text-xs font-bold text-[#010139] text-center uppercase tracking-wide">
                  Autorización, Declaración de Veracidad, Tratamiento de Datos Personales y Relevo de Responsabilidad
                </p>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">PRIMERA: AUTORIZACIÓN PARA TRATAMIENTO DE DATOS PERSONALES</p>
                  <p>De conformidad con lo establecido en la Ley 81 de 26 de marzo de 2019 sobre Protección de Datos Personales de la República de Panamá, autorizo a <strong>LÍDERES EN SEGUROS, S.A.</strong> para recopilar, almacenar, utilizar y transferir mis datos personales a aseguradoras, reaseguradoras, ajustadores y terceros necesarios para la gestión del contrato de seguro.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">SEGUNDA: NATURALEZA DE LA INTERMEDIACIÓN</p>
                  <p>Reconozco que LÍDERES EN SEGUROS, S.A. actúa exclusivamente como corredor e intermediario de seguros conforme al Decreto Ley 12 de 2012. El contrato de seguro se celebra entre el cliente y la aseguradora; el corredor no es parte aseguradora del contrato.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">TERCERA: COMUNICACIONES OFICIALES</p>
                  <p>El correo electrónico suministrado será el medio oficial de comunicación. Es mi responsabilidad suministrar un correo correcto y revisarlo periódicamente, incluyendo carpetas de spam.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">CUARTA: RESPONSABILIDAD SOBRE PAGOS Y MOROSIDAD</p>
                  <p>La prima del seguro es una obligación contractual directa con la aseguradora. La falta de pago oportuno puede generar cancelación automática de la póliza, suspensión de coberturas y rechazo de reclamos. La responsabilidad por morosidad es exclusivamente mía.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">QUINTA: DEVOLUCIONES Y CARGOS ADMINISTRATIVOS</p>
                  <p>Toda solicitud de reverso o devolución podrá generar cargos administrativos, bancarios y operativos, los cuales serán descontados del monto a devolver. El corredor no será responsable por demoras propias del banco, pasarela de pago o aseguradora.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">SEXTA: RELEVO DE RESPONSABILIDAD</p>
                  <p>Libero y exonero a LÍDERES EN SEGUROS, S.A., sus directores, agentes y colaboradores de cualquier reclamación derivada de decisiones de suscripción, rechazos de cobertura, exclusiones contractuales, cancelaciones por morosidad o errores en información suministrada por el cliente.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">SÉPTIMA: DECLARACIÓN DE VERACIDAD (INTEGRAL)</p>
                  <p>Declaro y certifico, bajo la gravedad de juramento, que toda la información suministrada es <strong>real, exacta, completa y veraz</strong>. No he omitido, alterado ni falseado información alguna. La presentación de información falsa constituye <strong>riesgo moral</strong> y puede dar lugar a la nulidad del contrato, cancelación de la póliza, pérdida de coberturas y rechazo de reclamaciones.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">OCTAVA: DECLARACIÓN DE ORIGEN LÍCITO DE FONDOS Y CUMPLIMIENTO EN MATERIA DE PREVENCIÓN DE BLANQUEO DE CAPITALES</p>
                  <p>Declaro bajo la gravedad de juramento que:</p>
                  <p>Los fondos utilizados para el pago de primas, cargos recurrentes, financiamientos o cualquier otra obligación derivada de la contratación del seguro tienen origen lícito, provienen de actividades legales y no guardan relación directa o indirecta con actividades ilícitas.</p>
                  <p>No mantengo vinculación alguna, directa o indirecta, con actividades de blanqueo de capitales, financiamiento del terrorismo, proliferación de armas de destrucción masiva, narcotráfico, delitos financieros, corrupción, fraude, trata de personas, delincuencia organizada, ni cualquier otro delito tipificado en la legislación penal de la República de Panamá o en tratados internacionales ratificados por el Estado Panameño.</p>
                  <p>No me encuentro incluido en listas restrictivas nacionales o internacionales, incluyendo pero no limitándose a: listas de la ONU, OFAC, la Unión Europea, la Superintendencia de Seguros y Reaseguros de Panamá, ni cualquier otra lista de control aplicable en materia de prevención de blanqueo de capitales.</p>
                  <p>No actúo como testaferro, intermediario oculto o representante de terceros cuyos fondos tengan origen ilícito.</p>
                  <p>En caso de actuar en representación de una persona jurídica, declaro que la entidad está debidamente constituida, sus beneficiarios finales no están vinculados a actividades ilícitas y los fondos provienen de operaciones comerciales legítimas.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">NOVENA: FACULTAD DE VERIFICACIÓN, DEBIDA DILIGENCIA Y CONSECUENCIAS</p>
                  <p>Acepto que, en cumplimiento de la Ley 23 de 27 de abril de 2015 y sus reglamentaciones, LÍDERES EN SEGUROS, S.A. podrá: solicitar documentación adicional de identificación, requerir información sobre actividad económica, verificar identidad mediante validaciones biométricas o documentales, consultar bases de datos públicas o privadas, suspender temporalmente procesos de emisión si se detectan inconsistencias, y negarse a intermediar operaciones cuando existan alertas razonables.</p>
                  <p>Reconozco que el suministro de información falsa o la omisión de información relevante en materia de origen de fondos podrá dar lugar a: cancelación inmediata del trámite o póliza, reporte a las autoridades competentes conforme a la normativa vigente, terminación de la relación comercial sin responsabilidad para el corredor, y conservación de registros como respaldo ante requerimientos regulatorios.</p>
                  <p>Me comprometo a notificar cualquier cambio en mi condición financiera, actividad económica o situación legal que pueda impactar el análisis de debida diligencia.</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-[#010139]">DÉCIMA: ACEPTACIÓN DIGITAL</p>
                  <p>Acepto que la firma digital incorporada en el portal mediante validación electrónica constituye aceptación plena, válida y vinculante del presente documento, conforme a la legislación vigente sobre comercio electrónico en la República de Panamá.</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <button
                  onClick={() => { setDeclarationAccepted(true); setShowTermsModal(false); }}
                  className="flex-1 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all"
                >
                  Acepto los Términos y Condiciones
                </button>
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Session timeout modal */}
        {showTimeoutModal && (
          <EmissionTimeoutModal
            onConfirm={() => router.replace('/cotizadores')}
          />
        )}
      </div>
    );
  }

  return <LoadingSkeleton />;
}
