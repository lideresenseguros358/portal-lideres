'use client';

import { useState } from 'react';
import { FaTimes, FaSearch } from 'react-icons/fa';

interface SearchModalProps {
  onClose: () => void;
  onSearch: (searchTerm: string) => void;
  insurers: any[];
}

export default function SearchModal({ onClose, onSearch, insurers }: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSearch(searchTerm.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 my-4 sm:my-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#010139]">Buscar casos</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
          >
            <FaTimes />
          </button>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Buscar por
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cliente, póliza, ticket, notas..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Busca por nombre de cliente, número de póliza, ticket o contenido de notas
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!searchTerm.trim()}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <FaSearch />
              Buscar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
