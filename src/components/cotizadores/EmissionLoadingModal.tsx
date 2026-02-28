'use client';

import { useEffect, useState } from 'react';
import { FaTimes, FaExclamationTriangle } from 'react-icons/fa';

// Construction icons as inline SVGs
const CONSTRUCTION_ICONS = [
  // Wrench
  <svg key="wrench" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  // Gear / Cog
  <svg key="gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  // Hammer
  <svg key="hammer" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><path d="m15 12-8.5 8.5c-.83.83-2.17.83-3 0 0 0 0 0 0 0a2.12 2.12 0 0 1 0-3L12 9"/><path d="M17.64 15 22 10.64"/><path d="m20.91 11.7-1.25-1.25c-.6-.6-.93-1.4-.93-2.25v-.86L16.01 4.6a5.56 5.56 0 0 0-3.94-1.64H9l.92.82A6.18 6.18 0 0 1 12 8.4v1.56l2 2h2.47l2.26 1.91"/></svg>,
  // Hard Hat / Helmet
  <svg key="hardhat" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><path d="M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z"/><path d="M10 15V6.5a3.5 3.5 0 0 1 7 0V15"/><path d="M7 15v-3a6.97 6.97 0 0 1 5-6.71"/></svg>,
  // Drill
  <svg key="drill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><path d="M14 9c0 .6-.4 1-1 1H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9c.6 0 1 .4 1 1"/><path d="M18 6h4"/><path d="M14 4h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-3"/><path d="m5 10-2 8"/><path d="M12 10v3c0 .6-.4 1-1 1H8c-.6 0-1-.4-1-1v-3"/><path d="m7 18 2-8"/></svg>,
  // Crane / Construction
  <svg key="crane" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><rect x="2" y="6" width="20" height="8" rx="1"/><path d="M17 14v7"/><path d="M7 14v7"/><path d="M17 3v3"/><path d="M7 3v3"/><path d="M10 14 2.3 6.3"/><path d="m14 6 7.7 7.7"/></svg>,
  // Bolt / Lightning
  <svg key="bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  // Shield / Protection
  <svg key="shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 sm:w-12 sm:h-12"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
];

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
  const [iconIndex, setIconIndex] = useState(0);
  // Key that increments to re-trigger the CSS animation on icon change
  const [animKey, setAnimKey] = useState(0);

  // Rotate icons every 2s with a smooth pop-in via CSS keyframes
  useEffect(() => {
    if (!isOpen || error) return;

    const interval = setInterval(() => {
      setIconIndex((prev) => (prev + 1) % CONSTRUCTION_ICONS.length);
      setAnimKey((prev) => prev + 1);
    }, 2200);

    return () => clearInterval(interval);
  }, [isOpen, error]);

  // On 100%: auto-close after a short pause so confirmation page is revealed
  useEffect(() => {
    if (progress >= 100 && !error) {
      const timer = setTimeout(() => {
        onComplete?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [progress, error, onComplete]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setIconIndex(0);
      setAnimKey(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const hasError = !!error;

  return (
    <>
      {/* Keyframe styles for icon pop-in */}
      <style>{`
        @keyframes iconPopIn {
          0% {
            opacity: 0;
            transform: scale(0.3) translateY(16px);
          }
          50% {
            opacity: 1;
            transform: scale(1.15) translateY(-6px);
          }
          70% {
            transform: scale(0.95) translateY(2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .icon-pop-in {
          animation: iconPopIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
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
            <div className="p-8">
              {/* Animated construction icon — smooth pop-in on each change */}
              <div className="flex justify-center mb-5 h-12 sm:h-14 items-center">
                <div
                  key={animKey}
                  className="text-[#8AAA19] icon-pop-in"
                >
                  {CONSTRUCTION_ICONS[iconIndex]}
                </div>
              </div>

              {/* Title with subtle pulse */}
              <h3 className="text-center text-lg sm:text-xl font-bold text-[#010139] mb-1 text-subtle-pulse">
                Espere un momento
              </h3>
              <p className="text-center text-sm sm:text-base text-[#8AAA19] font-semibold mb-6">
                Estamos construyendo su futuro
              </p>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden bar-shimmer"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-gray-500 font-mono text-center mb-4">
                {Math.round(Math.min(progress, 100))}%
              </p>

              {/* Current step */}
              <p className="text-sm text-gray-600 text-center min-h-[20px]">
                {currentStep}
              </p>

              {/* Footer warning */}
              <p className="text-xs text-gray-400 text-center mt-6">
                Por favor no cierre esta ventana hasta que el proceso termine...
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
