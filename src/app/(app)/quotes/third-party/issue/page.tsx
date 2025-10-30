'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import ThirdPartyIssuanceForm from '@/components/quotes/ThirdPartyIssuanceForm';
import { AUTO_THIRD_PARTY_INSURERS } from '@/lib/constants/auto-quotes';

export default function ThirdPartyIssuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [success, setSuccess] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);

  const insurerId = searchParams.get('insurer');
  const planType = searchParams.get('plan') as 'basic' | 'premium';

  // Find insurer data
  const insurer = AUTO_THIRD_PARTY_INSURERS.find(i => i.id === insurerId);

  if (!insurer || !planType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-white rounded-xl shadow-lg border-2 border-red-200 p-8">
            <div className="text-6xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-red-600 mb-4">
              Selección Inválida
            </h1>
            <p className="text-gray-600 mb-6">
              No se encontró la información del plan seleccionado.
            </p>
            <Link
              href="/quotes/third-party"
              className="inline-block px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all font-semibold"
            >
              Volver al Comparador
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const plan = planType === 'basic' ? insurer.basicPlan : insurer.premiumPlan;

  const handleSubmit = async (formData: any) => {
    try {
      // Call server action to create case
      const response = await fetch('/api/quotes/create-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formData,
          insurerId: insurer.id,
          insurerName: insurer.name,
          planType,
          annualPremium: plan.annualPremium,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        setCaseId(result.caseId);
        setSuccess(true);
        toast.success('¡Solicitud enviada exitosamente!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(result.error || 'Error al enviar la solicitud');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Error al procesar la solicitud');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-xl shadow-lg border-2 border-green-200 p-8 text-center">
            <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <FaCheckCircle className="text-green-600" size={48} />
            </div>

            <h1 className="text-3xl font-bold text-[#010139] mb-4">
              ¡Solicitud Enviada!
            </h1>

            <p className="text-lg text-gray-700 mb-6">
              Tu solicitud de seguro ha sido recibida exitosamente.
            </p>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-bold text-[#010139] mb-3">Próximos Pasos:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">1.</span>
                  <span>Un asesor revisará tu solicitud en las próximas horas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">2.</span>
                  <span>Recibirás un correo electrónico con la confirmación</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">3.</span>
                  <span>Te contactaremos para coordinar el pago y emisión de la póliza</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Plan Seleccionado:</strong>
              </p>
              <p className="font-semibold text-[#010139]">
                {insurer.name} - {plan.name}
              </p>
              <p className="text-2xl font-bold text-[#8AAA19] mt-2">
                B/.{plan.annualPremium.toFixed(2)}/año
              </p>
              {caseId && (
                <p className="text-xs text-gray-500 mt-2">
                  Número de referencia: {caseId.slice(0, 8)}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/quotes"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold text-center"
              >
                Nueva Cotización
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold text-center"
              >
                Ir al Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes/third-party"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Volver al comparador</span>
          </Link>

          <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
            Formulario de Emisión
          </h1>
          <p className="text-gray-600">
            Completa tus datos para finalizar la contratación de tu seguro
          </p>
        </div>

        {/* Form */}
        <ThirdPartyIssuanceForm
          insurerId={insurer.id}
          insurerName={insurer.name}
          planType={planType}
          annualPremium={plan.annualPremium}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
