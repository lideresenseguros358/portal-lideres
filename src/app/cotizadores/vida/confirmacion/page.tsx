'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FaCheckCircle, FaEnvelope, FaHome, FaShieldAlt } from 'react-icons/fa';

interface SubmissionData {
  nombre: string;
  correo: string;
  sumaAsegurada: number;
  tiposPropuesta: string[];
  ticket: string | null;
}

export default function VidaConfirmacionPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [submission, setSubmission] = useState<SubmissionData | null>(null);

  useEffect(() => {
    setMounted(true);
    const raw = sessionStorage.getItem('vidaQuoteSubmission');
    if (raw) {
      try {
        setSubmission(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, []);

  const handleGoHome = () => {
    sessionStorage.removeItem('vidaQuoteSubmission');
    router.push('/cotizadores');
  };

  const handleNewQuote = () => {
    sessionStorage.removeItem('vidaQuoteSubmission');
    router.push('/cotizadores/vida');
  };

  if (!mounted) return null;

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        <div className="bg-white rounded-3xl shadow-2xl border-2 border-green-200 p-8 sm:p-10 text-center">
          {/* Success icon */}
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-xl">
              <FaCheckCircle className="text-white text-4xl" />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-[#010139] mb-3">
            ¡Solicitud enviada!
          </h1>
          <p className="text-base text-gray-600 mb-6">
            Tu solicitud de cotización de seguro de vida ha sido recibida exitosamente.
          </p>

          {/* Details card */}
          {submission && (
            <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-5 mb-6 border-2 border-green-100 text-left space-y-3">
              {submission.ticket && (
                <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                  <span className="text-xs text-gray-500">Ticket</span>
                  <span className="text-sm font-bold text-[#010139]">{submission.ticket}</span>
                </div>
              )}
              <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                <span className="text-xs text-gray-500">Solicitante</span>
                <span className="text-sm font-semibold text-gray-800">{submission.nombre}</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                <span className="text-xs text-gray-500">Correo</span>
                <span className="text-sm font-medium text-gray-700">{submission.correo}</span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                <span className="text-xs text-gray-500">Suma asegurada</span>
                <span className="text-sm font-bold text-[#8AAA19]">
                  ${submission.sumaAsegurada?.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 px-3 bg-white rounded-lg">
                <span className="text-xs text-gray-500">Tipo(s) de propuesta</span>
                <span className="text-sm font-medium text-gray-700">{submission.tiposPropuesta?.join(', ')}</span>
              </div>
            </div>
          )}

          {/* What happens next */}
          <div className="bg-blue-50 border-2 border-blue-100 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <FaEnvelope className="text-blue-500 mt-0.5 text-lg flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-900 text-sm mb-1">¿Qué sigue?</h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Un asesor de <span className="font-bold text-[#8AAA19]">Líderes en Seguros</span> revisará tu solicitud y te enviará la cotización 
                  personalizada a tu correo electrónico en un plazo de <strong>24 horas hábiles</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleNewQuote}
              className="w-full px-6 py-3.5 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-xl font-bold text-sm transition-colors shadow-lg flex items-center justify-center gap-2"
            >
              <FaShieldAlt /> Nueva cotización de vida
            </button>
            <button
              onClick={handleGoHome}
              className="w-full inline-flex items-center justify-center gap-2 text-gray-500 hover:text-[#8AAA19] transition-colors text-sm font-medium py-2"
            >
              <FaHome className="text-base" />
              Volver al inicio
            </button>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs text-gray-400">
            Gracias por confiar en <span className="font-semibold text-[#8AAA19]">Líderes en Seguros</span>
          </p>
        </div>
      </div>
    </div>
  );
}
