'use client';

import { useState } from 'react';
import { FaUpload, FaTimes, FaFilePdf } from 'react-icons/fa';
import { toast } from 'sonner';

interface Section {
  id: string;
  name: string;
}

interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentSectionId: string;
  currentSectionName: string;
  allSections?: Section[]; // Para duplicado sincronizado
  uploadEndpoint: string; // '/api/guides/upload' o '/api/downloads/upload'
  createEndpoint: string; // '/api/guides/files' o '/api/downloads/files'
}

export default function UploadFileModal({
  isOpen,
  onClose,
  onSuccess,
  currentSectionId,
  currentSectionName,
  allSections = [],
  uploadEndpoint,
  createEndpoint
}: UploadFileModalProps) {
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [markAsNew, setMarkAsNew] = useState(true);
  const [duplicateIn, setDuplicateIn] = useState<string[]>([]);
  const [linkChanges, setLinkChanges] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Solo se permiten archivos PDF');
        return;
      }
      setFile(selectedFile);
      if (!name) {
        setName(selectedFile.name.replace('.pdf', ''));
      }
    }
  };

  const handleDuplicateToggle = (sectionId: string) => {
    setDuplicateIn(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !file) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setUploading(true);

    try {
      // 1. Subir archivo a Storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('section_id', currentSectionId);

      const uploadRes = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Error al subir archivo');
      }

      // 2. Crear registro en BD
      const createRes = await fetch(createEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: currentSectionId,
          name,
          file_url: uploadData.file_url,
          mark_as_new: markAsNew,
          duplicate_in: duplicateIn,
          link_changes: linkChanges
        })
      });

      const createData = await createRes.json();

      if (!createData.success) {
        throw new Error(createData.error || 'Error al crear archivo');
      }

      toast.success('Archivo subido exitosamente');
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Error al subir archivo');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setFile(null);
    setMarkAsNew(true);
    setDuplicateIn([]);
    setLinkChanges(false);
    onClose();
  };

  if (!isOpen) return null;

  const otherSections = allSections.filter(s => s.id !== currentSectionId);

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaUpload className="inline mr-2" />
              Subir Documento
            </h2>
            <p className="standard-modal-subtitle">{currentSectionName}</p>
          </div>
          <button onClick={handleClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <form id="upload-form" onSubmit={handleSubmit} className="space-y-6">
          {/* Nombre */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              Nombre del Documento *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Formulario de Solicitud"
              required
              className="
                w-full px-4 py-2
                border-2 border-gray-300 rounded-lg
                focus:border-[#8AAA19] focus:outline-none
              "
            />
          </div>

          {/* Archivo */}
          <div>
            <label className="block text-sm font-semibold text-[#010139] mb-2">
              Archivo PDF *
            </label>
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                required
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="
                  flex items-center justify-center gap-3
                  w-full px-4 py-3
                  border-2 border-dashed border-gray-300 rounded-lg
                  hover:border-[#8AAA19] hover:bg-gray-50
                  cursor-pointer transition-all
                "
              >
                {file ? (
                  <>
                    <FaFilePdf className="text-2xl text-red-600" />
                    <span className="font-medium text-gray-700">{file.name}</span>
                  </>
                ) : (
                  <>
                    <FaUpload className="text-2xl text-gray-400" />
                    <span className="text-gray-500">Click para seleccionar archivo PDF</span>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Marcar como Nuevo */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="mark-as-new"
              checked={markAsNew}
              onChange={(e) => setMarkAsNew(e.target.checked)}
              className="w-4 h-4 text-[#8AAA19] focus:ring-[#8AAA19] rounded"
            />
            <label htmlFor="mark-as-new" className="text-sm text-gray-700">
              Marcar como &quot;Nuevo&quot; (visible 24-48h)
            </label>
          </div>

          {/* Duplicar en otras secciones */}
          {otherSections.length > 0 && (
            <details className="border border-gray-200 rounded-lg">
              <summary className="p-4 cursor-pointer font-semibold text-[#010139] hover:bg-gray-50">
                Duplicar en otras secciones ({duplicateIn.length} seleccionadas)
              </summary>
              <div className="p-4 pt-0 space-y-2 max-h-48 overflow-y-auto">
                {otherSections.map(section => (
                  <div key={section.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`dup-${section.id}`}
                      checked={duplicateIn.includes(section.id)}
                      onChange={() => handleDuplicateToggle(section.id)}
                      className="w-4 h-4 text-[#8AAA19] focus:ring-[#8AAA19] rounded"
                    />
                    <label htmlFor={`dup-${section.id}`} className="text-sm text-gray-700">
                      {section.name}
                    </label>
                  </div>
                ))}

                {duplicateIn.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="link-changes"
                        checked={linkChanges}
                        onChange={(e) => setLinkChanges(e.target.checked)}
                        className="w-4 h-4 text-[#8AAA19] focus:ring-[#8AAA19] rounded"
                      />
                      <label htmlFor="link-changes" className="text-sm text-gray-700">
                        Vincular cambios (duplicado sincronizado)
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 ml-7">
                      Si activas esto, al editar/eliminar el archivo original se propagará a las copias
                    </p>
                  </div>
                )}
              </div>
            </details>
          )}

          </form>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="upload-form"
              disabled={uploading}
              className="standard-modal-button-primary"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Subiendo...</span>
                </>
              ) : (
                <>
                  <FaUpload />
                  <span>Subir Documento</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
