'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaFolder, FaPencilAlt } from 'react-icons/fa';
import { GuideSection } from '@/lib/guides/types';
import FolderDocuments from '@/components/guides/FolderDocuments';
import { toast } from 'sonner';

export default function GuideSectionPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.section as string;

  const [section, setSection] = useState<GuideSection | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar sección actual
      const sectionRes = await fetch('/api/guides/sections');
      const sectionData = await sectionRes.json();
      if (sectionData.success) {
        const currentSection = sectionData.sections.find((s: GuideSection) => s.id === sectionId);
        setSection(currentSection || null);
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

  if (loading) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Cargando...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!section) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <FaFolder className="text-6xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Sección no encontrada</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/guides')}
            className="
              flex items-center gap-2 mb-4
              text-[#010139] hover:text-[#8AAA19]
              font-semibold transition-colors
            "
          >
            <FaArrowLeft />
            <span>Volver a Guías</span>
          </button>

          <h1 className="text-3xl font-bold text-[#010139] mb-2">
            {section.name}
          </h1>
        </div>

        {/* Documentos de la carpeta */}
        <FolderDocuments
          folderId={sectionId}
          isMaster={isMaster}
          editMode={editMode}
          onUpdate={loadData}
        />
      </div>
    </div>
  );
}
