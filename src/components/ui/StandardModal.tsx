'use client';

import { ReactNode } from 'react';
import { FaTimes } from 'react-icons/fa';

interface StandardModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  hideCloseButton?: boolean;
}

/**
 * StandardModal - Modal estandarizado siguiendo el patrón de RegisterPaymentWizard
 * 
 * Características:
 * - Header fijo con gradiente corporativo
 * - Content con scroll independiente
 * - Footer fijo (opcional)
 * - Cierre al hacer clic fuera
 * - Sin bordes blancos en header/footer
 * - Totalmente responsive
 */
export function StandardModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '3xl',
  hideCloseButton = false,
}: StandardModalProps) {
  if (!isOpen) return null;

  const maxWidthClass = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  return (
    <div
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`standard-modal-container ${maxWidthClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">{title}</h2>
            {subtitle && (
              <p className="standard-modal-subtitle">{subtitle}</p>
            )}
          </div>
          {!hideCloseButton && (
            <button
              onClick={onClose}
              className="standard-modal-close"
              type="button"
            >
              <FaTimes size={24} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="standard-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface StandardModalFooterProps {
  onCancel?: () => void;
  onSubmit?: () => void;
  cancelText?: string;
  submitText?: string;
  loading?: boolean;
  disabled?: boolean;
  leftContent?: ReactNode;
}

/**
 * StandardModalFooter - Footer estandarizado para modales
 */
export function StandardModalFooter({
  onCancel,
  onSubmit,
  cancelText = 'Cancelar',
  submitText = 'Guardar',
  loading = false,
  disabled = false,
  leftContent,
}: StandardModalFooterProps) {
  return (
    <>
      <div className="flex-1">
        {leftContent}
      </div>
      
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="standard-modal-button-secondary"
          >
            {cancelText}
          </button>
        )}
        
        {onSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            disabled={loading || disabled}
            className="standard-modal-button-primary"
          >
            {loading ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                <span>Procesando...</span>
              </>
            ) : (
              submitText
            )}
          </button>
        )}
      </div>
    </>
  );
}
