'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { BrokerData } from '@/lib/commissions/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  brokerData: BrokerData | null;
}

export function BrokerDetailModal({ isOpen, onClose, brokerData }: Props) {
  if (!brokerData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalle de Descuentos: {brokerData.broker_name}</DialogTitle>
          <DialogDescription>
            Desglose de los descuentos aplicados en esta quincena.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {/* Placeholder for discount details */}
          <p><strong>Total Bruto:</strong> {brokerData.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          <p><strong>Total Descuentos:</strong> {brokerData.discounts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          <p className="font-bold mt-2"><strong>Neto a Pagar:</strong> {brokerData.net_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          
          <div className="mt-4 rounded-md border border-dashed p-4 text-center">
            <p className="text-muted-foreground">El desglose detallado de los descuentos aparecerá aquí.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
