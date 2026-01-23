'use client';

import { useState } from 'react';
import { FaTimes, FaCheckCircle, FaDatabase, FaFolder, FaExclamationTriangle } from 'react-icons/fa';
import { Button } from '@/components/ui/button';

interface EmitidoConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    saveToDatabase: boolean;
    documents: string[];
  }) => void;
  caseData: {
    client_name: string;
    policy_number: string;
    management_type: string;
    insurer_name?: string;
  };
}

export default function EmitidoConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  caseData
}: EmitidoConfirmModalProps) {
  const [saveToDatabase, setSaveToDatabase] = useState(true);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  if (!isOpen) return null;

  // Determinar documentos disponibles según tipo de caso
  const isAutoCase = caseData.management_type?.includes('AUTO') || false;
  const isVidaCase = caseData.management_type?.includes('VIDA') || false;

  const availableDocuments = [
    { id: 'cedula', label: 'Cédula / RUC', required: true },
    ...(isAutoCase ? [
      { id: 'licencia', label: 'Licencia de Conducir', required: true },
      { id: 'registro_vehicular', label: 'Registro Vehicular', required: true }, // OBLIGATORIO para auto
    ] : []),
    ...(isVidaCase ? [
      { id: 'examen_medico', label: 'Examen Médico', required: false },
    ] : []),
    { id: 'otros', label: 'Otros documentos', required: false },
  ];

  const handleToggleDocument = (docId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleConfirm = () => {
    // Validar documentos requeridos
    const missingRequired = availableDocuments
      .filter(doc => doc.required && !selectedDocuments.includes(doc.id))
      .map(doc => doc.label);

    if (missingRequired.length > 0) {
      alert(`⚠️ Documentos obligatorios faltantes:\n\n${missingRequired.join('\n')}\n\nPor favor selecciona todos los documentos obligatorios.`);
      return;
    }

    onConfirm({
      saveToDatabase,
      documents: selectedDocuments
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FaCheckCircle />
              Confirmar Cliente Emitido
            </h2>
            <p className="text-green-100 text-sm mt-1">
              {caseData.client_name} • Póliza: {caseData.policy_number}
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Pregunta 1: Guardar en BD */}
          <div className="mb-6">
            <div className="flex items-start gap-3 mb-3">
              <FaDatabase className="text-[#8AAA19] text-2xl mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  ¿Desea agregar este cliente a la base de datos?
                </h3>
                <p className="text-sm text-gray-600">
                  El cliente se registrará en <strong>preliminar de base de datos</strong> hasta que se complete toda la información requerida.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 ml-11">
              <button
                onClick={() => setSaveToDatabase(true)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  saveToDatabase
                    ? 'border-[#8AAA19] bg-green-50 text-[#8AAA19]'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="font-bold mb-1">✅ Sí, agregar a BD</div>
                <div className="text-xs">Recomendado para gestión completa</div>
              </button>
              <button
                onClick={() => setSaveToDatabase(false)}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  !saveToDatabase
                    ? 'border-[#8AAA19] bg-green-50 text-[#8AAA19]'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                <div className="font-bold mb-1">❌ No por ahora</div>
                <div className="text-xs">Solo actualizar status del caso</div>
              </button>
            </div>
          </div>

          {/* Pregunta 2: Documentos a guardar */}
          {saveToDatabase && (
            <div className="mb-6">
              <div className="flex items-start gap-3 mb-3">
                <FaFolder className="text-[#8AAA19] text-2xl mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    ¿Qué documentos desea guardar en el expediente?
                  </h3>
                  <p className="text-sm text-gray-600">
                    Selecciona los documentos que deseas incluir en el expediente del cliente.
                  </p>
                </div>
              </div>

              <div className="ml-11 space-y-2">
                {availableDocuments.map(doc => (
                  <label
                    key={doc.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDocuments.includes(doc.id)
                        ? 'border-[#8AAA19] bg-green-50'
                        : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedDocuments.includes(doc.id)}
                      onChange={() => handleToggleDocument(doc.id)}
                      className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                    />
                    <span className="flex-1 font-semibold text-gray-900">
                      {doc.label}
                      {doc.required && (
                        <span className="ml-2 text-red-600 text-xs font-bold">
                          * OBLIGATORIO
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>

              {isAutoCase && (
                <div className="ml-11 mt-4 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
                  <div className="flex items-start gap-2">
                    <FaExclamationTriangle className="text-amber-600 text-lg mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-1">
                        Importante para Trámites de Auto
                      </p>
                      <p className="text-xs text-amber-800">
                        Para <strong>Cobertura Completa</strong> y <strong>Daños a Terceros</strong>, 
                        el <strong>Registro Vehicular</strong> es obligatorio para completar el trámite.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumen */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <h4 className="font-bold text-blue-900 mb-2">📋 Resumen de la acción</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Status del caso: <strong>EMITIDO</strong> ✓</li>
              <li>
                • Base de datos: {saveToDatabase ? (
                  <strong className="text-green-700">Se registrará en preliminar</strong>
                ) : (
                  <strong className="text-gray-600">No se agregará</strong>
                )}
              </li>
              {saveToDatabase && selectedDocuments.length > 0 && (
                <li>
                  • Documentos: <strong>{selectedDocuments.length} seleccionado(s)</strong>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t flex items-center justify-between">
          <Button
            type="button"
            onClick={onClose}
            variant="outline"
            className="px-6"
          >
            Cancelar
          </Button>
          
          <Button
            type="button"
            onClick={handleConfirm}
            className="px-6 bg-green-600 hover:bg-green-700 text-white"
          >
            <FaCheckCircle className="mr-2" />
            Confirmar Emitido
          </Button>
        </div>
      </div>
    </div>
  );
}
