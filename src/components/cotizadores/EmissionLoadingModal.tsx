'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaExclamationTriangle, FaCheckCircle, FaHeadset, FaCreditCard } from 'react-icons/fa';
import PixelMascotLoader from './PixelMascotLoader';
import { formatEmissionError } from '@/lib/utils/emission-errors';

interface EmissionLoadingModalProps {
  isOpen: boolean;
  progress: number;        // 0-100, connected to real emission progress
  currentStep: string;     // Description of current step
  error?: string | null;   // Error message if emission fails
  paymentCharged?: boolean; // Whether PagueloFacil payment was already charged before the error
  blocked?: boolean;       // Whether emission is blocked (duplicate/case in review)
  blockedMessage?: string; // Custom message for blocked state
  onClose?: () => void;    // Only available when error
  onComplete?: () => void; // Called when 100% — modal auto-closes, confirmation page shows confetti
  onReport?: () => Promise<void>; // Called when user clicks REPORTAR (only shown if paymentCharged)
}

export default function EmissionLoadingModal({
  isOpen,
  progress,
  currentStep,
  error = null,
  paymentCharged = false,
  blocked = false,
  blockedMessage,
  onClose,
  onComplete,
  onReport,
}: EmissionLoadingModalProps) {
  const [mascotStatus, setMascotStatus] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [autoReportCountdown, setAutoReportCountdown] = useState(15);
  // Portal: wait for DOM to be available (SSR safety — same pattern as CameraCapture)
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // On 100%: auto-close after a short pause so confirmation page is revealed
  useEffect(() => {
    if (progress >= 100 && !error) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [progress, error, onComplete]);

  // Lock scroll on both <html> and <body> while modal is open.
  // Must lock html too — iOS Safari scrolls the html element, not just body.
  useEffect(() => {
    if (!isOpen) return;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [isOpen]);

  // Reset report state when modal opens/closes or error changes
  useEffect(() => {
    if (!isOpen || !error) {
      setReportSent(false);
      setReportSending(false);
      setAutoReportCountdown(15);
    }
  }, [isOpen, error]);

  // Auto-report: if paymentCharged and error, auto-send report after 15 seconds
  useEffect(() => {
    if (!isOpen || !error || !paymentCharged || reportSent || reportSending || blocked) return;
    if (autoReportCountdown <= 0) {
      handleReport();
      return;
    }
    const timer = setTimeout(() => setAutoReportCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, error, paymentCharged, reportSent, reportSending, blocked, autoReportCountdown]);

  if (!isOpen || !mounted) return null;

  const hasError = !!error;

  const handleReport = async () => {
    if (!onReport || reportSending) return;
    setReportSending(true);
    try {
      await onReport();
      setReportSent(true);
    } catch {
      // Even if report fails, show success to user — the data is already in the system
      setReportSent(true);
    } finally {
      setReportSending(false);
    }
  };

  const modal = (
    <>
      <style>{`
        @keyframes subtlePulseText {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        .text-subtle-pulse {
          animation: subtlePulseText 2.5s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .bar-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 1.8s ease-in-out infinite;
        }
      `}</style>

      {/*
        Overlay montado via Portal en document.body — igual que CameraCapture.
        Al estar fuera del árbol DOM de la página, ningún transform/filter/opacity
        de un ancestro puede romper position:fixed ni crear un stacking context que
        atrape el modal.
        env(safe-area-inset-*) respeta notch y barra de inicio en iPhone.
        touch-action:none + preventDefault bloquea scroll iOS Safari.
      */}
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
        style={{
          touchAction: 'none',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
        onTouchMove={(e) => e.preventDefault()}
      >
        {/*
          Card:
          - Mobile (< sm): hoja desde abajo, ocupa hasta 96dvh, esquinas redondeadas arriba
          - Desktop (≥ sm): card centrado, max-w-md, rounded-2xl completo
          - overflow-y-auto + max-h asegura scroll interno si el contenido es largo
            (ej: estados de error con mucho texto)
        */}
        <div
          className="
            bg-white w-full relative
            rounded-t-2xl sm:rounded-2xl
            shadow-2xl
            overflow-y-auto
            max-h-[96dvh] sm:max-h-[90dvh]
            sm:max-w-md sm:mx-4
          "
          onTouchMove={(e) => e.stopPropagation()}
        >

          {blocked ? (
            /* ─── BLOCKED STATE — Case in review ─── */
            <div className="p-8 text-center">
              <div className="mb-4">
                <FaExclamationTriangle className="text-amber-500 text-5xl mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-[#010139] mb-3">
                Caso en revisión
              </h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                {blockedMessage || 'Su caso está siendo revisado por nuestro equipo. Por favor espere a ser contactado.'}
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                <div className="flex items-start gap-2 mb-2">
                  <FaHeadset className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 font-medium">
                    Un ejecutivo está atendiendo su solicitud
                  </p>
                </div>
                <p className="text-xs text-blue-700 ml-6">
                  Hemos detectado que ya existe un proceso de emisión registrado para este vehículo. 
                  Nuestro equipo lo está revisando y se comunicará con usted en breve.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-start gap-2">
                  <FaCreditCard className="text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-700">
                    No se ha realizado ningún cargo adicional a su tarjeta. 
                    Su pago anterior está seguro y registrado.
                  </p>
                </div>
              </div>

              {onClose && (
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-[#010139] hover:bg-[#010139]/90 text-white rounded-lg font-semibold transition-colors"
                >
                  Entendido
                </button>
              )}
            </div>

          ) : hasError && reportSent ? (
            /* ─── REPORT SENT CONFIRMATION ─── */
            <div className="p-8 text-center">
              <div className="mb-4">
                <FaCheckCircle className="text-[#8AAA19] text-5xl mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-[#010139] mb-3">
                Caso reportado exitosamente
              </h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                Agradecemos su paciencia. Su caso ha sido elevado de inmediato a un ejecutivo
                para ser atendido de forma prioritaria.
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                <div className="flex items-start gap-2 mb-2">
                  <FaCreditCard className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800 font-medium">
                    Su pago ha sido recibido correctamente
                  </p>
                </div>
                <p className="text-xs text-blue-700 ml-6">
                  El cargo realizado a su tarjeta ha sido registrado. Un ejecutivo procederá 
                  a emitir su póliza de forma manual.
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 text-left">
                <div className="flex items-start gap-2 mb-2">
                  <FaHeadset className="text-[#010139] mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-[#010139] font-medium">
                    Se le contactará en poco tiempo
                  </p>
                </div>
                <p className="text-xs text-gray-600 ml-6">
                  Nuestro equipo revisará su caso y completará la emisión de su póliza.
                  Recibirá una confirmación por correo electrónico.
                </p>
              </div>

              {onClose && (
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-[#010139] hover:bg-[#010139]/90 text-white rounded-lg font-semibold transition-colors"
                >
                  Entendido
                </button>
              )}
            </div>

          ) : hasError ? (
            /* ─── ERROR STATE ─── */
            <div className="p-8 text-center">
              <div className="mb-4">
                <FaExclamationTriangle className="text-red-500 text-5xl mx-auto" />
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-1">
                No se pudo emitir la póliza
              </h3>
              <p className="text-sm text-gray-500 mb-3">
                La aseguradora rechazó la solicitud.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
                  <p className="text-sm text-red-800 leading-relaxed">
                    {formatEmissionError(error)}
                  </p>
                </div>
              )}

              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-red-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>

              {paymentCharged ? (
                /* Post-payment error: ONLY show REPORTAR — no other buttons */
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left mb-2">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Se detectó que el pago con su tarjeta ya fue procesado. 
                      Al reportar, un ejecutivo completará su emisión de forma manual.
                    </p>
                  </div>

                  <button
                    onClick={handleReport}
                    disabled={reportSending}
                    className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {reportSending ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enviando reporte...
                      </>
                    ) : (
                      <>
                        <FaHeadset className="text-lg" />
                        Reportar
                      </>
                    )}
                  </button>

                  <p className="text-[10px] text-gray-400 text-center">
                    Se enviará automáticamente en {autoReportCountdown}s
                  </p>
                </div>
              ) : (
                /* Pre-payment error: just close */
                <div className="space-y-3">
                  <p className="text-xs text-gray-400">
                    No se realizó ningún cargo a su tarjeta.
                  </p>
                  {onClose && (
                    <button
                      onClick={onClose}
                      className="px-8 py-2.5 bg-[#010139] hover:bg-[#010139]/90 text-white rounded-lg font-medium transition-colors"
                    >
                      Intentar más tarde
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ─── PROCESSING STATE ─── */
            <div className="px-5 pt-4 pb-6 sm:px-8 sm:pt-5 sm:pb-8">
              {/* Pixel mascot animation — smaller on mobile to fit viewport */}
              <div className="flex justify-center mb-2">
                <PixelMascotLoader size={120} onStatusChange={setMascotStatus} />
              </div>

              {/* Mascot status label */}
              <p className="text-center text-xs font-black text-[#8AAA19] tracking-wider mb-3" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                {mascotStatus}
              </p>

              {/* Title with subtle pulse */}
              <h3 className="text-center text-lg sm:text-xl font-bold text-[#010139] mb-1 text-subtle-pulse">
                Espere un momento
              </h3>
              <p className="text-center text-sm sm:text-base text-[#8AAA19] font-semibold mb-5">
                Estamos construyendo su futuro
              </p>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden bar-shimmer"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 font-mono text-center mb-3">
                {Math.round(Math.min(progress, 100))}%
              </p>

              {/* Current step */}
              <p className="text-sm text-gray-600 text-center min-h-[20px]">
                {currentStep}
              </p>

              {/* Footer warning */}
              <p className="text-xs text-gray-400 text-center mt-5">
                Por favor no cierre esta ventana hasta que el proceso termine...
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
