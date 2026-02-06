'use client';

import { useEffect, useState } from 'react';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';
import confetti from 'canvas-confetti';

interface PayFortnightProgressModalProps {
  isOpen: boolean;
  progress: number;
  currentStep: string;
  onComplete?: () => void;
  onClose?: () => void;
}

export default function PayFortnightProgressModal({
  isOpen,
  progress,
  currentStep,
  onComplete,
  onClose,
}: PayFortnightProgressModalProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  // Detectar cuando llega al 100%
  useEffect(() => {
    if (progress >= 100 && !showSuccess) {
      setShowSuccess(true);
      
      // Lanzar confeti
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 2,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#8AAA19', '#010139', '#FFD700']
        });
        confetti({
          particleCount: 2,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#8AAA19', '#010139', '#FFD700']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();

      // Llamar onComplete después de 2 segundos
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 2000);
    }
  }, [progress, showSuccess, onComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {!showSuccess ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8AAA19] mx-auto mb-4"></div>
            <h3 className="text-xl font-bold text-[#010139] mb-2">Cerrando Quincena...</h3>
            <p className="text-gray-600 mb-6">{currentStep}</p>
            
            {/* Barra de progreso */}
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] h-full rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${progress}%` }}
              >
                {progress > 10 && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                )}
              </div>
            </div>
            <p className="text-sm text-gray-500 font-mono">{Math.round(progress)}%</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <FaCheckCircle className="text-green-600 text-6xl mx-auto animate-bounce" />
            </div>
            <h3 className="text-2xl font-bold text-[#010139] mb-2">
              🎉 ¡Quincena Cerrada Exitosamente!
            </h3>
            <p className="text-gray-600 mb-4">
              La quincena ha sido cerrada y los pagos han sido generados correctamente
            </p>
            <p className="text-sm text-gray-500">
              Redirigiendo a historial...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
