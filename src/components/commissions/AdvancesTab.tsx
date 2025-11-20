'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { actionGetAdvances, actionGetPaidAdvancesTotal } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaChevronDown, FaChevronRight, FaMoneyBillWave, FaPlus, FaHistory, FaDollarSign, FaEdit } from 'react-icons/fa';
import { AddAdvanceModal } from './AddAdvanceModal';
import { AdvanceHistoryModal } from './AdvanceHistoryModal';
import { PayAdvanceModal } from './PayAdvanceModal';
import { EditAdvanceModal } from './EditAdvanceModal';

// Types
type AdvanceStatus = 'pending' | 'paid';

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
  status: AdvanceStatus;
  created_at: string;
  brokers: { id: string; name: string | null } | null;
  is_recurring?: boolean;
  recurrence_id?: string | null;
  total_paid?: number; // Total pagado desde advance_logs
}

interface GroupedAdvances {
  [brokerId: string]: {
    broker_name: string;
    total_pending: number;
    total_paid: number; // Total pagado por este broker
    advances: Advance[];
  };
}

interface Props {
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string }[];
}

export function AdvancesTab({ role, brokerId, brokers }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [allAdvances, setAllAdvances] = useState<Advance[]>([]);
  const [paidTotal, setPaidTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
  const [editingAdvance, setEditingAdvance] = useState<Advance | null>(null);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    brokerId: string | null;
    brokerName: string;
    pendingAdvances: { id: string; amount: number; reason: string | null }[];
  }>({
    isOpen: false,
    brokerId: null,
    brokerName: '',
    pendingAdvances: [],
  });

  // Sincronizar adelantos recurrentes existentes (solo una vez)
  const syncRecurrences = useCallback(async () => {
    try {
      console.log('[AdvancesTab] Syncing recurrences...');
      const response = await fetch('/commissions/sync-recurrences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result = await response.json();
      console.log('[AdvancesTab] Sync result:', result);
      if (result.synced > 0) {
        console.log('[AdvancesTab] Synced', result.synced, 'recurrences');
      }
    } catch (error) {
      console.error('[AdvancesTab] Error syncing recurrences:', error);
      // No mostramos error al usuario, solo logging
    }
  }, []);

  const loadAdvances = useCallback(async () => {
    setLoading(true);
    try {
      // Intentar sincronizar recurrencias primero (solo master)
      if (role === 'master') {
        await syncRecurrences();
      }
      
      const result = await actionGetAdvances(role === 'broker' ? brokerId || undefined : undefined, year);
      console.log('[AdvancesTab] Result from actionGetAdvances:', result);
      if (result.ok) {
        console.log('[AdvancesTab] Setting advances, count:', result.data?.length || 0);
        const normalized = (result.data || []).map((item) => {
          const status = typeof item.status === 'string' ? item.status.toLowerCase() : 'pending';
          const normalizedStatus: AdvanceStatus = status === 'paid' ? 'paid' : 'pending';
          const advance: Advance = {
            id: item.id,
            amount: Number(item.amount) || 0,
            reason: item.reason ?? null,
            status: normalizedStatus,
            created_at: item.created_at,
            brokers: (item as any).brokers ?? null,
            is_recurring: (item as any).is_recurring ?? false,
            recurrence_id: (item as any).recurrence_id ?? null,
            total_paid: (item as any).total_paid ? Number((item as any).total_paid) : undefined,
          };
          console.log('[AdvancesTab] Normalized advance:', advance.id, advance.status, advance.amount, 'total_paid:', advance.total_paid, 'recurring:', advance.is_recurring);
          return advance;
        });
        setAllAdvances(normalized);
      } else {
        console.error('[AdvancesTab] Error loading advances:', result.error);
        toast.error('Error al cargar adelantos', { description: result.error });
      }
      
      // Cargar total de deudas saldadas desde advance_logs
      const paidResult = await actionGetPaidAdvancesTotal(role === 'broker' ? brokerId || undefined : undefined, year);
      if (paidResult.ok) {
        console.log('[AdvancesTab] Paid total from logs:', paidResult.total);
        setPaidTotal(paidResult.total);
      } else {
        console.error('[AdvancesTab] Error loading paid total:', paidResult.error);
        setPaidTotal(0);
      }
    } catch (error) {
      console.error('[AdvancesTab] Exception loading advances:', error);
      toast.error('Error inesperado al cargar adelantos');
    } finally {
      setLoading(false);
    }
  }, [role, brokerId, year, syncRecurrences]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const groupedData = useMemo(() => {
    console.log('[AdvancesTab] Grouping advances, total count:', allAdvances.length);
    const grouped = allAdvances.reduce<GroupedAdvances>((acc, advance) => {
      const bId = advance.brokers?.id || 'unknown';
      if (!acc[bId]) {
        acc[bId] = {
          broker_name: advance.brokers?.name || 'Desconocido',
          total_pending: 0,
          total_paid: 0,
          advances: [],
        };
      }
      if (advance.status === 'pending') {
        acc[bId].total_pending += advance.amount;
      }
      if (advance.status === 'paid' && advance.total_paid) {
        acc[bId].total_paid += advance.total_paid;
      }
      acc[bId].advances.push(advance);
      console.log('[AdvancesTab] Group accumulate:', bId, advance.status, acc[bId].advances.length);
      return acc;
    }, {});
    console.log('[AdvancesTab] Grouped data:', Object.keys(grouped).length, 'brokers');
    return grouped;
  }, [allAdvances]);

  const toggleBroker = (id: string) => {
    const newSet = new Set(expandedBrokers);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedBrokers(newSet);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  const renderTable = (status: 'pending' | 'paid') => {
    const hasData = Object.values(groupedData).some(broker => 
      broker.advances.some(a => a.status === status)
    );

    if (loading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139] mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando adelantos...</p>
        </div>
      );
    }

    if (!hasData) {
      return (
        <div className="text-center py-12">
          <FaMoneyBillWave className="text-6xl text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            No hay adelantos {status === 'pending' ? 'pendientes' : 'saldados'} en {year}
          </p>
        </div>
      );
    }

    return (
      <div className="advances-table-wrapper">
        {/* Tabla para desktop */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-gray-200 bg-gray-50">
              {role === 'master' && <TableHead className="w-10 advances-th-expand"></TableHead>}
              <TableHead className="text-gray-700 font-semibold advances-th-broker">Corredor / Motivo</TableHead>
              <TableHead className="text-right text-gray-700 font-semibold advances-th-amount">Monto</TableHead>
              <TableHead className="text-center text-gray-700 font-semibold advances-th-date">Fecha</TableHead>
              <TableHead className="text-center text-gray-700 font-semibold advances-th-actions">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
        {Object.entries(groupedData).map(([bId, brokerData]) => {
          const advancesToShow = brokerData.advances.filter(a => a.status === status);
          if (advancesToShow.length === 0) return null;

          return (
            <React.Fragment key={`broker-${bId}`}>
              {role === 'master' && (
                <TableRow 
                  key={bId} 
                  onClick={() => toggleBroker(bId)} 
                  className="cursor-pointer bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-150 font-semibold transition-colors"
                >
                  <TableCell>
                    {expandedBrokers.has(bId) ? (
                      <FaChevronDown className="text-[#010139]" />
                    ) : (
                      <FaChevronRight className="text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-[#010139]">{brokerData.broker_name}</TableCell>
                  <TableCell className="text-right font-bold text-[#8AAA19] font-mono">
                    {status === 'pending' 
                      ? brokerData.total_pending.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                      : brokerData.total_paid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                    }
                  </TableCell>
                  <TableCell className="text-center text-gray-600">
                    {advancesToShow.length} adelantos
                  </TableCell>
                  <TableCell className="text-center">
                    {status === 'pending' ? (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="hover:bg-[#010139] hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          const pendingAdv = brokerData.advances
                            .filter(a => a.status === 'pending')
                            .map(a => ({ id: a.id, amount: a.amount, reason: a.reason }));
                          setPaymentModal({
                            isOpen: true,
                            brokerId: bId,
                            brokerName: brokerData.broker_name,
                            pendingAdvances: pendingAdv,
                          });
                        }}
                      >
                        Pago Externo
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-500">Saldado</span>
                    )}
                  </TableCell>
                </TableRow>
              )}
              {(role === 'broker' || expandedBrokers.has(bId)) && advancesToShow.map(advance => (
                <TableRow 
                  key={advance.id} 
                  className="hover:bg-gray-50 transition-colors"
                >
                  {role === 'master' && <TableCell></TableCell>}
                  <TableCell className={role === 'master' ? 'pl-12 text-gray-600' : 'text-gray-700'}>
                    <div className="flex items-center gap-2">
                      <span>{advance.reason || 'Sin motivo especificado'}</span>
                      {advance.is_recurring && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                          🔁 RECURRENTE
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-700">
                    {status === 'pending'
                      ? advance.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                      : (advance.total_paid || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                    }
                  </TableCell>
                  <TableCell className="text-center text-gray-500 text-sm">
                    {new Date(advance.created_at).toLocaleDateString('es-PA')}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {role === 'master' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingAdvance(advance);
                          }}
                          className="hover:bg-[#010139] hover:text-white"
                          title="Editar adelanto"
                        >
                          <FaEdit className="text-sm" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost" 
                        onClick={() => setSelectedAdvanceId(advance.id)}
                        className="hover:bg-[#8AAA19] hover:text-white"
                        title="Ver historial"
                      >
                        <FaHistory className="text-sm" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          );
        })}
        </TableBody>
        </Table>
        </div>
        
        {/* Cards para mobile */}
        <div className="md:hidden space-y-3">
          {Object.entries(groupedData).map(([bId, brokerData]) => {
            const advancesToShow = brokerData.advances.filter(a => a.status === status);
            if (advancesToShow.length === 0) return null;
            
            return (
              <div key={`mobile-broker-${bId}`} className="space-y-2">
                {role === 'master' && (
                  <div 
                    onClick={() => toggleBroker(bId)}
                    className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-3 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedBrokers.has(bId) ? <FaChevronDown /> : <FaChevronRight />}
                        <span className="font-bold">{brokerData.broker_name}</span>
                      </div>
                      <span className="font-bold text-[#8AAA19]">
                        {status === 'pending' 
                          ? brokerData.total_pending.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                          : brokerData.total_paid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                        }
                      </span>
                    </div>
                    <div className="text-xs text-white/80 mt-1">
                      {advancesToShow.length} adelanto{advancesToShow.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                
                {(role === 'broker' || expandedBrokers.has(bId)) && advancesToShow.map(advance => (
                  <div key={`mobile-${advance.id}`} className="bg-white border-2 border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#010139] text-sm">
                          {advance.reason || 'Sin motivo especificado'}
                        </p>
                        {advance.is_recurring && (
                          <span className="inline-block mt-1 text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                            ♻️ Recurrente
                          </span>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-[#8AAA19] font-mono text-base">
                          {status === 'pending'
                            ? advance.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                            : (advance.total_paid || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
                          }
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(advance.created_at).toLocaleDateString('es-PA')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      {role === 'master' && (
                        <Button
                          size="sm"
                          onClick={() => setEditingAdvance(advance)}
                          className="flex-1 bg-[#010139] hover:bg-[#020270] text-white text-xs"
                        >
                          <FaEdit className="text-xs text-white" /> Editar
                        </Button>
                      )}
                      {role === 'master' && status === 'pending' && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setPaymentModal({
                              isOpen: true,
                              brokerId: advance.brokers?.id || null,
                              brokerName: advance.brokers?.name || 'Desconocido',
                              pendingAdvances: [{ id: advance.id, amount: advance.amount, reason: advance.reason }],
                            });
                          }}
                          className="flex-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:from-[#7a9916] hover:to-[#5c7312] text-white text-xs"
                        >
                          <FaDollarSign className="text-xs text-white" /> Pagar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAdvanceId(advance.id)}
                        className="flex-1 text-xs"
                      >
                        <FaHistory className="text-xs" /> Historial
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <style jsx global>{`
          .advances-table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        `}</style>
      </div>
    );
  };

  // Calculate totals
  const totals = useMemo(() => {
    const pendingAdvances = allAdvances.filter(a => a.status === 'pending');
    const paidAdvances = allAdvances.filter(a => a.status === 'paid');
    
    const pendingTotal = pendingAdvances.reduce((sum, a) => sum + a.amount, 0);
    // paidTotal ya viene de advance_logs (suma de pagos realizados)
    
    console.log('[AdvancesTab] Totals calculation:');
    console.log('  - Total advances:', allAdvances.length);
    console.log('  - Pending advances:', pendingAdvances.length, 'Total:', pendingTotal);
    console.log('  - Paid advances:', paidAdvances.length, 'Total from logs:', paidTotal);
    
    // Verificar si hay adelantos con montos inválidos en pendientes
    const invalidAmounts = pendingAdvances.filter(a => isNaN(a.amount) || a.amount === null);
    if (invalidAmounts.length > 0) {
      console.warn('[AdvancesTab] Found pending advances with invalid amounts:', invalidAmounts);
    }
    
    return { pendingTotal, paidTotal };
  }, [allAdvances, paidTotal]);

  return (
    <div className="space-y-6">
      <AddAdvanceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadAdvances} brokers={brokers} />
      <EditAdvanceModal advance={editingAdvance} onClose={() => setEditingAdvance(null)} onSuccess={loadAdvances} />
      <AdvanceHistoryModal isOpen={!!selectedAdvanceId} onClose={() => setSelectedAdvanceId(null)} advanceId={selectedAdvanceId} />
      <PayAdvanceModal 
        isOpen={paymentModal.isOpen} 
        onClose={() => setPaymentModal({ isOpen: false, brokerId: null, brokerName: '', pendingAdvances: [] })} 
        onSuccess={loadAdvances}
        brokerId={paymentModal.brokerId}
        brokerName={paymentModal.brokerName}
        pendingAdvances={paymentModal.pendingAdvances}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white shadow-xl border-l-4 border-l-[#010139] hover:shadow-2xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <div className="p-2 bg-[#010139]/10 rounded-lg">
                <FaMoneyBillWave className="text-[#010139]" size={18} />
              </div>
              Total Adelantos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#010139] font-mono">
              {totals.pendingTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {role === 'master' 
                ? `${Object.keys(groupedData).length} corredores con adelantos`
                : `${allAdvances.filter(a => a.status === 'pending').length} adelantos activos`
              }
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-white shadow-xl border-l-4 border-l-[#8AAA19] hover:shadow-2xl transition-all">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <div className="p-2 bg-[#8AAA19]/10 rounded-lg">
                <FaDollarSign className="text-[#8AAA19]" size={18} />
              </div>
              Total Adelantos Saldados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#8AAA19] font-mono">
              {totals.paidTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            <p className="text-sm text-gray-500 mt-2">En el año {year}</p>
          </CardContent>
        </Card>
        
        {role === 'master' && (
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 shadow-xl border-l-4 border-l-green-500 hover:shadow-2xl hover:scale-105 transition-all cursor-pointer"
                onClick={() => setIsAddModalOpen(true)}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FaPlus className="text-green-600" size={18} />
                </div>
                Crear Nuevo Adelanto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-gray-700">Click para agregar</p>
              <p className="text-sm text-gray-600 mt-1">Registrar adelanto a corredor</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Table */}
      <Card className="bg-white shadow-xl">
        <CardHeader className="bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-t-lg">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <FaHistory className="text-white" size={20} />
              </div>
              <CardTitle className="text-white text-xl">Gestión de Adelantos</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-28 bg-white/10 border-white/30 text-white backdrop-blur-sm hover:bg-white/20">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {role === 'master' && (
                <Button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-[#8AAA19] hover:bg-[#6d8814] text-white shadow-lg transition-all hover:scale-105"
                >
                  <FaPlus className="mr-2 h-3 w-3" />
                  <span className="hidden sm:inline">Nuevo Adelanto</span>
                  <span className="sm:hidden">Nuevo</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs defaultValue="pending" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none bg-gray-50 border-b-2 border-gray-200">
              <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:text-[#010139] data-[state=active]:border-b-2 data-[state=active]:border-[#010139] rounded-none font-semibold">
                Deudas Activas
              </TabsTrigger>
              <TabsTrigger value="paid" className="data-[state=active]:bg-white data-[state=active]:text-[#8AAA19] data-[state=active]:border-b-2 data-[state=active]:border-[#8AAA19] rounded-none font-semibold">
                Deudas Saldadas
              </TabsTrigger>
            </TabsList>
            <div className="p-6 bg-white">
              <TabsContent value="pending">
                {renderTable('pending')}
              </TabsContent>
              <TabsContent value="paid">
                {renderTable('paid')}
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
