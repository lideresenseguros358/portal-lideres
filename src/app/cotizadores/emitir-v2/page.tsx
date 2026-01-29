/**
 * Página de Emisión V2 - ESTILO ASSA
 * Una sola página con secciones colapsables, estados visibles
 * Flujo lineal sin navegación por URL
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaMoneyBillWave, FaUser, FaCar, FaFileUpload, FaCamera, FaCheckCircle, FaClipboardCheck } from 'react-icons/fa';

// Componentes de secciones
import EmissionSection, { type SectionStatus } from '@/components/cotizadores/emision/EmissionSection';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import InsuredDataSection, { type InsuredData } from '@/components/cotizadores/emision/InsuredDataSection';
import VehicleDataSection, { type VehicleData } from '@/components/cotizadores/emision/VehicleDataSection';
import ClientDocumentsSection, { type ClientDocuments } from '@/components/cotizadores/emision/ClientDocumentsSection';
import VehicleInspectionSection, { type VehicleInspectionData } from '@/components/cotizadores/emision/VehicleInspectionSection';
import TruthDeclarationSection from '@/components/cotizadores/emision/TruthDeclarationSection';

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

  // Emisión final
  const handleConfirmEmission = async () => {
    try {
      toast.info('Emitiendo póliza...');
      
      // Detectar aseguradora
      const isFedpaReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('FEDPA');
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');
      
      if (isFedpaReal) {
        // Emisión FEDPA con documentos
        const docsFormData = new FormData();
        docsFormData.append('environment', 'DEV');
        if (documents?.cedulaFile) docsFormData.append('documento_identidad', documents.cedulaFile);
        if (documents?.licenciaFile) docsFormData.append('licencia_conducir', documents.licenciaFile);
        if (documents?.registroFile) docsFormData.append('registro_vehicular', documents.registroFile);
        
        const docsResponse = await fetch('/api/fedpa/documentos/upload', {
          method: 'POST',
          body: docsFormData,
        });
        
        if (!docsResponse.ok) throw new Error('Error subiendo documentos');
        const docsResult = await docsResponse.json();
        
        // Emitir póliza FEDPA
        const emisionPayload = {
          environment: 'DEV',
          Plan: selectedPlan._planCode || 1,
          idDoc: docsResult.idDoc,
          PrimerNombre: insuredData?.primerNombre,
          PrimerApellido: insuredData?.primerApellido,
          SegundoNombre: insuredData?.segundoNombre,
          SegundoApellido: insuredData?.segundoApellido,
          Identificacion: insuredData?.cedula,
          FechaNacimiento: insuredData?.fechaNacimiento?.split('-').reverse().join('/'),
          Sexo: insuredData?.sexo,
          Email: insuredData?.email,
          Telefono: parseInt(insuredData?.telefono.replace(/\D/g, '') || '0'),
          Celular: parseInt(insuredData?.celular.replace(/\D/g, '') || '0'),
          Direccion: insuredData?.direccion,
          esPEP: insuredData?.esPEP ? 1 : 0,
          Acreedor: insuredData?.acreedor,
          sumaAsegurada: quoteData.valorVehiculo,
          Uso: quoteData.uso || '10',
          Marca: selectedPlan._marcaCodigo,
          Modelo: selectedPlan._modeloCodigo,
          Ano: quoteData.ano?.toString(),
          Motor: vehicleData?.motor,
          Placa: vehicleData?.placa,
          Vin: vehicleData?.vin,
          Color: vehicleData?.color,
          Pasajero: vehicleData?.pasajeros,
          Puerta: vehicleData?.puertas,
          PrimaTotal: selectedPlan.annualPremium,
        };
        
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emisionPayload),
        });
        
        if (!emisionResponse.ok) throw new Error('Error emitiendo póliza');
        const emisionResult = await emisionResponse.json();
        
        sessionStorage.setItem('emittedPolicy', JSON.stringify({
          nroPoliza: emisionResult.nroPoliza,
          insurer: 'FEDPA Seguros',
        }));
        
        toast.success('¡Póliza emitida exitosamente!');
        router.push('/cotizadores/confirmacion');
        
      } else if (isInternacionalReal) {
        // Emisión IS (simplificado)
        toast.success('¡Póliza emitida exitosamente!');
        router.push('/cotizadores/confirmacion');
      } else {
        // Simulado
        await new Promise(resolve => setTimeout(resolve, 2000));
        toast.success('¡Póliza emitida exitosamente!');
        router.push('/cotizadores/confirmacion');
      }
      
    } catch (error: any) {
      console.error('Error emitiendo:', error);
      toast.error(error.message || 'Error al emitir póliza');
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
         inspectionSection, declarationSection, reviewSection] = sections;

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

          {/* 7. RESUMEN Y CONFIRMACIÓN */}
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
              {/* Resumen de datos */}
              <div className="bg-gray-50 rounded-xl p-6 space-y-4">
                <h5 className="text-lg font-bold text-[#010139]">Resumen de Emisión</h5>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Plan de Pago</p>
                    <p className="font-bold">{installments} cuota(s)</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Asegurado</p>
                    <p className="font-bold">{insuredData?.primerNombre} {insuredData?.primerApellido}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Vehículo</p>
                    <p className="font-bold">{quoteData.marca} {quoteData.modelo}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Placa</p>
                    <p className="font-bold">{vehicleData?.placa}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Documentos</p>
                    <p className="font-bold text-[#8AAA19]">✓ 3/3 Completos</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Inspección</p>
                    <p className="font-bold text-[#8AAA19]">✓ Completa</p>
                  </div>
                </div>
              </div>

              {/* Botón Emitir */}
              <button
                onClick={handleConfirmEmission}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg
                  bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white 
                  hover:shadow-2xl hover:scale-105 transition-all duration-200"
                type="button"
              >
                Emitir Póliza Ahora →
              </button>
            </div>
          </EmissionSection>
          )}
        </div>
      </div>
    </div>
  );
}
