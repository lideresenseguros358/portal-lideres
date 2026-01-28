/**
 * Tooltip con hover y auto-apertura inicial
 * - Se abre automáticamente la primera vez (3s)
 * - Siguientes veces: hover sobre el icono
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

  // Auto-abrir solo la primera vez al montar
  useEffect(() => {
    if (autoOpenOnMount && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      setTimeout(() => {
        setIsOpen(true);
      }, 500); // Pequeño delay para que se vea natural
    }
  }, [autoOpenOnMount]);

  // Auto-cerrar después del delay
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
          className={`absolute left-0 top-full mt-3 z-50 w-72 sm:w-96 bg-sky-50/90 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-200/50 transition-all duration-300 ${
            isClosing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
          }`}
          style={{
            animation: isClosing ? 'none' : 'fadeInSlideUp 300ms ease-out',
          }}
        >
          <div className="text-sm text-gray-700 leading-relaxed">
            {content}
          </div>
          
          {/* Flecha arriba con celeste */}
          <div className="absolute -top-2 left-6 w-4 h-4 bg-sky-50/90 backdrop-blur-sm border-l border-t border-sky-200/50 transform rotate-45"></div>
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
