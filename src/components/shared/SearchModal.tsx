'use client';

import { useState, useEffect } from 'react';
import { FaSearch, FaTimes, FaDownload, FaEye, FaFolder } from 'react-icons/fa';
import BadgeNuevo from './BadgeNuevo';

interface SearchResult {
  id: string;
  name: string;
  file_url: string;
  is_new: boolean;
  tags: string[]; // e.g., ['Charlas'] para Guías o ['Auto', 'ASSA', 'Formularios'] para Descargas
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchEndpoint: string; // '/api/guides/search' o '/api/downloads/search'
  title: string;
  placeholder?: string;
}

export default function SearchModal({
  isOpen,
  onClose,
  searchEndpoint,
  title,
  placeholder = 'Buscar documento...'
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch();
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${searchEndpoint}?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        // Formatear resultados según el módulo
        const formattedResults = data.results.map((r: any) => ({
          id: r.id,
          name: r.name,
          file_url: r.file_url,
          is_new: r.is_new,
          tags: r.section_name 
            ? (r.insurer_name 
                ? [r.insurer_name, r.policy_type, r.section_name] 
                : [r.section_name])
            : []
        }));
        setResults(formattedResults);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (url: string) => {
    window.open(url, '_blank');
  };

  const handleDownload = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaSearch className="inline mr-2" />
              {title}
            </h2>
            <p className="standard-modal-subtitle">Buscar documentos y archivos</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          {/* Search Input */}
          <div className="mb-6">
            <div className="flex items-center gap-2 border-2 border-gray-300 rounded-lg focus-within:border-[#8AAA19] bg-white px-4 py-3">
              <div className="flex-shrink-0 text-gray-400">
                <FaSearch />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 bg-transparent p-0 text-lg"
                style={{ WebkitTextSizeAdjust: '100%', WebkitAppearance: 'none' }}
                autoFocus
              />
            </div>
          </div>

          {/* Results */}
          <div>
          {loading && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#010139] border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Buscando...</p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-8">
              <FaSearch className="text-6xl text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Escribe al menos 2 caracteres para buscar</p>
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8">
              <FaFolder className="text-6xl text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No se encontraron resultados</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="
                    p-4 rounded-lg border border-gray-200
                    hover:border-[#8AAA19] hover:shadow-md
                    transition-all duration-200
                  "
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-[#010139] truncate">
                          {result.name}
                        </h3>
                        <BadgeNuevo show={result.is_new} />
                      </div>
                      
                      {result.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {result.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="
                                px-2 py-1 text-xs
                                bg-gray-100 text-gray-700 rounded-md
                              "
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleView(result.file_url)}
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
                      <button
                        onClick={() => handleDownload(result.file_url, result.name)}
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
