'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPencilAlt, FaPlus } from 'react-icons/fa';
import VidaAssaFilesList from '@/components/downloads/VidaAssaFilesList';
import { toast } from 'sonner';

export default function VidaAssaFolderPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params.folder_id as string;

  const [folder, setFolder] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar carpeta
      const foldersRes = await fetch('/api/vida-assa/folders');
      const foldersData = await foldersRes.json();
      
      if (foldersData.success) {
        const foundFolder = foldersData.folders?.find((f: any) => f.id === folderId);
        setFolder(foundFolder);
      }

      // Cargar archivos
      const filesRes = await fetch(`/api/vida-assa/files?folder_id=${folderId}`);
      const filesData = await filesRes.json();
      
      if (filesData.success) {
        setFiles(filesData.files || []);
      }

      // Verificar rol
      const profileRes = await fetch('/api/profile');
      const profileData = await profileRes.json();
      setIsMaster(profileData.role === 'master');
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/downloads/personas/vida_assa')}
          className="
            flex items-center gap-2 mb-6
            text-[#010139] hover:text-[#8AAA19]
            font-semibold transition-colors
          "
        >
          <FaArrowLeft />
          <span>Volver a VIDA ASSA</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#010139] mb-2">
            {folder?.name || 'Cargando...'}
          </h1>
          <p className="text-gray-600">
            Documentos disponibles para descarga
          </p>
        </div>

        {/* Botones de acción para Master */}
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
          </div>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        ) : (
          <VidaAssaFilesList
            folderId={folderId}
            files={files}
            isMaster={isMaster}
            editMode={editMode}
            onUpdate={loadData}
          />
        )}
      </div>
    </div>
  );
}
