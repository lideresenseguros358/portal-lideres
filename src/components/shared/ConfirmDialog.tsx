'use client';

import { useEffect } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTimes } from 'react-icons/fa';

type DialogType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title?: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Aceptar',
  cancelText = 'Cancelar'
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <FaCheckCircle className="text-[#8AAA19] text-5xl" />;
      case 'error':
        return <FaExclamationTriangle className="text-red-500 text-5xl" />;
      case 'warning':
        return <FaExclamationTriangle className="text-orange-500 text-5xl" />;
      case 'confirm':
        return <FaExclamationTriangle className="text-[#8AAA19] text-5xl" />;
      default:
        return <FaInfoCircle className="text-[#010139] text-5xl" />;
    }
  };

  const getTitle = () => {
    if (title) return title;
    switch (type) {
      case 'success':
        return 'Éxito';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Advertencia';
      case 'confirm':
        return 'Confirmar acción';
      default:
        return 'Información';
    }
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const isConfirmDialog = type === 'confirm' || !!onConfirm;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black bg-opacity-50 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full transform transition-all my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente corporativo */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h3 className="text-lg font-bold">{getTitle()}</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <FaTimes />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Icono */}
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>

          {/* Mensaje */}
          <div className="text-center mb-6">
            <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Botones */}
          <div className={`flex gap-3 ${isConfirmDialog ? 'justify-end' : 'justify-center'}`}>
            {isConfirmDialog && (
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors border border-gray-300"
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`px-6 py-2.5 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg ${
                type === 'error'
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : type === 'warning'
                  ? 'bg-orange-500 hover:bg-orange-600 text-white'
                  : type === 'success'
                  ? 'bg-[#8AAA19] hover:bg-[#6d8814] text-white'
                  : 'bg-[#010139] hover:bg-[#020270] text-white'
              }`}
              autoFocus
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
