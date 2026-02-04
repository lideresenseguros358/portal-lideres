'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaUpload, FaDownload, FaEdit, FaTrash, FaFileAlt, FaFilePdf, FaFileImage, FaFile, FaPlus, FaTimes, FaStar, FaRegStar, FaArrowUp, FaArrowDown, FaSearch, FaFolderOpen, FaPencilAlt } from 'react-icons/fa';
import { toast } from 'sonner';

interface Document {
  id: string;
  name: string;
  file_url: string;
  section_id: string;
  section_name: string;
  display_order: number;
  created_at: string;
  created_by_name: string;
  show_new_badge: boolean;
  is_favorite?: boolean;
}

interface DocumentsListProps {
  scope: string;
  policyType: string;
  insurerId: string;
  isMaster: boolean;
  editMode?: boolean;
  onUpdate?: () => void;
}

export default function DocumentsList({ scope, policyType, insurerId, isMaster, editMode: externalEditMode, onUpdate }: DocumentsListProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [editMode, setEditMode] = useState(externalEditMode || false);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [uploadFiles, setUploadFiles] = useState<Array<{ file: File; customName: string }>>([]);
  const [uploadSectionId, setUploadSectionId] = useState('');
  const [uploadMarkNew, setUploadMarkNew] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
    loadSections();
    // Cargar favoritos de localStorage
    const storedFavorites = localStorage.getItem(`favorites_${insurerId}`);
    if (storedFavorites) {
      try {
        const favArray = JSON.parse(storedFavorites);
        setFavorites(new Set(favArray));
      } catch (e) {
        console.error('Error loading favorites:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, policyType, insurerId]);

  const loadSections = async () => {
    try {
      const res = await fetch(`/api/downloads/sections?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`);
      const data = await res.json();
      if (data.success) {
        setSections(data.sections);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
    }
  };

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Primero obtenemos las secciones
      const sectionsRes = await fetch(`/api/downloads/sections?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`);
      const sectionsData = await sectionsRes.json();
      
      if (sectionsData.success && sectionsData.sections) {
        // Luego obtenemos los documentos de todas las secciones
        const allDocs: Document[] = [];
        
        for (const section of sectionsData.sections) {
          const filesRes = await fetch(`/api/downloads/files?section_id=${section.id}`);
          const filesData = await filesRes.json();
          
          if (filesData.success && filesData.files) {
            const docsWithSection = filesData.files.map((file: any) => ({
              ...file,
              section_name: section.name
            }));
            allDocs.push(...docsWithSection);
          }
        }
        
        setDocuments(allDocs);
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
    if (uploadFiles.length === 0 || !uploadSectionId) {
      toast.error('Selecciona al menos un archivo y una sección');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    const totalFiles = uploadFiles.length;
    let uploadedCount = 0;

    try {
      for (const fileObj of uploadFiles) {
        // 1. Subir archivo a storage
        const formData = new FormData();
        formData.append('file', fileObj.file);
        formData.append('section_id', uploadSectionId);
        formData.append('folder', 'downloads');

        const uploadRes = await fetch('/api/downloads/upload', {
          method: 'POST',
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (!uploadData.success) {
          throw new Error(uploadData.error || 'Error al subir archivo');
        }

        // 2. Crear registro en BD con nombre personalizado
        const createRes = await fetch('/api/downloads/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: uploadSectionId,
            name: fileObj.customName,
            file_url: uploadData.file_url,
            mark_as_new: uploadMarkNew
          })
        });

        const createData = await createRes.json();
        if (!createData.success) {
          throw new Error(createData.error || 'Error al crear documento');
        }

        uploadedCount++;
        setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
      }

      toast.success(`${uploadedCount} documento(s) cargado(s) correctamente`);
      setShowUploadModal(false);
      setUploadFiles([]);
      setUploadSectionId('');
      setUploadMarkNew(false);
      loadDocuments();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error uploading:', error);
      toast.error(error.message || 'Error al subir documentos');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleEdit = (doc: Document) => {
    setEditingDoc(doc);
    setShowEditModal(true);
  };

  const handleMove = async () => {
    if (!movingDoc || !targetSectionId) return;

    try {
      const res = await fetch('/api/downloads/files', {
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
      const res = await fetch(`/api/downloads/sections?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`);
      const data = await res.json();
      if (data.success) {
        setAvailableSections(data.sections);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
      toast.error('Error al cargar secciones');
    } finally {
      setLoadingSections(false);
    }
  };

  const handleUpdateName = async (newName: string) => {
    if (!editingDoc || !newName.trim()) return;

    try {
      const res = await fetch('/api/downloads/files', {
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

  const handleDelete = async (docId: string) => {
    if (!confirm('¿Está seguro de eliminar este documento?')) return;

    try {
      const res = await fetch(`/api/downloads/files?id=${docId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Documento eliminado correctamente');
        loadDocuments();
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al eliminar documento');
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
      // TODO: Persistir en localStorage o BD
      localStorage.setItem(`favorites_${insurerId}`, JSON.stringify(Array.from(newFavorites)));
      return newFavorites;
    });
  };

  const handleReorder = async (docId: string, direction: 'up' | 'down') => {
    const docIndex = documents.findIndex(d => d.id === docId);
    if (docIndex === -1) return;

    const doc = documents[docIndex];
    if (!doc) return;

    const sectionDocs = documents.filter(d => d.section_id === doc.section_id).sort((a, b) => a.display_order - b.display_order);
    const sectionIndex = sectionDocs.findIndex(d => d.id === docId);

    if ((direction === 'up' && sectionIndex === 0) || (direction === 'down' && sectionIndex === sectionDocs.length - 1)) {
      toast.info('El documento ya está en la posición límite');
      return;
    }

    const targetIndex = direction === 'up' ? sectionIndex - 1 : sectionIndex + 1;
    const targetDoc = sectionDocs[targetIndex];
    if (!targetDoc) return;

    try {
      // Intercambiar display_order
      await fetch('/api/downloads/files', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: doc.id,
          action: 'reorder',
          params: { display_order: targetDoc.display_order }
        })
      });

      await fetch('/api/downloads/files', {
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
      console.error('Error reordering document:', error);
      toast.error('Error al reordenar documento');
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Cargando documentos...</p>
      </div>
    );
  }

  // Filtrar y ordenar documentos
  const filteredDocuments = documents
    .filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFavorites = !filterFavorites || favorites.has(doc.id);
      return matchesSearch && matchesFavorites;
    })
    .sort((a, b) => {
      // Favoritos primero
      const aFav = favorites.has(a.id);
      const bFav = favorites.has(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      // Luego por display_order
      return a.display_order - b.display_order;
    });

  return (
    <div>
      {/* Header con controles */}
      <div className="mb-6 space-y-4">
        {/* Barra de búsqueda y filtros */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          {/* Búsqueda */}
          <div className="flex items-center gap-2 border-2 border-gray-300 rounded-lg focus-within:border-[#8AAA19] bg-white px-3 py-2 flex-1 w-full sm:max-w-md">
            <div className="flex-shrink-0 text-gray-400">
              <FaSearch />
            </div>
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 bg-transparent p-0"
              style={{ WebkitTextSizeAdjust: '100%', WebkitAppearance: 'none' }}
            />
          </div>

          {/* Botones de control */}
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:scale-105 ${
                filterFavorites
                  ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                  : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-yellow-400'
              }`}
            >
              <FaStar className={filterFavorites ? 'text-white' : 'text-yellow-500'} />
              <span>Favoritos</span>
              {favorites.size > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  filterFavorites ? 'bg-white/30 text-white' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {favorites.size}
                </span>
              )}
            </button>
            
            {isMaster && (
              <button
                onClick={() => setEditMode(!editMode)}
                className={
                  `flex-1 sm:flex-none px-5 py-2.5 rounded-xl font-bold text-sm
                  shadow-md hover:shadow-lg
                  hover:scale-105
                  transition-all duration-200
                  flex items-center gap-2
                  ${editMode 
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white' 
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
                  }`
                }
                title={editMode ? 'Desactivar modo edición' : 'Activar modo edición'}
              >
                <FaPencilAlt className={editMode ? 'text-white' : 'text-gray-600'} />
                <span className="hidden sm:inline">{editMode ? 'Salir' : 'Editar'}</span>
              </button>
            )}
            
            {isMaster && editMode && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all font-bold text-sm shadow-md hover:scale-105"
              >
                <FaPlus className="text-white" />
                <span className="hidden sm:inline">Cargar</span>
              </button>
            )}
          </div>
        </div>

        {/* Info de filtros activos */}
        {(searchTerm || filterFavorites) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>Mostrando {filteredDocuments.length} de {documents.length} documentos</span>
            {(searchTerm || filterFavorites) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterFavorites(false);
                }}
                className="text-[#8AAA19] hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de documentos */}
      {documents.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-lg">
          <FaFileAlt className="mx-auto text-6xl text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No hay documentos disponibles</p>
          {isMaster && (
            <p className="text-gray-400 text-sm mt-2">Haz clic en "Cargar Documento" para agregar archivos</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const isFavorite = favorites.has(doc.id);
            const sectionDocs = documents.filter(d => d.section_id === doc.section_id).sort((a, b) => a.display_order - b.display_order);
            const docIndex = sectionDocs.findIndex(d => d.id === doc.id);
            const canMoveUp = docIndex > 0;
            const canMoveDown = docIndex < sectionDocs.length - 1;

            return (
              <div
                key={doc.id}
                className={`bg-white rounded-xl shadow-lg border-2 hover:shadow-xl transition-all p-4 ${
                  isFavorite ? 'border-yellow-400' : 'border-gray-100 hover:border-[#8AAA19]'
                }`}
              >
                {/* Header con badges y favorito */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                      {doc.section_name}
                    </span>
                    {doc.show_new_badge && (
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold animate-pulse">
                        ¡NUEVO!
                      </span>
                    )}
                  </div>
                  
                  {/* Botón de favorito */}
                  <button
                    onClick={() => handleToggleFavorite(doc.id)}
                    className={`p-1.5 rounded-lg transition-all ${
                      isFavorite 
                        ? 'text-yellow-500 hover:bg-yellow-50' 
                        : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
                    }`}
                    title={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    {isFavorite ? <FaStar size={16} /> : <FaRegStar size={16} />}
                  </button>
                </div>

              {/* Icono y nombre del archivo */}
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

              {/* Botones de acción */}
              <div className="space-y-2 pt-3 border-t border-gray-200">
                {/* Fila de botones principales */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all text-sm font-medium"
                    title="Descargar"
                  >
                    <FaDownload className="text-white" size={12} />
                    <span>Descargar</span>
                  </button>
                  {isMaster && editMode && (
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
                        title="Mover a otra sección"
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

                {/* Fila de botones de reordenamiento (solo Master en modo edición) */}
                {isMaster && editMode && (canMoveUp || canMoveDown) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReorder(doc.id, 'up')}
                      disabled={!canMoveUp}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all ${
                        canMoveUp 
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                          : 'bg-gray-50 text-gray-400 cursor-not-allowed'
                      }`}
                      title="Mover arriba"
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
                      title="Mover abajo"
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

      {/* Modal de carga de documento */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#010139]">Cargar Documento</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadFiles([]);
                  setUploadSectionId('');
                  setUploadMarkNew(false);
                }}
                className="text-gray-400 hover:text-gray-600"
                disabled={uploading}
              >
                <FaTimes size={20} />
              </button>
            </div>
            
            {sections.length === 0 ? (
              <div className="text-center py-8">
                <FaFolderOpen className="mx-auto text-5xl text-gray-300 mb-4" />
                <h4 className="text-lg font-semibold text-gray-700 mb-2">
                  No hay secciones disponibles
                </h4>
                <p className="text-sm text-gray-600 mb-6">
                  Antes de cargar documentos, debes crear al menos una sección para organizarlos.
                </p>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    router.push(`/downloads/${scope}/${policyType}/${insurerId}/sections`);
                  }}
                  className="px-6 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
                >
                  Crear Sección
                </button>
              </div>
            ) : (
            <div className="space-y-4">
              {/* Selección de archivos múltiples */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Archivos * (puedes seleccionar múltiples)
                </label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const newFiles = files.map(file => ({ file, customName: file.name }));
                    setUploadFiles(prev => [...prev, ...newFiles]);
                    e.target.value = ''; // Reset input
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  disabled={uploading}
                />
              </div>

              {/* Lista de archivos seleccionados */}
              {uploadFiles.length > 0 && (
                <div className="border-2 border-gray-200 rounded-lg p-3 max-h-60 overflow-y-auto">
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
                <div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#8AAA19] h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 text-center">
                    Subiendo... {uploadProgress}%
                  </p>
                </div>
              )}

              {/* Selección de sección */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sección *
                </label>
                <select
                  value={uploadSectionId}
                  onChange={(e) => setUploadSectionId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                >
                  <option value="">Selecciona una sección</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Marcar como nuevo */}
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

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setUploadFiles([]);
                    setUploadSectionId('');
                    setUploadMarkNew(false);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploadFiles.length === 0 || !uploadSectionId || uploading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? `Subiendo ${uploadProgress}%` : `Subir ${uploadFiles.length} archivo(s)`}
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de edición de documento */}
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
                  placeholder="Nombre del documento"
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

      {/* Modal de Mover a Otra Sección */}
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
              Selecciona sección destino:
            </label>

            {loadingSections ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#8AAA19] border-t-transparent"></div>
                <p className="text-sm text-gray-600 mt-2">Cargando secciones...</p>
              </div>
            ) : availableSections.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-sm">No hay otras secciones disponibles</p>
              </div>
            ) : (
              <>
                <select
                  value={targetSectionId}
                  onChange={(e) => setTargetSectionId(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none mb-4"
                >
                  <option value="">-- Selecciona una sección --</option>
                  {availableSections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name} ({section.files_count || 0} archivo{(section.files_count || 0) !== 1 ? 's' : ''})
                    </option>
                  ))}
                </select>

                {targetSectionId && (
                  <div className="mb-4 p-3 bg-purple-50 border-l-4 border-purple-500 rounded">
                    <p className="text-sm text-purple-800">
                      ✓ El archivo se moverá a la sección seleccionada
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
    </div>
  );
}
