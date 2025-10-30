'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';
import ThirdPartyIssuanceForm from '@/components/quotes/ThirdPartyIssuanceForm';
import VehiclePhotosUpload from '@/components/quotes/VehiclePhotosUpload';

export default function ComprehensiveIssuePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'form' | 'photos' | 'success'>('form');
  const [formData, setFormData] = useState<any>(null);
  const [photos, setPhotos] = useState<{ [key: string]: File }>({});
  const [loading, setLoading] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);

  const insurerParam = searchParams.get('insurer');
  const insurerName = insurerParam?.toUpperCase() || 'ASSA';

  const handleFormSubmit = async (data: any) => {
    // Save form data and move to photos step
    setFormData(data);
    setStep('photos');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePhotosChange = (newPhotos: { [key: string]: File }) => {
    setPhotos(newPhotos);
  };

  const handleFinalSubmit = async () => {
    if (Object.keys(photos).length < 6) {
      toast.error('Por favor sube todas las fotos requeridas');
      return;
    }

    setLoading(true);

    try {
      // Create FormData for file upload
      const uploadData = new FormData();
      uploadData.append('formData', JSON.stringify(formData));
      uploadData.append('insurerName', insurerName);
      uploadData.append('planType', 'comprehensive');
      uploadData.append('annualPremium', '850'); // Mock - vendría de la cotización

      // Append photos
      Object.entries(photos).forEach(([key, file]) => {
        uploadData.append(`photo_${key}`, file);
      });

      const response = await fetch('/api/quotes/create-case-with-photos', {
        method: 'POST',
        body: uploadData,
      });

      const result = await response.json();

      if (result.ok) {
        setCaseId(result.caseId);
        setStep('success');
        toast.success('¡Solicitud enviada exitosamente!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(result.error || 'Error al enviar la solicitud');
      }
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
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
              Tu solicitud de seguro de cobertura completa ha sido recibida.
            </p>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-left">
              <h3 className="font-bold text-[#010139] mb-3">Próximos Pasos:</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">1.</span>
                  <span>Revisaremos las fotos de tu vehículo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">2.</span>
                  <span>Un asesor se pondrá en contacto en 24-48 horas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">3.</span>
                  <span>Te enviaremos la cotización final por correo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#8AAA19] font-bold">4.</span>
                  <span>Coordinaremos pago y emisión de póliza</span>
                </li>
              </ul>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Aseguradora:</strong>
              </p>
              <p className="font-semibold text-[#010139] text-lg">
                {insurerName}
              </p>
              <p className="text-sm text-gray-600 mt-2">
                Cobertura Completa
              </p>
              {caseId && (
                <p className="text-xs text-gray-500 mt-2">
                  Ref: {caseId.slice(0, 8)}
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

  if (step === 'photos') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => setStep('form')}
              className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
            >
              <FaArrowLeft />
              <span>Volver al formulario</span>
            </button>

            <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
              <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
                Paso Final: Fotos del Vehículo
              </h1>
              <p className="text-gray-600">
                Para completar tu cotización, necesitamos 6 fotos de tu vehículo
              </p>
            </div>
          </div>

          {/* Photos Component */}
          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6 md:p-8">
            <VehiclePhotosUpload
              onPhotosChange={handlePhotosChange}
              readOnly={false}
            />

            {/* Submit Button */}
            <div className="mt-8 pt-6 border-t-2 border-gray-100">
              <button
                onClick={handleFinalSubmit}
                disabled={loading || Object.keys(photos).length < 6}
                className="w-full px-8 py-4 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    Procesando...
                  </>
                ) : (
                  <>
                    <FaCheckCircle />
                    Enviar Solicitud
                  </>
                )}
              </button>

              {Object.keys(photos).length < 6 && (
                <p className="text-center text-sm text-red-600 mt-3 font-semibold">
                  Por favor sube las {6 - Object.keys(photos).length} fotos restantes para continuar
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step: Form
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/quotes/comprehensive/results"
            className="inline-flex items-center gap-2 text-[#010139] hover:text-[#8AAA19] transition-colors mb-4 font-semibold"
          >
            <FaArrowLeft />
            <span>Volver a resultados</span>
          </Link>

          <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
            <h1 className="text-3xl md:text-4xl font-bold text-[#010139] mb-2">
              Formulario de Emisión - Cobertura Completa
            </h1>
            <p className="text-gray-600">
              Completa tus datos. Después subirás las fotos del vehículo.
            </p>

            {/* Steps Indicator */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-[#8AAA19] text-white flex items-center justify-center font-bold">
                  1
                </div>
                <span className="ml-2 text-sm font-semibold text-[#010139]">Datos</span>
              </div>
              <div className="w-12 md:w-24 h-1 bg-gray-200"></div>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold">
                  2
                </div>
                <span className="ml-2 text-sm font-semibold text-gray-600">Fotos</span>
              </div>
              <div className="w-12 md:w-24 h-1 bg-gray-200"></div>
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center font-bold">
                  3
                </div>
                <span className="ml-2 text-sm font-semibold text-gray-600">Listo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <ThirdPartyIssuanceForm
          insurerId={insurerName.toLowerCase()}
          insurerName={insurerName}
          planType="premium"
          annualPremium={850} // Mock - vendría de la cotización real
          onSubmit={handleFormSubmit}
        />
      </div>
    </div>
  );
}
