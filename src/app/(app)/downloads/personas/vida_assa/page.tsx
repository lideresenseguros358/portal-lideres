'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import VidaAssaFoldersView from '@/components/downloads/VidaAssaFoldersView';
import { toast } from 'sonner';

export default function VidaAssaPage() {
  const router = useRouter();
  const [folders, setFolders] = useState<any[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar carpetas
      const foldersRes = await fetch('/api/vida-assa/folders');
      const foldersData = await foldersRes.json();
      
      if (foldersData.success) {
        setFolders(foldersData.folders || []);
      } else {
        console.error('Error loading folders:', foldersData);
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
          onClick={() => router.push('/downloads/personas')}
          className="
            flex items-center gap-2 mb-6
            text-[#010139] hover:text-[#8AAA19]
            font-semibold transition-colors
          "
        >
          <FaArrowLeft />
          <span>Volver a Ramo Personas</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#010139] mb-2">
            VIDA ASSA
          </h1>
          <p className="text-gray-600">
            Documentos organizados por carpetas
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Cargando carpetas...</p>
          </div>
        ) : (
          <VidaAssaFoldersView
            folders={folders}
            isMaster={isMaster}
            onUpdate={loadData}
          />
        )}
      </div>
    </div>
  );
}
