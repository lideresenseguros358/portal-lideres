'use client';

import { useEffect, useState } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import PixelMascotLoader from './PixelMascotLoader';

interface EmissionLoadingModalProps {
  isOpen: boolean;
  progress: number;        // 0-100, connected to real emission progress
  currentStep: string;     // Description of current step
  error?: string | null;   // Error message if emission fails
  onClose?: () => void;    // Only available when error
  onComplete?: () => void; // Called when 100% — modal auto-closes, confirmation page shows confetti
}

export default function EmissionLoadingModal({
  isOpen,
  progress,
  currentStep,
  error = null,
  onClose,
  onComplete,
}: EmissionLoadingModalProps) {
  const [mascotStatus, setMascotStatus] = useState('');

  // On 100%: auto-close after a short pause so confirmation page is revealed
  useEffect(() => {
    if (progress >= 100 && !error) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [progress, error, onComplete]);

  if (!isOpen) return null;

  const hasError = !!error;

  return (
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

      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden relative">

          {hasError ? (
            /* ─── ERROR STATE ─── */
            <div className="p-8 text-center">
              <div className="mb-4">
                <FaExclamationTriangle className="text-red-500 text-5xl mx-auto" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Error al Emitir</h3>
              <p className="text-sm text-red-600 mb-6">{error}</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                  className="bg-red-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  Cerrar
                </button>
              )}
            </div>
          ) : (
            /* ─── PROCESSING STATE ─── */
            <div className="px-6 pt-4 pb-6 sm:px-8 sm:pt-5 sm:pb-8">
              {/* Pixel mascot animation */}
              <div className="flex justify-center mb-2">
                <PixelMascotLoader size={160} onStatusChange={setMascotStatus} />
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
}
