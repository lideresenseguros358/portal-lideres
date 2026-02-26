/**
 * Página de Emisión V2 - Cobertura Completa
 * Una sola página con secciones colapsables, estados visibles
 * Flujo lineal sin navegación por URL
 * Replicando UX/UI moderna inspirada en mejores prácticas del mercado
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaMoneyBillWave, FaUser, FaCar, FaFileUpload, FaCamera, FaCheckCircle, FaCreditCard, FaClipboardCheck } from 'react-icons/fa';

// Componentes de secciones
import EmissionSection, { type SectionStatus } from '@/components/cotizadores/emision/EmissionSection';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import InsuredDataSection, { type InsuredData } from '@/components/cotizadores/emision/InsuredDataSection';
import VehicleDataSection, { type VehicleData } from '@/components/cotizadores/emision/VehicleDataSection';
import ClientDocumentsSection, { type ClientDocuments } from '@/components/cotizadores/emision/ClientDocumentsSection';
import VehicleInspectionSection, { type VehicleInspectionData } from '@/components/cotizadores/emision/VehicleInspectionSection';
import TruthDeclarationSection from '@/components/cotizadores/emision/TruthDeclarationSection';
import CreditCardInput from '@/components/is/CreditCardInput';

// Utilidades
import { generateInspectionReport } from '@/lib/utils/inspectionReportGenerator';

interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  status: SectionStatus;
  canAccess: boolean;
}

export default function EmitirV2Page() {
  const router = useRouter();
  
  // Estado global
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  
  // Datos de cada sección
  const [installments, setInstallments] = useState(1);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [insuredData, setInsuredData] = useState<InsuredData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [documents, setDocuments] = useState<ClientDocuments | null>(null);
  const [inspectionData, setInspectionData] = useState<VehicleInspectionData | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [inspectionPDF, setInspectionPDF] = useState<Blob | null>(null);
  const [creditCardToken, setCreditCardToken] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  
  // Control de secciones
  const [activeSectionId, setActiveSectionId] = useState<string>('payment');
  const [sections, setSections] = useState<Section[]>([
    {
      id: 'payment',
      title: 'Plan de Pago',
      subtitle: 'Selecciona cómo deseas pagar tu póliza',
      icon: <FaMoneyBillWave />,
      status: 'in-progress',
      canAccess: true,
    },
    {
      id: 'insured',
      title: 'Datos del Asegurado',
      subtitle: 'Información del titular de la póliza',
      icon: <FaUser />,
      status: 'locked',
      canAccess: false,
    },
    {
      id: 'vehicle',
      title: 'Datos del Vehículo',
      subtitle: 'Información específica del vehículo',
      icon: <FaCar />,
      status: 'locked',
      canAccess: false,
    },
    {
      id: 'documents',
      title: 'Documentos del Cliente',
      subtitle: 'Adjunta los documentos requeridos',
      icon: <FaFileUpload />,
      status: 'locked',
      canAccess: false,
    },
    {
      id: 'inspection',
      title: 'Inspección del Vehículo',
      subtitle: 'Toma fotos de las partes indicadas',
      icon: <FaCamera />,
      status: 'locked',
      canAccess: false,
    },
    {
      id: 'declaration',
      title: 'Declaración de Veracidad',
      subtitle: 'Acepta los términos y condiciones',
      icon: <FaCheckCircle />,
      status: 'locked',
      canAccess: false,
    },
    {
      id: 'payment-method',
      title: 'Datos de Pago',
      subtitle: 'Ingresa los datos de tu tarjeta de crédito',
      icon: <FaCreditCard />,
      status: 'locked',
      canAccess: false,
    },
    {
      id: 'review',
      title: 'Resumen y Confirmación',
      subtitle: 'Revisa todos los datos antes de emitir',
      icon: <FaClipboardCheck />,
      status: 'locked',
      canAccess: false,
    },
  ]);

  // Cargar datos iniciales
  useEffect(() => {
    const loadData = () => {
      try {
        setLoading(true);
        
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

  // Actualizar estado de una sección
  const updateSectionStatus = (sectionId: string, status: SectionStatus) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, status } : section
    ));
  };

  // Desbloquear siguiente sección
  const unlockNextSection = (currentSectionId: string) => {
    const currentIndex = sections.findIndex(s => s.id === currentSectionId);
    if (currentIndex < sections.length - 1) {
      const nextSection = sections[currentIndex + 1];
      if (nextSection) {
        setSections(prev => prev.map((section, idx) => {
          if (idx === currentIndex) {
            return { ...section, status: 'complete' as SectionStatus };
          }
          if (idx === currentIndex + 1) {
            return { ...section, status: 'in-progress' as SectionStatus, canAccess: true };
          }
          return section;
        }));
        setActiveSectionId(nextSection.id);
      }
    }
  };

  // Handlers de cada sección
  const handlePaymentComplete = (numInstallments: number, monthlyPaymentAmount: number) => {
    setInstallments(numInstallments);
    setMonthlyPayment(monthlyPaymentAmount);
    unlockNextSection('payment');
  };

  const handleInsuredDataComplete = (data: InsuredData) => {
    setInsuredData(data);
    unlockNextSection('insured');
  };

  const handleVehicleDataComplete = (data: VehicleData) => {
    setVehicleData(data);
    unlockNextSection('vehicle');
  };

  const handleDocumentsComplete = (data: ClientDocuments) => {
    setDocuments(data);
    unlockNextSection('documents');
  };

  const handleInspectionComplete = (data: VehicleInspectionData) => {
    setInspectionData(data);
    
    // Generar PDF automáticamente en background
    if (insuredData && vehicleData) {
      toast.info('Generando informe de inspección...');
      generateInspectionReport({
        insuredData,
        vehicleData,
        inspectionData: data,
        quoteData,
      }).then(pdfBlob => {
        setInspectionPDF(pdfBlob);
        toast.success('Informe de inspección generado');
      }).catch(err => {
        console.error('Error generando PDF:', err);
        toast.error('Error generando informe, pero puedes continuar');
      });
    }
    
    unlockNextSection('inspection');
  };

  const handleDeclarationComplete = () => {
    setDeclarationAccepted(true);
    unlockNextSection('declaration');
  };

  const handleCreditCardComplete = (token: string, last4: string, brand: string) => {
    setCreditCardToken(token);
    setCardLast4(last4);
    setCardBrand(brand);
    toast.success(`Tarjeta ${brand} ****${last4} registrada`);
    unlockNextSection('payment-method');
  };

  const handleCreditCardError = (error: string) => {
    toast.error(error);
  };

  const handleActivateSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section && section.canAccess) {
      setActiveSectionId(sectionId);
      // Cambiar status a in-progress si estaba complete
      if (section.status === 'complete') {
        updateSectionStatus(sectionId, 'in-progress');
      }
    }
  };

  // Estado de emisión para evitar doble click
  const [isEmitting, setIsEmitting] = useState(false);

  // Emisión final
  const handleConfirmEmission = async () => {
    if (isEmitting) return;
    setIsEmitting(true);
    
    try {
      toast.info('Emitiendo póliza...');
      
      // Detectar aseguradora
      const isFedpaReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('FEDPA');
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');
      
      if (isFedpaReal) {
        // ========== PASO 1: Subir documentos ==========
        const docsFormData = new FormData();
        docsFormData.append('environment', 'DEV');
        if (documents?.cedulaFile) docsFormData.append('documento_identidad', documents.cedulaFile);
        if (documents?.licenciaFile) docsFormData.append('licencia_conducir', documents.licenciaFile);
        if (documents?.registroFile) docsFormData.append('registro_vehicular', documents.registroFile);
        
        toast.info('Subiendo documentos...');
        const docsResponse = await fetch('/api/fedpa/documentos/upload', {
          method: 'POST',
          body: docsFormData,
        });
        
        if (!docsResponse.ok) {
          const docsError = await docsResponse.json().catch(() => ({}));
          throw new Error(docsError.error || 'Error subiendo documentos');
        }
        const docsResult = await docsResponse.json();
        if (!docsResult.success) throw new Error(docsResult.error || 'Error subiendo documentos');
        
        // ========== PASO 2: Emitir póliza FEDPA ==========
        toast.info('Generando póliza...');
        const emisionPayload = {
          environment: 'DEV',
          Plan: selectedPlan._planCode || parseInt(selectedPlan._idCotizacion) || 411,
          idDoc: docsResult.idDoc,
          // Cliente
          PrimerNombre: insuredData?.primerNombre,
          PrimerApellido: insuredData?.primerApellido,
          SegundoNombre: insuredData?.segundoNombre || '',
          SegundoApellido: insuredData?.segundoApellido || '',
          Identificacion: insuredData?.cedula,
          FechaNacimiento: insuredData?.fechaNacimiento?.split('-').reverse().join('/'),
          Sexo: insuredData?.sexo,
          Email: insuredData?.email,
          Telefono: parseInt(insuredData?.telefono?.replace(/\D/g, '') || '0'),
          Celular: parseInt(insuredData?.celular?.replace(/\D/g, '') || '0'),
          Direccion: insuredData?.direccion,
          esPEP: insuredData?.esPEP ? 1 : 0,
          Acreedor: insuredData?.acreedor || '',
          // Vehículo
          sumaAsegurada: quoteData?.valorVehiculo || selectedPlan._sumaAsegurada || 0,
          Uso: selectedPlan._uso || quoteData?.uso || '10',
          Marca: selectedPlan._marcaCodigo || quoteData?.marcaCodigo || quoteData?.marca,
          Modelo: selectedPlan._modeloCodigo || quoteData?.modeloCodigo || quoteData?.modelo,
          MarcaNombre: selectedPlan._marcaNombre || quoteData?.marca || '',
          ModeloNombre: selectedPlan._modeloNombre || quoteData?.modelo || '',
          Ano: (selectedPlan._anio || quoteData?.anio || quoteData?.anno || new Date().getFullYear()).toString(),
          Motor: vehicleData?.motor,
          Placa: vehicleData?.placa,
          Vin: vehicleData?.vin,
          Color: vehicleData?.color,
          Pasajero: vehicleData?.pasajeros || 5,
          Puerta: vehicleData?.puertas || 4,
          PrimaTotal: selectedPlan.annualPremium,
        };
        
        console.log('[Emisión] Payload FEDPA:', emisionPayload);
        
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emisionPayload),
        });
        
        const emisionResult = await emisionResponse.json();
        
        if (!emisionResponse.ok || !emisionResult.success) {
          throw new Error(emisionResult.error || 'Error emitiendo póliza FEDPA');
        }
        
        // ========== PASO 3: Guardar datos completos para confirmación ==========
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.poliza || emisionResult.nroPoliza,
          insurer: 'FEDPA Seguros',
          vigenciaDesde: emisionResult.desde || emisionResult.vigenciaDesde,
          vigenciaHasta: emisionResult.hasta || emisionResult.vigenciaHasta,
          cotizacion: emisionResult.cotizacion,
          policyId: emisionResult.policyId,
          clientId: emisionResult.clientId,
          primaTotal: selectedPlan.annualPremium,
          planType: selectedPlan.planType,
          asegurado: `${insuredData?.primerNombre} ${insuredData?.primerApellido}`,
          cedula: insuredData?.cedula,
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo} ${emisionPayload.Ano}`,
          placa: vehicleData?.placa,
        }));
        
        toast.success('¡Póliza emitida exitosamente!');
        router.push('/cotizadores/confirmacion');
        
      } else if (isInternacionalReal) {
        // IS: Emisión pendiente (API bloqueada)
        toast.error('Internacional de Seguros: emisión no disponible temporalmente. Contacte soporte.');
        setIsEmitting(false);
        return;
      } else {
        // Simulado (demo)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: `DEMO-${Date.now()}`,
          insurer: selectedPlan?.insurerName || 'Demo',
          vigenciaDesde: new Date().toLocaleDateString('es-PA'),
          vigenciaHasta: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString('es-PA'),
          primaTotal: selectedPlan?.annualPremium,
          planType: selectedPlan?.planType,
          asegurado: `${insuredData?.primerNombre} ${insuredData?.primerApellido}`,
          vehiculo: `${quoteData?.marca} ${quoteData?.modelo}`,
          placa: vehicleData?.placa,
          isDemo: true,
        }));
        
        toast.success('¡Póliza emitida exitosamente! (Demo)');
        router.push('/cotizadores/confirmacion');
      }
      
    } catch (error: any) {
      console.error('Error emitiendo:', error);
      toast.error(error.message || 'Error al emitir póliza');
      setIsEmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#8AAA19] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!selectedPlan || !quoteData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-700 mb-4">No hay datos disponibles</h2>
          <button
            onClick={() => router.push('/cotizadores')}
            className="px-6 py-3 bg-[#010139] hover:bg-[#8AAA19] text-white rounded-lg font-semibold transition-colors"
          >
            Volver a Cotizar
          </button>
        </div>
      </div>
    );
  }

  // Configuración por aseguradora
  const requiresPEP = selectedPlan?.insurerName?.includes('FEDPA');
  const requiresAccreedor = selectedPlan?.insurerName?.includes('FEDPA');

  // Referencias seguras a secciones
  const [paymentSection, insuredSection, vehicleSection, documentsSection, 
         inspectionSection, declarationSection, paymentMethodSection, reviewSection] = sections;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Global */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2">
            Emisión de Póliza
          </h1>
          <p className="text-gray-600">
            {selectedPlan.insurerName} - {selectedPlan.planType}
          </p>
          <p className="text-lg font-bold text-[#8AAA19] mt-2">
            ${selectedPlan.annualPremium.toLocaleString()} / año
          </p>
        </div>

        {/* Secciones */}
        <div className="space-y-6">
          
          {/* 1. PLAN DE PAGO */}
          {paymentSection && (
            <EmissionSection
              id={paymentSection.id}
              title={paymentSection.title}
              subtitle={paymentSection.subtitle}
              icon={paymentSection.icon}
              status={paymentSection.status}
              canAccess={paymentSection.canAccess}
              isActive={activeSectionId === paymentSection.id}
              onActivate={() => handleActivateSection(paymentSection.id)}
          >
            <PaymentPlanSelector
              annualPremium={selectedPlan.annualPremium}
              priceBreakdown={selectedPlan._priceBreakdown}
              onContinue={handlePaymentComplete}
            />
          </EmissionSection>
          )}

          {/* 2. DATOS DEL ASEGURADO */}
          {insuredSection && (
            <EmissionSection
              id={insuredSection.id}
              title={insuredSection.title}
              subtitle={insuredSection.subtitle}
              icon={insuredSection.icon}
              status={insuredSection.status}
              canAccess={insuredSection.canAccess}
              isActive={activeSectionId === insuredSection.id}
              onActivate={() => handleActivateSection(insuredSection.id)}
            >
              <InsuredDataSection
                initialData={insuredData || undefined}
                onComplete={handleInsuredDataComplete}
                requiresPEP={requiresPEP}
                requiresAccreedor={requiresAccreedor}
              />
            </EmissionSection>
          )}

          {/* 3. DATOS DEL VEHÍCULO */}
          {vehicleSection && (
            <EmissionSection
              id={vehicleSection.id}
              title={vehicleSection.title}
              subtitle={vehicleSection.subtitle}
              icon={vehicleSection.icon}
              status={vehicleSection.status}
              canAccess={vehicleSection.canAccess}
              isActive={activeSectionId === vehicleSection.id}
              onActivate={() => handleActivateSection(vehicleSection.id)}
            >
              <VehicleDataSection
                initialData={vehicleData || undefined}
                quoteData={quoteData}
                onComplete={handleVehicleDataComplete}
              />
            </EmissionSection>
          )}

          {/* 4. DOCUMENTOS DEL CLIENTE */}
          {documentsSection && (
            <EmissionSection
              id={documentsSection.id}
              title={documentsSection.title}
              subtitle={documentsSection.subtitle}
              icon={documentsSection.icon}
              status={documentsSection.status}
              canAccess={documentsSection.canAccess}
              isActive={activeSectionId === documentsSection.id}
              onActivate={() => handleActivateSection(documentsSection.id)}
            >
              <ClientDocumentsSection
                initialData={documents || undefined}
                onComplete={handleDocumentsComplete}
              />
            </EmissionSection>
          )}

          {/* 5. INSPECCIÓN VEHICULAR */}
          {inspectionSection && (
            <EmissionSection
              id={inspectionSection.id}
              title={inspectionSection.title}
              subtitle={inspectionSection.subtitle}
              icon={inspectionSection.icon}
              status={inspectionSection.status}
              canAccess={inspectionSection.canAccess}
              isActive={activeSectionId === inspectionSection.id}
              onActivate={() => handleActivateSection(inspectionSection.id)}
            >
              <VehicleInspectionSection
                initialData={inspectionData || undefined}
                onComplete={handleInspectionComplete}
              />
            </EmissionSection>
          )}

          {/* 6. DECLARACIÓN DE VERACIDAD */}
          {declarationSection && (
            <EmissionSection
              id={declarationSection.id}
              title={declarationSection.title}
              subtitle={declarationSection.subtitle}
              icon={declarationSection.icon}
              status={declarationSection.status}
              canAccess={declarationSection.canAccess}
              isActive={activeSectionId === declarationSection.id}
              onActivate={() => handleActivateSection(declarationSection.id)}
            >
              <TruthDeclarationSection
                onComplete={handleDeclarationComplete}
              />
            </EmissionSection>
          )}

          {/* 7. DATOS DE PAGO */}
          {paymentMethodSection && (
            <EmissionSection
              id={paymentMethodSection.id}
              title={paymentMethodSection.title}
              subtitle={paymentMethodSection.subtitle}
              icon={paymentMethodSection.icon}
              status={paymentMethodSection.status}
              canAccess={paymentMethodSection.canAccess}
              isActive={activeSectionId === paymentMethodSection.id}
              onActivate={() => handleActivateSection(paymentMethodSection.id)}
            >
              <div className="space-y-6">
                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-6">
                  <p className="text-sm text-gray-700 mb-4">
                    Ingresa los datos de tu tarjeta de crédito para procesar el pago de la póliza.
                    Solo aceptamos Visa y Mastercard.
                  </p>
                </div>

                <CreditCardInput
                  onTokenReceived={handleCreditCardComplete}
                  onError={handleCreditCardError}
                  environment={process.env.NODE_ENV === 'production' ? 'production' : 'development'}
                />

                {creditCardToken && (
                  <div className="flex items-center gap-2 p-4 bg-green-50 border-2 border-green-300 rounded-xl">
                    <FaCheckCircle className="text-[#8AAA19] text-xl flex-shrink-0" />
                    <p className="text-sm font-semibold text-green-800">
                      Tarjeta {cardBrand} ****{cardLast4} registrada correctamente
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t-2 border-gray-200">
                  <button
                    onClick={() => unlockNextSection('payment-method')}
                    disabled={!creditCardToken}
                    className={`w-full py-4 px-6 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-200 ${
                      creditCardToken
                        ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105 cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    type="button"
                  >
                    <FaClipboardCheck className="text-xl" />
                    Continuar al Resumen
                  </button>
                  {!creditCardToken && (
                    <p className="text-xs text-gray-500 text-center mt-2">
                      Ingresa los datos de tu tarjeta para continuar
                    </p>
                  )}
                </div>
              </div>
            </EmissionSection>
          )}

          {/* 8. RESUMEN Y CONFIRMACIÓN */}
          {reviewSection && (
            <EmissionSection
              id={reviewSection.id}
              title={reviewSection.title}
              subtitle={reviewSection.subtitle}
              icon={reviewSection.icon}
              status={reviewSection.status}
              canAccess={reviewSection.canAccess}
              isActive={activeSectionId === reviewSection.id}
              onActivate={() => handleActivateSection(reviewSection.id)}
          >
            <div className="space-y-6">
              {/* Resumen Completo de Emisión */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                <h5 className="text-xl font-bold text-[#010139] mb-6 flex items-center gap-3">
                  <FaClipboardCheck className="text-blue-600" />
                  Resumen Completo de Emisión
                </h5>

                {/* Plan y Pago */}
                <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Plan de Pago</h6>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Cuotas</p>
                      <p className="font-bold text-lg">{installments} cuota(s)</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Pago Mensual</p>
                      <p className="font-bold text-lg">${monthlyPayment.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Prima Anual</p>
                      <p className="font-bold text-lg text-[#8AAA19]">${selectedPlan.annualPremium.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Método de Pago</p>
                      <p className="font-bold">{cardBrand} ****{cardLast4}</p>
                    </div>
                  </div>
                </div>

                {/* Datos del Asegurado */}
                <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Datos del Asegurado</h6>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Nombre Completo</p>
                      <p className="font-bold">{insuredData?.primerNombre} {insuredData?.segundoNombre} {insuredData?.primerApellido} {insuredData?.segundoApellido}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Cédula/Pasaporte</p>
                      <p className="font-bold">{insuredData?.cedula}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-bold">{insuredData?.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Teléfono</p>
                      <p className="font-bold">{insuredData?.celular}</p>
                    </div>
                  </div>
                </div>

                {/* Datos del Vehículo */}
                <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Datos del Vehículo</h6>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Marca y Modelo</p>
                      <p className="font-bold">{quoteData.marca} {quoteData.modelo} {quoteData.ano}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Placa</p>
                      <p className="font-bold">{vehicleData?.placa}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">VIN/Chasis</p>
                      <p className="font-bold">{vehicleData?.vin}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Motor</p>
                      <p className="font-bold">{vehicleData?.motor}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Color</p>
                      <p className="font-bold">{vehicleData?.color}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Valor</p>
                      <p className="font-bold text-[#8AAA19]">${quoteData.valorVehiculo?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* Estado de Documentos e Inspección */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h6 className="font-bold text-[#010139] mb-3 text-sm uppercase tracking-wide">Documentación</h6>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Documentos</p>
                      <p className="font-bold text-[#8AAA19] flex items-center gap-2">
                        <FaCheckCircle /> 3/3 Completos
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Inspección Vehicular</p>
                      <p className="font-bold text-[#8AAA19] flex items-center gap-2">
                        <FaCheckCircle /> 7/7 Fotos
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Declaración de Veracidad</p>
                      <p className="font-bold text-[#8AAA19] flex items-center gap-2">
                        <FaCheckCircle /> Aceptada
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Informe PDF</p>
                      <p className="font-bold text-[#8AAA19] flex items-center gap-2">
                        <FaCheckCircle /> Generado
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Emitir */}
              <button
                onClick={handleConfirmEmission}
                disabled={isEmitting}
                className={`w-full py-5 px-6 rounded-xl font-bold text-xl
                  flex items-center justify-center gap-3 transition-all duration-200
                  ${isEmitting
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'
                  }`}
                type="button"
              >
                {isEmitting ? (
                  <>
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    Emitiendo póliza...
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="text-2xl" />
                    Confirmar y Emitir Póliza
                  </>
                )}
              </button>
            </div>
          </EmissionSection>
          )}
        </div>
      </div>
    </div>
  );
}
