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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, width: 0 });
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
  
  // Calcular posición fixed del tooltip para NUNCA salirse del viewport
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const trigger = triggerRef.current;
      const triggerRect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 16; // Margen de seguridad
      
      // Ancho del tooltip
      const tooltipWidth = viewportWidth < 640 ? viewportWidth - (margin * 2) : 320; // 80 * 4 = 320px en desktop
      
      // Calcular posición inicial (centrado bajo el trigger)
      let left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
      let top = triggerRect.bottom + 12; // 12px debajo del trigger
      
      // Ajustar si se sale por la izquierda
      if (left < margin) {
        left = margin;
      }
      
      // Ajustar si se sale por la derecha
      if (left + tooltipWidth > viewportWidth - margin) {
        left = viewportWidth - tooltipWidth - margin;
      }
      
      // Si se sale por abajo, mostrar arriba del trigger
      if (top + 200 > viewportHeight - margin) { // Asumimos altura ~200px
        top = triggerRect.top - 200 - 12;
      }
      
      setTooltipPosition({ top, left, width: tooltipWidth });
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
          className={`fixed z-[9999] bg-sky-50/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-200/50 transition-all duration-300 ${
            isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            width: `${tooltipPosition.width}px`,
            animation: isClosing ? 'none' : 'fadeIn 300ms ease-out',
          }}
        >
          <div className="text-sm text-gray-700 leading-relaxed">
            {content}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
});

AutoCloseTooltip.displayName = 'AutoCloseTooltip';

export default AutoCloseTooltip;
