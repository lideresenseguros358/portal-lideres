/**
 * EmissionTimeoutModal
 * Shown when the 30-minute emission timer expires.
 * Mounted as a React Portal so it always covers the full viewport
 * regardless of ancestor transforms or z-index stacking contexts.
 */

'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FaClock } from 'react-icons/fa';

interface EmissionTimeoutModalProps {
  /** Called when the user clicks "Volver al inicio" */
  onConfirm: () => void;
}

export default function EmissionTimeoutModal({ onConfirm }: EmissionTimeoutModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      style={{ overflow: 'hidden' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FaClock className="text-amber-500 text-3xl" />
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-[#010139] mb-2">
          Sesión expirada
        </h2>

        {/* Message */}
        <p className="text-gray-600 text-sm leading-relaxed mb-2">
          Tu sesión ha expirado. Vuelve a ingresar nuevamente tus datos.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          Tienes 30 minutos para completar la emisión.
        </p>

        {/* CTA */}
        <button
          onClick={onConfirm}
          className="w-full py-3 bg-[#010139] hover:bg-[#020270] active:scale-95 text-white rounded-xl font-semibold text-sm transition-all"
        >
          Volver al inicio
        </button>
      </div>
    </div>,
    document.body
  );
}
