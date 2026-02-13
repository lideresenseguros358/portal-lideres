'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaHistory } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaMoneyBillWave, FaExchangeAlt, FaCheckCircle, FaExclamationTriangle, FaSpinner } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionApplyAdvancePayment } from '@/app/(app)/commissions/actions';
import { supabaseClient } from '@/lib/supabase/client';
import { AdvanceHistoryModal } from './AdvanceHistoryModal';

interface AdvanceItem {
  id: string;
  amount: number;
  reason: string | null;
  total_paid?: number;
  payment_logs?: Array<{ date: string; amount: number }>;
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
  const [selectedAdvanceForHistory, setSelectedAdvanceForHistory] = useState<string | null>(null);
  
  // Determinar quincena actual (Panamá timezone UTC-5)
  const getCurrentQuincena = () => {
    const now = new Date();
    // Ajustar a zona horaria de Panamá (UTC-5)
    const panamaDate = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    const day = panamaDate.getUTCDate();
    return day >= 16 ? 'Q1' : 'Q2';
  };
  
  // Get today's date in YYYY-MM-DD format (Panamá timezone UTC-5)
  const getTodayDate = () => {
    const now = new Date();
    // Ajustar a zona horaria de Panamá (UTC-5)
    const panamaDate = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    const year = panamaDate.getUTCFullYear();
    const month = String(panamaDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(panamaDate.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  // Transfer fields
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transferDate, setTransferDate] = useState(getTodayDate());
  
  // Reference validation
  const [validatingRef, setValidatingRef] = useState(false);
  const [refValidation, setRefValidation] = useState<{
    exists: boolean;
    amount: number;
    usedAmount: number;
    remainingAmount: number;
    status: string;
  } | null>(null);
  
  // Cash fields
  const [cashDate, setCashDate] = useState(getTodayDate());
  
  // Selected advances with amounts
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([]);

  const totalPending = pendingAdvances.reduce((sum, adv) => sum + adv.amount, 0);
  const totalAssigned = advancePayments.reduce((sum, ap) => sum + ap.amount, 0);

  const resetForm = () => {
    setReferenceNumber('');
    setTransferDate(getTodayDate());
    setCashDate(getTodayDate());
    setAdvancePayments([]);
    setPaymentType('transfer');
    setRefValidation(null);
  };

  // Validar referencia cuando se ingresa
  useEffect(() => {
    const validateReference = async () => {
      if (!referenceNumber || referenceNumber.length < 3) {
        setRefValidation(null);
        return;
      }

      setValidatingRef(true);
      try {
        const { data: transfer, error } = await supabaseClient()
          .from('bank_transfers')
          .select('*')
          .eq('reference_number', referenceNumber)
          .single();

        if (error || !transfer) {
          setRefValidation(null);
        } else {
          const amount = Number(transfer.amount) || 0;
          const usedAmount = Number(transfer.used_amount) || 0;
          const remainingAmount = amount - usedAmount;
          
          setRefValidation({
            exists: true,
            amount,
            usedAmount,
            remainingAmount,
            status: transfer.status || 'available'
          });

          // Auto-llenar fecha de la transferencia bancaria
          if (transfer.date) {
            setTransferDate(transfer.date);
          }

          // Auto-llenar montos si hay adelantos seleccionados
          if (advancePayments.length === 0 && pendingAdvances.length > 0) {
            let remaining = remainingAmount;
            const newPayments: AdvancePayment[] = [];
            
            for (const advance of pendingAdvances) {
              if (remaining <= 0) break;
              
              const amountToApply = Math.min(advance.amount, remaining);
              newPayments.push({
                advanceId: advance.id,
                amount: amountToApply,
                reason: advance.reason || 'Sin motivo'
              });
              remaining -= amountToApply;
            }
            
            if (newPayments.length > 0) {
              setAdvancePayments(newPayments);
            }
          }
        }
      } catch (error) {
        console.error('Error validating reference:', error);
        setRefValidation(null);
      } finally {
        setValidatingRef(false);
      }
    };

    const timeoutId = setTimeout(validateReference, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referenceNumber]);

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

  const handlePayAll = () => {
    if (paymentType === 'transfer' && refValidation?.exists) {
      let remaining = refValidation.remainingAmount;
      const newPayments: AdvancePayment[] = [];
      for (const advance of pendingAdvances) {
        if (remaining <= 0) break;
        const amountToApply = Math.min(advance.amount, remaining);
        newPayments.push({
          advanceId: advance.id,
          amount: amountToApply,
          reason: advance.reason || 'Sin motivo'
        });
        remaining -= amountToApply;
      }
      setAdvancePayments(newPayments);
      if (remaining <= 0 && pendingAdvances.some(a => !newPayments.find(p => p.advanceId === a.id) || (newPayments.find(p => p.advanceId === a.id)?.amount || 0) < a.amount)) {
        toast.warning('El saldo disponible no cubre todos los adelantos. Se asignó hasta el máximo disponible.');
      } else {
        toast.success('Montos asignados a todos los adelantos');
      }
    } else {
      const newPayments: AdvancePayment[] = pendingAdvances.map(advance => ({
        advanceId: advance.id,
        amount: advance.amount,
        reason: advance.reason || 'Sin motivo'
      }));
      setAdvancePayments(newPayments);
      toast.success('Montos completos asignados a todos los adelantos');
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
      
      // Validar que la referencia exista
      if (!refValidation?.exists) {
        toast.error('La referencia ingresada no existe en el historial de banco');
        return;
      }
      
      // Validar que no exceda el monto disponible (con tolerancia de centavos)
      if (totalAssigned > refValidation.remainingAmount + 0.01) {
        toast.error(`El monto total ($${totalAssigned.toFixed(2)}) excede el saldo disponible de la referencia ($${refValidation.remainingAmount.toFixed(2)})`);
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
        const payload = {
          advance_id: payment.advanceId,
          amount: payment.amount,
          payment_type: paymentType === 'transfer' ? 'external_transfer' : 'cash',
          reference_number: paymentType === 'transfer' ? referenceNumber : undefined,
          payment_date: paymentType === 'transfer' ? transferDate : cashDate,
        };

        console.log('[PayAdvanceModal] Calling actionApplyAdvancePayment:', payload);

        const result = await actionApplyAdvancePayment(payload);

        console.log('[PayAdvanceModal] Result:', result);

        if (!result.ok) {
          toast.error(`Error en adelanto "${payment.reason}"`, { description: result.error });
          setLoading(false);
          return;
        }
      }

      toast.success(
        paymentType === 'transfer' 
          ? `Transferencia aplicada exitosamente ($${totalAssigned.toFixed(2)}) - Registrada en historial de banco` 
          : `Pago en efectivo aplicado exitosamente ($${totalAssigned.toFixed(2)})`
      );
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('[PayAdvanceModal] Error:', error);
      toast.error('Error inesperado al procesar el pago', { description: error?.message || String(error) });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          resetForm();
          onClose();
        }
      }}
    >
      <div 
        className="standard-modal-container max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaMoneyBillWave className="inline mr-2" />
              Registrar Pago Externo
            </h2>
            <p className="standard-modal-subtitle">
              Corredor: {brokerName} | Total adeudado: ${totalPending.toFixed(2)}
            </p>
            <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-purple-100/20 border border-purple-300/30 text-white text-xs font-semibold">
              📅 Quincena Actual: {getCurrentQuincena()} {getCurrentQuincena() === 'Q1' ? '(16-31)' : '(01-15)'}
            </div>
          </div>
          <button onClick={() => { resetForm(); onClose(); }} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <Tabs value={paymentType} onValueChange={(value) => setPaymentType(value as 'cash' | 'transfer')} className="w-full flex flex-col">
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
                💡 La transferencia se validará contra el historial de banco y se aplicará automáticamente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ref">Número de Referencia *</Label>
                <div className="relative">
                  <Input
                    id="ref"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value.toUpperCase())}
                    placeholder="Ej: REF123456"
                    className="uppercase pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {validatingRef && <FaSpinner className="animate-spin text-gray-400" />}
                    {!validatingRef && refValidation?.exists && refValidation.remainingAmount > 0.01 && (
                      <FaCheckCircle className="text-green-600" />
                    )}
                    {!validatingRef && refValidation?.exists && refValidation.remainingAmount <= 0.01 && (
                      <FaExclamationTriangle className="text-red-600" />
                    )}
                    {!validatingRef && referenceNumber && !refValidation?.exists && referenceNumber.length >= 3 && (
                      <FaExclamationTriangle className="text-red-600" />
                    )}
                  </div>
                </div>
                {refValidation?.exists && refValidation.remainingAmount <= 0.01 && (
                  <div className="text-xs space-y-1 p-2 bg-red-50 border border-red-300 rounded">
                    <p className="text-red-800 font-semibold">🚫 Transferencia ya utilizada en su totalidad</p>
                    <p className="text-red-700">Monto total: <span className="font-mono font-bold">${refValidation.amount.toFixed(2)}</span></p>
                    <p className="text-red-700">Usado: <span className="font-mono">${refValidation.usedAmount.toFixed(2)}</span></p>
                    <p className="text-red-700">Disponible: <span className="font-mono font-bold text-red-900">$0.00</span></p>
                    <p className="text-red-600 mt-1 font-medium">No se puede usar esta referencia. Debe usar otra referencia con saldo disponible.</p>
                  </div>
                )}
                {refValidation?.exists && refValidation.remainingAmount > 0.01 && refValidation.usedAmount > 0 && (
                  <div className="text-xs space-y-1 p-2 bg-amber-50 border border-amber-300 rounded">
                    <p className="text-amber-800 font-semibold">⚠️ Referencia parcialmente usada</p>
                    <p className="text-amber-700">Monto total: <span className="font-mono font-bold">${refValidation.amount.toFixed(2)}</span></p>
                    <p className="text-amber-700">Usado: <span className="font-mono">${refValidation.usedAmount.toFixed(2)}</span></p>
                    <p className="text-amber-700">Disponible: <span className="font-mono font-bold text-green-700">${refValidation.remainingAmount.toFixed(2)}</span></p>
                  </div>
                )}
                {refValidation?.exists && refValidation.remainingAmount > 0.01 && refValidation.usedAmount === 0 && (
                  <div className="text-xs space-y-1 p-2 bg-green-50 border border-green-200 rounded">
                    <p className="text-green-800 font-semibold">✅ Referencia disponible</p>
                    <p className="text-green-700">Monto total: <span className="font-mono font-bold">${refValidation.amount.toFixed(2)}</span></p>
                    <p className="text-green-700">Disponible: <span className="font-mono font-bold">${refValidation.remainingAmount.toFixed(2)}</span></p>
                  </div>
                )}
                {!validatingRef && referenceNumber && !refValidation?.exists && referenceNumber.length >= 3 && (
                  <div className="text-xs p-2 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800">❌ Referencia no encontrada en historial de banco</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="transfer-date">Fecha *</Label>
                <Input
                  id="transfer-date"
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Distribución del Pago</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePayAll}
                  disabled={!refValidation?.exists || refValidation.remainingAmount <= 0.01}
                  className="text-xs hover:bg-[#8AAA19] hover:text-white"
                >
                  💰 Pagar Todo
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                  <div className="col-span-5">Motivo del Adelanto</div>
                  <div className="col-span-2 text-right">Saldo</div>
                  <div className="col-span-3 text-right">Monto a Pagar</div>
                  <div className="col-span-2 text-center">Acciones</div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {pendingAdvances.map((advance) => {
                    const currentPayment = advancePayments.find(ap => ap.advanceId === advance.id);
                    return (
                      <div key={advance.id} className="px-3 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50">
                        <div className="col-span-5 text-sm">{advance.reason || 'Sin motivo'}</div>
                        <div className="col-span-2 text-right text-sm font-mono text-gray-600">${advance.amount.toFixed(2)}</div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            max={refValidation?.remainingAmount ? Math.min(advance.amount, refValidation.remainingAmount) : advance.amount}
                            value={currentPayment?.amount || ''}
                            onChange={(e) => handleAdvanceAmountChange(advance.id, e.target.value, advance.reason || 'Sin motivo')}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="0.00"
                            className="text-right text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                            disabled={!refValidation?.exists || refValidation.remainingAmount <= 0.01}
                          />
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedAdvanceForHistory(advance.id)}
                            className="text-xs px-2 py-1 h-7"
                            title="Ver historial de pagos"
                          >
                            <FaHistory className="text-[#010139]" />
                          </Button>
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
                className="focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Distribución del Pago</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePayAll}
                  className="text-xs hover:bg-[#8AAA19] hover:text-white"
                >
                  💰 Pagar Todo
                </Button>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b grid grid-cols-12 gap-2 text-xs font-semibold text-gray-700">
                  <div className="col-span-5">Motivo del Adelanto</div>
                  <div className="col-span-2 text-right">Saldo</div>
                  <div className="col-span-3 text-right">Monto a Pagar</div>
                  <div className="col-span-2 text-center">Acciones</div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {pendingAdvances.map((advance) => {
                    const currentPayment = advancePayments.find(ap => ap.advanceId === advance.id);
                    return (
                      <div key={advance.id} className="px-3 py-2 border-b last:border-b-0 grid grid-cols-12 gap-2 items-center hover:bg-gray-50">
                        <div className="col-span-5 text-sm">{advance.reason || 'Sin motivo'}</div>
                        <div className="col-span-2 text-right text-sm font-mono text-gray-600">${advance.amount.toFixed(2)}</div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            max={advance.amount}
                            value={currentPayment?.amount || ''}
                            onChange={(e) => handleAdvanceAmountChange(advance.id, e.target.value, advance.reason || 'Sin motivo')}
                            onWheel={(e) => e.currentTarget.blur()}
                            placeholder="0.00"
                            className="text-right text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        </div>
                        <div className="col-span-2 flex justify-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedAdvanceForHistory(advance.id)}
                            className="text-xs px-2 py-1 h-7"
                            title="Ver historial de pagos"
                          >
                            <FaHistory className="text-[#010139]" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Total a Pagar:</span>
              <span className={`text-xl font-bold font-mono ${
                paymentType === 'transfer' && refValidation?.exists && totalAssigned > refValidation.remainingAmount + 0.01
                  ? 'text-red-600' : 'text-[#8AAA19]'
              }`}>${totalAssigned.toFixed(2)}</span>
            </div>
            {paymentType === 'transfer' && refValidation?.exists && totalAssigned > refValidation.remainingAmount + 0.01 && (
              <p className="text-xs text-red-600 font-medium">⚠️ El monto excede el disponible (${refValidation.remainingAmount.toFixed(2)})</p>
            )}
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm();
                onClose();
              }}
              disabled={loading}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || (paymentType === 'transfer' && refValidation?.exists === true && totalAssigned > refValidation.remainingAmount + 0.01) || (paymentType === 'transfer' && refValidation?.exists === true && refValidation.remainingAmount <= 0.01)}
              className="standard-modal-button-primary"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                'Registrar Pago'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal de Historial */}
      <AdvanceHistoryModal
        isOpen={!!selectedAdvanceForHistory}
        onClose={() => setSelectedAdvanceForHistory(null)}
        advanceId={selectedAdvanceForHistory}
      />
    </div>
  );
}
