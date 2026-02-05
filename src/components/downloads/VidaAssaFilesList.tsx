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
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMarkNew, setUploadMarkNew] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VidaAssaFile | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const handleUpload = async () => {
    console.log('[VIDA ASSA] handleUpload iniciado');
    console.log('[VIDA ASSA] uploadFile:', uploadFile);
    console.log('[VIDA ASSA] folderId:', folderId);
    
    if (!uploadFile) {
      console.log('[VIDA ASSA] ERROR: No hay archivo seleccionado');
      toast.error('Selecciona un archivo');
      return;
    }

    console.log('[VIDA ASSA] Iniciando upload...');
    setUploading(true);
    try {
      // 1. Subir archivo a storage
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('section_id', folderId);
      formData.append('folder', 'downloads');

      console.log('[VIDA ASSA] Enviando a /api/downloads/upload');
      const uploadRes = await fetch('/api/downloads/upload', {
        method: 'POST',
        body: formData
      });

      console.log('[VIDA ASSA] Respuesta del servidor:', uploadRes.status);
      const uploadData = await uploadRes.json();
      console.log('[VIDA ASSA] Upload data:', uploadData);
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Error al subir archivo');
      }

      // 2. Crear registro en BD
      const createRes = await fetch('/api/vida-assa/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_id: folderId,
          name: uploadFile.name,
          file_url: uploadData.file_url,
          file_size: uploadFile.size,
          file_type: uploadFile.type,
          is_new: uploadMarkNew,
          marked_new_until: uploadMarkNew ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null
        })
      });

      const createData = await createRes.json();
      console.log('[VIDA ASSA] Create data:', createData);
      
      if (createData.success) {
        console.log('[VIDA ASSA] ✅ Documento cargado exitosamente');
        toast.success('Documento cargado');
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadMarkNew(false);
        onUpdate();
      } else {
        console.log('[VIDA ASSA] ❌ Error al crear documento:', createData.error);
        throw new Error(createData.error || 'Error al crear documento');
      }
    } catch (error: any) {
      console.error('[VIDA ASSA] ❌ ERROR CRÍTICO:', error);
      console.error('[VIDA ASSA] Error stack:', error.stack);
      toast.error(error.message || 'Error al cargar documento');
    } finally {
      console.log('[VIDA ASSA] Upload finalizado');
      setUploading(false);
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
            onClick={() => {
              console.log('[VIDA ASSA] Botón Subir Documento clickeado - empty state');
              setShowUploadModal(true);
            }}
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
            onClick={() => {
              console.log('[VIDA ASSA] Botón Subir Documento clickeado - with files');
              setShowUploadModal(true);
            }}
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivo *
                </label>
                <input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  disabled={uploading}
                />
                {uploadFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Seleccionado: {uploadFile.name}
                  </p>
                )}
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={uploadMarkNew}
                    onChange={(e) => setUploadMarkNew(e.target.checked)}
                    className="w-4 h-4 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                  />
                  <span className="text-sm text-gray-700">Marcar como nuevo (7 días)</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadMarkNew(false);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                disabled={uploading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Cargando...' : 'Cargar'}
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
