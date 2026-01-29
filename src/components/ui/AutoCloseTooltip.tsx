/**
 * Tooltip con hover y auto-cierre
 * - Se abre al pasar el cursor sobre el icono
 * - Se cierra automáticamente después de 3 segundos
 * - Diseño: celeste suave con transparencia
 */

'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { FaQuestionCircle } from 'react-icons/fa';

interface AutoCloseTooltipProps {
  content: string;
  autoCloseDelay?: number;
  autoOpenOnMount?: boolean; // Si debe abrirse automáticamente al montar
}

export interface AutoCloseTooltipRef {
  open: () => void;
  close: () => void;
}

const AutoCloseTooltip = forwardRef<AutoCloseTooltipRef, AutoCloseTooltipProps>(({ 
  content, 
  autoCloseDelay = 3000,
  autoOpenOnMount = false
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const hasAutoOpened = useRef(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpen(true);
      setIsClosing(false);
    },
    close: () => handleClose(),
  }));

  // Auto-cerrar después del delay SOLO cuando se abre con hover
  useEffect(() => {
    if (isOpen && !isClosing) {
      closeTimerRef.current = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
        }
      };
    }
  }, [isOpen, isClosing, autoCloseDelay]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300); // Duración de la animación de salida
  };

  const handleMouseEnter = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsClosing(false);
    }
  };

  const handleMouseLeave = () => {
    if (isOpen) {
      handleClose();
    }
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="text-sky-500 hover:text-sky-600 transition-all hover:scale-110 ml-2"
        aria-label="Más información"
      >
        <FaQuestionCircle className="text-lg" />
      </button>

      {(isOpen || isClosing) && (
        <div 
          className={`absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 top-full mt-3 z-50 w-[calc(100vw-2rem)] sm:w-80 md:w-96 max-w-[calc(100vw-2rem)] bg-sky-50/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-200/50 transition-all duration-300 ${
            isClosing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
          style={{
            animation: isClosing ? 'none' : 'fadeInSlideUp 300ms ease-out',
          }}
        >
          <div className="text-sm text-gray-700 leading-relaxed">
            {content}
          </div>
          
          {/* Flecha arriba con celeste - centrada en mobile, a la izquierda en desktop */}
          <div className="absolute -top-2 left-1/2 sm:left-6 -translate-x-1/2 sm:translate-x-0 w-4 h-4 bg-sky-50/95 backdrop-blur-sm border-l border-t border-sky-200/50 transform rotate-45"></div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeInSlideUp {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
});

AutoCloseTooltip.displayName = 'AutoCloseTooltip';

export default AutoCloseTooltip;
