/**
 * Tooltip con hover y auto-cierre
 * - Se abre al pasar el cursor sobre el icono
 * - Se cierra automáticamente después de 8 segundos
 * - Se cierra al hacer click fuera del tooltip
 * - Renderizado via portal en document.body con posición absoluta (sigue el scroll)
 */

'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaQuestionCircle } from 'react-icons/fa';

interface AutoCloseTooltipProps {
  content: string;
  autoCloseDelay?: number;
  autoOpenOnMount?: boolean;
}

export interface AutoCloseTooltipRef {
  open: () => void;
  close: () => void;
}

const AutoCloseTooltip = forwardRef<AutoCloseTooltipRef, AutoCloseTooltipProps>(({
  content,
  autoCloseDelay = 8000,
  autoOpenOnMount = false
}, ref) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, width: 0 });
  const [mounted, setMounted] = useState(false);
  const hasAutoOpened = useRef(false);
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // Portal requires the DOM to be mounted
  useEffect(() => {
    setMounted(true);
  }, []);

  useImperativeHandle(ref, () => ({
    open: () => {
      computePosition();
      setIsOpen(true);
      setIsClosing(false);
    },
    close: () => handleClose(),
  }));

  // Compute tooltip position in document-absolute coordinates so it follows scroll
  const computePosition = () => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;

    const tooltipWidth = viewportWidth < 640 ? viewportWidth - margin * 2 : 320;

    // Horizontal: center under the trigger, clamp within viewport
    let left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
    if (left < margin) left = margin;
    if (left + tooltipWidth > viewportWidth - margin) left = viewportWidth - tooltipWidth - margin;

    // Vertical: below trigger, or above if it would go off-screen
    const estimatedHeight = 200;
    const fitsBelow = triggerRect.bottom + 12 + estimatedHeight <= viewportHeight - margin;
    const top = fitsBelow
      ? triggerRect.bottom + 12 + window.scrollY
      : triggerRect.top - estimatedHeight - 12 + window.scrollY;

    // left is still viewport-relative; convert to document-absolute
    setTooltipPosition({ top, left: left + window.scrollX, width: tooltipWidth });
  };

  // Recalculate position on every scroll while tooltip is open
  useEffect(() => {
    if (!isOpen) return;
    const onScroll = () => computePosition();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isOpen]);

  // Recalculate when tooltip opens
  useEffect(() => {
    if (isOpen) computePosition();
  }, [isOpen]);

  // Auto-cerrar después del delay
  useEffect(() => {
    if (isOpen && !isClosing) {
      closeTimerRef.current = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);
      return () => {
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      };
    }
  }, [isOpen, isClosing, autoCloseDelay]);

  // Cerrar al hacer click fuera del tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen &&
          tooltipRef.current &&
          triggerRef.current &&
          !tooltipRef.current.contains(event.target as Node) &&
          !triggerRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 300);
  };

  const handleMouseEnter = () => {
    if (!isOpen) {
      setIsOpen(true);
      setIsClosing(false);
    }
  };

  const handleMouseLeave = () => {
    if (isOpen) handleClose();
  };

  const tooltipEl = (isOpen || isClosing) && mounted ? (
    <div
      ref={tooltipRef}
      className={`absolute z-[9999] bg-sky-50/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 border border-sky-200/50 transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
      style={{
        top: tooltipPosition.top,
        left: tooltipPosition.left,
        width: tooltipPosition.width,
        animation: isClosing ? 'none' : 'tooltipFadeIn 300ms ease-out',
      }}
    >
      <div className="text-sm text-gray-700 leading-relaxed">
        {content}
      </div>
    </div>
  ) : null;

  return (
    <>
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
      </div>

      {mounted && createPortal(
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
      )}
    </>
  );
});

AutoCloseTooltip.displayName = 'AutoCloseTooltip';

export default AutoCloseTooltip;
