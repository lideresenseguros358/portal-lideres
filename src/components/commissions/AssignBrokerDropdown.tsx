'use client';

import { useState, useMemo } from 'react';
import { actionResolvePendingGroups } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
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
}

export function AssignBrokerDropdown({ itemGroup, brokers, onSuccess }: Props) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtrar brokers por término de búsqueda
  const filteredBrokers = useMemo(() => {
    if (!searchTerm.trim()) return brokers;
    
    const term = searchTerm.toLowerCase();
    return brokers.filter(broker => 
      broker.name.toLowerCase().includes(term)
    );
  }, [brokers, searchTerm]);

  const handleAssign = async (brokerId: string) => {
    setIsAssigning(true);
    setSearchTerm(''); // Limpiar búsqueda
    
    const result = await actionResolvePendingGroups({
      broker_id: brokerId,
      policy_number: itemGroup.policy_number,
      item_ids: itemGroup.items.map(i => i.id),
    });

    if (result.ok) {
      toast.success(`Asignado a corredor exitosamente.`);
      onSuccess(brokerId);
    } else {
      toast.error('Error al asignar.', { description: result.error });
    }
    setIsAssigning(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          disabled={isAssigning}
          className="bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:from-[#020270] hover:to-[#010139] border-0 shadow-md font-semibold"
        >
          {isAssigning ? 'Asignando...' : 'Asignar Corredor'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border border-gray-200 shadow-lg min-w-[250px] p-2">
        {/* Campo de búsqueda */}
        <div className="px-2 pb-2 border-b border-gray-200">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={12} />
            <Input
              type="text"
              placeholder="Buscar corredor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 h-8 text-sm"
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
                onClick={() => handleAssign(broker.id)}
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
