'use client';

import { useState } from 'react';
import { actionResolvePendingGroups } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Props {
  itemGroup: { policy_number: string; items: { id: string }[] };
  brokers: { id: string; name: string }[];
  onSuccess: () => void;
}

export function AssignBrokerDropdown({ itemGroup, brokers, onSuccess }: Props) {
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async (brokerId: string) => {
    setIsAssigning(true);
    const result = await actionResolvePendingGroups({
      broker_id: brokerId,
      policy_number: itemGroup.policy_number,
      item_ids: itemGroup.items.map(i => i.id),
    });

    if (result.ok) {
      toast.success(`Asignado a corredor exitosamente.`);
      onSuccess();
    } else {
      toast.error('Error al asignar.', { description: result.error });
    }
    setIsAssigning(false);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isAssigning}>
          {isAssigning ? 'Asignando...' : 'Asignar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-white border-2 border-gray-200 shadow-lg">
        {brokers.map(broker => (
          <DropdownMenuItem 
            key={broker.id} 
            onClick={() => handleAssign(broker.id)}
            className="cursor-pointer hover:bg-gray-100 focus:bg-gray-100 bg-white"
          >
            {broker.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
