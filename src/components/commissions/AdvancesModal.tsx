'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionGetAdvances, actionApplyAdvanceDiscount, actionRecalculateFortnight } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaTimes } from 'react-icons/fa';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaExternalLinkAlt } from 'react-icons/fa';

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brokerId: string;
  brokerName: string;
  fortnightId: string;
}

export default function AdvancesModal({ isOpen, onClose, onSuccess, brokerId, brokerName, fortnightId }: Props) {
  const router = useRouter();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);
  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [paymentType, setPaymentType] = useState<'fortnight' | 'external_cash' | 'external_transfer'>('fortnight');
  const [isPending, startTransition] = useTransition();
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchAdvances = async () => {
        setLoading(true);
        const result = await actionGetAdvances(brokerId);
        if (result.ok) {
          setAdvances((result.data as Advance[])?.filter(a => a.amount > 0) || []);
        }
        setLoading(false);
      };
      fetchAdvances();
    }
  }, [isOpen, brokerId]);

  const handleDiscountChange = (advanceId: string, value: string, maxAmount: number) => {
    const amount = parseFloat(value) || 0;
    // Validar que no exceda el saldo del adelanto
    if (amount > maxAmount) {
      toast.warning(`El monto no puede exceder el saldo de ${maxAmount.toFixed(2)}`);
      return;
    }
    setDiscounts(prev => ({ ...prev, [advanceId]: amount }));
  };

  const handleSave = () => {
    // Handle external transfer (check) payment
    if (paymentType === 'external_transfer') {
      const selectedAdvances = Object.entries(discounts).filter(([, amount]) => amount > 0);
      if (selectedAdvances.length === 0) {
        toast.error('Seleccione al menos un adelanto para pagar');
        return;
      }
      if (selectedAdvances.length > 1) {
        toast.error('Solo puede pagar un adelanto a la vez con transferencia');
        return;
      }
      const [advanceId] = selectedAdvances[0] as [string, number];
      // Redirect to checks module to register the transfer
      router.push(`/checks/new?advance_id=${advanceId}`);
      onClose();
      return;
    }

    // Handle other payment types
    startTransition(async () => {
      const promises = Object.entries(discounts)
        .filter(([, amount]) => amount > 0)
        .map(([advance_id, amount]) => 
          actionApplyAdvanceDiscount({ fortnight_id: fortnightId, broker_id: brokerId, advance_id, amount, payment_type: paymentType })
        );

      if (promises.length === 0) {
        toast.info('No se ingresaron montos para aplicar.');
        return;
      }

      const results = await Promise.all(promises);
      const errors = results.filter(r => !r.ok);

      if (errors.length > 0) {
        toast.error(`${errors.length} descuentos no pudieron ser aplicados.`);
      } else {
        // CRÍTICO: Recalcular quincena para actualizar fortnight_broker_totals.discounts_json
        console.log('[AdvancesModal] 🔄 Recalculando quincena para reflejar adelantos...');
        const recalcResult = await actionRecalculateFortnight(fortnightId);
        if (!recalcResult.ok) {
          console.error('[AdvancesModal] Error recalculando:', recalcResult.error);
          toast.warning('Adelantos aplicados pero error al actualizar totales. Recarga la página.');
        } else {
          console.log('[AdvancesModal] ✅ Recalculación exitosa');
        }
        
        toast.success('Descuentos aplicados exitosamente.');
        onSuccess();
        onClose();
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">Aplicar Adelantos</h2>
            <p className="standard-modal-subtitle">{brokerName}</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" disabled={isPending} type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <div className="space-y-4">
            <Tabs defaultValue="fortnight" onValueChange={(value: string) => setPaymentType(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="fortnight">Descontar de Quincena</TabsTrigger>
                <TabsTrigger value="external_cash">Pago Externo (Efectivo)</TabsTrigger>
                <TabsTrigger value="external_transfer" className="flex items-center gap-2">
                  Pago Externo (Transferencia)
                  <FaExternalLinkAlt className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {paymentType === 'external_transfer' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Nota:</strong> Al seleccionar transferencia, será redirigido al módulo de cheques para registrar 
                  la referencia bancaria y completar el pago del adelanto.
                </p>
              </div>
            )}

            <div className="rounded-md border max-h-[300px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Razón del Adelanto</TableHead>
                    <TableHead className="text-right">Saldo Pendiente</TableHead>
                    <TableHead className="min-w-[120px] text-right">Monto a Aplicar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={3} className="text-center h-24">Cargando...</TableCell></TableRow>
                  ) : advances.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center h-24">No hay adelantos pendientes.</TableCell></TableRow>
                  ) : (
                    advances.map(advance => (
                      <TableRow key={advance.id}>
                        <TableCell className="font-medium">{advance.reason}</TableCell>
                        <TableCell className="text-right">{formatCurrency(advance.amount)}</TableCell>
                        <TableCell className="text-right">
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            max={advance.amount}
                            className="text-right bg-gray-50"
                            onChange={(e) => handleDiscountChange(advance.id, e.target.value, advance.amount)}
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div></div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="standard-modal-button-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="standard-modal-button-primary"
            >
              {isPending ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Guardando...</span>
                </>
              ) : (
                'Guardar y Aplicar'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}