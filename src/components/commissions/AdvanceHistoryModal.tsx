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

interface AdvanceInfo {
  id: string;
  reason: string;
  initial_amount: number;
  current_amount: number;
  status: string;
  is_recurring: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  advanceId: string | null;
}

export function AdvanceHistoryModal({ isOpen, onClose, advanceId }: Props) {
  const [history, setHistory] = useState<HistoryLog[]>([]);
  const [advance, setAdvance] = useState<AdvanceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && advanceId) {
      const fetchHistory = async () => {
        setLoading(true);
        const result = await actionGetAdvanceHistory(advanceId);
        if (result.ok) {
          setHistory(result.data as unknown as HistoryLog[] || []);
          setAdvance(result.advance as AdvanceInfo);
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
  const initialAmount = advance?.initial_amount || 0;
  const currentAmount = advance?.current_amount || 0;
  const isFullyPaid = currentAmount <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#010139]">
            Historial de Pagos - {advance?.reason || 'Adelanto'}
          </DialogTitle>
          <DialogDescription>Detalle completo de todos los abonos realizados.</DialogDescription>
        </DialogHeader>
        
        {/* Resumen Superior con Deudas */}
        {!loading && advance && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium">💰 Deuda Inicial</p>
                <p className="text-lg font-bold text-blue-700 font-mono">
                  {initialAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium">💸 Total Abonado</p>
                <p className="text-lg font-bold text-[#8AAA19] font-mono">
                  {totalPaid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium">📊 Cantidad Pagos</p>
                <p className="text-lg font-bold text-[#010139]">{history.length}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 mb-1 font-medium">
                  {isFullyPaid ? '✅ Completado' : '⏳ Deuda Actual'}
                </p>
                <p className={`text-lg font-bold font-mono ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
                  {currentAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              </div>
            </div>

            {/* Mensaje de Agradecimiento */}
            {isFullyPaid && !advance.is_recurring && (
              <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🎉</span>
                  <div>
                    <p className="font-bold text-green-800 text-lg">¡Felicidades!</p>
                    <p className="text-green-700 text-sm">
                      Has completado el pago de este adelanto. ¡Gracias por tu compromiso y responsabilidad!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Nota para Recurrentes */}
            {advance.is_recurring && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <p className="text-sm text-purple-800">
                  <span className="font-semibold">🔁 Adelanto Recurrente:</span> Este adelanto se restablece automáticamente después de cada pago completo.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex-1 overflow-hidden">
          <div className="history-table-wrapper rounded-md border max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead className="history-th-date">Fecha</TableHead>
                  <TableHead className="history-th-type">Tipo</TableHead>
                  <TableHead className="text-right history-th-before">Deuda Antes</TableHead>
                  <TableHead className="text-right history-th-amount">Monto Pagado</TableHead>
                  <TableHead className="text-right history-th-after">Deuda Después</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139] mx-auto"></div>
                  </TableCell></TableRow>
                ) : history.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center h-24 text-gray-500">
                    No hay pagos registrados para este adelanto.
                  </TableCell></TableRow>
                ) : (
                  (() => {
                    let remainingDebt = initialAmount;
                    return history.map((log, index) => {
                      const debtBefore = remainingDebt;
                      const debtAfter = Math.max(0, remainingDebt - log.amount);
                      remainingDebt = debtAfter;
                      
                      return (
                        <TableRow key={log.id} className="hover:bg-gray-50">
                          <TableCell className="history-td-date">
                            <div className="font-medium text-sm">{new Date(log.created_at).toLocaleDateString('es-PA')}</div>
                            <div className="text-xs text-gray-500">{new Date(log.created_at).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' })}</div>
                          </TableCell>
                          <TableCell className="history-td-type">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {log.payment_type === 'fortnight' ? 'Quincena' : 
                               log.payment_type === 'cash' ? 'Efectivo' : 
                               log.payment_type === 'transfer' ? 'Transfer.' : 'Otro'}
                            </span>
                          </TableCell>
                          <TableCell className="text-right history-td-before">
                            <span className="font-mono text-sm text-red-600 font-semibold">
                              {debtBefore.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right history-td-amount">
                            <span className="font-mono font-bold text-[#8AAA19]">
                              {log.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right history-td-after">
                            <span className={`font-mono text-sm font-semibold ${debtAfter <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                              {debtAfter.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    });
                  })()
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
          
          @media (max-width: 768px) {
            .history-th-before,
            .history-td-before {
              display: none;
            }
            .history-table-wrapper {
              font-size: 0.875rem;
            }
          }
          
          @media (max-width: 640px) {
            .history-th-type,
            .history-td-type {
              display: none;
            }
          }
          
          @media (max-width: 480px) {
            .history-th-date,
            .history-td-date {
              font-size: 0.75rem;
            }
            .history-th-amount,
            .history-td-amount,
            .history-th-after,
            .history-td-after {
              font-size: 0.75rem;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
