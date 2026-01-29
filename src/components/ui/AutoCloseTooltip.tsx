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
  const [position, setPosition] = useState<'left' | 'right' | 'center'>('left');
  const hasAutoOpened = useRef(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setIsOpen(true);
      setIsClosing(false);
    },
    close: () => handleClose(),
  }));
  
  // Detectar posición óptima para evitar overflow
  useEffect(() => {
    if (isOpen && tooltipRef.current && triggerRef.current) {
      const tooltip = tooltipRef.current;
      const trigger = triggerRef.current;
      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const margin = 16; // Margen de respeto con el borde
      
      // Calcular si se sale por la derecha
      const wouldOverflowRight = triggerRect.left + tooltipRect.width > viewportWidth - margin;
      // Calcular si se sale por la izquierda
      const wouldOverflowLeft = triggerRect.left < margin;
      
      if (wouldOverflowRight && !wouldOverflowLeft) {
        setPosition('right');
      } else if (wouldOverflowLeft && !wouldOverflowRight) {
        setPosition('left');
      } else {
        setPosition('center');
      }
    }
  }, [isOpen]);

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
      ref={triggerRef}
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
          ref={tooltipRef}
          className={`absolute top-full mt-3 z-50 w-[calc(100vw-2rem)] sm:w-80 md:w-96 bg-sky-50/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-200/50 transition-all duration-300 ${
            isClosing ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
          } ${
            position === 'right' ? 'right-0' : position === 'left' ? 'left-0' : 'left-1/2 -translate-x-1/2'
          }`}
          style={{
            animation: isClosing ? 'none' : 'fadeInSlideUp 300ms ease-out',
            maxWidth: 'calc(100vw - 2rem)',
          }}
        >
          <div className="text-sm text-gray-700 leading-relaxed">
            {content}
          </div>
          
          {/* Flecha arriba con celeste - posición dinámica */}
          <div className={`absolute -top-2 w-4 h-4 bg-sky-50/95 backdrop-blur-sm border-l border-t border-sky-200/50 transform rotate-45 ${
            position === 'right' ? 'right-6' : position === 'left' ? 'left-6' : 'left-1/2 -translate-x-1/2'
          }`}></div>
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
