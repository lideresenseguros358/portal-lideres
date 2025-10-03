'use client';

import { useState, useEffect } from 'react';
import { actionGetAdvanceHistory } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface HistoryLog {
  id: string;
  amount: number;
  payment_type: string;
  created_at: string;
  fortnights: { period_start: string; period_end: string } | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  advanceId: string | null;
}

export function AdvanceHistoryModal({ isOpen, onClose, advanceId }: Props) {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && advanceId) {
      const fetchHistory = async () => {
        setLoading(true);
        const result = await actionGetAdvanceHistory(advanceId);
        if (result.ok) {
          setHistory(result.data as unknown as HistoryLog[] || []);
        } else {
          toast.error('Error al cargar el historial', { description: result.error });
        }
        setLoading(false);
      };
      fetchHistory();
    }
  }, [isOpen, advanceId]);

  const formatPaymentType = (type: string) => {
    switch (type) {
      case 'fortnight': return 'Descuento de Quincena';
      case 'external_cash': return 'Pago Externo (Efectivo)';
      case 'external_check': return 'Pago Externo (Cheque)';
      default: return type;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Historial de Pagos del Adelanto</DialogTitle>
          <DialogDescription>Aquí se muestran todos los abonos realizados a este adelanto.</DialogDescription>
        </DialogHeader>
        <div className="mt-4 rounded-md border max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Tipo de Pago</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Monto Abonado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24">Cargando...</TableCell></TableRow>
              ) : history.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center h-24">No hay pagos registrados.</TableCell></TableRow>
              ) : (
                history.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{formatPaymentType(log.payment_type)}</TableCell>
                    <TableCell>{log.fortnights ? `Q${new Date(log.fortnights.period_start).getDate() <= 15 ? 1 : 2}` : '-'}</TableCell>
                    <TableCell className="text-right">{log.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
