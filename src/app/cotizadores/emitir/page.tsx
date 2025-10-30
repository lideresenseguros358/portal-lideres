/**
 * Página de Emisión - Resumen y datos faltantes
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUppercaseInputs } from '@/lib/cotizadores/hooks/useUppercaseInputs';
import { toast } from 'sonner';
import InsurerBadge from '@/components/cotizadores/InsurerBadge';
import CreditCardInput from '@/components/is/CreditCardInput';
import type { QuoteOption } from '@/lib/cotizadores/types';

export default function EmitirPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const quoteId = searchParams.get('quoteId');
  const { createUppercaseHandler } = useUppercaseInputs();
  const [showPayment, setShowPayment] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  const [selectedOption, setSelectedOption] = useState<QuoteOption | null>(null);
  const [contactData, setContactData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    direccion: ''
  });

  useEffect(() => {
    // Cargar opción seleccionada del sessionStorage
    const stored = sessionStorage.getItem('selectedOption');
    if (stored) {
      setSelectedOption(JSON.parse(stored));
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOption || !quoteId) {
      toast.error('Error: Información incompleta');
      return;
    }

    // Validaciones básicas
    if (!contactData.nombre || !contactData.email || !contactData.telefono) {
      toast.error('Por favor completa todos los campos obligatorios');
      return;
    }

    // Mostrar formulario de pago
    setShowPayment(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePaymentSuccess = (token: string, last4: string, brand: string) => {
    // TODO: Enviar a backend para crear caso/póliza
    console.log('Pago procesado:', { quoteId, token, last4, brand, contactData });
    
    setPaymentComplete(true);
    toast.success('¡Pago procesado exitosamente!');
    
    // Guardar datos para confirmación
    sessionStorage.setItem('paymentData', JSON.stringify({
      quoteId,
      token,
      last4,
      brand,
      contactData,
      selectedOption
    }));
    
    // Redirigir a confirmación después de 2 segundos
    setTimeout(() => {
      router.push(`/cotizadores/confirmacion?quoteId=${quoteId}`);
    }, 2000);
  };

  if (!selectedOption) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-8 text-center">
          <p className="text-gray-600">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (paymentComplete) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-green-200 p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">¡Pago Exitoso!</h2>
          <p className="text-gray-600">Redirigiendo a confirmación...</p>
        </div>
      </div>
    );
  }

  if (showPayment) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            Pago de Póliza
          </h1>
          <p className="text-gray-600">
            Ingresa los datos de tu tarjeta para completar el pago
          </p>
        </div>

        {/* Resumen de pago */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{selectedOption.insurerName}</h3>
              <p className="text-sm text-gray-600">{selectedOption.planName}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#8AAA19]">
                ${selectedOption.prima.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">USD/año</div>
            </div>
          </div>
        </div>

        {/* Formulario de pago */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6">
          <CreditCardInput
            onTokenReceived={handlePaymentSuccess}
            onError={(error) => toast.error(error)}
            environment="development"
          />
        </div>

        <div className="mt-4">
          <button
            onClick={() => setShowPayment(false)}
            className="text-gray-600 hover:text-gray-800 font-semibold"
          >
            ← Volver a datos de contacto
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            Proceder a Emisión
          </h1>
          <p className="text-gray-600">
            Revisa tu selección y completa la información faltante
          </p>
        </div>

        {/* Resumen de Selección */}
        <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 md:p-8 mb-6">
          <h2 className="text-xl font-bold text-[#010139] mb-4">
            Opción Seleccionada
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <InsurerBadge 
                name={selectedOption.insurerName}
                logoUrl={selectedOption.insurerLogoUrl}
                size="lg"
              />
              <div className="mt-4">
                <h3 className="text-lg font-semibold text-gray-800">{selectedOption.planName}</h3>
                <p className="text-sm text-gray-600 mt-1">Deducible: {selectedOption.deducible || 'N/A'}</p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm text-gray-600 mb-1">Prima Anual</div>
              <div className="text-4xl font-bold text-[#8AAA19]">
                ${selectedOption.prima.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">USD</div>
            </div>
          </div>

          {/* Coberturas */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Coberturas incluidas:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {selectedOption.coberturasClave.map((cob, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-[#8AAA19]">✓</span>
                  <span>{cob}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Formulario de Datos de Contacto */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 p-6 md:p-8 space-y-6">
          <h2 className="text-xl font-bold text-[#010139]">
            Información de Contacto
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre completo <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contactData.nombre}
                onChange={createUppercaseHandler((e) => 
                  setContactData({ ...contactData, nombre: e.target.value })
                )}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="JUAN PÉREZ"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Correo electrónico <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={contactData.email}
                onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="juan@email.com"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={contactData.telefono}
                onChange={(e) => setContactData({ ...contactData, telefono: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="+507 6000-0000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Dirección (opcional)
              </label>
              <input
                type="text"
                value={contactData.direccion}
                onChange={createUppercaseHandler((e) => 
                  setContactData({ ...contactData, direccion: e.target.value })
                )}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                placeholder="CALLE 50, EDIFICIO XYZ"
              />
            </div>
          </div>

          {/* Info sobre pago */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <div className="text-2xl">💳</div>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Pago seguro con tarjeta</h4>
                <p className="text-sm text-blue-800">
                  En el siguiente paso ingresarás los datos de tu tarjeta de crédito de forma segura. 
                  Aceptamos Visa y Mastercard.
                </p>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              className="w-full px-6 py-4 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-bold text-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              CONTINUAR A PAGO
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              Al continuar, aceptas nuestros términos y condiciones
            </p>
          </div>
        </form>
      </div>
    </>
  );
}
