'use client';

import { useState } from 'react';
import { FaSearch, FaPencilAlt } from 'react-icons/fa';
import { GuideSection } from '@/lib/guides/types';
import FoldersView from './FoldersView';
import SearchModal from '@/components/shared/SearchModal';
import { toast } from 'sonner';

interface GuidesMainClientProps {
  initialSections: GuideSection[];
  isMaster: boolean;
}

export default function GuidesMainClient({ initialSections, isMaster }: GuidesMainClientProps) {
  const [sections, setSections] = useState<GuideSection[]>(initialSections);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const loadSections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guides/sections');
      const data = await res.json();
      if (data.success) {
        setSections(data.sections);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
      toast.error('Error al cargar secciones');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#010139] mb-2">
            Guías
          </h1>
          <p className="text-gray-600">
            Material interno de estudio y soporte
          </p>
        </div>

        {/* Buscador */}
        <div className="mb-8 flex justify-center">
          <button
            onClick={() => setShowSearch(true)}
            className="
              px-8 py-4 rounded-xl
              bg-gradient-to-r from-[#8AAA19] to-[#6d8814]
              text-white font-bold text-lg
              shadow-lg hover:shadow-xl
              hover:scale-105
              transition-all duration-200
              flex items-center gap-3
            "
          >
            <FaSearch className="text-white text-xl" />
            <span>Buscar Documento</span>
          </button>
        </div>

        {/* Carpetas */}
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Cargando carpetas...</p>
          </div>
        ) : (
          <FoldersView folders={sections} isMaster={isMaster} editMode={editMode} onUpdate={loadSections} />
        )}

        {/* Modal de Búsqueda */}
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
