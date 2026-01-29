/**
 * Barra de Progreso para Wizard de Emisión
 * Runner al inicio → Progreso → Flag al final
 * Mobile-first
 */

'use client';

import { FaRunning, FaFlagCheckered } from 'react-icons/fa';

interface EmissionProgressBarProps {
  currentStep: number;
  totalSteps?: number;
}

export default function EmissionProgressBar({ 
  currentStep, 
  totalSteps = 6 
}: EmissionProgressBarProps) {
  const percentage = Math.round((currentStep / totalSteps) * 100);
  
  return (
    <div className="w-full mb-6">
      {/* Container */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress Bar con Iconos */}
        <div className="flex items-center gap-3">
          {/* Runner Icon */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
              <FaRunning className="text-white text-xl" />
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="flex-1 relative">
            {/* Background Track */}
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              {/* Progress Fill */}
              <div 
                className="h-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] transition-all duration-500 ease-out relative"
                style={{ width: `${percentage}%` }}
              >
                {/* Shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
              </div>
            </div>
            
            {/* Percentage Label */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2">
              <span className="text-xs font-bold text-gray-600 bg-white px-2 py-1 rounded-full shadow-sm">
                {percentage}%
              </span>
            </div>
          </div>
          
          {/* Flag Icon */}
          <div className="flex-shrink-0">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 ${
              percentage === 100 
                ? 'bg-gradient-to-br from-[#8AAA19] to-[#6d8814] scale-110' 
                : 'bg-gray-300'
            }`}>
              <FaFlagCheckered className={`text-xl ${percentage === 100 ? 'text-white' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>
        
        {/* Step Counter */}
        <div className="text-center mt-3">
          <span className="text-xs sm:text-sm text-gray-600 font-medium">
            Paso {currentStep} de {totalSteps}
          </span>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}
