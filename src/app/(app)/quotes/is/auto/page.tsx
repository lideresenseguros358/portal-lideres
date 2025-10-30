'use client';

import { useState } from 'react';
import QuoteWizard from '@/components/is/auto/QuoteWizard';
import QuoteResults from '@/components/is/auto/QuoteResults';
import CreditCardInput from '@/components/is/CreditCardInput';
import SuccessModal from '@/components/is/SuccessModal';
import { FaCar, FaShieldAlt } from 'react-icons/fa';

type Step = 'wizard' | 'results' | 'payment' | 'success';

export default function ISAutoQuotePage() {
  const [currentStep, setCurrentStep] = useState<Step>('wizard');
  const [idCotizacion, setIdCotizacion] = useState('');
  const [formData, setFormData] = useState<any>(null);
  const [emisionData, setEmisionData] = useState<any>(null);
  const [paymentToken, setPaymentToken] = useState('');
  const [environment] = useState<'development' | 'production'>('development');

  // Manejar cotización generada
  const handleQuoteGenerated = (id: string, data: any) => {
    setIdCotizacion(id);
    setFormData(data);
    setCurrentStep('results');
  };

  // Proceder al pago
  const handleProceedToPayment = () => {
    setCurrentStep('payment');
  };

  // Manejar token de pago
  const handleTokenReceived = async (token: string, last4: string, brand: string) => {
    setPaymentToken(token);

    // MOCK: Simular emisión de póliza (en producción llama a /api/is/auto/emitir)
    console.log('[MOCK] Emitiendo póliza con token:', token);
    
    // Simular delay de API
    await new Promise(resolve => setTimeout(resolve, 2000));

    // MOCK: Datos de emisión
    const mockEmisionData = {
      nroPoliza: `POL-${Date.now()}`,
      pdfUrl: undefined, // En producción vendría de IS
      clienteNombre: `${formData.vnombre} ${formData.vapellido}`,
      vehiculo: `${formData.vmarca_label} ${formData.vmodelo_label} ${formData.vanioauto}`,
      primaTotal: 481.50,
    };

    setEmisionData(mockEmisionData);
    setCurrentStep('success');
  };

  // Manejar error de pago
  const handlePaymentError = (error: string) => {
    alert(`Error en el pago: ${error}`);
  };

  // Cerrar modal y volver al inicio
  const handleCloseSuccess = () => {
    setCurrentStep('wizard');
    setIdCotizacion('');
    setFormData(null);
    setEmisionData(null);
    setPaymentToken('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-3 mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-800 rounded-full flex items-center justify-center">
              <FaCar className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[#010139]">Seguro de Auto</h1>
              <p className="text-gray-600">Internacional de Seguros</p>
            </div>
          </div>
          
          {environment === 'development' && (
            <div className="inline-block bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-lg text-sm">
              <span className="font-semibold">🧪 Ambiente de Desarrollo</span> - Usando datos de prueba
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Wizard Step */}
          {currentStep === 'wizard' && (
            <QuoteWizard
              onQuoteGenerated={handleQuoteGenerated}
              environment={environment}
            />
          )}

          {/* Results Step */}
          {currentStep === 'results' && (
            <QuoteResults
              idCotizacion={idCotizacion}
              formData={formData}
              onProceedToPayment={handleProceedToPayment}
            />
          )}

          {/* Payment Step */}
          {currentStep === 'payment' && (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8">
                <button
                  onClick={() => setCurrentStep('results')}
                  className="text-[#010139] hover:underline"
                >
                  ← Volver a resultados
                </button>
              </div>

              <h2 className="text-2xl font-bold text-[#010139] mb-6 text-center">Pago de Prima</h2>
              
              {/* Resumen de compra */}
              <div className="bg-gray-50 p-6 rounded-lg mb-8">
                <h3 className="font-semibold text-gray-700 mb-4">Resumen de Compra</h3>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600">{formData.vmarca_label} {formData.vmodelo_label} {formData.vanioauto}</p>
                    <p className="text-sm text-gray-500">{formData.tipo_cobertura}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#8AAA19] font-mono">$481.50</p>
                    <p className="text-sm text-gray-500">Total a pagar</p>
                  </div>
                </div>
              </div>

              {/* Formulario de tarjeta */}
              <CreditCardInput
                onTokenReceived={handleTokenReceived}
                onError={handlePaymentError}
                environment={environment}
              />
            </div>
          )}
        </div>

        {/* Success Modal */}
        {emisionData && (
          <SuccessModal
            isOpen={currentStep === 'success'}
            onClose={handleCloseSuccess}
            nroPoliza={emisionData.nroPoliza}
            pdfUrl={emisionData.pdfUrl}
            clienteNombre={emisionData.clienteNombre}
            vehiculo={emisionData.vehiculo}
            primaTotal={emisionData.primaTotal}
          />
        )}

        {/* Footer info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p className="flex items-center justify-center space-x-2">
            <FaShieldAlt className="text-blue-600" />
            <span>Tus datos están protegidos con encriptación SSL</span>
          </p>
        </div>
      </div>
    </div>
  );
}
