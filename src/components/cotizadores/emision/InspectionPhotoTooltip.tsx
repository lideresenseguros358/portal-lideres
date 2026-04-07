/**
 * Tooltip para Inspección Vehicular — Sin autoclose
 * - Se abre automáticamente cuando el botón es pendiente
 * - Se cierra cuando la foto se completa y se activa el siguiente
 * - Posición FIXED (estatico en viewport, no se mueve con scroll)
 * - Copia el diseño de AutoCloseTooltip del cotizador CC
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface InspectionPhotoTooltipProps {
  isVisible: boolean;        // Abierto si el botón es pendiente
  buttonElement: HTMLElement | null;  // Elemento del botón para calcular posición
  photoIndex: number;        // Índice de la foto (0 = primera, etc.)
  totalPhotos: number;       // Total de fotos
}

const InspectionPhotoTooltip = ({
  isVisible,
  buttonElement,
  photoIndex,
  totalPhotos,
}: InspectionPhotoTooltipProps) => {
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Portal requires the DOM to be mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  // Calcular posición relativa al botón en viewport (fixed)
  const computePosition = () => {
    if (!buttonElement) return;
    const rect = buttonElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 12;
    const tooltipWidth = 280;
    const estimatedHeight = 120;

    // Horizontal: centrado bajo el botón, clamped dentro del viewport
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < margin) left = margin;
    if (left + tooltipWidth > viewportWidth - margin) left = viewportWidth - tooltipWidth - margin;

    // Vertical: debajo del botón si cabe, arriba si no
    const fitsBelow = rect.bottom + 12 + estimatedHeight <= viewportHeight - margin;
    const top = fitsBelow ? rect.bottom + 12 : rect.top - estimatedHeight - 12;

    setTooltipPosition({ top, left });
  };

  // Recalcular al abrir/cambiar visibilidad
  useEffect(() => {
    if (isVisible && buttonElement) {
      computePosition();
      // También en scroll (para fixed, el tooltip se queda pero el botón se mueve en viewport)
      const onScroll = () => computePosition();
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }
  }, [isVisible, buttonElement]);

  // Recalcular en resize
  useEffect(() => {
    if (!isVisible) return;
    const onResize = () => computePosition();
    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, [isVisible]);

  // Determinar mensaje según índice de foto
  const getMessage = (): string => {
    if (photoIndex === 0) {
      return 'Empieza tomando las fotos aquí';
    } else if (photoIndex === totalPhotos - 1) {
      return 'Con esta foto terminamos';
    } else {
      return 'Continuemos con esta foto';
    }
  };

  const tooltipEl = isVisible && mounted ? (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] bg-sky-50/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-200/50 transition-opacity duration-300 opacity-100 pointer-events-auto"
      style={{
        top: `${tooltipPosition.top}px`,
        left: `${tooltipPosition.left}px`,
        width: '280px',
        animation: 'tooltipFadeIn 300ms ease-out',
      }}
    >
      <div className="text-sm text-gray-700 leading-relaxed font-medium">
        {getMessage()}
      </div>
    </div>
  ) : null;

  return mounted ? createPortal(
    <>
      {tooltipEl}
      <style>{`
        @keyframes tooltipFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>,
    document.body
  ) : null;
};

export default InspectionPhotoTooltip;
