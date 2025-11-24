'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaCheckCircle } from 'react-icons/fa';

interface Advance {
  id: string;
  reason: string;
  amount: number;
  status: string;
  created_at: string;
}

interface DiscountModalProps {
  isOpen: boolean;
  onClose: () => void;
  brokerId: string;
  brokerName: string;
  fortnightId: string;
  grossAmount: number;
  onSuccess: () => void;
}

export default function DiscountModal({
  isOpen,
  onClose,
  brokerId,
  brokerName,
  fortnightId,
  grossAmount,
  onSuccess
}: DiscountModalProps) {
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [selectedAdvances, setSelectedAdvances] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAdvances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, brokerId]);

  const loadAdvances = async () => {
    try {
      const response = await fetch(`/api/advances?broker_id=${brokerId}&status=PENDING,PARTIAL`);
      const data = await response.json();
      if (data.ok) {
        setAdvances(data.data || []);
      }
    } catch (error) {
      console.error('Error cargando adelantos:', error);
    }
  };

  const handleToggleAdvance = (advanceId: string, maxAmount: number) => {
    const newSelected = new Map(selectedAdvances);
    if (newSelected.has(advanceId)) {
      newSelected.delete(advanceId);
    } else {
      newSelected.set(advanceId, maxAmount);
    }
    setSelectedAdvances(newSelected);
  };

  const handleAmountChange = (advanceId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    const advance = advances.find(a => a.id === advanceId);
    if (!advance) return;

    const maxAmount = Math.min(advance.amount, grossAmount - getTotalDiscount());
    const finalAmount = Math.min(numAmount, maxAmount);

    const newSelected = new Map(selectedAdvances);
    newSelected.set(advanceId, finalAmount);
    setSelectedAdvances(newSelected);
  };

  const getTotalDiscount = () => {
    return Array.from(selectedAdvances.values()).reduce((sum, amount) => sum + amount, 0);
  };

  const handleApply = async () => {
    if (selectedAdvances.size === 0) {
      alert('Debe seleccionar al menos un adelanto');
      return;
    }

    const totalDiscount = getTotalDiscount();
    if (totalDiscount > grossAmount) {
      alert('El total de descuentos no puede ser mayor al monto bruto');
      return;
    }

    setLoading(true);
    try {
      const discounts = Array.from(selectedAdvances.entries()).map(([advance_id, amount]) => ({
        advance_id,
        amount
      }));

      const response = await fetch('/api/commissions/apply-discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fortnight_id: fortnightId,
          broker_id: brokerId,
          discounts
        })
      });

      const data = await response.json();

      if (data.ok) {
        alert('✅ Descuentos aplicados exitosamente');
        onSuccess();
        onClose();
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error al aplicar descuentos');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const netAmount = grossAmount - getTotalDiscount();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold">Aplicar Descuentos</h3>
            <p className="text-sm text-blue-200">{brokerName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <FaTimes className="text-xl" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Resumen de Montos */}
          <div className="bg-gradient-to-r from-blue-50 to-white rounded-lg p-4 border-l-4 border-[#010139]">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Monto Bruto</p>
                <p className="text-lg font-bold text-gray-900 font-mono">
                  ${grossAmount.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Total Descuento</p>
                <p className="text-lg font-bold text-red-600 font-mono">
                  ${getTotalDiscount().toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Neto a Pagar</p>
                <p className="text-lg font-bold text-[#8AAA19] font-mono">
                  ${netAmount.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Lista de Adelantos */}
          <div>
            <h4 className="text-md font-bold text-[#010139] mb-3">
              Deudas Activas ({advances.length})
            </h4>

            {advances.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No hay deudas activas para este corredor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {advances.map((advance) => {
                  const isSelected = selectedAdvances.has(advance.id);
                  const selectedAmount = selectedAdvances.get(advance.id) || 0;

                  return (
                    <div
                      key={advance.id}
                      className={`border-2 rounded-lg p-3 transition-all ${
                        isSelected
                          ? 'border-[#8AAA19] bg-[#8AAA19]/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleAdvance(advance.id, advance.amount)}
                          className="mt-1 w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                        />

                        {/* Info */}
                        <div className="flex-1">
                          <p className="font-semibold text-[#010139]">{advance.reason}</p>
                          <p className="text-sm text-gray-600">
                            Saldo: ${advance.amount.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(advance.created_at).toLocaleDateString('es-PA')}
                          </p>
                        </div>

                        {/* Input de Monto */}
                        {isSelected && (
                          <div className="w-32">
                            <label className="text-xs text-gray-600">Aplicar:</label>
                            <input
                              type="number"
                              value={selectedAmount}
                              onChange={(e) => handleAmountChange(advance.id, e.target.value)}
                              max={Math.min(advance.amount, grossAmount)}
                              step="0.01"
                              className="w-full border-2 border-[#8AAA19] rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#8AAA19]"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Advertencia si excede */}
          {getTotalDiscount() > grossAmount && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <p className="text-red-800 font-semibold">
                ⚠️ El total de descuentos excede el monto bruto disponible
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-2xl flex justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleApply}
            disabled={loading || selectedAdvances.size === 0 || getTotalDiscount() > grossAmount}
            className="px-6 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Aplicando...
              </>
            ) : (
              <>
                <FaCheckCircle />
                Aplicar Descuentos
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
