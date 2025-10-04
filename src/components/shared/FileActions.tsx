'use client';

import { useState } from 'react';
import { FaEye, FaDownload, FaEdit, FaTrash, FaExchangeAlt, FaEllipsisV } from 'react-icons/fa';
import { toast } from 'sonner';

interface FileActionsProps {
  fileId: string;
  fileName: string;
  fileUrl: string;
  isMaster: boolean;
  onUpdate: () => void;
  deleteEndpoint: string;
}

export default function FileActions({
  fileId,
  fileName,
  fileUrl,
  isMaster,
  onUpdate,
  deleteEndpoint
}: FileActionsProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleView = () => {
    window.open(fileUrl, '_blank');
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.click();
  };

  const handleDelete = async () => {
    if (!confirm(`¿Estás seguro de eliminar "${fileName}"?`)) return;

    setDeleting(true);
    try {
      const res = await fetch(`${deleteEndpoint}?id=${fileId}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error al eliminar');
      }

      if (data.affected_links > 0) {
        toast.success(`Archivo eliminado (${data.affected_links} vínculos también eliminados)`);
      } else {
        toast.success('Archivo eliminado exitosamente');
      }

      onUpdate();
    } catch (error: any) {
      console.error('Error deleting file:', error);
      toast.error(error.message || 'Error al eliminar archivo');
    } finally {
      setDeleting(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Ver */}
        <button
          onClick={handleView}
          className="
            p-2 rounded-lg
            bg-[#010139] text-white
            hover:bg-[#020250] hover:scale-105
            transition-all duration-200
          "
          title="Ver documento"
        >
          <FaEye />
        </button>

        {/* Descargar */}
        <button
          onClick={handleDownload}
          className="
            p-2 rounded-lg
            bg-[#8AAA19] text-white
            hover:bg-[#6d8814] hover:scale-105
            transition-all duration-200
          "
          title="Descargar"
        >
          <FaDownload />
        </button>

        {/* Más acciones (solo Master) */}
        {isMaster && (
          <>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="
                p-2 rounded-lg
                bg-gray-200 text-gray-700
                hover:bg-gray-300 hover:scale-105
                transition-all duration-200
              "
              title="Más acciones"
            >
              <FaEllipsisV />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-10">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="
                    w-full px-4 py-3 text-left
                    flex items-center gap-3
                    text-red-600 hover:bg-red-50
                    rounded-lg transition-colors
                    disabled:opacity-50
                  "
                >
                  <FaTrash />
                  <span>{deleting ? 'Eliminando...' : 'Eliminar'}</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Backdrop para cerrar menú */}
      {showMenu && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}
