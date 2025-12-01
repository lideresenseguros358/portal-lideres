'use client';

import { X, FileDown, FileSpreadsheet } from 'lucide-react';

interface ExportFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFormat: (format: 'pdf' | 'excel') => void;
  selectedCount: number;
  totalCount: number;
}

export default function ExportFormatModal({ 
  isOpen, 
  onClose, 
  onSelectFormat, 
  selectedCount,
  totalCount 
}: ExportFormatModalProps) {
  if (!isOpen) return null;

  const exportingCount = selectedCount > 0 ? selectedCount : totalCount;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">Exportar Clientes</h2>
            <p className="standard-modal-subtitle">
              {selectedCount > 0 
                ? `${selectedCount} cliente${selectedCount !== 1 ? 's' : ''} seleccionado${selectedCount !== 1 ? 's' : ''}`
                : `Todos los clientes (${totalCount})`
              }
            </p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <p className="text-gray-700 mb-6">Selecciona el formato de exportación:</p>
          
          <div className="space-y-3">
            {/* PDF Option */}
            <button
              onClick={() => onSelectFormat('pdf')}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#010139] hover:bg-gray-50 transition-all group"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-lg group-hover:bg-red-200 transition-all">
                <FileDown className="text-red-600" size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-gray-900 text-lg">Formato PDF</h3>
                <p className="text-sm text-gray-600">Documento imprimible con tabla de clientes</p>
              </div>
              <div className="text-gray-400 group-hover:text-[#010139] transition-all">
                →
              </div>
            </button>

            {/* Excel Option */}
            <button
              onClick={() => onSelectFormat('excel')}
              className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-[#8AAA19] hover:bg-gray-50 transition-all group"
            >
              <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg group-hover:bg-green-200 transition-all">
                <FileSpreadsheet className="text-green-600" size={24} />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-gray-900 text-lg">Formato Excel</h3>
                <p className="text-sm text-gray-600">Hoja de cálculo editable (XLSX)</p>
              </div>
              <div className="text-gray-400 group-hover:text-[#8AAA19] transition-all">
                →
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <button
            type="button"
            onClick={onClose}
            className="standard-modal-button-secondary"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
