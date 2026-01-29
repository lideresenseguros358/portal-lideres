/**
 * Wrapper reutilizable para secciones del proceso de emisión
 * Estilo ASSA: Estados visibles, colapsable, validación
 */

'use client';

import { ReactNode, useState, useEffect } from 'react';
import { FaCheck, FaExclamationTriangle, FaLock, FaChevronDown, FaChevronUp } from 'react-icons/fa';

export type SectionStatus = 'locked' | 'pending' | 'in-progress' | 'complete';

interface EmissionSectionProps {
  id: string;
  title: string;
  subtitle?: string;
  icon: ReactNode;
  status: SectionStatus;
  canAccess: boolean;
  isActive: boolean;
  children: ReactNode;
  onStatusChange?: (status: SectionStatus) => void;
  onActivate?: () => void;
}

export default function EmissionSection({
  id,
  title,
  subtitle,
  icon,
  status,
  canAccess,
  isActive,
  children,
  onStatusChange,
  onActivate,
}: EmissionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);

  // Auto-expandir cuando se activa
  useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
      // Scroll suave a la sección
      setTimeout(() => {
        document.getElementById(`section-${id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }, 100);
    } else if (status === 'complete') {
      setIsExpanded(false);
    }
  }, [isActive, id, status]);

  const handleHeaderClick = () => {
    if (!canAccess) return;
    
    if (status === 'complete' || isActive) {
      setIsExpanded(!isExpanded);
    }
    
    if (onActivate && !isActive) {
      onActivate();
    }
  };

  // Estilos según estado
  const getStatusStyles = () => {
    switch (status) {
      case 'locked':
        return {
          border: 'border-gray-300',
          bg: 'bg-gray-50',
          textColor: 'text-gray-400',
          icon: <FaLock className="text-gray-400" />,
          badge: null,
        };
      case 'pending':
        return {
          border: 'border-amber-400',
          bg: 'bg-amber-50',
          textColor: 'text-amber-900',
          icon: <FaExclamationTriangle className="text-amber-500" />,
          badge: (
            <span className="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded-full">
              PENDIENTE
            </span>
          ),
        };
      case 'in-progress':
        return {
          border: 'border-blue-500',
          bg: 'bg-blue-50',
          textColor: 'text-blue-900',
          icon: <div className="w-5 h-5 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />,
          badge: (
            <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">
              EN PROGRESO
            </span>
          ),
        };
      case 'complete':
        return {
          border: 'border-[#8AAA19]',
          bg: 'bg-green-50',
          textColor: 'text-[#010139]',
          icon: <FaCheck className="text-[#8AAA19]" />,
          badge: (
            <span className="px-3 py-1 bg-[#8AAA19] text-white text-xs font-bold rounded-full">
              COMPLETO
            </span>
          ),
        };
      default:
        return {
          border: 'border-gray-300',
          bg: 'bg-white',
          textColor: 'text-gray-700',
          icon: null,
          badge: null,
        };
    }
  };

  const styles = getStatusStyles();
  const isLocked = status === 'locked' || !canAccess;

  return (
    <div
      id={`section-${id}`}
      className={`rounded-2xl border-2 ${styles.border} ${styles.bg} overflow-hidden transition-all duration-300 ${
        isLocked ? 'opacity-60' : 'shadow-lg'
      }`}
      style={{ scrollMarginTop: '100px' }}
    >
      {/* Header - Siempre visible */}
      <button
        onClick={handleHeaderClick}
        disabled={isLocked}
        className={`w-full p-6 flex items-center gap-4 transition-colors ${
          isLocked
            ? 'cursor-not-allowed'
            : 'cursor-pointer hover:bg-opacity-80'
        }`}
        type="button"
      >
        {/* Icono de sección */}
        <div className="flex-shrink-0 text-2xl">
          {icon}
        </div>

        {/* Título y subtítulo */}
        <div className="flex-1 text-left">
          <h3 className={`text-lg sm:text-xl font-bold ${styles.textColor}`}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Badge de estado */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {styles.badge}
          {styles.icon}
          
          {/* Chevron para colapsar/expandir (solo si no está locked) */}
          {!isLocked && (
            <div className="text-gray-400 ml-2">
              {isExpanded ? <FaChevronUp size={20} /> : <FaChevronDown size={20} />}
            </div>
          )}
        </div>
      </button>

      {/* Contenido - Colapsable */}
      <div
        className={`transition-all duration-300 ease-out ${
          isExpanded ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="p-6 pt-0 border-t-2 border-gray-200">
          {children}
        </div>
      </div>
    </div>
  );
}
