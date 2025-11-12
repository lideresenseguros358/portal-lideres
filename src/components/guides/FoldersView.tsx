'use client';

import { useState } from 'react';
import { FaFolder, FaPlus, FaEdit, FaTrash, FaArrowUp, FaArrowDown, FaFileAlt, FaStar, FaTimes } from 'react-icons/fa';
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

interface FoldersViewProps {
  folders: Folder[];
  isMaster: boolean;
  onUpdate: () => void;
}

export default function FoldersView({ folders: initialFolders, isMaster, onUpdate }: FoldersViewProps) {
  const [folders, setFolders] = useState(initialFolders);
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
      const res = await fetch('/api/guides/sections', {
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
      const res = await fetch('/api/guides/sections', {
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
      const res = await fetch(`/api/guides/sections?id=${folderId}`, {
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

    try {
      // Intercambiar display_order
      await fetch('/api/guides/sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: folder.id,
          display_order: targetFolder.display_order
        })
      });

      await fetch('/api/guides/sections', {
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
      {/* Header con botón crear */}
      {isMaster && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold"
          >
            <FaPlus />
            <span>Nueva Carpeta</span>
          </button>
        </div>
      )}

      {/* Grid de carpetas */}
      {folders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-lg">
          <FaFolder className="mx-auto text-6xl text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No hay carpetas disponibles</p>
          {isMaster && (
            <p className="text-gray-400 text-sm mt-2">Haz clic en "Nueva Carpeta" para crear una</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {folders.map((folder, index) => (
            <div
              key={folder.id}
              className="bg-white rounded-xl shadow-lg border-2 border-gray-100 hover:border-[#8AAA19] hover:shadow-xl transition-all"
            >
              <Link href={`/guides/${folder.id}`} className="block p-6">
                {/* Icono de carpeta */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-[#8AAA19] to-[#6d8814] rounded-lg flex items-center justify-center">
                    <FaFolder className="text-3xl text-white" />
                  </div>
                  {folder.has_new_files && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full animate-pulse">
                      ¡NUEVO!
                    </span>
                  )}
                </div>

                {/* Nombre */}
                <h3 className="text-lg font-bold text-[#010139] mb-2 break-words">
                  {folder.name}
                </h3>

                {/* Contador */}
                <p className="text-sm text-gray-500">
                  {folder.files_count} documento{folder.files_count !== 1 ? 's' : ''}
                </p>
              </Link>

              {/* Botones de acción (solo Master) */}
              {isMaster && (
                <div className="border-t border-gray-200 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        openEditModal(folder);
                      }}
                      className="flex-1 px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <FaEdit size={12} />
                      <span>Editar</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteFolder(folder.id, folder.name);
                      }}
                      className="flex-1 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <FaTrash size={12} />
                      <span>Eliminar</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleReorderFolder(folder.id, 'up');
                      }}
                      disabled={index === 0}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1 ${
                        index === 0
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FaArrowUp size={10} />
                      <span>Arriba</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleReorderFolder(folder.id, 'down');
                      }}
                      disabled={index === folders.length - 1}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs transition-all flex items-center justify-center gap-1 ${
                        index === folders.length - 1
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <FaArrowDown size={10} />
                      <span>Abajo</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal crear carpeta */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#010139]">Nueva Carpeta</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewFolderName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la carpeta *
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  placeholder="Ej: Manuales de Usuario"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewFolderName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim() || loading}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar carpeta */}
      {showEditModal && editingFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-[#010139]">Editar Carpeta</h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingFolder(null);
                  setNewFolderName('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre de la carpeta
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdateFolder()}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  placeholder="Nombre de la carpeta"
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingFolder(null);
                    setNewFolderName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateFolder}
                  disabled={!newFolderName.trim() || loading}
                  className="flex-1 px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
