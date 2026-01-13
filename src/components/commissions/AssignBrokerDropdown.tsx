'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FaSearch } from 'react-icons/fa';

interface Props {
  itemGroup: { policy_number: string; items: { id: string }[] };
  brokers: { id: string; name: string }[];
  onSuccess: (brokerId?: string) => void;
  onSelectBroker?: (brokerId: string, brokerName: string) => void;
}

export function AssignBrokerDropdown({ itemGroup, brokers, onSuccess, onSelectBroker }: Props) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar brokers por término de búsqueda
  const filteredBrokers = useMemo(() => {
    if (!searchTerm.trim()) return brokers;
    
    const term = searchTerm.toLowerCase();
    return brokers.filter(broker => 
      broker.name.toLowerCase().includes(term)
    );
  }, [brokers, searchTerm]);

  const handleSelectBroker = (brokerId: string, brokerName: string) => {
    setSearchTerm(''); // Limpiar búsqueda
    
    // ACTIVAR modo selección en vez de asignar inmediatamente
    if (onSelectBroker) {
      onSelectBroker(brokerId, brokerName);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm"
          className="bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:from-[#020270] hover:to-[#010139] border-0 shadow-md font-semibold"
        >
          Asignar Corredor
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg min-w-[250px] p-2">
        {/* Campo de búsqueda */}
        <div className="px-2 pb-2 border-b border-gray-200">
          <div className="flex items-center gap-2 border-2 border-gray-300 rounded-lg focus-within:border-[#8AAA19] bg-white px-2 py-1">
            <div className="flex-shrink-0 text-gray-400">
              <FaSearch size={12} />
            </div>
            <Input
              type="text"
              placeholder="Buscar corredor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-0 border-0 focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400 text-sm bg-transparent p-0 h-6"
              style={{ WebkitTextSizeAdjust: '100%', WebkitAppearance: 'none' }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Lista de brokers con scroll */}
        <div className="max-h-[250px] overflow-y-auto mt-2">
          {filteredBrokers.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              No se encontraron corredores
            </div>
          ) : (
            filteredBrokers.map(broker => (
              <DropdownMenuItem 
                key={broker.id} 
                onClick={() => handleSelectBroker(broker.id, broker.name)}
                className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 bg-white px-3 py-2 rounded"
              >
                {broker.name}
              </DropdownMenuItem>
            ))
          )}
        </div>

        {/* Contador */}
        {searchTerm && (
          <div className="px-3 py-1 mt-2 border-t border-gray-200 text-xs text-gray-500">
            {filteredBrokers.length} de {brokers.length} corredor(es)
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
