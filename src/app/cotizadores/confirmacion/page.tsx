/**
 * Página de Confirmación - Póliza Emitida con Confeti
 * Paso 7 del Wizard (después de emisión)
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaDownload, FaHome } from 'react-icons/fa';
import confetti from 'canvas-confetti';

export default function ConfirmacionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [policyData, setPolicyData] = useState<any>(null);

  useEffect(() => {
    setMounted(true);

    // Cargar datos de la póliza emitida desde sessionStorage
    const emittedPolicy = sessionStorage.getItem('emittedPolicy');
    if (emittedPolicy) {
      const data = JSON.parse(emittedPolicy);
      setPolicyData(data);
    }

    // Disparar confetti desde la parte superior
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50;

      // Confetti desde la parte superior (izquierda y derecha)
      confetti({
        particleCount,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { x: randomInRange(0.1, 0.3), y: 0 },
        colors: ['#8AAA19', '#010139', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });

      confetti({
        particleCount,
        angle: randomInRange(55, 125),
        spread: randomInRange(50, 70),
        origin: { x: randomInRange(0.7, 0.9), y: 0 },
        colors: ['#8AAA19', '#010139', '#FFD700', '#FF6B6B', '#4ECDC4'],
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return null;
  }

  const handleDownloadPDF = () => {
    if (policyData?.pdfUrl) {
      window.open(policyData.pdfUrl, '_blank');
    } else {
      // Fallback: generar PDF desde backend si no hay URL
      window.open(`/api/policies/${policyData?.policyId}/pdf`, '_blank');
    }
  };

  const handleGoHome = () => {
    // Limpiar sessionStorage
    sessionStorage.removeItem('emittedPolicy');
    sessionStorage.removeItem('selectedQuote');
    sessionStorage.removeItem('quoteInput');
    
    // Redirigir al inicio
    router.push('/cotizadores');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        {/* Card Principal */}
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-200 p-8 sm:p-12 text-center">
          {/* Ícono de Éxito */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-xl animate-bounce">
              <FaCheckCircle className="text-white text-5xl" />
            </div>
          </div>

          {/* Título y Mensaje */}
          <h1 className="text-3xl sm:text-4xl font-bold text-[#010139] mb-4">
            ¡Felicidades!
          </h1>
          <h2 className="text-xl sm:text-2xl font-semibold text-green-700 mb-3">
            Tu póliza ha sido emitida con éxito
          </h2>
          <p className="text-base sm:text-lg text-gray-600 mb-8">
            Gracias por confiar en <span className="font-bold text-[#8AAA19]">Líderes en Seguros</span>
          </p>

          {/* Información de la Póliza */}
          {policyData && (
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 mb-8 border-2 border-green-200">
              <h3 className="text-sm font-semibold text-gray-600 mb-3">Información de tu Póliza</h3>
              <div className="space-y-2">
                {policyData.nroPoliza && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Número de Póliza:</span>
                    <span className="text-base font-bold text-[#010139]">{policyData.nroPoliza}</span>
                  </div>
                )}
                {policyData.insurer && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Aseguradora:</span>
                    <span className="text-base font-semibold text-gray-800">{policyData.insurer}</span>
                  </div>
                )}
                {policyData.vigenciaDesde && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Vigencia:</span>
                    <span className="text-sm font-medium text-gray-700">
                      {policyData.vigenciaDesde} - {policyData.vigenciaHasta}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botón Principal: Descargar PDF */}
          <button
            onClick={handleDownloadPDF}
            className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-2xl transition-all transform hover:scale-105 flex items-center justify-center gap-3 mb-6 mx-auto"
          >
            <FaDownload className="text-white text-xl" />
            Descargar PDF de la Póliza
          </button>

          {/* Línea Separadora */}
          <div className="my-8 border-t border-gray-200"></div>

          {/* Botón Secundario Discreto: Volver al Inicio */}
          <button
            onClick={handleGoHome}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-[#8AAA19] transition-colors text-sm font-medium"
          >
            <FaHome className="text-base" />
            Volver al inicio
          </button>
        </div>

        {/* Nota Informativa */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Recibirás un correo electrónico con la confirmación y detalles de tu póliza
          </p>
        </div>
      </div>
    </div>
  );
}
