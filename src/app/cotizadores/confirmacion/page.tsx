/**
 * Página de Confirmación - Resultado del pago
 */

'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { updateQuoteStatus } from '@/lib/cotizadores/storage';

export default function ConfirmacionPage() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');
  const quoteId = searchParams.get('quoteId');

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Analytics
    console.log('[Analytics] return_from_wix:', { status, quoteId });

    // Actualizar estado del quote si fue exitoso
    if (status === 'success' && quoteId) {
      updateQuoteStatus(quoteId, 'PAID');
    }
  }, [status, quoteId]);

  if (!mounted) {
    return null; // Evitar hidratación incorrecta
  }

  // Success
  if (status === 'success') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-green-200 p-8 md:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
            <div className="text-5xl">✓</div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-green-800 mb-4">
            ¡Pago recibido!
          </h1>

          <p className="text-lg text-gray-700 mb-6">
            Hemos recibido tu pago exitosamente. Procederemos con la emisión de tu póliza.
          </p>

          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 mb-8">
            <h3 className="font-semibold text-green-900 mb-2">Próximos pasos:</h3>
            <ul className="text-sm text-green-800 text-left space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">1.</span>
                <span>Recibirás un correo de confirmación con el detalle de tu pago</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">2.</span>
                <span>Nuestro equipo procesará tu solicitud en las próximas 24-48 horas</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 mt-0.5">3.</span>
                <span>Te contactaremos para finalizar detalles y entregarte tu póliza</span>
              </li>
            </ul>
          </div>

          {quoteId && (
            <div className="text-sm text-gray-600 mb-6">
              ID de cotización: <span className="font-mono font-semibold">{quoteId}</span>
            </div>
          )}

          <a
            href="https://www.lideresenseguros.com"
            className="inline-block px-8 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
          >
            VOLVER AL SITIO WEB
          </a>
        </div>
      </div>
    );
  }

  // Failure
  if (status === 'failure' || status === 'cancel') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-lg border-2 border-red-200 p-8 md:p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <div className="text-5xl">✕</div>
          </div>

          <h1 className="text-3xl md:text-4xl font-bold text-red-800 mb-4">
            No se completó el pago
          </h1>

          <p className="text-lg text-gray-700 mb-8">
            {status === 'cancel' 
              ? 'Has cancelado el proceso de pago.' 
              : 'Hubo un problema procesando tu pago.'}
          </p>

          <p className="text-gray-600 mb-8">
            Puedes intentarlo nuevamente cuando gustes. Tu cotización sigue disponible.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="https://www.lideresenseguros.com"
              className="px-8 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              VOLVER AL SITIO WEB
            </a>
            
            {quoteId && (
              <Link
                href={`/cotizadores/emitir?quoteId=${quoteId}`}
                className="px-8 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
              >
                REINTENTAR PAGO
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Pending o estado desconocido
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl shadow-lg border-2 border-yellow-200 p-8 md:p-12 text-center">
        <div className="w-20 h-20 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-6">
          <div className="text-5xl">⏳</div>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 mb-4">
          Pago pendiente
        </h1>

        <p className="text-lg text-gray-700 mb-8">
          Estamos verificando el estado de tu pago. Por favor espera un momento.
        </p>

        <a
          href="https://www.lideresenseguros.com"
          className="inline-block px-8 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg"
        >
          VOLVER AL SITIO WEB
        </a>
      </div>
    </div>
  );
}
