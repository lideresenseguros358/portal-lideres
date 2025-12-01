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
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">Buscar casos</h2>
            <p className="standard-modal-subtitle">Encuentra casos por cliente, póliza o contenido</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <form id="search-form" onSubmit={handleSubmit} className="space-y-4">
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

          </form>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="search-form"
              disabled={!searchTerm.trim()}
              className="standard-modal-button-primary"
            >
              <FaSearch />
              <span>Buscar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
