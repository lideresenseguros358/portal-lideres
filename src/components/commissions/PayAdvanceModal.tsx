'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaMoneyBillWave, FaExchangeAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionApplyAdvancePayment } from '@/app/(app)/commissions/actions';

interface AdvanceItem {
  id: string;
  amount: number;
  reason: string | null;
}

interface AdvancePayment {
  advanceId: string;
  amount: number;
  reason: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brokerId: string | null;
  brokerName: string;
  pendingAdvances: AdvanceItem[];
}

export function PayAdvanceModal({ isOpen, onClose, onSuccess, brokerId, brokerName, pendingAdvances }: Props) {
  const [paymentType, setPaymentType] = useState<'cash' | 'transfer'>('transfer');
  const [loading, setLoading] = useState(false);
  
  // Transfer fields
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transferDate, setTransferDate] = useState('');
  
  // Cash fields
  const [cashDate, setCashDate] = useState('');
  
  // Selected advances with amounts
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([]);

  const totalPending = pendingAdvances.reduce((sum, adv) => sum + adv.amount, 0);
  const totalAssigned = advancePayments.reduce((sum, ap) => sum + ap.amount, 0);

  const resetForm = () => {
    setReferenceNumber('');
    setTransferDate('');
    setCashDate('');
    setAdvancePayments([]);
    setPaymentType('transfer');
  };

  const handleAdvanceAmountChange = (advanceId: string, amount: string, reason: string) => {
    const numAmount = parseFloat(amount) || 0;
    const existing = advancePayments.find(ap => ap.advanceId === advanceId);
    
    if (numAmount === 0) {
      setAdvancePayments(advancePayments.filter(ap => ap.advanceId !== advanceId));
    } else if (existing) {
      setAdvancePayments(advancePayments.map(ap => 
        ap.advanceId === advanceId ? { ...ap, amount: numAmount } : ap
      ));
    } else {
      setAdvancePayments([...advancePayments, { advanceId, amount: numAmount, reason }]);
    }
  };

  const handleSubmit = async () => {
    // Validaciones
    if (advancePayments.length === 0) {
      toast.error('Debe seleccionar al menos un adelanto y asignar un monto');
      return;
    }

    if (paymentType === 'transfer') {
      if (!referenceNumber || !transferDate) {
        toast.error('Debe completar número de referencia y fecha');
        return;
      }
    } else {
      if (!cashDate) {
        toast.error('Debe completar la fecha del pago');
        return;
      }
    }

    if (totalAssigned <= 0) {
      toast.error('El monto total a pagar debe ser mayor a 0');
      return;
    }

    setLoading(true);
    try {
      // Aplicar pago a cada adelanto seleccionado
      for (const payment of advancePayments) {
        const result = await actionApplyAdvancePayment({
          advance_id: payment.advanceId,
          amount: payment.amount,
          payment_type: paymentType === 'transfer' ? 'external_transfer' : 'external_cash',
          reference_number: paymentType === 'transfer' ? referenceNumber : undefined,
          payment_date: paymentType === 'transfer' ? transferDate : cashDate,
        });

        if (!result.ok) {
          toast.error(`Error en adelanto "${payment.reason}"`, { description: result.error });
          setLoading(false);
          return;
        }
      }

      toast.success(
        paymentType === 'transfer' 
          ? `Transferencia registrada ($${totalAssigned.toFixed(2)}). Se aplicará cuando la referencia esté disponible.` 
          : `Pago en efectivo aplicado exitosamente ($${totalAssigned.toFixed(2)})`
      );
      resetForm();
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error inesperado al procesar el pago');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        resetForm();
        onClose();
      }
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#010139]">Registrar Pago Externo</DialogTitle>
          <DialogDescription>
            Corredor: <span className="font-semibold">{brokerName}</span> | Total adeudado: <span className="font-semibold text-[#010139]">${totalPending.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={paymentType} onValueChange={(value) => setPaymentType(value as 'cash' | 'transfer')} className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="transfer" className="flex items-center gap-2">
              <FaExchangeAlt /> Transferencia
            </TabsTrigger>
            <TabsTrigger value="cash" className="flex items-center gap-2">
              <FaMoneyBillWave /> Efectivo
            </TabsTrigger>
          </TabsList>

          {/* Transferencia */}
          <TabsContent value="transfer" className="space-y-4 mt-4 flex-1 overflow-auto">
            <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
              <p className="text-sm text-blue-800">
                💡 La transferencia se registrará en el historial de banco. Se aplicará automáticamente cuando la referencia esté disponible.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ref">Número de Referencia *</Label>
                <Input
                  id="ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                  placeholder="Ej: REF123456"
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-date">Fecha *</Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Distribución del Pago</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                  <div className="col-span-6">Motivo del Adelanto</div>
                  <div className="col-span-3 text-right">Saldo</div>
                  <div className="col-span-3 text-right">Monto a Pagar</div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {pendingAdvances.map((advance) => {
                    const currentPayment = advancePayments.find(ap => ap.advanceId === advance.id);
                    return (
                      <div key={advance.id} className="px-3 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50">
                        <div className="col-span-6 text-sm">{advance.reason || 'Sin motivo'}</div>
                        <div className="col-span-3 text-right text-sm font-mono text-gray-600">${advance.amount.toFixed(2)}</div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            max={advance.amount}
                            value={currentPayment?.amount || ''}
                            onChange={(e) => handleAdvanceAmountChange(advance.id, e.target.value, advance.reason || 'Sin motivo')}
                            placeholder="0.00"
                            className="text-right text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Efectivo */}
          <TabsContent value="cash" className="space-y-4 mt-4 flex-1 overflow-auto">
            <div className="bg-green-50 border-l-4 border-green-500 p-3 rounded">
              <p className="text-sm text-green-800">
                💵 El pago en efectivo se aplicará directamente al saldo del adelanto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cash-date">Fecha del Pago *</Label>
              <Input
                id="cash-date"
                type="date"
                value={cashDate}
                onChange={(e) => setCashDate(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Distribución del Pago</Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                  <div className="col-span-6">Motivo del Adelanto</div>
                  <div className="col-span-3 text-right">Saldo</div>
                  <div className="col-span-3 text-right">Monto a Pagar</div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {pendingAdvances.map((advance) => {
                    const currentPayment = advancePayments.find(ap => ap.advanceId === advance.id);
                    return (
                      <div key={advance.id} className="px-3 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50">
                        <div className="col-span-6 text-sm">{advance.reason || 'Sin motivo'}</div>
                        <div className="col-span-3 text-right text-sm font-mono text-gray-600">${advance.amount.toFixed(2)}</div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            max={advance.amount}
                            value={currentPayment?.amount || ''}
                            onChange={(e) => handleAdvanceAmountChange(advance.id, e.target.value, advance.reason || 'Sin motivo')}
                            placeholder="0.00"
                            className="text-right text-sm"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Total Section */}
        <div className="flex-shrink-0 border-t pt-4 bg-gradient-to-r from-gray-50 to-gray-100 -mx-6 -mb-6 px-6 pb-6">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-gray-700">Total a Pagar:</span>
            <span className="text-2xl font-bold text-[#8AAA19] font-mono">${totalAssigned.toFixed(2)}</span>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => {
              resetForm();
              onClose();
            }} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading}
              className="bg-[#010139] hover:bg-[#8AAA19] text-white"
            >
              {loading ? 'Procesando...' : 'Registrar Pago'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
