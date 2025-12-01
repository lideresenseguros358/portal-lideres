'use client';

import { FaTimes } from 'react-icons/fa';
import type { BrokerData } from '@/lib/commissions/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  brokerData: BrokerData | null;
}

export function BrokerDetailModal({ isOpen, onClose, brokerData }: Props) {
  if (!brokerData) return null;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">Detalle de Descuentos</h2>
            <p className="standard-modal-subtitle">{brokerData.broker_name}</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        <div className="standard-modal-content">
          {/* Placeholder for discount details */}
          <p><strong>Total Bruto:</strong> {brokerData.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          <p><strong>Total Descuentos:</strong> {brokerData.discounts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          <p className="font-bold mt-2"><strong>Neto a Pagar:</strong> {brokerData.net_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
          
          <div className="mt-4 rounded-md border border-dashed p-4 text-center">
            <p className="text-muted-foreground">El desglose detallado de los descuentos aparecerá aquí.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
