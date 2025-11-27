'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaSearch, FaTimes } from 'react-icons/fa';
import { supabaseClient } from '@/lib/supabase/client';

interface SearchSuggestion {
  id: string;
  name: string;
  national_id: string | null;
  email: string | null;
  type: 'client';
}

interface InlineSearchBarProps {
  initialQuery?: string;
}

export default function InlineSearchBar({ initialQuery = '' }: InlineSearchBarProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions as user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        const supabase = supabaseClient();
        
        // 1. Buscar clientes directamente
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name, national_id, email')
          .or(`name.ilike.%${searchQuery}%,national_id.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(8);

        // 2. Buscar pólizas por notas o número de póliza
        const { data: policiesData } = await supabase
          .from('policies')
          .select('client_id, clients!inner(id, name, national_id, email)')
          .or(`notas.ilike.%${searchQuery}%,policy_number.ilike.%${searchQuery}%`)
          .limit(8);

        // Combinar resultados y eliminar duplicados
        const clientsMap = new Map<string, SearchSuggestion>();

        // Agregar clientes encontrados directamente
        if (!clientsError && clientsData) {
          clientsData.forEach((client) => {
            clientsMap.set(client.id, {
              id: client.id,
              name: client.name || 'Sin nombre',
              national_id: client.national_id,
              email: client.email,
              type: 'client' as const,
            });
          });
        }

        // Agregar clientes de pólizas con notas/números coincidentes
        if (policiesData) {
          policiesData.forEach((policy: any) => {
            if (policy.clients && !clientsMap.has(policy.clients.id)) {
              clientsMap.set(policy.clients.id, {
                id: policy.clients.id,
                name: policy.clients.name || 'Sin nombre',
                national_id: policy.clients.national_id,
                email: policy.clients.email,
                type: 'client' as const,
              });
            }
          });
        }

        // Convertir Map a array y limitar a 8 resultados
        setSuggestions(Array.from(clientsMap.values()).slice(0, 8));
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/db?tab=clients&search=${encodeURIComponent(searchQuery.trim())}`);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    const searchTerm = suggestion.national_id || suggestion.name;
    setSearchQuery(searchTerm);
    setShowSuggestions(false);
    // Forzar búsqueda inmediata
    router.push(`/db?tab=clients&search=${encodeURIComponent(searchTerm)}`);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSuggestions([]);
    router.push('/db?tab=clients');
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(true);
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <form onSubmit={handleSearch} className="relative">
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
            <FaSearch className="text-lg" />
          </div>

          {/* Input */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            className="w-full pl-12 pr-24 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#8AAA19] transition-all text-gray-700 placeholder-gray-400"
            placeholder="Buscar por nombre, cédula, email o notas..."
          />

          {/* Clear & Search Buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                title="Limpiar búsqueda"
              >
                <FaTimes />
              </button>
            )}
            <button
              type="submit"
              disabled={!searchQuery.trim()}
              className="px-4 py-2 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Buscar
            </button>
          </div>
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {showSuggestions && (searchQuery.trim().length >= 2) && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border-2 border-gray-100 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin w-6 h-6 border-2 border-[#010139] border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-sm">Buscando...</p>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Resultados ({suggestions.length})
              </div>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-l-4 border-transparent hover:border-[#8AAA19] group"
                >
                  <div className="font-semibold text-gray-900 group-hover:text-[#010139] mb-1">
                    {suggestion.name}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {suggestion.national_id && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Cédula:</span>
                        <span>{suggestion.national_id}</span>
                      </span>
                    )}
                    {suggestion.email && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Email:</span>
                        <span className="truncate max-w-xs">{suggestion.email}</span>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-lg font-semibold mb-1">No se encontraron resultados</p>
              <p className="text-sm">Intenta con otro término de búsqueda</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
