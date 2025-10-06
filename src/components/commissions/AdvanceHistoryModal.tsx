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
      case 'external_transfer': return 'Transferencia Externa';
      default: return type;
    }
  };

  const totalPaid = history.reduce((sum, log) => sum + log.amount, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#010139]">Historial de Pagos del Adelanto</DialogTitle>
          <DialogDescription>Detalle completo de todos los abonos realizados.</DialogDescription>
        </DialogHeader>
        
        {/* Resumen Superior */}
        {!loading && history.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Total Abonado</p>
              <p className="text-lg font-bold text-[#8AAA19] font-mono">
                {totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Cantidad de Pagos</p>
              <p className="text-lg font-bold text-[#010139]">{history.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">Último Pago</p>
              <p className="text-sm font-semibold text-gray-700">
                {history[0] ? new Date(history[0].created_at).toLocaleDateString('es-PA') : '-'}
              </p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <div className="history-table-wrapper rounded-md border max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead className="history-th-date">Fecha</TableHead>
                  <TableHead className="history-th-type">Tipo de Pago</TableHead>
                  <TableHead className="history-th-detail">Detalle</TableHead>
                  <TableHead className="text-right history-th-amount">Monto Abonado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139] mx-auto"></div>
                  </TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center h-24 text-gray-500">
                    No hay pagos registrados para este adelanto.
                  </TableCell></TableRow>
                ) : (
                  history.map(log => (
                    <TableRow key={log.id} className="hover:bg-gray-50">
                      <TableCell className="history-td-date">
                        <div className="font-medium">{new Date(log.created_at).toLocaleDateString('es-PA')}</div>
                        <div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}</div>
                      </TableCell>
                      <TableCell className="history-td-type">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {formatPaymentType(log.payment_type)}
                        </span>
                      </TableCell>
                      <TableCell className="history-td-detail">
                        {log.fortnights ? (
                          <span className="text-sm">
                            Q{new Date(log.fortnights.period_start).getDate() <= 15 ? 1 : 2} - {new Date(log.fortnights.period_start).toLocaleDateString('es-PA', { month: 'short', year: 'numeric' })}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right history-td-amount">
                        <span className="font-mono font-semibold text-[#8AAA19]">
                          {log.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <style jsx global>{`
          .history-table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          @media (max-width: 640px) {
            .history-th-detail,
            .history-td-detail {
              display: none;
            }
            .history-table-wrapper {
              font-size: 0.875rem;
            }
          }
          
          @media (max-width: 480px) {
            .history-th-date,
            .history-td-date {
              font-size: 0.75rem;
            }
            .history-th-type,
            .history-td-type {
              font-size: 0.75rem;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
