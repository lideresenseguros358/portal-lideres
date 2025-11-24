'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FaLock, FaMinus, FaCheckCircle } from 'react-icons/fa';

interface BrokerPaymentActionsProps {
  brokerId: string;
  brokerName: string;
  fortnightId: string;
  grossAmount: number;
  netAmount: number;
  isRetained: boolean;
  onUpdate: () => void;
}

export default function BrokerPaymentActions({
  brokerId,
  brokerName,
  fortnightId,
  grossAmount,
  netAmount,
  isRetained,
  onUpdate
}: BrokerPaymentActionsProps) {
  const [loading, setLoading] = useState(false);

  const handleRetain = async () => {
    if (loading) return;

    const action = isRetained ? 'liberar' : 'retener';
    const confirmed = confirm(
      `¿Está seguro de ${action} el pago de ${brokerName}?\n\n` +
      `${isRetained 
        ? 'El pago será incluido en el TXT bancario.' 
        : 'El pago será excluido del TXT bancario y movido a Ajustes Retenidos.'}`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const endpoint = isRetained ? '/api/commissions/unretain' : '/api/commissions/retain';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fortnight_id: fortnightId,
          broker_id: brokerId
        })
      });

      const data = await response.json();

      if (data.ok) {
        alert(`✅ Pago ${action === 'retener' ? 'retenido' : 'liberado'} exitosamente`);
        onUpdate();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleDiscount = async () => {
    if (loading) return;

    // Abrir modal de descuentos (implementar DiscountModal)
    alert('Funcionalidad de descuentos - Implementar modal con lista de adelantos activos');
    // TODO: Implementar DiscountModal
  };

  return (
    <div className="flex gap-2">
      {/* Botón Retener/Liberar */}
      <Button
        onClick={handleRetain}
        disabled={loading}
        className={`
          ${isRetained 
            ? 'bg-gray-500 hover:bg-gray-600' 
            : 'bg-yellow-600 hover:bg-yellow-700'
          }
          text-white shadow-md font-semibold transition-all
        `}
      >
        {loading ? (
          <span className="animate-spin">⏳</span>
        ) : isRetained ? (
          <>
            <FaCheckCircle className="mr-2" />
            Liberar
          </>
        ) : (
          <>
            <FaLock className="mr-2" />
            Retener
          </>
        )}
      </Button>

      {/* Botón Descontar */}
      {!isRetained && (
        <Button
          onClick={handleDiscount}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 text-white shadow-md font-semibold transition-all"
        >
          <FaMinus className="mr-2" />
          Descontar
        </Button>
      )}
    </div>
  );
}
