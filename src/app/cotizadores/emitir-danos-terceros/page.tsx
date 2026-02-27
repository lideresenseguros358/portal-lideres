/**
 * Página de Emisión - Daños a Terceros
 * Replica el UX de cobertura completa con URL-based steps.
 * Steps: emission-data → vehicle → payment-info → review
 * Sin inspección, sin cuotas (modal de pago maneja contado vs cuotas),
 * sin paso separado de documentos (se piden en emission-data),
 * declaración de veracidad integrada en review.
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaCheckCircle, FaUser, FaCar, FaCreditCard, FaClipboardCheck, FaTimes } from 'react-icons/fa';
import EmissionDataForm, { type EmissionData } from '@/components/cotizadores/EmissionDataForm';
import VehicleDataForm, { type VehicleData } from '@/components/cotizadores/VehicleDataForm';
import CreditCardInput from '@/components/is/CreditCardInput';
import LoadingSkeleton from '@/components/cotizadores/LoadingSkeleton';
import EmissionProgressBar from '@/components/cotizadores/EmissionProgressBar';
import EmissionBreadcrumb, { type EmissionStep, type BreadcrumbStepDef } from '@/components/cotizadores/EmissionBreadcrumb';
import SignaturePad from '@/components/cotizadores/SignaturePad';
import Image from 'next/image';
import { buscarOcupacion } from '@/lib/fedpa/catalogos-complementarios';

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
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

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
    toast.success('Tarjeta registrada. Presiona "Continuar al Resumen" para seguir.');
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

    try {
      const isFedpaReal = selectedPlan?._isReal && (selectedPlan?._isFEDPA || selectedPlan?.insurerName?.includes('FEDPA'));
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');

      if (!emissionData) throw new Error('Faltan datos del asegurado');

      // ═══════════════════════════════════════════════════════
      // EMISIÓN FEDPA — Daños a Terceros
      // ═══════════════════════════════════════════════════════
      if (isFedpaReal) {
        // Get idCotizacion from sessionStorage
        const tpQuoteRaw = sessionStorage.getItem('thirdPartyQuote');
        const tpQuote = tpQuoteRaw ? JSON.parse(tpQuoteRaw) : null;

        const emisionCommon = {
          IdCotizacion: tpQuote?.idCotizacion || '',
          Plan: selectedPlan._planCode || 426,
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
          PrimaTotal: selectedPlan.annualPremium,
        };

        let emisionResult: any = null;
        const usedMethod = 'emisor_plan';

        // ── EmisorPlan (2024): upload docs → emitirpoliza ──
        // Note: Emisor Externo (2021) crear_poliza_auto_cc_externos is
        // broken on FEDPA's server (ORA-01400 even with manual example data).
        // EmisorPlan is the ONLY working emission path.
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
        toast.info('Emitiendo póliza...');
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ environment: 'DEV', ...emisionCommon, idDoc: docsResponseData.idDoc }),
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

        console.log(`[EMISIÓN DT FEDPA] Póliza emitida (${usedMethod}):`, emisionResult.nroPoliza || emisionResult.poliza);
        
        // ═══ ENVIAR BIENVENIDA AL CLIENTE POR CORREO ═══
        toast.info('Enviando confirmación por correo...');
        try {
          const welcomeForm = new FormData();
          welcomeForm.append('tipoCobertura', 'DT');
          welcomeForm.append('environment', 'development');
          welcomeForm.append('nroPoliza', emisionResult.nroPoliza || emisionResult.poliza || '');
          welcomeForm.append('insurerName', 'FEDPA Seguros');
          if (emisionResult.clientId) welcomeForm.append('clientId', emisionResult.clientId);
          if (emisionResult.policyId) welcomeForm.append('policyId', emisionResult.policyId);
          
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
          }));
          
          welcomeForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca,
            modelo: quoteData?.modelo,
            anio: quoteData?.anio || quoteData?.anno,
            valorVehiculo: quoteData?.valorVehiculo || 0,
            cobertura: 'Daños a Terceros',
            primaTotal: selectedPlan.annualPremium || 0,
          }));
          
          if (emissionData.cedulaFile) {
            welcomeForm.append('cedulaFile', emissionData.cedulaFile);
          }
          if (emissionData.licenciaFile) {
            welcomeForm.append('licenciaFile', emissionData.licenciaFile);
          }
          if (signatureDataUrl) {
            welcomeForm.append('firmaDataUrl', signatureDataUrl);
          }
          
          const welcomeResponse = await fetch('/api/is/auto/send-expediente', {
            method: 'POST',
            body: welcomeForm,
          });
          const welcomeResult = await welcomeResponse.json();
          if (welcomeResult.success) {
            console.log('[FEDPA DT] ✅ Bienvenida enviada:', welcomeResult.messageId);
          } else {
            console.error('[FEDPA DT] Error bienvenida:', welcomeResult.error);
          }
        } catch (welcomeErr: any) {
          console.error('[FEDPA DT] Error enviando bienvenida:', welcomeErr);
        }

        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza || emisionResult.poliza,
          insurer: 'FEDPA Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${quoteData?.anno || quoteData?.anio || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan.annualPremium,
          tipoCobertura: 'Daños a Terceros',
          method: usedMethod,
        }));
        sessionStorage.removeItem('thirdPartyQuote');
        sessionStorage.removeItem('selectedQuote');
        toast.success(`¡Póliza emitida! Nº ${emisionResult.nroPoliza || emisionResult.poliza}`);
        router.push('/cotizadores/confirmacion');

      // ═══════════════════════════════════════════════════════
      // EMISIÓN INTERNACIONAL — Daños a Terceros
      // ═══════════════════════════════════════════════════════
      } else if (isInternacionalReal) {
        console.log('[EMISIÓN DT INTERNACIONAL] Iniciando emisión con API real...');
        toast.info('Emitiendo póliza...');

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
            vcodmarca: selectedPlan._vcodmarca,
            vmarca_label: quoteData?.marca,
            vcodmodelo: selectedPlan._vcodmodelo,
            vmodelo_label: quoteData?.modelo,
            vanioauto: quoteData?.anio || quoteData?.anno || new Date().getFullYear(),
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
            vacreedor: emissionData?.acreedor || '',
            tipo_cobertura: 'Daños a Terceros',
            environment: 'development',
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

        console.log('[EMISIÓN DT INTERNACIONAL] Póliza emitida:', emisionResult.nroPoliza);

        // ═══ ENVIAR EXPEDIENTE Y BIENVENIDA POR CORREO ═══
        toast.info('Enviando expediente por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', 'DT');
          expedienteForm.append('environment', 'development');
          expedienteForm.append('nroPoliza', emisionResult.nroPoliza || '');
          expedienteForm.append('pdfUrl', emisionResult.pdfUrl || '');
          expedienteForm.append('insurerName', 'Internacional de Seguros');
          expedienteForm.append('firmaDataUrl', signatureDataUrl || '');
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
          }));
          
          expedienteForm.append('quoteData', JSON.stringify({
            marca: quoteData?.marca,
            modelo: quoteData?.modelo,
            anio: quoteData?.anio || quoteData?.anno,
            valorVehiculo: quoteData?.valorVehiculo || 0,
            tipoVehiculo: quoteData?.tipoVehiculo || 'SEDAN',
            cobertura: 'Daños a Terceros',
            primaTotal: selectedPlan.annualPremium || 0,
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
          if (expedienteResult.success) {
            console.log('[IS EXPEDIENTE DT] ✅ Correo enviado:', expedienteResult.messageId);
            toast.success('Expediente y confirmación enviados por correo');
          } else {
            console.error('[IS EXPEDIENTE DT] Error:', expedienteResult.error);
            toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
          }
        } catch (expError: any) {
          console.error('[IS EXPEDIENTE DT] Error enviando expediente:', expError);
          toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
        }

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
        
        toast.success(`¡Póliza emitida! Nº ${emisionResult.nroPoliza}`);
        router.push('/cotizadores/confirmacion');

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
                Información de Pago
              </h2>
              <p className="text-gray-600">
                Completa los datos de tu tarjeta para procesar el pago
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
      if (!signatureDataUrl) {
        setShowSignaturePad(true);
        return;
      }
      handleConfirmEmission();
    };

    const handleSignatureComplete = (dataUrl: string) => {
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

            {/* Emit Button */}
            <div className="mt-8">
              <button
                onClick={handleEmitClick}
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
                  Debes aceptar los Términos y Condiciones para continuar
                </p>
              )}
              {declarationAccepted && !signatureDataUrl && (
                <p className="text-xs text-blue-600 text-center mt-2">
                  Al emitir se solicitará tu firma digital para la carta de autorización
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
      </div>
    );
  }

  return <LoadingSkeleton />;
}
