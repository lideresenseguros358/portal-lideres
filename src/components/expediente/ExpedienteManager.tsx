'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaUpload, FaDownload, FaTrash, FaFile, FaFilePdf, FaFileImage, FaPlus, FaTimes, FaEye } from 'react-icons/fa';
import { toast } from 'sonner';
import {
  uploadExpedienteDocument,
  getClientDocuments,
  getPolicyDocuments,
  deleteExpedienteDocument,
  getExpedienteDocumentUrl,
  type DocumentType,
  type ExpedienteDocument,
} from '@/lib/storage/expediente';

interface ExpedienteManagerProps {
  clientId: string;
  policyId?: string | null;
  showClientDocs?: boolean; // Mostrar cédula y licencia
  showPolicyDocs?: boolean; // Mostrar registro vehicular
  showOtros?: boolean; // Mostrar documentos tipo "otros"
  readOnly?: boolean; // Solo lectura (broker en algunos casos)
  onDocumentsChange?: (docs: ExpedienteDocument[]) => void;
}

export default function ExpedienteManager({
  clientId,
  policyId = null,
  showClientDocs = true,
  showPolicyDocs = true,
  showOtros = true,
  readOnly = false,
  onDocumentsChange,
}: ExpedienteManagerProps) {
  const [documents, setDocuments] = useState<ExpedienteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('cedula');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    try {
      let allDocs: ExpedienteDocument[] = [];

      // Load client documents
      if (showClientDocs) {
        const clientDocsResult = await getClientDocuments(clientId);
        if (clientDocsResult.ok && clientDocsResult.data) {
          allDocs = [...allDocs, ...clientDocsResult.data];
        }
      }

      // Load policy documents
      if (showPolicyDocs && policyId) {
        const policyDocsResult = await getPolicyDocuments(policyId);
        if (policyDocsResult.ok && policyDocsResult.data) {
          allDocs = [...allDocs, ...policyDocsResult.data];
        }
      }

      setDocuments(allDocs);
      onDocumentsChange?.(allDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [clientId, policyId, showClientDocs, showPolicyDocs, onDocumentsChange]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Selecciona un archivo');
      return;
    }

    if (uploadDocType === 'otros' && !uploadDocName.trim()) {
      toast.error('Ingresa un nombre para el documento');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadExpedienteDocument(
        clientId,
        uploadDocType === 'registro_vehicular' ? policyId : null,
        uploadDocType,
        uploadFile,
        {
          documentName: uploadDocType === 'otros' ? uploadDocName : undefined,
          notes: uploadNotes || undefined,
        }
      );

      if (result.ok) {
        toast.success('Documento subido exitosamente');
        setShowUploadModal(false);
        resetUploadForm();
        loadDocuments();
      } else {
        toast.error(result.error || 'Error al subir documento');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Error al subir documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('¿Estás seguro de eliminar este documento?')) {
      return;
    }

    try {
      const result = await deleteExpedienteDocument(docId);
      if (result.ok) {
        toast.success('Documento eliminado');
        loadDocuments();
      } else {
        toast.error(result.error || 'Error al eliminar documento');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const handleDownload = async (doc: ExpedienteDocument) => {
    try {
      const result = await getExpedienteDocumentUrl(doc.file_path);
      if (result.ok && result.url) {
        window.open(result.url, '_blank');
      } else {
        toast.error('Error al obtener URL del documento');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Error al descargar documento');
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadDocType('cedula');
    setUploadDocName('');
    setUploadNotes('');
  };

  const getDocumentIcon = (mimeType: string | null) => {
    if (!mimeType) return <FaFile className="text-gray-500" />;
    if (mimeType.includes('pdf')) return <FaFilePdf className="text-red-500" />;
    if (mimeType.includes('image')) return <FaFileImage className="text-blue-500" />;
    return <FaFile className="text-gray-500" />;
  };

  const getDocumentTypeLabel = (type: DocumentType, name: string | null) => {
    const labels: Record<DocumentType, string> = {
      cedula: 'CEDULA/PASAPORTE',
      licencia: 'Licencia',
      registro_vehicular: 'Registro Vehicular',
      otros: name || 'Otro Documento',
    };
    return labels[type];
  };

  // Get required documents that should always be shown
  const getRequiredDocuments = () => {
    const required: DocumentType[] = [];
    if (showClientDocs) {
      required.push('cedula');
    }
    return required;
  };

  // Check if a required document exists
  const hasRequiredDoc = (type: DocumentType) => {
    return documents.some(doc => doc.document_type === type);
  };

  const filterDocuments = () => {
    return documents.filter(doc => {
      if (!showClientDocs && (doc.document_type === 'cedula' || doc.document_type === 'licencia')) {
        return false;
      }
      if (!showPolicyDocs && doc.document_type === 'registro_vehicular') {
        return false;
      }
      if (!showOtros && doc.document_type === 'otros') {
        return false;
      }
      return true;
    });
  };

  const filteredDocs = filterDocuments();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-[#010139]">
          📁 Expediente del Cliente
        </h3>
        {!readOnly && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all text-xs font-medium"
          >
            <FaPlus size={12} />
            <span className="hidden sm:inline">Subir</span>
            <span className="sm:hidden">+</span>
          </button>
        )}
      </div>

      {/* Documents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
        {/* Required documents - always show */}
        {getRequiredDocuments().map((reqType) => {
          const doc = documents.find(d => d.document_type === reqType);
          const hasDoc = !!doc;

          if (hasDoc && doc) {
            // Document exists - show normally
            return (
              <div
                key={doc.id}
                className="flex items-center gap-2 p-2.5 sm:p-3 bg-white border border-gray-200 rounded-lg hover:border-[#8AAA19] transition-all"
              >
                <div className="text-lg sm:text-xl flex-shrink-0">
                  {getDocumentIcon(doc.mime_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#010139] truncate text-xs sm:text-sm">
                    {getDocumentTypeLabel(doc.document_type, doc.document_name)}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">{doc.file_name}</p>
                  {doc.notes && (
                    <p className="text-[10px] text-gray-600 italic mt-0.5">{doc.notes}</p>
                  )}
                  <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">
                    {new Date(doc.uploaded_at).toLocaleDateString('es-PA', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-[#010139] hover:bg-gray-100 rounded transition-all"
                    title="Descargar"
                  >
                    <FaDownload size={14} />
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                      title="Eliminar"
                    >
                      <FaTrash size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          } else {
            // Document missing - show placeholder with "Falta"
            return (
              <div
                key={reqType}
                className="flex items-center gap-2 p-2.5 sm:p-3 bg-amber-50 border border-amber-300 rounded-lg"
              >
                <div className="text-lg sm:text-xl flex-shrink-0 text-amber-600">
                  <FaFile />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-amber-900 text-xs sm:text-sm">
                    {getDocumentTypeLabel(reqType, null)}
                  </p>
                  <p className="text-xs text-amber-700 font-medium mt-0.5">
                    ⚠️ Falta
                  </p>
                </div>
                {!readOnly && (
                  <button
                    onClick={() => {
                      setUploadDocType(reqType);
                      setShowUploadModal(true);
                    }}
                    className="flex items-center gap-1 px-2 py-1.5 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-all text-xs font-medium"
                  >
                    <FaPlus size={10} />
                    Incluir
                  </button>
                )}
              </div>
            );
          }
        })}

        {/* Other uploaded documents */}
        {filteredDocs.filter(doc => !getRequiredDocuments().includes(doc.document_type)).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2.5 sm:p-3 bg-white border border-gray-200 rounded-lg hover:border-[#8AAA19] transition-all"
            >
              <div className="text-lg sm:text-xl flex-shrink-0">
                {getDocumentIcon(doc.mime_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#010139] truncate text-xs sm:text-sm">
                  {getDocumentTypeLabel(doc.document_type, doc.document_name)}
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">{doc.file_name}</p>
                {doc.notes && (
                  <p className="text-[10px] text-gray-600 italic mt-0.5">{doc.notes}</p>
                )}
                <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">
                  {new Date(doc.uploaded_at).toLocaleDateString('es-PA', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 text-[#010139] hover:bg-gray-100 rounded transition-all"
                  title="Descargar"
                >
                  <FaDownload size={14} />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                    title="Eliminar"
                  >
                    <FaTrash size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#010139]">Subir Documento</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="p-1.5 hover:bg-gray-100 rounded transition-all"
              >
                <FaTimes size={16} className="text-gray-600" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Document Type */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Tipo de Documento *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as DocumentType)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                >
                  {showClientDocs && <option value="cedula">CEDULA/PASAPORTE</option>}
                  {showClientDocs && <option value="licencia">Licencia</option>}
                  {showPolicyDocs && policyId && (
                    <option value="registro_vehicular">Registro Vehicular</option>
                  )}
                  {showOtros && <option value="otros">Otros</option>}
                </select>
              </div>

              {/* Document Name (only for "otros") */}
              {uploadDocType === 'otros' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nombre del Documento *
                  </label>
                  <input
                    type="text"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    placeholder="Ej: Carta de autorización"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                  />
                </div>
              )}

              {/* File Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Archivo *
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-sm"
                />
                <p className="text-[10px] text-gray-500 mt-1">
                  PDF, JPG, PNG, WebP (máx. 10MB)
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Notas (opcional)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas sobre este documento..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none resize-none text-sm"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadForm();
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? 'Subiendo...' : 'Subir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
