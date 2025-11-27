'use client';

import { useState, useEffect } from 'react';
import { FaUpload, FaDownload, FaEdit, FaTrash, FaFileAlt, FaFilePdf, FaFileImage, FaFile, FaPlus, FaTimes, FaStar, FaRegStar, FaArrowUp, FaArrowDown, FaSearch, FaFolderOpen } from 'react-icons/fa';
import { toast } from 'sonner';

interface Document {
  id: string;
  name: string;
  file_url: string;
  display_order: number;
  created_at: string;
  created_by_name: string;
  show_new_badge: boolean;
}

interface FolderDocumentsProps {
  folderId: string;
  isMaster: boolean;
  onUpdate?: () => void;
}

export default function FolderDocuments({ folderId, isMaster, onUpdate }: FolderDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMarkNew, setUploadMarkNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingDoc, setMovingDoc] = useState<Document | null>(null);
  const [targetSectionId, setTargetSectionId] = useState('');
  const [availableSections, setAvailableSections] = useState<any[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  useEffect(() => {
    loadDocuments();
    // Cargar favoritos
    const storedFavorites = localStorage.getItem(`guide_favorites_${folderId}`);
    if (storedFavorites) {
      try {
        const favArray = JSON.parse(storedFavorites);
        setFavorites(new Set(favArray));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guides/files?section_id=${folderId}`);
      const data = await res.json();
      if (data.success) {
        setDocuments(data.files);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (doc: Document) => {
    window.open(doc.file_url, '_blank');
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Selecciona un archivo');
      return;
    }

    setUploading(true);
    try {
      // 1. Subir archivo
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('folder', 'guides');

      const uploadRes = await fetch('/api/guides/upload', {
        method: 'POST',
        body: formData
      });

      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        throw new Error(uploadData.error || 'Error al subir archivo');
      }

      // 2. Crear registro
      const createRes = await fetch('/api/guides/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: folderId,
          name: uploadFile.name,
          file_url: uploadData.url,
          mark_as_new: uploadMarkNew
        })
      });

      const createData = await createRes.json();
      if (createData.success) {
        toast.success('Documento cargado');
        setShowUploadModal(false);
        setUploadFile(null);
        setUploadMarkNew(false);
        loadDocuments();
        onUpdate?.();
      } else {
        throw new Error(createData.error || 'Error al crear documento');
      }
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast.error(error.message || 'Error al cargar documento');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setShowEditModal(true);
  };

  const handleUpdateName = async (newName: string) => {
    if (!editingDoc || !newName.trim()) return;

    try {
      const res = await fetch('/api/guides/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingDoc.id,
          action: 'rename',
          params: { name: newName }
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Documento renombrado');
        setShowEditModal(false);
        setEditingDoc(null);
        loadDocuments();
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al renombrar');
      }
    } catch (error) {
      console.error('Error updating document:', error);
      toast.error('Error al actualizar documento');
    }
  };

  const handleMove = async () => {
    if (!movingDoc || !targetSectionId) return;

    try {
      const res = await fetch('/api/guides/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: movingDoc.id,
          action: 'move',
          section_id: targetSectionId
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Archivo movido correctamente');
        setShowMoveModal(false);
        setMovingDoc(null);
        setTargetSectionId('');
        loadDocuments();
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al mover archivo');
      }
    } catch (error) {
      console.error('Error moving document:', error);
      toast.error('Error al mover archivo');
    }
  };

  const loadAvailableSections = async () => {
    setLoadingSections(true);
    try {
      const res = await fetch('/api/guides/sections');
      const data = await res.json();
      if (data.success) {
        setAvailableSections(data.sections.filter((s: any) => s.id !== folderId));
      }
    } catch (error) {
      console.error('Error loading sections:', error);
      toast.error('Error al cargar carpetas');
    } finally {
      setLoadingSections(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('¿Está seguro de eliminar este documento?')) return;

    try {
      const res = await fetch(`/api/guides/files?id=${docId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Documento eliminado');
        loadDocuments();
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  const handleToggleFavorite = (docId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(docId)) {
        newFavorites.delete(docId);
        toast.success('Removido de favoritos');
      } else {
        newFavorites.add(docId);
        toast.success('Agregado a favoritos');
      }
      localStorage.setItem(`guide_favorites_${folderId}`, JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
  };

  const handleReorder = async (docId: string, direction: 'up' | 'down') => {
    const docIndex = documents.findIndex(d => d.id === docId);
    if (docIndex === -1) return;

    if ((direction === 'up' && docIndex === 0) || (direction === 'down' && docIndex === documents.length - 1)) {
      toast.info('El documento ya está en la posición límite');
      return;
    }

    const targetIndex = direction === 'up' ? docIndex - 1 : docIndex + 1;
    const doc = documents[docIndex];
    const targetDoc = documents[targetIndex];
    
    if (!doc || !targetDoc) return;

    try {
      await fetch('/api/guides/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          action: 'reorder',
          params: { display_order: targetDoc.display_order }
        })
      });

      await fetch('/api/guides/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetDoc.id,
          action: 'reorder',
          params: { display_order: doc.display_order }
        })
      });

      toast.success('Orden actualizado');
      loadDocuments();
      onUpdate?.();
    } catch (error) {
      console.error('Error reordering:', error);
      toast.error('Error al reordenar');
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FaFilePdf className="text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <FaFileImage className="text-blue-500" />;
      case 'doc':
      case 'docx':
        return <FaFileAlt className="text-blue-600" />;
      default:
        return <FaFile className="text-gray-500" />;
    }
  };

  // Filtrar y ordenar
  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorites = !filterFavorites || favorites.has(doc.id);
      return matchesSearch && matchesFavorites;
    })
    .sort((a, b) => {
      const aFav = favorites.has(a.id);
      const bFav = favorites.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return a.display_order - b.display_order;
    });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Cargando documentos...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Barra de controles */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Búsqueda */}
          <div className="relative flex-1 w-full sm:max-w-md">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filterFavorites
                  ? 'bg-yellow-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FaStar />
              <span>Favoritos</span>
              {favorites.size > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-white bg-opacity-30 rounded-full text-xs">
                  {favorites.size}
                </span>
              )}
            </button>

            {isMaster && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
              >
                <FaPlus />
                <span className="hidden sm:inline">Cargar</span>
              </button>
            )}
          </div>
        </div>

        {/* Info filtros */}
        {(searchTerm || filterFavorites) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Mostrando {filteredDocuments.length} de {documents.length} documentos</span>
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterFavorites(false);
              }}
              className="text-[#8AAA19] hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-lg">
          <FaFileAlt className="mx-auto text-6xl text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No hay documentos en esta carpeta</p>
          {isMaster && (
            <p className="text-gray-400 text-sm mt-2">Haz clic en "Cargar" para agregar archivos</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc, index) => {
            const isFavorite = favorites.has(doc.id);
            const canMoveUp = index > 0;
            const canMoveDown = index < filteredDocuments.length - 1;

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-xl shadow-lg border-2 hover:shadow-xl transition-all p-4 ${
                  isFavorite ? 'border-yellow-400' : 'border-gray-100 hover:border-[#8AAA19]'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {doc.show_new_badge && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold animate-pulse">
                        ¡NUEVO!
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggleFavorite(doc.id)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isFavorite
                        ? 'text-yellow-500 hover:bg-yellow-50'
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
                    }`}
                  >
                    {isFavorite ? <FaStar size={16} /> : <FaRegStar size={16} />}
                  </button>
                </div>

                {/* Archivo info */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="text-3xl flex-shrink-0">
                    {getFileIcon(doc.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[#010139] break-words line-clamp-2">
                      {doc.name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Por: {doc.created_by_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString('es-PA')}
                    </p>
                  </div>
                </div>

                {/* Botones */}
                <div className="space-y-2 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload(doc)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all text-sm font-medium"
                    >
                      <FaDownload size={12} />
                      <span>Descargar</span>
                    </button>
                    {isMaster && (
                      <>
                        <button
                          onClick={() => handleEdit(doc)}
                          className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all"
                          title="Editar nombre"
                        >
                          <FaEdit size={12} />
                        </button>
                        <button
                          onClick={() => {
                            setMovingDoc(doc);
                            loadAvailableSections();
                            setShowMoveModal(true);
                          }}
                          className="px-3 py-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition-all"
                          title="Mover a otra carpeta"
                        >
                          <FaFolderOpen size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                          title="Eliminar"
                        >
                          <FaTrash size={12} />
                        </button>
                      </>
                    )}
                  </div>

                  {isMaster && (canMoveUp || canMoveDown) && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReorder(doc.id, 'up')}
                        disabled={!canMoveUp}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                          canMoveUp
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <FaArrowUp size={10} />
                        <span>Arriba</span>
                      </button>
                      <button
                        onClick={() => handleReorder(doc.id, 'down')}
                        disabled={!canMoveDown}
                        className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                          canMoveDown
                            ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <FaArrowDown size={10} />
                        <span>Abajo</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#010139]">Cargar Documento</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFile(null);
                  setUploadMarkNew(false);
                }}
                className="text-gray-400 hover:text-gray-600"
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
                  <span className="text-sm text-gray-700">Marcar como nuevo (48 horas)</span>
                </label>
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
        </div>
      )}

      {/* Modal de Mover a Otra Carpeta */}
      {showMoveModal && movingDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#010139] flex items-center gap-2">
                <FaFolderOpen className="text-purple-600" />
                Mover Archivo
              </h3>
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMovingDoc(null);
                  setTargetSectionId('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <FaTimes />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 truncate">
                {movingDoc.name}
              </p>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Selecciona carpeta destino:
            </label>

            {loadingSections ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#8AAA19] border-t-transparent"></div>
                <p className="text-sm text-gray-600 mt-2">Cargando carpetas...</p>
              </div>
            ) : availableSections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No hay otras carpetas disponibles</p>
              </div>
            ) : (
              <>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none mb-4"
                >
                  <option value="">-- Selecciona una carpeta --</option>
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} ({section.files_count || 0} archivo{(section.files_count || 0) !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>

                {targetSectionId && (
                  <div className="mb-4 p-3 bg-purple-50 border-l-4 border-purple-500 rounded">
                    <p className="text-sm text-purple-800">
                      ✓ El archivo se moverá a la carpeta seleccionada
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowMoveModal(false);
                  setMovingDoc(null);
                  setTargetSectionId('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleMove}
                disabled={!targetSectionId}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Mover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Editar */}
      {showEditModal && editingDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#010139]">Editar Documento</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingDoc(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del documento
                </label>
                <input
                  type="text"
                  defaultValue={editingDoc.name}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateName((e.target as HTMLInputElement).value);
                    }
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  id="edit-doc-name"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDoc(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const input = document.getElementById('edit-doc-name') as HTMLInputElement;
                    handleUpdateName(input.value);
                  }}
                  className="flex-1 px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all font-semibold"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
