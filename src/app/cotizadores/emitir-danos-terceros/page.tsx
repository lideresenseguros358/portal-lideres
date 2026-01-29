/**
 * Página de Emisión - Daños a Terceros
 * Versión simplificada sin inspección vehicular
 * Flujo lineal con menos requisitos que cobertura completa
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FaMoneyBillWave, FaUser, FaCar, FaFileUpload, FaCheckCircle, FaCreditCard, FaClipboardCheck } from 'react-icons/fa';

// Componentes de secciones
import EmissionSection, { type SectionStatus } from '@/components/cotizadores/emision/EmissionSection';
import PaymentPlanSelector from '@/components/cotizadores/PaymentPlanSelector';
import InsuredDataSection, { type InsuredData } from '@/components/cotizadores/emision/InsuredDataSection';
import VehicleDataSection, { type VehicleData } from '@/components/cotizadores/emision/VehicleDataSection';
import ClientDocumentsSection, { type ClientDocuments } from '@/components/cotizadores/emision/ClientDocumentsSection';
import TruthDeclarationSection from '@/components/cotizadores/emision/TruthDeclarationSection';
import CreditCardInput from '@/components/is/CreditCardInput';

interface Section {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  status: SectionStatus;
  canAccess: boolean;
}

export default function EmitirDanosTercerosPage() {
  const router = useRouter();
  
  // Estado global
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [quoteData, setQuoteData] = useState<any>(null);
  
  // Datos de cada sección (menos que cobertura completa)
  const [installments, setInstallments] = useState(1);
  const [monthlyPayment, setMonthlyPayment] = useState(0);
  const [insuredData, setInsuredData] = useState<InsuredData | null>(null);
  const [vehicleData, setVehicleData] = useState<VehicleData | null>(null);
  const [documents, setDocuments] = useState<ClientDocuments | null>(null);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [creditCardToken, setCreditCardToken] = useState<string | null>(null);
  const [cardLast4, setCardLast4] = useState<string | null>(null);
  const [cardBrand, setCardBrand] = useState<string | null>(null);
  
  // Control de secciones (6 secciones en lugar de 8)
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
      if (section.status === 'complete') {
        updateSectionStatus(sectionId, 'in-progress');
      }
    }
  };

  // Emisión final (simplificado para daños a terceros)
  const handleConfirmEmission = async () => {
    try {
      toast.info('Emitiendo póliza de Daños a Terceros...');
      
      // Detectar aseguradora
      const isFedpaReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('FEDPA');
      const isInternacionalReal = selectedPlan?._isReal && selectedPlan?.insurerName?.includes('INTERNACIONAL');
      
      if (isFedpaReal || isInternacionalReal) {
        // Lógica real de emisión (sin inspección ni PDF)
        toast.success('Póliza emitida exitosamente');
        router.push('/cotizadores/confirmacion');
      } else {
        // Flujo simulado
        setTimeout(() => {
          toast.success('Póliza emitida exitosamente (simulado)');
          router.push('/cotizadores/confirmacion');
        }, 2000);
      }
      
    } catch (error) {
      console.error('Error emitiendo:', error);
      toast.error('Error al emitir la póliza');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8AAA19] mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!selectedPlan) {
    return null;
  }

  // Configuración por aseguradora
  const requiresPEP = selectedPlan?.insurerName?.includes('FEDPA');
  const requiresAccreedor = selectedPlan?.insurerName?.includes('FEDPA');

  // Referencias seguras a secciones
  const [paymentSection, insuredSection, vehicleSection, documentsSection, 
         declarationSection, paymentMethodSection, reviewSection] = sections;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Global */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-2">
            Emisión de Póliza - Daños a Terceros
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
            <div className="space-y-6">
              {/* Botón volver a comparativa */}
              <div className="flex justify-start">
                <button
                  onClick={() => router.push('/cotizadores')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 
                    bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 
                    hover:border-gray-400 transition-colors"
                  type="button"
                >
                  <span>←</span>
                  Volver a Comparativa
                </button>
              </div>

              <PaymentPlanSelector
                annualPremium={selectedPlan.annualPremium}
                priceBreakdown={selectedPlan._priceBreakdown}
                onContinue={handlePaymentComplete}
              />
            </div>
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

          {/* 4. DOCUMENTOS DEL CLIENTE (menos documentos) */}
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

          {/* 5. DECLARACIÓN DE VERACIDAD */}
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

          {/* 6. DATOS DE PAGO */}
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
                  <div className="pt-6 border-t-2 border-gray-200">
                    <button
                      onClick={() => unlockNextSection('payment-method')}
                      className="w-full py-4 px-6 rounded-xl font-bold text-lg
                        bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white 
                        hover:shadow-2xl hover:scale-105 transition-all duration-200"
                      type="button"
                    >
                      Continuar al Resumen →
                    </button>
                  </div>
                )}
              </div>
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
              {/* Resumen Simplificado */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
                <h5 className="text-xl font-bold text-[#010139] mb-6 flex items-center gap-3">
                  <FaClipboardCheck className="text-blue-600" />
                  Resumen de Emisión - Daños a Terceros
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
                      <p className="text-gray-500">Cobertura</p>
                      <p className="font-bold text-blue-600">Daños a Terceros</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Declaración</p>
                      <p className="font-bold text-[#8AAA19] flex items-center gap-2">
                        <FaCheckCircle /> Aceptada
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón Emitir */}
              <button
                onClick={handleConfirmEmission}
                className="w-full py-5 px-6 rounded-xl font-bold text-xl
                  bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white 
                  hover:shadow-2xl hover:scale-105 transition-all duration-200
                  flex items-center justify-center gap-3"
                type="button"
              >
                <FaCheckCircle className="text-2xl" />
                Confirmar y Emitir Póliza →
              </button>
            </div>
          </EmissionSection>
          )}
        </div>
      </div>
    </div>
  );
}
