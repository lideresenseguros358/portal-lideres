'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FaUpload, FaDownload, FaTrash, FaFile, FaFilePdf, FaFileImage, FaPlus, FaTimes, FaEye, FaIdCard, FaFolderPlus } from 'react-icons/fa';
import { toast } from 'sonner';
import {
  uploadExpedienteDocument,
  getClientDocuments,
  getPolicyDocuments,
  deleteExpedienteDocument,
  getExpedienteDocumentUrl,
  getClientDocumentLimit,
  DOCUMENTS_PER_POLICY,
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
  // Control externo del modal (para evitar que se cierre por re-renders)
  externalModalOpen?: boolean;
  onExternalModalChange?: (open: boolean) => void;
}

export default function ExpedienteManager({
  clientId,
  policyId = null,
  showClientDocs = true,
  showPolicyDocs = true,
  showOtros = true,
  readOnly = false,
  onDocumentsChange,
  externalModalOpen,
  onExternalModalChange,
}: ExpedienteManagerProps) {
  const [documents, setDocuments] = useState<ExpedienteDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  
  // Usar control externo si está disponible, sino usar interno
  const showUploadModal = externalModalOpen !== undefined ? externalModalOpen : internalModalOpen;
  const setShowUploadModal = (open: boolean) => {
    if (onExternalModalChange) {
      onExternalModalChange(open);
    } else {
      setInternalModalOpen(open);
    }
  };
  
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string; type: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [clientDocLimit, setClientDocLimit] = useState<{ count: number; maxAllowed: number; remaining: number; policyCount: number } | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<DocumentType>('cedula');
  const [uploadDocName, setUploadDocName] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [mounted, setMounted] = useState(false);

  // Montar el componente en el cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  // Función para forzar la descarga de archivos (programatically)
  const forceDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Error al descargar archivo:', error);
      toast.error('Error al descargar el archivo');
    }
  };

  // Usar ref para onDocumentsChange para evitar re-renders constantes
  const onDocumentsChangeRef = useRef(onDocumentsChange);
  useEffect(() => {
    onDocumentsChangeRef.current = onDocumentsChange;
  }, [onDocumentsChange]);

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

      // Load client document limit (5 × number of policies)
      const limitResult = await getClientDocumentLimit(clientId);
      if (limitResult.ok && limitResult.count !== undefined && limitResult.maxAllowed !== undefined && limitResult.remaining !== undefined && limitResult.policyCount !== undefined) {
        setClientDocLimit({
          count: limitResult.count,
          maxAllowed: limitResult.maxAllowed,
          remaining: limitResult.remaining,
          policyCount: limitResult.policyCount,
        });
      }

      setDocuments(allDocs);
      onDocumentsChangeRef.current?.(allDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  }, [clientId, policyId, showClientDocs, showPolicyDocs]);

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

  const handlePreview = async (doc: ExpedienteDocument) => {
    setLoadingPreview(true);
    try {
      const result = await getExpedienteDocumentUrl(doc.file_path);
      if (result.ok && result.url) {
        setPreviewDoc({
          url: result.url,
          name: doc.file_name,
          type: doc.mime_type || ''
        });
      } else {
        toast.error('Error al obtener URL del documento');
      }
    } catch (error) {
      console.error('Error previewing document:', error);
      toast.error('Error al previsualizar documento');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (doc: ExpedienteDocument) => {
    try {
      const result = await getExpedienteDocumentUrl(doc.file_path);
      if (result.ok && result.url) {
        await forceDownload(result.url, doc.file_name);
      } else {
        toast.error('Error al obtener la URL del documento');
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
    <div className="space-y-3">
      {/* Header with "Nuevo Documento" button - Mobile First */}
      {!readOnly && (
        <div className="flex items-center justify-end">
          <button
            onClick={() => setShowUploadModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold"
          >
            <FaFolderPlus size={14} />
            <span>Nuevo Documento</span>
          </button>
        </div>
      )}

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
                <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handlePreview(doc)}
                    disabled={loadingPreview}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all disabled:opacity-50"
                    title="Previsualizar"
                  >
                    <FaEye size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-all"
                    title="Descargar"
                  >
                    <FaDownload size={16} />
                  </button>
                  {!readOnly && (
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all hover:scale-110"
                      title="Eliminar documento"
                    >
                      <FaTrash size={18} className="text-red-600" />
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
                className="flex flex-col gap-2 p-2.5 sm:p-3 bg-amber-50 border border-amber-300 rounded-lg"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
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
                </div>
                {!readOnly && (
                  <button
                    onClick={() => {
                      setUploadDocType(reqType);
                      setShowUploadModal(true);
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all text-xs font-semibold shadow-md hover:shadow-lg"
                    title="Subir cédula/pasaporte del cliente"
                  >
                    <FaIdCard size={12} />
                    <span>Incluir Cédula</span>
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
              <div className="flex flex-col sm:flex-row items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handlePreview(doc)}
                  disabled={loadingPreview}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all disabled:opacity-50"
                  title="Previsualizar"
                >
                  <FaEye size={16} />
                </button>
                <button
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-all"
                  title="Descargar"
                >
                  <FaDownload size={16} />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all hover:scale-110"
                    title="Eliminar documento"
                  >
                    <FaTrash size={18} className="text-red-600" />
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Preview Modal */}
      {previewDoc && mounted && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] sm:max-h-[85vh] overflow-hidden border-2 border-gray-200 flex flex-col my-4 sm:my-8">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-[#010139] to-[#020270] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg">
                  <FaEye size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Previsualización</h3>
                  <p className="text-xs text-white/80 truncate max-w-md">{previewDoc.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Solo mostrar botón de descarga si NO es PDF (los PDFs tienen su propio botón) */}
                {!previewDoc.type.includes('pdf') && (
                  <button
                    onClick={() => forceDownload(previewDoc.url, previewDoc.name)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all flex items-center gap-2 text-sm font-semibold"
                    title="Descargar"
                  >
                    <FaDownload size={16} className="text-white" />
                    <span className="hidden sm:inline text-white">Descargar</span>
                  </button>
                )}
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <FaTimes size={18} className="text-white" />
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto bg-gray-100 p-4">
              {previewDoc.type.includes('pdf') ? (
                <iframe
                  src={previewDoc.url}
                  className="w-full h-full min-h-[600px] rounded-lg bg-white"
                  title={previewDoc.name}
                />
              ) : previewDoc.type.includes('image') ? (
                <div className="flex items-center justify-center h-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.name}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FaFile size={64} className="text-gray-400" />
                  <p className="text-gray-600">No se puede previsualizar este tipo de archivo</p>
                  <button
                    onClick={() => forceDownload(previewDoc.url, previewDoc.name)}
                    className="px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center gap-2"
                  >
                    <FaDownload size={16} />
                    Descargar Archivo
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Upload Modal */}
      {showUploadModal && mounted && createPortal(
        <div 
          className="standard-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowUploadModal(false);
              resetUploadForm();
            }
          }}
        >
          <div 
            className="standard-modal-container max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="standard-modal-header">
              <div>
                <h2 className="standard-modal-title">
                  <FaFolderPlus className="inline mr-2" />
                  Subir Documento
                </h2>
                <p className="standard-modal-subtitle">
                  Agregar archivo al expediente del cliente
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="standard-modal-close"
                type="button"
              >
                <FaTimes size={24} />
              </button>
            </div>

            <div className="standard-modal-content">
              {/* Client Document Limit Info */}
              {clientDocLimit && (
                <div className={`rounded-lg p-4 border-l-4 ${
                  clientDocLimit.remaining > 0
                    ? 'bg-blue-50 border-blue-500'
                    : 'bg-red-50 border-red-500'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-shrink-0 text-lg">
                      {clientDocLimit.remaining > 0 ? '📊' : '⚠️'}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${
                        clientDocLimit.remaining > 0 ? 'text-blue-900' : 'text-red-900'
                      }`}>
                        {clientDocLimit.remaining > 0
                          ? `Documentos del cliente: ${clientDocLimit.count} de ${clientDocLimit.maxAllowed}`
                          : `Límite alcanzado: ${clientDocLimit.count}/${clientDocLimit.maxAllowed}`}
                      </p>
                      <p className={`text-xs mt-1 ${
                        clientDocLimit.remaining > 0 ? 'text-blue-700' : 'text-red-700'
                      }`}>
                        {clientDocLimit.remaining > 0
                          ? `Límite: ${DOCUMENTS_PER_POLICY} documentos × ${clientDocLimit.policyCount} póliza(s) = ${clientDocLimit.maxAllowed} en total. Puedes subir ${clientDocLimit.remaining} más.`
                          : `Este cliente ya tiene el máximo de documentos permitidos (${DOCUMENTS_PER_POLICY} por cada una de sus ${clientDocLimit.policyCount} póliza(s)). Elimina alguno para subir uno nuevo.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaFile size={14} className="text-[#8AAA19]" />
                  Tipo de Documento <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as DocumentType)}
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-all"
                >
                  {showClientDocs && (
                    <option value="cedula">🆔 CÉDULA/PASAPORTE</option>
                  )}
                  {showClientDocs && (
                    <option value="licencia">🚗 Licencia de Conducir</option>
                  )}
                  {showPolicyDocs && policyId && (
                    <option value="registro_vehicular">📄 Registro Vehicular</option>
                  )}
                  {showOtros && (
                    <option value="otros">📂 Otros Documentos</option>
                  )}
                </select>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  {uploadDocType === 'cedula' && 'ℹ️ Documento de identificación del cliente'}
                  {uploadDocType === 'licencia' && 'ℹ️ Licencia de conducir vigente'}
                  {uploadDocType === 'registro_vehicular' && 'ℹ️ Registro del vehículo asegurado'}
                  {uploadDocType === 'otros' && 'ℹ️ Documento adicional personalizado'}
                </p>
              </div>

              {/* Document Name (only for "otros") */}
              {uploadDocType === 'otros' && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    ✏️ Nombre del Documento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={uploadDocName}
                    onChange={(e) => setUploadDocName(e.target.value)}
                    placeholder="Ej: Carta de autorización, Certificado médico..."
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none"
                  />
                  <p className="text-xs text-blue-700 mt-2">
                    💡 Dale un nombre descriptivo para identificarlo fácilmente
                  </p>
                </div>
              )}

              {/* File Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <FaUpload size={14} className="text-[#8AAA19]" />
                  Seleccionar Archivo <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none hover:border-[#8AAA19] transition-all cursor-pointer"
                  />
                </div>
                {uploadFile ? (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                    <FaFilePdf size={16} className="text-green-600" />
                    <span className="text-sm text-green-800 font-medium truncate">
                      {uploadFile.name}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    📁 Formatos aceptados: PDF, JPG, PNG (máx. 10MB por archivo)
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Notas (opcional)
                </label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  rows={3}
                  placeholder="Agrega notas o comentarios sobre este documento..."
                  className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none resize-none"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="standard-modal-footer">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                disabled={uploading}
                className="standard-modal-button-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !uploadFile || (clientDocLimit !== null && clientDocLimit.remaining === 0)}
                className="standard-modal-button-primary"
              >
                  {uploading ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Subiendo...</span>
                    </>
                  ) : (
                    <>
                      <FaUpload size={14} />
                      <span>Subir Documento</span>
                    </>
                  )}
                </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
