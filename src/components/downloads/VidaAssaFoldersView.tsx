'use client';

import { useState } from 'react';
import { FaFolder, FaPlus, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaFileAlt, FaStar, FaTimes, FaPencilAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import Link from 'next/link';

interface Folder {
  id: string;
  name: string;
  display_order: number;
  files_count?: number;
  has_new_files?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface VidaAssaFoldersViewProps {
  folders: Folder[];
  isMaster: boolean;
  onUpdate: () => void;
}

export default function VidaAssaFoldersView({ folders: initialFolders, isMaster, onUpdate }: VidaAssaFoldersViewProps) {
  const [folders, setFolders] = useState(initialFolders);
  const [editMode, setEditMode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Ingresa un nombre para la carpeta');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/vida-assa/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Carpeta creada');
        setShowCreateModal(false);
        setNewFolderName('');
        onUpdate();
      } else {
        toast.error(data.error || 'Error al crear carpeta');
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      toast.error('Error al crear carpeta');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/vida-assa/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingFolder.id,
          name: newFolderName
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Carpeta actualizada');
        setShowEditModal(false);
        setEditingFolder(null);
        setNewFolderName('');
        onUpdate();
      } else {
        toast.error(data.error || 'Error al actualizar carpeta');
      }
    } catch (error) {
      console.error('Error updating folder:', error);
      toast.error('Error al actualizar carpeta');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(`¿Está seguro de eliminar la carpeta "${folderName}"? Se eliminarán todos los documentos dentro.`)) return;

    try {
      const res = await fetch(`/api/vida-assa/folders?id=${folderId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Carpeta eliminada');
        onUpdate();
      } else {
        toast.error(data.error || 'Error al eliminar carpeta');
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Error al eliminar carpeta');
    }
  };

  const handleReorderFolder = async (folderId: string, direction: 'up' | 'down') => {
    const folderIndex = folders.findIndex(f => f.id === folderId);
    if (folderIndex === -1) return;

    if ((direction === 'up' && folderIndex === 0) || (direction === 'down' && folderIndex === folders.length - 1)) {
      toast.info('La carpeta ya está en la posición límite');
      return;
    }

    const targetIndex = direction === 'up' ? folderIndex - 1 : folderIndex + 1;
    const folder = folders[folderIndex];
    const targetFolder = folders[targetIndex];
    
    if (!folder || !targetFolder) return;

    try {
      // Intercambiar display_order
      await fetch('/api/vida-assa/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: folder.id,
          display_order: targetFolder.display_order
        })
      });

      await fetch('/api/vida-assa/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetFolder.id,
          display_order: folder.display_order
        })
      });

      toast.success('Orden actualizado');
      onUpdate();
    } catch (error) {
      console.error('Error reordering folder:', error);
      toast.error('Error al reordenar carpeta');
    }
  };

  const openEditModal = (folder: Folder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setShowEditModal(true);
  };

  return (
    <div>
      {/* Header con botones Master */}
      {isMaster && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`
              px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
              ${editMode 
                ? 'bg-[#8AAA19] text-white shadow-md' 
                : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-[#8AAA19]'
              }
            `}
          >
            <FaPencilAlt />
            {editMode ? 'Desactivar Edición' : 'Activar Edición'}
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="
              px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2
              bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white
              shadow-md hover:shadow-lg hover:scale-105
            "
          >
            <FaPlus />
            Nueva Carpeta
          </button>
        </div>
      )}

      {/* Grid de Carpetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {folders.map((folder) => (
          <div
            key={folder.id}
            className="
              relative group
              bg-white rounded-xl shadow-lg border-2 border-gray-200
              hover:shadow-xl hover:border-[#8AAA19]
              transition-all duration-200
              overflow-hidden
            "
          >
            {/* Badge de NUEVO */}
            {folder.has_new_files && (
              <div className="absolute top-3 right-3 z-10">
                <span className="
                  px-3 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white
                  text-xs font-bold rounded-full shadow-lg
                  animate-pulse
                ">
                  <FaStar className="inline mr-1" />
                  NUEVO
                </span>
              </div>
            )}

            <Link
              href={`/downloads/personas/vida_assa/${folder.id}`}
              className="block p-6 hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col items-center text-center">
                {/* Icono de carpeta grande */}
                <FaFolder className="text-6xl text-[#8AAA19] mb-4 group-hover:scale-110 transition-transform" />
                
                {/* Nombre de carpeta */}
                <h3 className="text-lg font-bold text-[#010139] mb-2 line-clamp-2 min-h-[3.5rem]">
                  {folder.name}
                </h3>
                
                {/* Contador de archivos */}
                <div className="flex items-center gap-2 text-gray-600">
                  <FaFileAlt className="text-sm" />
                  <span className="text-sm font-medium">
                    {folder.files_count || 0} archivo{(folder.files_count || 0) !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </Link>

            {/* Botones de edición (solo visible en editMode) */}
            {isMaster && editMode && (
              <div className="absolute inset-x-0 bottom-0 bg-gray-50 border-t-2 border-gray-200 p-3 flex justify-center gap-2">
                <button
                  onClick={() => handleReorderFolder(folder.id, 'up')}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Subir"
                >
                  <FaArrowUp />
                </button>
                <button
                  onClick={() => handleReorderFolder(folder.id, 'down')}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Bajar"
                >
                  <FaArrowDown />
                </button>
                <button
                  onClick={() => openEditModal(folder)}
                  className="p-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                  title="Editar"
                >
                  <FaEdit />
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id, folder.name)}
                  className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  title="Eliminar"
                >
                  <FaTrash />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {folders.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl shadow-lg border-2 border-gray-200">
          <FaFolder className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-600 mb-2">
            No hay carpetas disponibles
          </h3>
          <p className="text-gray-500">
            {isMaster ? 'Crea tu primera carpeta haciendo click en "Nueva Carpeta"' : 'Aún no se han configurado carpetas'}
          </p>
        </div>
      )}

      {/* Modal: Crear Carpeta */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#010139]">Nueva Carpeta</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFolderName('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre de la carpeta
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Ej: TRAMITE REGULAR"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) handleCreateFolder();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFolderName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={loading || !newFolderName.trim()}
                className="flex-1 px-4 py-2 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors disabled:opacity-50"
              >
                {loading ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Editar Carpeta */}
      {showEditModal && editingFolder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#010139]">Editar Carpeta</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFolder(null);
                  setNewFolderName('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre de la carpeta
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !loading) handleUpdateFolder();
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFolder(null);
                  setNewFolderName('');
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdateFolder}
                disabled={loading || !newFolderName.trim()}
                className="flex-1 px-4 py-2 bg-[#8AAA19] text-white rounded-lg font-semibold hover:bg-[#6d8814] transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
