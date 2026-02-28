'use client';

import { use, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import ThirdPartyIssuanceForm from '@/components/quotes/ThirdPartyIssuanceForm';
import { AUTO_THIRD_PARTY_INSURERS } from '@/lib/constants/auto-quotes';
import { formatISPolicyNumber } from '@/lib/utils/policy-number';
import { createPaymentOnEmission } from '@/lib/adm-cot/create-payment-on-emission';

export default function ThirdPartyIssuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [success, setSuccess] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [isRealEmission, setIsRealEmission] = useState(false);

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
              href="/cotizadores/third-party"
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
      // Verificar si es INTERNACIONAL con API real
      const thirdPartyQuoteData = sessionStorage.getItem('thirdPartyQuote');
      const quoteData = thirdPartyQuoteData ? JSON.parse(thirdPartyQuoteData) : null;
      
      if (quoteData?.isRealAPI && insurer.id === 'internacional') {
        // EMISIÓN REAL CON API DE INTERNACIONAL
        toast.loading('Emitiendo póliza...');
        
        const emisionResponse = await fetch('/api/is/auto/emitir', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vIdPv: quoteData.idCotizacion,
            vcodtipodoc: 1, // Cédula
            vnrodoc: formData.nationalId,
            vnombre: formData.firstName,
            vapellido: formData.lastName,
            vtelefono: formData.email.includes('@') ? '0000-0000' : formData.nationalId.substring(0, 8),
            vcorreo: formData.email,
            vcodmarca: 204, // Se usará en futuro con catálogos
            vcodmodelo: 1234,
            vmarca_label: formData.brand,
            vmodelo_label: formData.model,
            vanioauto: formData.year,
            vsumaaseg: 0, // ← DAÑOS A TERCEROS SIEMPRE 0 (TÁCITO)
            vcodplancobertura: quoteData.vcodplancobertura,
            vcodgrupotarifa: quoteData.vcodgrupotarifa,
            paymentToken: 'TEMP_TOKEN', // TODO: Integrar con tarjeta cuando esté implementado
            tipo_cobertura: 'Daños a Terceros',
            environment: 'development',
          }),
        });
        
        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          throw new Error(errorData.error || 'Error al emitir póliza');
        }
        
        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          throw new Error(emisionResult.error || 'Error al emitir póliza');
        }
        
        // ═══ Prefix IS policy number with 1-30- ═══
        emisionResult.nroPoliza = formatISPolicyNumber(emisionResult.nroPoliza);

        // ═══ ADM COT: Auto-create pending payment ═══
        createPaymentOnEmission({
          insurer: 'INTERNACIONAL',
          policyNumber: emisionResult.nroPoliza || '',
          insuredName: `${formData.firstName} ${formData.lastName}`,
          cedula: formData.nationalId,
          totalPremium: plan.annualPremium || 0,
          installments: 1,
          ramo: 'AUTO',
        });

        toast.dismiss();
        toast.success(`¡Póliza emitida! Nº ${emisionResult.nroPoliza}`);
        
        // Guardar datos para visualización
        sessionStorage.setItem('emittedPolicy', JSON.stringify(emisionResult));
        
        // Redirigir a página de visualización
        router.push('/cotizadores/poliza-emitida');
        
        // Limpiar sessionStorage
        sessionStorage.removeItem('thirdPartyQuote');
        
      } else if (quoteData?.isFEDPA && insurer.id === 'fedpa') {
        // EMISIÓN REAL CON API DE FEDPA
        toast.loading('Emitiendo póliza con FEDPA...');
        
        // Convertir fecha a dd/mm/yyyy
        const formatFecha = (fecha: string) => {
          if (fecha.includes('-')) {
            const [year, month, day] = fecha.split('-');
            return `${day}/${month}/${year}`;
          }
          return fecha;
        };
        
        const emisionResponse = await fetch('/api/fedpa/emision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            environment: 'PROD',
            Plan: planType === 'basic' ? 342 : 343, // Planes FEDPA de terceros
            idDoc: 'TEMP_DOC', // Temporal, en producción se debe subir primero
            
            // Cliente
            PrimerNombre: formData.firstName.split(' ')[0] || formData.firstName,
            PrimerApellido: formData.lastName.split(' ')[0] || formData.lastName,
            SegundoNombre: formData.firstName.split(' ')[1] || '',
            SegundoApellido: formData.lastName.split(' ')[1] || '',
            Identificacion: formData.nationalId,
            FechaNacimiento: formatFecha(formData.birthDate),
            Sexo: 'M', // Se puede agregar al formulario
            Email: formData.email,
            Telefono: parseInt(formData.nationalId.replace(/\D/g, '').substring(0, 8)) || 60000000,
            Celular: parseInt(formData.nationalId.replace(/\D/g, '').substring(0, 8)) || 60000000,
            Direccion: formData.address || 'Panama',
            esPEP: 0,
            
            // Vehículo
            Uso: '10', // Particular por defecto
            Marca: formData.brand.substring(0, 3).toUpperCase(), // Código de 3 letras
            Modelo: formData.model.toUpperCase(),
            Ano: formData.year.toString(),
            Motor: formData.motorNumber || 'TEMP_MOTOR',
            Placa: formData.plateNumber,
            Vin: formData.vin || 'VH1221TEMPVINTMP',
            Color: formData.color || 'ROJO',
            Pasajero: parseInt(formData.occupants as string) || 5,
            Puerta: 4,
            
            // Prima
            PrimaTotal: plan.annualPremium,
          }),
        });
        
        if (!emisionResponse.ok) {
          const errorData = await emisionResponse.json();
          throw new Error(errorData.error || 'Error al emitir póliza');
        }
        
        const emisionResult = await emisionResponse.json();
        if (!emisionResult.success) {
          throw new Error(emisionResult.error || 'Error al emitir póliza');
        }
        
        // ═══ ADM COT: Auto-create pending payment ═══
        createPaymentOnEmission({
          insurer: 'FEDPA',
          policyNumber: emisionResult.poliza || emisionResult.nroPoliza || '',
          insuredName: `${formData.firstName} ${formData.lastName}`,
          cedula: formData.nationalId,
          totalPremium: plan.annualPremium || 0,
          installments: 1,
          ramo: 'AUTO',
        });

        toast.dismiss();
        toast.success(`¡Póliza emitida! Nº ${emisionResult.poliza || emisionResult.nroPoliza}`);
        
        // Guardar datos para visualización
        sessionStorage.setItem('emittedPolicy', JSON.stringify(emisionResult));
        
        // Redirigir a página de visualización
        router.push('/cotizadores/poliza-emitida');
        
        // Limpiar sessionStorage
        sessionStorage.removeItem('thirdPartyQuote');
        
      } else {
        // OTRAS ASEGURADORAS - Flujo actual (simulado)
        console.log('Datos del formulario:', formData);
        console.log('Aseguradora:', insurer.id, insurer.name);
        console.log('Plan:', planType, plan.annualPremium);
        
        // TODO: Crear caso en BD para seguimiento manual
        setCaseId(`CASE-${Date.now()}`);
        setSuccess(true);
        toast.success('¡Solicitud enviada exitosamente!');
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error: any) {
      console.error('Error submitting form:', error);
      toast.dismiss();
      toast.error(error.message || 'Error al procesar la solicitud');
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
              {isRealEmission ? '¡Póliza Emitida!' : '¡Solicitud Enviada!'}
            </h1>

            <p className="text-lg text-gray-700 mb-6">
              {isRealEmission 
                ? 'Tu póliza ha sido emitida exitosamente.' 
                : 'Tu solicitud de seguro ha sido recibida exitosamente.'}
            </p>

            {isRealEmission ? (
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-6 text-left">
                <h3 className="font-bold text-[#010139] mb-3">✅ Póliza Confirmada:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-[#8AAA19] font-bold">•</span>
                    <span>Tu póliza ha sido emitida automáticamente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8AAA19] font-bold">•</span>
                    <span>Recibirás un correo con los documentos de la póliza</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#8AAA19] font-bold">•</span>
                    <span>El pago se procesará según el plan seleccionado</span>
                  </li>
                </ul>
              </div>
            ) : (
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
            )}

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
                  {isRealEmission ? `Número de Póliza: ${caseId}` : `Número de referencia: ${caseId.slice(0, 8)}`}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href="https://www.lideresenseguros.com"
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold text-center"
              >
                Volver al Sitio Web
              </a>
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
            href="/cotizadores/third-party"
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
