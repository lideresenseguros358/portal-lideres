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
import SignaturePad from '@/components/cotizadores/SignaturePad';
import Image from 'next/image';
import { trackQuoteEmitted, trackQuoteFailed, trackStepUpdate } from '@/lib/adm-cot/track-quote';
import { createPaymentOnEmission } from '@/lib/adm-cot/create-payment-on-emission';
import { buscarOcupacion } from '@/lib/fedpa/catalogos-complementarios';

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
  const [signatureDataUrl, setSignatureDataUrl] = useState<string>('');
  const [showSignaturePad, setShowSignaturePad] = useState(false);

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

  // ═══ ADM COT: Helper to get quote ref for step tracking ═══
  const getTrackingInfo = () => {
    const refId = selectedPlan?._idCotizacion;
    if (!refId) return null;
    const isFedpa = selectedPlan?.insurerName?.includes('FEDPA');
    const prefix = isFedpa ? 'FEDPA' : 'IS';
    const insurer = isFedpa ? 'FEDPA' : 'INTERNACIONAL';
    const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
    return { quoteRef: `${prefix}-${refId}-${planSuffix}`, insurer };
  };

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
    
    // ═══ ADM COT: Track step ═══
    const t = getTrackingInfo();
    if (t) trackStepUpdate({ ...t, step: 'emission-data' });
    
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
          Ocupacion: buscarOcupacion(emissionData.actividadEconomica).codigo,
          Acreedor: emissionData.acreedor || '',
          sumaAsegurada: quoteData.valorVehiculo || 0,
          Uso: quoteData.uso || '10',
          Marca: selectedPlan._marcaCodigo || quoteData.marca,
          Modelo: selectedPlan._modeloCodigo || quoteData.modelo,
          MarcaNombre: selectedPlan._marcaNombre || quoteData.marca || '',
          ModeloNombre: selectedPlan._modeloNombre || quoteData.modelo || '',
          Ano: quoteData.anno?.toString() || quoteData.anio?.toString() || new Date().getFullYear().toString(),
          Motor: vehicleData!.motor,
          Placa: vehicleData!.placa,
          Vin: vehicleData!.vinChasis,
          Color: vehicleData!.color,
          Pasajero: vehicleData!.pasajeros,
          Puerta: vehicleData!.puertas,
          PrimaTotal: selectedPlan.annualPremium,
        };

        // ── Intentar EmisorPlan (2024) primero; si token bloqueado → Emisor Externo (2021) ──
        let emisionResult: any = null;
        let usedMethod = 'emisor_plan';
        
        // PASO 1: Intentar subir documentos con EmisorPlan (requiere Bearer token)
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
        
        const docsResponseData = await docsResponse.json();
        const isTokenBlocked = docsResponse.status === 424 || docsResponseData.code === 'TOKEN_NOT_AVAILABLE';
        
        if (docsResponse.ok && docsResponseData.success) {
          // ── EmisorPlan path: docs uploaded OK → emit with idDoc ──
          console.log('[EMISIÓN FEDPA] Documentos subidos (EmisorPlan):', docsResponseData.idDoc);
          
          toast.info('Emitiendo póliza...');
          const emisionResponse = await fetch('/api/fedpa/emision', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              environment: 'DEV',
              ...emisionCommon,
              idDoc: docsResponseData.idDoc,
            }),
          });
          
          const emisionResponseData = await emisionResponse.json();
          
          if (!emisionResponse.ok || !emisionResponseData.success) {
            // Si emisión falla por token también, intentar fallback
            if (emisionResponse.status === 424 || emisionResponseData.code === 'TOKEN_NOT_AVAILABLE') {
              console.warn('[EMISIÓN FEDPA] EmisorPlan emisión falló por token, usando fallback...');
              // Fall through to Emisor Externo below
            } else {
              throw new Error(emisionResponseData.error || 'Error emitiendo póliza');
            }
          } else {
            emisionResult = emisionResponseData;
            usedMethod = 'emisor_plan';
          }
        } else if (isTokenBlocked) {
          console.warn('[EMISIÓN FEDPA] Token bloqueado, usando Emisor Externo (2021)...');
        } else {
          // Doc upload failed for non-token reason
          throw new Error(docsResponseData.error || 'Error subiendo documentos');
        }
        
        // ── FALLBACK: Emisor Externo (2021) — bundlea docs + emisión sin token ──
        if (!emisionResult) {
          toast.info('Usando método alternativo de emisión...');
          usedMethod = 'emisor_externo';
          
          const fallbackForm = new FormData();
          fallbackForm.append('environment', 'DEV');
          fallbackForm.append('emisionData', JSON.stringify(emisionCommon));
          fallbackForm.append('documento_identidad', emissionData.cedulaFile!, emissionData.cedulaFile!.name || 'documento_identidad.pdf');
          fallbackForm.append('licencia_conducir', emissionData.licenciaFile!, emissionData.licenciaFile!.name || 'licencia_conducir.pdf');
          if (vehicleData?.registroVehicular) {
            fallbackForm.append('registro_vehicular', vehicleData.registroVehicular, vehicleData.registroVehicular.name || 'registro_vehicular.pdf');
          }
          
          const fallbackResponse = await fetch('/api/fedpa/emision/fallback', {
            method: 'POST',
            body: fallbackForm,
          });
          
          const fallbackData = await fallbackResponse.json();
          
          if (!fallbackResponse.ok || !fallbackData.success) {
            throw new Error(fallbackData.error || 'Error emitiendo póliza (método alternativo)');
          }
          
          emisionResult = fallbackData;
        }
        
        console.log(`[EMISIÓN FEDPA] Póliza emitida (${usedMethod}):`, emisionResult.nroPoliza || emisionResult.poliza);
        
        // ═══ ADM COT: Track successful FEDPA emission ═══
        const fedpaRef = selectedPlan?._idCotizacion;
        if (fedpaRef) {
          const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
          trackQuoteEmitted({ quoteRef: `FEDPA-${fedpaRef}-${planSuffix}`, insurer: 'FEDPA', policyNumber: emisionResult.nroPoliza || emisionResult.poliza });
        }
        
        // ═══ ADM COT: Auto-create pending payment + recurrence ═══
        createPaymentOnEmission({
          insurer: 'FEDPA',
          policyNumber: emisionResult.nroPoliza || emisionResult.poliza || '',
          insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          totalPremium: selectedPlan?.annualPremium || 0,
          installments,
          ramo: 'AUTO',
        });
        
        // ═══ ENVIAR BIENVENIDA AL CLIENTE POR CORREO ═══
        toast.info('Enviando confirmación por correo...');
        try {
          const welcomeForm = new FormData();
          welcomeForm.append('tipoCobertura', 'CC');
          welcomeForm.append('environment', 'development');
          welcomeForm.append('nroPoliza', emisionResult.nroPoliza || emisionResult.poliza || '');
          welcomeForm.append('insurerName', 'FEDPA Seguros');
          welcomeForm.append('firmaDataUrl', signatureDataUrl || '');
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
            marca: quoteData.marca,
            modelo: quoteData.modelo,
            anio: quoteData.anio || quoteData.anno,
            valorVehiculo: quoteData.valorVehiculo || 0,
            cobertura: 'Cobertura Completa',
            primaTotal: selectedPlan?.annualPremium || 0,
          }));
          
          if (emissionData.cedulaFile) {
            welcomeForm.append('cedulaFile', emissionData.cedulaFile);
          }
          if (emissionData.licenciaFile) {
            welcomeForm.append('licenciaFile', emissionData.licenciaFile);
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
        
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza || emisionResult.poliza,
          insurer: 'FEDPA Seguros',
          clientId: emisionResult.clientId,
          policyId: emisionResult.policyId,
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          asegurado: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          vehiculo: `${quoteData.marca} ${quoteData.modelo} ${quoteData.anio || quoteData.anno || ''}`.trim(),
          placa: vehicleData?.placa || '',
          primaTotal: selectedPlan?.annualPremium,
          tipoCobertura: 'Cobertura Completa',
          method: usedMethod,
        }));
        
        toast.success(`¡Póliza FEDPA emitida! Nº ${emisionResult.nroPoliza || emisionResult.poliza}`);
        router.push('/cotizadores/confirmacion');
        
      } else if (isInternacionalReal) {
        console.log('[EMISIÓN INTERNACIONAL] Iniciando emisión con API real...');
        
        if (!emissionData) {
          throw new Error('Faltan datos de emisión');
        }
        
        const isCC = quoteData.cobertura === 'COMPLETA';
        const tipoCobertura = isCC ? 'Cobertura Completa' : 'Daños a Terceros';
        
        if (isCC && !inspectionPhotos.length) {
          throw new Error('Faltan fotos de inspección para Cobertura Completa');
        }
        
        // Emitir con API real de INTERNACIONAL
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
            tipo_cobertura: tipoCobertura,
            vmarca_label: quoteData.marca,
            vmodelo_label: quoteData.modelo,
            environment: 'development',
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
        
        console.log('[EMISION INTERNACIONAL] Póliza emitida:', emisionResult.nroPoliza);
        
        // ═══ ADM COT: Track successful IS emission ═══
        const isRef = selectedPlan?._idCotizacion;
        if (isRef) {
          const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
          trackQuoteEmitted({ quoteRef: `IS-${isRef}-${planSuffix}`, insurer: 'INTERNACIONAL', policyNumber: emisionResult.nroPoliza });
        }
        
        // ═══ ADM COT: Auto-create pending payment + recurrence ═══
        createPaymentOnEmission({
          insurer: 'INTERNACIONAL',
          policyNumber: emisionResult.nroPoliza || '',
          insuredName: `${emissionData.primerNombre} ${emissionData.primerApellido}`,
          cedula: emissionData.cedula,
          totalPremium: selectedPlan?.annualPremium || 0,
          installments,
          ramo: 'AUTO',
        });
        
        // ═══ ENVIAR EXPEDIENTE POR CORREO ═══
        toast.info('Enviando expediente por correo...');
        try {
          const expedienteForm = new FormData();
          expedienteForm.append('tipoCobertura', isCC ? 'CC' : 'DT');
          expedienteForm.append('environment', 'development');
          expedienteForm.append('nroPoliza', emisionResult.nroPoliza || '');
          expedienteForm.append('pdfUrl', emisionResult.pdfUrl || '');
          expedienteForm.append('insurerName', 'Internacional de Seguros');
          expedienteForm.append('firmaDataUrl', signatureDataUrl || '');
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
          if (expedienteResult.success) {
            console.log('[IS EXPEDIENTE] ✅ Correo enviado:', expedienteResult.messageId);
            toast.success('Expediente enviado por correo');
          } else {
            console.error('[IS EXPEDIENTE] Error:', expedienteResult.error);
            toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
          }
        } catch (expError: any) {
          console.error('[IS EXPEDIENTE] Error enviando expediente:', expError);
          toast.warning('Póliza emitida pero hubo un error enviando el expediente por correo');
        }
        
        // Guardar datos completos de la póliza para la confirmación y carátula
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
        
        toast.success(`¡Póliza emitida! Nº ${emisionResult.nroPoliza}`);
        router.push('/cotizadores/confirmacion');
        
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
        
        toast.success('¡Póliza emitida exitosamente! (Demo)');
        router.push('/cotizadores/confirmacion');
      }
      
    } catch (error: any) {
      console.error('Error emitiendo p\u00f3liza:', error);
      toast.error(error.message || 'Error al emitir p\u00f3liza');
      // ═══ ADM COT: Track emission failure ═══
      const refId = selectedPlan?._idCotizacion;
      if (refId) {
        const isFedpa = selectedPlan?.insurerName?.includes('FEDPA');
        const prefix = isFedpa ? 'FEDPA' : 'IS';
        const insurer = isFedpa ? 'FEDPA' : 'INTERNACIONAL';
        const planSuffix = selectedPlan?.planType === 'premium' ? 'P' : 'B';
        trackQuoteFailed({ quoteRef: `${prefix}-${refId}-${planSuffix}`, insurer, errorMessage: error.message, lastStep: step });
      }
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
  const isInternacional = !!(selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL'));

  // Determinar step inicial según tipo
  // IS DT still needs emission-data and vehicle steps (for documents), just no inspection
  const needsFullWizard = isAutoCompleta || isInternacional;
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
    // For IS Internacional: require signature before emitting
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
      </div>
    );
  }

  return <LoadingSkeleton />;
}
