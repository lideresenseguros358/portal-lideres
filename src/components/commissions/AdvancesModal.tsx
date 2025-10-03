'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { actionGetAdvances, actionApplyAdvanceDiscount } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
        toast.success('Descuentos aplicados exitosamente.');
        onSuccess();
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl p-0 bg-white">
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="text-[#010139]">Aplicar Adelantos para {brokerName}</CardTitle>
            <DialogDescription>Seleccione los saldos pendientes y el monto a descontar en esta quincena o registre un pago externo.</DialogDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <TableHead className="w-[180px] text-right">Monto a Aplicar</TableHead>
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
          </CardContent>
          <DialogFooter className="p-6 bg-gray-50 rounded-b-lg">
            <Button variant="outline" onClick={onClose} disabled={isPending}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isPending} className="bg-[#010139] text-white hover:bg-[#010139]/90">
              {isPending ? 'Guardando...' : 'Guardar y Aplicar'}
            </Button>
          </DialogFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}