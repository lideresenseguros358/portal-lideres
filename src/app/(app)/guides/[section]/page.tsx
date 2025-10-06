'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaFolder } from 'react-icons/fa';
import { GuideFile, GuideSection } from '@/lib/guides/types';
import FilesList from '@/components/guides/FilesList';
import UploadFileModal from '@/components/shared/UploadFileModal';
import SearchModal from '@/components/shared/SearchModal';
import { toast } from 'sonner';

export default function GuideSectionPage() {
  const params = useParams();
  const router = useRouter();
  const sectionId = params.section as string;

  const [section, setSection] = useState<GuideSection | null>(null);
  const [files, setFiles] = useState<GuideFile[]>([]);
  const [allSections, setAllSections] = useState<GuideSection[]>([]);
  const [isMaster, setIsMaster] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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
        setAllSections(sectionData.sections);
      }

      // Cargar archivos
      const filesRes = await fetch(`/api/guides/files?section_id=${sectionId}`);
      const filesData = await filesRes.json();
      if (filesData.success) {
        setFiles(filesData.files);
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-[#010139] mb-2">
                {section.name}
              </h1>
              <p className="text-gray-600">
                {files.length} documento{files.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSearch(true)}
                className="
                  px-6 py-3 rounded-lg
                  bg-[#010139] text-white font-semibold
                  hover:bg-[#020250] hover:scale-105
                  transition-all duration-200
                  flex items-center gap-2
                "
              >
                <FaFolder />
                <span className="hidden sm:inline">Buscar en Guías</span>
              </button>

              {isMaster && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="
                    px-6 py-3 rounded-lg
                    bg-gradient-to-r from-[#8AAA19] to-[#6d8814]
                    text-white font-bold
                    shadow-lg hover:shadow-xl
                    hover:scale-105
                    transition-all duration-200
                    flex items-center gap-2
                  "
                >
                  <FaPlus />
                  <span>Subir Documento</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Archivos */}
        <FilesList
          files={files}
          isMaster={isMaster}
          onUpdate={loadData}
        />

        {/* Modales */}
        <UploadFileModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onSuccess={loadData}
          currentSectionId={sectionId}
          currentSectionName={section.name}
          allSections={allSections.filter(s => s.id !== sectionId)}
          uploadEndpoint="/api/guides/upload"
          createEndpoint="/api/guides/files"
        />

        <SearchModal
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          searchEndpoint="/api/guides/search"
          title="Buscar en Guías"
          placeholder="Buscar documento..."
        />
      </div>
    </div>
  );
}
