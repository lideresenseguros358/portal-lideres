'use client';

import { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import ScopeSelector from './ScopeSelector';
import SearchModal from '@/components/shared/SearchModal';
import { useRouter } from 'next/navigation';

export default function DownloadsMainClient() {
  const [showSearch, setShowSearch] = useState(true); // Auto-abrir al entrar
  const router = useRouter();

  const handleScopeSelect = (scope: 'generales' | 'personas') => {
    router.push(`/downloads/${scope}`);
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#010139] mb-2">
            Descargas
          </h1>
          <p className="text-gray-600">
            Repositorio de documentos por Ramo, Tipo y Aseguradora
          </p>
        </div>

        {/* Buscador */}
        <div className="mb-12 flex justify-center">
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
            <FaSearch className="text-xl" />
            <span>Buscar Documento</span>
          </button>
        </div>

        {/* Selector de Ramos */}
        <ScopeSelector onSelect={handleScopeSelect} />

        {/* Modal de Búsqueda */}
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
