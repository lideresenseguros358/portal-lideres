'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft, FaPlus, FaSearch } from 'react-icons/fa';
import FilesList from '@/components/downloads/FilesList';
import UploadFileModal from '@/components/shared/UploadFileModal';
import SearchModal from '@/components/shared/SearchModal';
import { toast } from 'sonner';

export default function DownloadsSectionPage() {
  const params = useParams();
  const router = useRouter();
  const scope = params.scope as string;
  const policyType = params.type as string;
  const insurerId = params.insurer as string;
  const sectionId = params.section as string;

  const [section, setSection] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [allSections, setAllSections] = useState<any[]>([]);
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
      // Cargar sección
      const sectionsRes = await fetch(`/api/downloads/sections?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`);
      const sectionsData = await sectionsRes.json();
      if (sectionsData.success) {
        const currentSection = sectionsData.sections.find((s: any) => s.id === sectionId);
        setSection(currentSection);
        setAllSections(sectionsData.sections);
      }

      // Cargar archivos
      const filesRes = await fetch(`/api/downloads/files?section_id=${sectionId}`);
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

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push(`/downloads/${scope}/${policyType}/${insurerId}`)}
          className="
            flex items-center gap-2 mb-4
            text-[#010139] hover:text-[#8AAA19]
            font-semibold transition-colors
          "
        >
          <FaArrowLeft />
          <span>Volver a Secciones</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#010139] mb-2">
              {section?.name || 'Sección'}
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
              <FaSearch />
              <span className="hidden sm:inline">Buscar</span>
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

        <FilesList files={files} isMaster={isMaster} onUpdate={loadData} />

        <UploadFileModal
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onSuccess={loadData}
          currentSectionId={sectionId}
          currentSectionName={section?.name || 'Sección'}
          allSections={allSections.filter(s => s.id !== sectionId)}
          uploadEndpoint="/api/downloads/upload"
          createEndpoint="/api/downloads/files"
        />

        <SearchModal
          isOpen={showSearch}
          onClose={() => setShowSearch(false)}
          searchEndpoint="/api/downloads/search"
          title="Buscar en Descargas"
          placeholder="Buscar documento..."
        />
      </div>
    </div>
  );
}
