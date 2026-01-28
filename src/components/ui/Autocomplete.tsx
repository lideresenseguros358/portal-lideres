/**
 * Componente Autocomplete con búsqueda en tiempo real
 * Mejora la UX permitiendo filtrar opciones mientras se escribe
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { FaChevronDown, FaSearch, FaTimes } from 'react-icons/fa';

export interface AutocompleteOption {
  value: string | number;
  label: string;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string | number;
  onChange: (value: string | number, option: AutocompleteOption | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  loading?: boolean;
  emptyMessage?: string;
}

export default function Autocomplete({
  options,
  value,
  onChange,
  placeholder = 'Buscar...',
  disabled = false,
  className = '',
  error = false,
  loading = false,
  emptyMessage = 'No hay opciones disponibles',
}: AutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Encontrar la opción seleccionada
  const selectedOption = options.find(opt => opt.value === value);

  // Filtrar opciones según el término de búsqueda
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejar teclas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || loading) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(prev =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll automático al item resaltado
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (option: AutocompleteOption) => {
    onChange(option.value, option);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', null);
    setSearchTerm('');
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleInputClick = () => {
    if (!disabled && !loading) {
      setIsOpen(true);
      if (inputRef.current) {
        inputRef.current.select();
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div
        className={`flex items-center gap-2 border-2 rounded-lg transition-colors px-3 py-3 md:px-4 md:py-3 ${
          error
            ? 'border-red-500 focus-within:border-red-600'
            : 'border-gray-300 focus-within:border-[#8AAA19]'
        } ${
          disabled || loading
            ? 'bg-gray-100 cursor-not-allowed'
            : 'bg-white cursor-text'
        } ${className}`}
        onClick={handleInputClick}
      >
        {/* Search Icon */}
        <div className="flex-shrink-0 text-gray-400">
          <FaSearch className="text-sm" />
        </div>

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? searchTerm : selectedOption?.label || ''}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || loading}
          className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 text-base bg-transparent p-0"
          style={{ 
            WebkitTextSizeAdjust: '100%',
            WebkitAppearance: 'none'
          }}
        />

        {/* Right Icons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {loading && (
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[#8AAA19]" />
          )}
          
          {!loading && selectedOption && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              disabled={disabled}
            >
              <FaTimes className="text-sm" />
            </button>
          )}

          <div className="text-gray-400">
            <FaChevronDown
              className={`text-sm transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Dropdown de opciones */}
      {isOpen && !disabled && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {filteredOptions.length > 0 ? (
            <ul ref={listRef} className="overflow-y-auto max-h-60">
              {filteredOptions.map((option, index) => (
                <li
                  key={option.value}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-4 py-2.5 cursor-pointer transition-colors ${
                    index === highlightedIndex
                      ? 'bg-[#8AAA19] text-white'
                      : option.value === value
                      ? 'bg-green-50 text-[#8AAA19] font-medium'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {option.label}
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-center text-gray-500">
              {searchTerm ? (
                <div>
                  <p className="font-medium">No se encontraron resultados</p>
                  <p className="text-sm mt-1">
                    Intenta con otro término de búsqueda
                  </p>
                </div>
              ) : (
                <p>{emptyMessage}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
