'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaMoneyBillWave, FaChevronDown, FaChevronRight, FaCheckCircle } from 'react-icons/fa';
import { actionGetAdvances } from '@/app/(app)/commissions/actions';
import { BrokerRecurringAdvancesCard } from './BrokerRecurringAdvancesCard';

interface Props {
  brokerId: string;
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'paid';
  created_at: string;
  is_recurring?: boolean;
  recurrence_id?: string | null;
  payments?: Array<{
    date: string;
    amount: number;
    method: string;
  }>;
}

export default function BrokerAdvancesTab({ brokerId }: Props) {
  const [activeAdvances, setActiveAdvances] = useState<Advance[]>([]);
  const [paidAdvances, setPaidAdvances] = useState<Advance[]>([]);
  const [expandedAdvances, setExpandedAdvances] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdvances = async () => {
      setLoading(true);
      try {
        const result = await actionGetAdvances(brokerId);
        if (result.ok) {
          const advances = (result.data || []).map((a: any) => ({
            ...a,
            amount: Number(a.amount) || 0
          }));
          setActiveAdvances(advances.filter((a: any) => a.status === 'pending'));
          setPaidAdvances(advances.filter((a: any) => a.status === 'paid'));
        }
      } catch (error) {
        console.error('Error loading advances:', error);
      }
      setLoading(false);
    };
    loadAdvances();
  }, [brokerId]);

  const toggleAdvance = (id: string) => {
    const newSet = new Set(expandedAdvances);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedAdvances(newSet);
  };

  // Calculate totals
  const totalActive = activeAdvances.reduce((sum, a) => sum + a.amount, 0);
  const totalPaid = paidAdvances.reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-2">
            <FaMoneyBillWave className="text-[#010139] text-xl" />
            <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">MIS ADELANTOS</h2>
          </div>
          <p className="text-sm text-gray-600">
            Consulta tus adelantos activos y el historial de pagos realizados
          </p>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-lg border-l-4 border-l-red-500">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Deuda Activa</p>
                <p className="text-2xl sm:text-3xl font-bold text-red-600 font-mono">{formatCurrency(totalActive)}</p>
              </div>
              <FaMoneyBillWave className="text-3xl sm:text-4xl text-red-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-l-4 border-l-[#8AAA19]">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Pagado</p>
                <p className="text-2xl sm:text-3xl font-bold text-[#8AAA19] font-mono">{formatCurrency(totalPaid)}</p>
              </div>
              <FaCheckCircle className="text-3xl sm:text-4xl text-[#8AAA19]/30" />
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-lg border-l-4 border-l-[#010139]">
          <CardContent className="p-4 sm:p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Adelantos Activos</p>
                <p className="text-2xl sm:text-3xl font-bold text-[#010139]">{activeAdvances.length}</p>
              </div>
              <FaMoneyBillWave className="text-3xl sm:text-4xl text-[#010139]/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recurring Advances Card */}
      <BrokerRecurringAdvancesCard brokerId={brokerId} />

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2">
          <TabsTrigger value="active">Adelantos Activos</TabsTrigger>
          <TabsTrigger value="paid">Adelantos Pagados</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {activeAdvances.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaMoneyBillWave className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay adelantos activos
                  </h3>
                  <p className="text-sm text-gray-500">Tus adelantos pendientes aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="font-semibold text-gray-700">Motivo</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto Original</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Saldo Pendiente</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha Creación</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeAdvances.map(advance => {
                        const paidAmount = advance.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                        const balance = advance.amount - paidAmount;
                        return (
                          <>
                            <TableRow 
                              key={advance.id}
                              className="cursor-pointer hover:bg-gray-50 transition-colors"
                              onClick={() => toggleAdvance(advance.id)}
                            >
                              <TableCell>
                                {expandedAdvances.has(advance.id) ? 
                                  <FaChevronDown className="text-[#010139]" /> : 
                                  <FaChevronRight className="text-gray-400" />
                                }
                              </TableCell>
                              <TableCell className="text-gray-700">
                                <div className="flex items-center gap-2">
                                  <span>{advance.reason || 'Sin motivo'}</span>
                                  {advance.is_recurring && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                      🔁 RECURRENTE
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-[#010139] font-semibold">
                                {formatCurrency(advance.amount)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-red-600 font-bold text-lg">
                                {formatCurrency(balance)}
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {advance.created_at ? new Date(advance.created_at).toLocaleDateString('es-PA') : '-'}
                              </TableCell>
                            </TableRow>
                            {expandedAdvances.has(advance.id) && (
                              <TableRow>
                                <TableCell colSpan={5} className="bg-gray-50/50">
                                  <div className="p-4 sm:p-6">
                                    <p className="text-sm font-semibold text-gray-700 mb-3">Historial de Pagos:</p>
                                    {advance.payments && advance.payments.length > 0 ? (
                                      <div className="space-y-2">
                                        {advance.payments?.map((payment, idx) => (
                                          <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 bg-white rounded shadow-sm">
                                            <span className="text-sm text-gray-600">
                                              {new Date(payment.date).toLocaleDateString('es-PA')}
                                            </span>
                                            <span className="text-sm text-gray-600">{payment.method}</span>
                                            <span className="text-sm font-mono font-semibold text-[#8AAA19]">
                                              {formatCurrency(payment.amount)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500">No hay pagos registrados aún</p>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="paid" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {paidAdvances.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaCheckCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay adelantos pagados
                  </h3>
                  <p className="text-sm text-gray-500">Tu historial de adelantos saldados aparecerá aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-10"></TableHead>
                        <TableHead className="font-semibold text-gray-700">Motivo</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto Total</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha Creación</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha Saldado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidAdvances.map(advance => (
                        <>
                          <TableRow 
                            key={advance.id}
                            className="cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => toggleAdvance(advance.id)}
                          >
                            <TableCell>
                              {expandedAdvances.has(advance.id) ? 
                                <FaChevronDown className="text-[#010139]" /> : 
                                <FaChevronRight className="text-gray-400" />
                              }
                            </TableCell>
                            <TableCell className="text-gray-700">
                              <div className="flex items-center gap-2">
                                <span>{advance.reason || 'Sin motivo'}</span>
                                {advance.is_recurring && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                    🔁 RECURRENTE
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#8AAA19] font-bold text-lg">
                              {formatCurrency(advance.amount)}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {advance.created_at ? new Date(advance.created_at).toLocaleDateString('es-PA') : '-'}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {(() => {
                                const lastPayment = advance.payments?.[advance.payments.length - 1];
                                return lastPayment ? new Date(lastPayment.date).toLocaleDateString('es-PA') : '-';
                              })()}
                            </TableCell>
                          </TableRow>
                          {expandedAdvances.has(advance.id) && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-gray-50/50">
                                <div className="p-4 sm:p-6">
                                  <p className="text-sm font-semibold text-gray-700 mb-3">Desglose de Pagos:</p>
                                  {advance.payments && advance.payments.length > 0 ? (
                                    <div className="space-y-2">
                                      {advance.payments?.map((payment, idx) => (
                                        <div key={idx} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 bg-white rounded shadow-sm">
                                          <span className="text-sm text-gray-600">
                                            {new Date(payment.date).toLocaleDateString('es-PA')}
                                          </span>
                                          <span className="text-sm text-gray-600">{payment.method}</span>
                                          <span className="text-sm font-mono font-semibold text-[#8AAA19]">
                                            {formatCurrency(payment.amount)}
                                          </span>
                                        </div>
                                      ))}
                                      <div className="border-t pt-2 mt-2">
                                        <div className="flex justify-between items-center font-semibold">
                                          <span className="text-sm">Total Pagado</span>
                                          <span className="text-sm font-mono text-[#8AAA19]">
                                            {formatCurrency(advance.amount)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No hay información de pagos</p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
