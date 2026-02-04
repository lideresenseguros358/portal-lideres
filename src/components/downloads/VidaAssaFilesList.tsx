'use client';

import { useState } from 'react';
import { FaFilePdf, FaUpload, FaTrash, FaEdit, FaTimes, FaStar } from 'react-icons/fa';
import { toast } from 'sonner';
import BadgeNuevo from '@/components/shared/BadgeNuevo';

interface VidaAssaFile {
  id: string;
  name: string;
  file_url: string;
  file_size?: number;
  file_type?: string;
  is_new: boolean;
  marked_new_until?: string;
  created_at: string;
  uploaded_by?: string;
}

interface VidaAssaFilesListProps {
  folderId: string;
  files: VidaAssaFile[];
  isMaster: boolean;
  editMode: boolean;
  onUpdate: () => void;
}

export default function VidaAssaFilesList({ folderId, files, isMaster, editMode, onUpdate }: VidaAssaFilesListProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadFiles, setUploadFiles] = useState<Array<{ file: File; customName: string }>>([]);
  const [selectedFile, setSelectedFile] = useState<VidaAssaFile | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      toast.error('Selecciona al menos un archivo');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const totalFiles = uploadFiles.length;
    let uploadedCount = 0;

    try {
      for (const fileObj of uploadFiles) {
        // 1. Subir archivo a storage usando el mismo endpoint que downloads
        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('section_id', folderId);
        formData.append('folder', 'vida_assa');

        const uploadRes = await fetch('/api/downloads/upload', {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Error al subir archivo');
        }

        // 2. Crear registro en BD con nombre personalizado
        const res = await fetch('/api/vida-assa/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folder_id: folderId,
            name: fileObj.customName,
            file_url: uploadData.file_url,
            file_size: fileObj.file.size,
            file_type: fileObj.file.type,
            is_new: true,
            marked_new_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      toast.success(`${uploadedCount} archivo(s) subido(s) exitosamente`);
      setShowUploadModal(false);
      setUploadFiles([]);
      onUpdate();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast.error(error.message || 'Error al subir archivos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`¿Está seguro de eliminar "${fileName}"?`)) return;

    try {
      const res = await fetch(`/api/vida-assa/files?id=${fileId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Archivo eliminado');
        onUpdate();
      } else {
        toast.error(data.error || 'Error al eliminar archivo');
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error('Error al eliminar archivo');
    }
  };

  const handleEditFile = (file: VidaAssaFile) => {
    setSelectedFile(file);
    setNewFileName(file.name);
  };

  const handleUpdateFileName = async () => {
    if (!selectedFile || !newFileName.trim()) return;

    try {
      const res = await fetch('/api/vida-assa/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedFile.id,
          name: newFileName.trim()
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Nombre actualizado');
        setSelectedFile(null);
        setNewFileName('');
        onUpdate();
      } else {
        toast.error(data.error || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error updating file:', error);
      toast.error('Error al actualizar');
    }
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (files.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-lg border-2 border-gray-200">
        <FaFilePdf className="text-6xl text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-600 mb-2">
          No hay archivos en esta carpeta
        </h3>
        <p className="text-gray-500 mb-6">
          {isMaster ? 'Sube tu primer documento haciendo click en el botón de arriba' : 'Aún no se han subido archivos'}
        </p>
        {isMaster && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="
              px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2
              bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white
              shadow-md hover:shadow-lg hover:scale-105 mx-auto
            "
          >
            <FaUpload />
            Subir Documento
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Botón Subir (solo Master) */}
      {isMaster && (
        <div className="mb-6">
          <button
            onClick={() => setShowUploadModal(true)}
            className="
              px-6 py-3 rounded-lg font-semibold transition-all flex items-center gap-2
              bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white
              shadow-md hover:shadow-lg hover:scale-105
            "
          >
            <FaUpload />
            Subir Documento
          </button>
        </div>
      )}

      {/* Lista de archivos */}
      <div className="space-y-3">
        {files.map((file) => {
          const showNewBadge = file.is_new && file.marked_new_until && new Date(file.marked_new_until) > new Date();
          
          return (
            <div
              key={file.id}
              className="
                bg-white rounded-lg shadow-md
                border-2 border-gray-200
                hover:border-[#8AAA19] hover:shadow-lg
                transition-all duration-200
                p-4
              "
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <FaFilePdf className="text-3xl text-red-600 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[#010139] truncate">
                        {file.name}
                      </h3>
                      {showNewBadge && <BadgeNuevo show={true} />}
                    </div>
                    <p className="text-sm text-gray-500">
                      {new Date(file.created_at).toLocaleDateString('es-PA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      {file.file_size && ` • ${(file.file_size / 1024 / 1024).toFixed(2)} MB`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botón Descargar (siempre visible) */}
                  <button
                    onClick={() => handleDownload(file.file_url, file.name)}
                    className="
                      px-4 py-2 rounded-lg font-semibold transition-all
                      bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white
                      hover:shadow-lg hover:scale-105
                    "
                  >
                    Descargar
                  </button>

                  {/* Botones de edición (solo Master en editMode) */}
                  {isMaster && editMode && (
                    <>
                      <button
                        onClick={() => handleEditFile(file)}
                        className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                        title="Editar nombre"
                      >
                        <FaEdit />
                      </button>
                      <button
                        onClick={() => handleDeleteFile(file.id, file.name)}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <FaTrash />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Subir Archivo */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#010139]">Subir Documento</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={uploading}
              >
                <FaTimes size={20} />
              </button>
            </div>

            {/* Selección de archivos múltiples */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Archivos * (puedes seleccionar múltiples)
              </label>
              <input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  const newFiles = files.map(file => ({ file, customName: file.name }));
                  setUploadFiles(prev => [...prev, ...newFiles]);
                  e.target.value = '';
                }}
                disabled={uploading}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Formatos soportados: PDF, Word, Excel, Imágenes
              </p>
            </div>

            {/* Lista de archivos seleccionados */}
            {uploadFiles.length > 0 && (
              <div className="border-2 border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Archivos seleccionados ({uploadFiles.length})
                </p>
                <div className="space-y-2">
                  {uploadFiles.map((fileObj, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <FaFilePdf className="text-red-500 flex-shrink-0" />
                      <input
                        type="text"
                        value={fileObj.customName}
                        onChange={(e) => {
                          const updated = [...uploadFiles];
                          updated[index] = { file: fileObj.file, customName: e.target.value };
                          setUploadFiles(updated);
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:border-[#8AAA19] focus:outline-none"
                        placeholder="Nombre del archivo"
                        disabled={uploading}
                      />
                      <button
                        onClick={() => {
                          setUploadFiles(uploadFiles.filter((_, i) => i !== index));
                        }}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                        disabled={uploading}
                        title="Eliminar"
                      >
                        <FaTimes />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Barra de progreso */}
            {uploading && uploadProgress > 0 && (
              <div className="mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-[#8AAA19] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <p className="text-sm text-gray-600 mt-2 text-center">
                  Subiendo... {uploadProgress}%
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || uploadFiles.length === 0}
                className="flex-1 px-4 py-2 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors disabled:opacity-50"
              >
                {uploading ? `Subiendo ${uploadProgress}%` : `Subir ${uploadFiles.length} archivo(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Nombre */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#010139]">Editar Nombre</h3>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setNewFileName('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre del archivo
              </label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleUpdateFileName();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setNewFileName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateFileName}
                disabled={!newFileName.trim()}
                className="flex-1 px-4 py-2 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
