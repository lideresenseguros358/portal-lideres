/**
 * Sección: Documentos del Cliente
 * Upload de documentos en formato LISTA (NO sobre el auto)
 */

'use client';

import { useState, useRef } from 'react';
import { FaFileUpload, FaCamera, FaCheck, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';

interface DocumentFile {
  id: string;
  name: string;
  label: string;
  tooltip: string;
  file?: File;
  preview?: string;
  required: boolean;
}

export interface ClientDocuments {
  cedulaFile?: File;
  licenciaFile?: File;
  registroFile?: File;
}

interface ClientDocumentsSectionProps {
  initialData?: ClientDocuments;
  onComplete: (data: ClientDocuments) => void;
  documentNames?: {
    identidad?: string;
    licencia?: string;
    registro?: string;
  };
}

export default function ClientDocumentsSection({
  initialData,
  onComplete,
  documentNames = {
    identidad: 'Documento de Identidad (Cédula o Pasaporte)',
    licencia: 'Licencia de Conducir',
    registro: 'Registro Vehicular / Tarjeta de Circulación',
  },
}: ClientDocumentsSectionProps) {
  const [documents, setDocuments] = useState<DocumentFile[]>([
    {
      id: 'cedula',
      name: 'cedula',
      label: documentNames.identidad!,
      tooltip: 'Debe verse completo, legible y vigente. Formato: JPG, PNG o PDF (máx 5MB)',
      required: true,
    },
    {
      id: 'licencia',
      name: 'licencia',
      label: documentNames.licencia!,
      tooltip: 'Debe estar vigente y legible. Formato: JPG, PNG o PDF (máx 5MB)',
      required: true,
    },
    {
      id: 'registro',
      name: 'registro',
      label: documentNames.registro!,
      tooltip: 'Debe coincidir con la información del vehículo ingresado. Formato: JPG, PNG o PDF (máx 5MB)',
      required: true,
    },
  ]);

  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const handleFileSelect = async (docId: string, file: File | null) => {
    if (!file) return;

    // Validar tamaño (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo debe ser menor a 5MB');
      return;
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Solo se permiten archivos JPG, PNG o PDF');
      return;
    }

    // Crear preview si es imagen
    let preview: string | undefined;
    if (file.type.startsWith('image/')) {
      preview = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    }

    // Actualizar documento
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, file, preview } : doc
    ));

    const docLabel = documents.find(d => d.id === docId)?.label;
    toast.success(`${docLabel} adjuntado correctamente`);
  };

  const handleCameraCapture = (docId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment' as any;
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        handleFileSelect(docId, file);
      }
    };
    
    input.click();
  };

  const handleRemoveFile = (docId: string) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === docId ? { ...doc, file: undefined, preview: undefined } : doc
    ));
    
    const docLabel = documents.find(d => d.id === docId)?.label;
    toast.info(`${docLabel} eliminado`);
  };

  const handleSubmit = () => {
    const missingDocs = documents.filter(doc => doc.required && !doc.file);
    
    if (missingDocs.length > 0) {
      toast.error(`Faltan ${missingDocs.length} documento(s) por adjuntar`);
      return;
    }

    const data: ClientDocuments = {
      cedulaFile: documents.find(d => d.id === 'cedula')?.file,
      licenciaFile: documents.find(d => d.id === 'licencia')?.file,
      registroFile: documents.find(d => d.id === 'registro')?.file,
    };

    onComplete(data);
    toast.success('Documentos adjuntados correctamente');
  };

  const completedCount = documents.filter(d => d.file).length;
  const totalCount = documents.filter(d => d.required).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b-2 border-gray-200">
        <FaFileUpload className="text-[#010139] text-2xl" />
        <div>
          <h4 className="text-xl font-bold text-[#010139]">Documentos del Cliente</h4>
          <p className="text-sm text-gray-600">
            Adjunta los documentos requeridos ({completedCount} / {totalCount} completados)
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-semibold text-gray-700">Progreso de Documentos</span>
          <span className="font-bold text-[#8AAA19]">{completedCount} / {totalCount}</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-[#8AAA19] to-[#6d8814] transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>
      </div>

      {/* Lista de Documentos */}
      <div className="space-y-4">
        {documents.map((doc, index) => (
          <div
            key={doc.id}
            className={`border-2 rounded-xl overflow-hidden transition-all ${
              doc.file
                ? 'border-[#8AAA19] bg-green-50'
                : 'border-amber-400 bg-amber-50'
            }`}
          >
            {/* Header del documento */}
            <div className="p-4 flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {doc.file ? (
                  <div className="w-8 h-8 rounded-full bg-[#8AAA19] flex items-center justify-center">
                    <FaCheck className="text-white" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                    <FaExclamationTriangle className="text-white text-sm" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h5 className="font-bold text-gray-900 text-base mb-1">
                  {index + 1}. {doc.label}
                  {doc.required && <span className="text-red-500 ml-1">*</span>}
                </h5>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {doc.tooltip}
                </p>

                {/* Preview o Nombre del archivo */}
                {doc.file && (
                  <div className="mt-3 flex items-center gap-3">
                    {doc.preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={doc.preview}
                        alt={doc.label}
                        className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300"
                      />
                    ) : (
                      <div className="w-20 h-20 bg-gray-200 rounded-lg border-2 border-gray-300 flex items-center justify-center">
                        <FaFileUpload className="text-gray-500 text-2xl" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(doc.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(doc.id)}
                      className="flex-shrink-0 p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      type="button"
                      aria-label="Eliminar archivo"
                    >
                      <FaTimes size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Botones de acción (solo si no hay archivo) */}
            {!doc.file && (
              <div className="px-4 pb-4 flex gap-3">
                <input
                  ref={el => { fileInputRefs.current[doc.id] = el; }}
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => handleFileSelect(doc.id, e.target.files?.[0] || null)}
                  className="hidden"
                />
                
                <button
                  onClick={() => fileInputRefs.current[doc.id]?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 
                    bg-white border-2 border-[#8AAA19] text-[#8AAA19] rounded-lg
                    font-semibold hover:bg-[#8AAA19] hover:text-white transition-colors"
                  type="button"
                >
                  <FaFileUpload />
                  <span className="text-sm">Seleccionar Archivo</span>
                </button>

                <button
                  onClick={() => handleCameraCapture(doc.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 
                    bg-[#8AAA19] text-white rounded-lg font-semibold 
                    hover:bg-[#6d8814] transition-colors"
                  type="button"
                >
                  <FaCamera />
                  <span className="text-sm">Tomar Foto</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Alerta si faltan documentos */}
      {completedCount < totalCount && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <FaExclamationTriangle className="text-amber-600 text-xl flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Faltan {totalCount - completedCount} documento(s) por adjuntar
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Todos los documentos marcados con (*) son obligatorios para continuar
            </p>
          </div>
        </div>
      )}

      {/* Botón Guardar */}
      <div className="pt-6 border-t-2 border-gray-200">
        <button
          onClick={handleSubmit}
          disabled={completedCount < totalCount}
          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 ${
            completedCount === totalCount
              ? 'bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white hover:shadow-2xl hover:scale-105'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          type="button"
        >
          {completedCount === totalCount 
            ? 'Guardar y Continuar →' 
            : `Completa los ${totalCount - completedCount} documento(s) faltantes`}
        </button>
      </div>
    </div>
  );
}
