'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { actionGetAdvances, actionGetPaidAdvancesTotal, actionGetAdvanceLogs } from '@/app/(app)/commissions/actions';
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
type AdvanceStatus = 'pending' | 'paid' | 'partial';

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
  last_payment_date?: string | null; // Fecha del último pago desde advance_logs
  payment_logs?: Array<{ date: string; amount: number }>; // Logs individuales con fecha y monto
  payment_details?: {
    policy_number: string | null;
    client_name: string | null;
    insurer_name: string | null;
  } | null;
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
  const [advanceLogs, setAdvanceLogs] = useState<any[]>([]);
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
      // NO sincronizar automáticamente - causa loops al eliminar
      // if (role === 'master') {
      //   await syncRecurrences();
      // }
      
      const result = await actionGetAdvances(role === 'broker' ? brokerId || undefined : undefined, year);
      console.log('[AdvancesTab] Result from actionGetAdvances:', result);
      if (result.ok) {
        console.log('[AdvancesTab] Setting advances, count:', result.data?.length || 0);
        const normalized = (result.data || []).map((item) => {
          const status = typeof item.status === 'string' ? item.status.toLowerCase() : 'pending';
          // NO cambiar el status - usar tal cual viene del backend
          const normalizedStatus: AdvanceStatus = 
            status === 'paid' ? 'paid' : 
            status === 'partial' ? 'partial' : 
            'pending';
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
            last_payment_date: (item as any).last_payment_date ?? null,
            payment_logs: (item as any).payment_logs ?? [],
            payment_details: (item as any).payment_details ?? null,
          };
          console.log('[AdvancesTab] Advance:', advance.id.substring(0,8), 'status:', advance.status, 'amount:', advance.amount, 'total_paid:', advance.total_paid, 'payment_logs:', advance.payment_logs?.length, 'last_payment:', advance.last_payment_date);
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
      
      // Cargar logs de pagos para la pestaña "Descuentos"
      const logsResult = await actionGetAdvanceLogs(role === 'broker' ? brokerId || undefined : undefined, year);
      if (logsResult.ok) {
        console.log('[AdvancesTab] Loaded advance logs:', logsResult.data?.length || 0);
        setAdvanceLogs(logsResult.data || []);
      } else {
        console.error('[AdvancesTab] Error loading logs:', logsResult.error);
        setAdvanceLogs([]);
      }
    } catch (error) {
      console.error('[AdvancesTab] Exception loading advances:', error);
      toast.error('Error inesperado al cargar adelantos');
    } finally {
      setLoading(false);
    }
  }, [role, brokerId, year]);

  useEffect(() => {
    loadAdvances();
  }, [loadAdvances]);

  const groupedData = useMemo(() => {
    console.log('[AdvancesTab] Grouping advances, total count:', allAdvances.length);
    
    // Primero, agrupar adelantos recurrentes con mismo recurrence_id
    const recurrenceMap: Record<string, Advance[]> = {};
    const nonRecurrentAdvances: Advance[] = [];
    
    allAdvances.forEach(advance => {
      if (advance.is_recurring && advance.recurrence_id) {
        const recId = advance.recurrence_id;
        if (!recurrenceMap[recId]) {
          recurrenceMap[recId] = [];
        }
        recurrenceMap[recId]!.push(advance);
      } else {
        nonRecurrentAdvances.push(advance);
      }
    });
    
    // Combinar adelantos recurrentes del mismo grupo en uno solo
    const mergedAdvances: Advance[] = [];
    
    Object.values(recurrenceMap).forEach(group => {
      if (!group || group.length === 0) return;
      
      if (group.length > 1) {
        // Múltiples adelantos con mismo recurrence_id (Q1 y Q2)
        // Combinar en uno solo VISUALMENTE, pero mantener monto individual
        const base = group[0]!;
        
        // Sumar total_paid de AMBOS adelantos del grupo
        const combinedTotalPaid = group.reduce((sum, adv) => sum + (adv.total_paid || 0), 0);
        
        // Combinar payment_logs de AMBOS adelantos
        const combinedPaymentLogs: Array<{ date: string; amount: number }> = [];
        group.forEach(adv => {
          if (adv.payment_logs && adv.payment_logs.length > 0) {
            combinedPaymentLogs.push(...adv.payment_logs);
          }
        });
        
        // Usar la fecha de pago más reciente de cualquiera de los dos
        const latestPaymentDate = group
          .filter(a => a.last_payment_date)
          .map(a => a.last_payment_date!)
          .sort((a, b) => b.localeCompare(a))[0] || null;
        
        const merged: Advance = { 
          id: base.id,
          amount: base.amount, // Mantener monto individual, no sumar
          reason: base.reason?.replace(/ \(Recurrente Q[12]\)/, '') + ' (Recurrente Q1 y Q2)',
          status: base.status,
          created_at: base.created_at,
          brokers: base.brokers,
          is_recurring: base.is_recurring,
          recurrence_id: base.recurrence_id,
          total_paid: combinedTotalPaid, // Total de AMBOS
          last_payment_date: latestPaymentDate, // Fecha más reciente
          payment_logs: combinedPaymentLogs, // Logs combinados de ambos
          payment_details: base.payment_details
        };
        // Guardar referencia a todos los adelantos del grupo con sus montos
        (merged as any).quincenaGroup = group.map(a => ({
          id: a.id,
          amount: a.amount,
          quincena: a.reason?.includes('Q1') ? 'Q1' : 'Q2',
          total_paid: a.total_paid || 0,
          last_payment_date: a.last_payment_date
        }));
        mergedAdvances.push(merged);
      } else {
        // Solo un adelanto (Q1 o Q2)
        const single = group[0]!;
        mergedAdvances.push(single);
      }
    });
    
    // Agregar adelantos no recurrentes
    mergedAdvances.push(...nonRecurrentAdvances);
    
    // Ahora agrupar por broker
    const grouped = mergedAdvances.reduce<GroupedAdvances>((acc, advance) => {
      const bId = advance.brokers?.id || 'unknown';
      if (!acc[bId]) {
        acc[bId] = {
          broker_name: advance.brokers?.name || 'Desconocido',
          total_pending: 0,
          total_paid: 0,
          advances: [],
        };
      }
      // Sumar al pending si es pending o partial Y tiene monto > 0
      if ((advance.status === 'pending' || advance.status === 'partial') && advance.amount > 0) {
        acc[bId].total_pending += advance.amount;
      }
      // Sumar al paid si tiene total_paid (incluye recurrentes con pagos)
      if (advance.total_paid && advance.total_paid > 0) {
        acc[bId].total_paid += advance.total_paid;
      }
      acc[bId].advances.push(advance);
      return acc;
    }, {});
    
    console.log('[AdvancesTab] Grouped data:', Object.keys(grouped).length, 'brokers');
    console.log('[AdvancesTab] Merged recurring advances:', Object.values(recurrenceMap).filter(g => g.length > 1).length);
    return grouped;
  }, [allAdvances]);

  const toggleBroker = (id: string) => {
    const newSet = new Set(expandedBrokers);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedBrokers(newSet);
  };

  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleDate = (date: string) => {
    const newSet = new Set(expandedDates);
    newSet.has(date) ? newSet.delete(date) : newSet.add(date);
    setExpandedDates(newSet);
  };

  const [expandedDateBrokers, setExpandedDateBrokers] = useState<Set<string>>(new Set());
  const toggleDateBroker = (key: string) => {
    const newSet = new Set(expandedDateBrokers);
    newSet.has(key) ? newSet.delete(key) : newSet.add(key);
    setExpandedDateBrokers(newSet);
  };

  const [expandedRecurrences, setExpandedRecurrences] = useState<Set<string>>(new Set());
  const toggleRecurrence = (key: string) => {
    const newSet = new Set(expandedRecurrences);
    newSet.has(key) ? newSet.delete(key) : newSet.add(key);
    setExpandedRecurrences(newSet);
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Helper: agrupar adelantos recurrentes
  const groupRecurrences = (advances: Advance[]) => {
    const recurrenceGroups: Record<string, Advance[]> = {};
    const nonRecurrent: Advance[] = [];
    
    advances.forEach(adv => {
      if (adv.is_recurring && adv.recurrence_id) {
        const recId = adv.recurrence_id;
        if (!recurrenceGroups[recId]) {
          recurrenceGroups[recId] = [];
        }
        const group = recurrenceGroups[recId];
        if (group) {
          group.push(adv);
        }
      } else {
        nonRecurrent.push(adv);
      }
    });
    
    return { recurrenceGroups, nonRecurrent };
  };

  const renderTable = (status: 'pending' | 'paid') => {
    // Verificar que hay datos para mostrar
    const hasData = Object.values(groupedData).some(broker => {
      if (status === 'paid') {
        // Para paid: buscar adelantos con historial de pagos
        return broker.advances.some(a => a.total_paid && a.total_paid > 0);
      } else {
        // Para pending: recurrentes SIEMPRE, o pending/partial con monto > 0
        return broker.advances.some(a => {
          // Recurrentes SIEMPRE en Deudas Activas
          if (a.is_recurring && a.recurrence_id) {
            return true;
          }
          // No recurrentes: solo pending o partial con monto > 0
          return ((a.status === 'pending' || a.status === 'partial') && a.amount > 0);
        });
      }
    });

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

    // Para Descuentos, agrupar ADELANTOS por fecha de pago
    if (status === 'paid') {
      // Recolectar adelantos con pagos
      const allPaidAdvances: Advance[] = [];
      Object.values(groupedData).forEach(brokerData => {
        brokerData.advances.forEach(adv => {
          if (adv.total_paid && adv.total_paid > 0 && adv.last_payment_date) {
            allPaidAdvances.push(adv);
          }
        });
      });

      // Agrupar por fecha de pago - ESTRICTO por día sin zona horaria
      const byDate: Record<string, { advances: Advance[], total: number, brokers: Record<string, { name: string, advances: Advance[], total: number }> }> = {};
      
      console.log('[AdvancesTab] Agrupando por fecha - Total adelantos con pagos:', allPaidAdvances.length);
      console.log('[AdvancesTab] Fechas de pago (muestra):', 
        allPaidAdvances.slice(0, 3).map(a => ({ 
          id: a.id.substring(0, 8), 
          date: a.last_payment_date 
        }))
      );
      
      // Agrupar por fecha usando payment_logs para obtener el monto REAL pagado en cada fecha
      allPaidAdvances.forEach(adv => {
        if (!adv.payment_logs || adv.payment_logs.length === 0) return;
        
        // Procesar cada log individual
        adv.payment_logs.forEach(log => {
          const dateKey = log.date.substring(0, 10);
          
          if (!byDate[dateKey]) {
            byDate[dateKey] = { advances: [], total: 0, brokers: {} };
          }
          
          // Solo agregar el adelanto una vez por fecha (para mostrar en la lista)
          const alreadyAdded = byDate[dateKey].advances.some(a => a.id === adv.id);
          if (!alreadyAdded) {
            byDate[dateKey].advances.push(adv);
          }
          
          // Sumar el monto REAL pagado en esta fecha
          byDate[dateKey].total += log.amount;
          
          if (role === 'master') {
            const brokerId = adv.brokers?.id || 'unknown';
            const brokerName = adv.brokers?.name || 'Sin corredor';
            
            if (!byDate[dateKey].brokers[brokerId]) {
              byDate[dateKey].brokers[brokerId] = { name: brokerName, advances: [], total: 0 };
            }
            
            // Solo agregar el adelanto una vez por fecha y broker
            const alreadyAddedToBroker = byDate[dateKey].brokers[brokerId].advances.some(a => a.id === adv.id);
            if (!alreadyAddedToBroker) {
              byDate[dateKey].brokers[brokerId].advances.push(adv);
            }
            
            // Sumar el monto REAL pagado en esta fecha para este broker
            byDate[dateKey].brokers[brokerId].total += log.amount;
          }
        });
      });

      // Ordenar fechas de más reciente a más antigua (comparación string YYYY-MM-DD)
      const sortedDates = Object.keys(byDate).sort((a, b) => {
        // Comparación string directa: "2025-11-20" > "2025-11-19" = true
        return b.localeCompare(a);
      });
      
      console.log('[AdvancesTab] Fechas agrupadas (ordenadas):', sortedDates);
      console.log('[AdvancesTab] Adelantos por fecha:', 
        sortedDates.map(date => ({ 
          date, 
          count: byDate[date]?.advances.length || 0,
          total: byDate[date]?.total || 0
        }))
      );

      return (
        <div className="advances-table-wrapper">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-gray-200 bg-gray-50">
                  <TableHead className="w-10 advances-th-expand"></TableHead>
                  <TableHead className="text-gray-700 font-semibold advances-th-broker">{role === 'master' ? 'Fecha / Corredor / Motivo' : 'Fecha / Motivo'}</TableHead>
                  <TableHead className="text-right text-gray-700 font-semibold advances-th-amount">Monto</TableHead>
                  <TableHead className="text-center text-gray-700 font-semibold advances-th-actions">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDates.map(dateKey => {
                  const dateGroup = byDate[dateKey];
                  if (!dateGroup) return null;
                  
                  // Formatear fecha YYYY-MM-DD a DD/MM/YYYY SIN conversiones
                  const [year, month, day] = dateKey.split('-');
                  const dateDisplay = `${day}/${month}/${year}`;
                  const isDateExpanded = expandedDates.has(dateKey);
                  
                  return (
                    <React.Fragment key={`date-${dateKey}`}>
                      {/* Fila de agrupación por fecha */}
                      <TableRow
                        onClick={() => toggleDate(dateKey)}
                        className="cursor-pointer bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 font-semibold transition-colors border-b-2 border-blue-200"
                      >
                        <TableCell>
                          {isDateExpanded ? (
                            <FaChevronDown className="text-[#010139]" />
                          ) : (
                            <FaChevronRight className="text-gray-400" />
                          )}
                        </TableCell>
                        <TableCell className="font-bold text-[#010139]">
                          📅 {dateDisplay}
                        </TableCell>
                        <TableCell className="text-right font-bold text-[#8AAA19] font-mono">
                          {dateGroup.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell className="text-center text-gray-600">
                          {dateGroup.advances.length} adelanto{dateGroup.advances.length !== 1 ? 's' : ''}
                        </TableCell>
                      </TableRow>

                      {isDateExpanded && role === 'master' ? (
                        // Vista Master: Agrupar por broker dentro de la fecha
                        Object.entries(dateGroup.brokers).map(([brokerId, brokerData]) => {
                          const brokerKey = `${dateKey}-${brokerId}`;
                          const isBrokerExpanded = expandedDateBrokers.has(brokerKey);
                          
                          return (
                            <React.Fragment key={brokerKey}>
                              {/* Fila de broker */}
                              <TableRow
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleDateBroker(brokerKey);
                                }}
                                className="cursor-pointer bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-150 transition-colors"
                              >
                                <TableCell className="pl-6">
                                  {isBrokerExpanded ? (
                                    <FaChevronDown className="text-[#010139] text-xs" />
                                  ) : (
                                    <FaChevronRight className="text-gray-400 text-xs" />
                                  )}
                                </TableCell>
                                <TableCell className="pl-8 font-semibold text-[#010139]">
                                  {brokerData.name}
                                </TableCell>
                                <TableCell className="text-right font-semibold text-[#8AAA19] font-mono">
                                  {brokerData.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                </TableCell>
                                <TableCell className="text-center text-gray-600 text-sm">
                                  {brokerData.advances.length} adelanto{brokerData.advances.length !== 1 ? 's' : ''}
                                </TableCell>
                              </TableRow>

                              {/* Adelantos del broker */}
                              {isBrokerExpanded && brokerData.advances.map(advance => (
                                <TableRow
                                  key={advance.id}
                                  className="hover:bg-gray-50 transition-colors"
                                >
                                  <TableCell></TableCell>
                                  <TableCell className="pl-16 text-gray-600">
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
                                    {(advance.total_paid || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
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
                        })
                      ) : isDateExpanded ? (
                        // Vista Broker: Mostrar adelantos directamente (sin nombre de broker)
                        dateGroup.advances.map(advance => (
                          <TableRow
                            key={advance.id}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <TableCell></TableCell>
                            <TableCell className="pl-12 text-gray-600">
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
                              {(advance.total_paid || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setSelectedAdvanceId(advance.id)}
                                className="hover:bg-[#8AAA19] hover:text-white"
                                title="Ver historial"
                              >
                                <FaHistory className="text-sm" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Cards para mobile - Agrupada por fecha */}
          <div className="md:hidden space-y-3">
            {sortedDates.map(dateKey => {
              const dateGroup = byDate[dateKey];
              if (!dateGroup) return null;
              
              // Formatear fecha YYYY-MM-DD a DD/MM/YYYY SIN conversiones
              const [year, month, day] = dateKey.split('-');
              const dateDisplay = `${day}/${month}/${year}`;
              const isDateExpanded = expandedDates.has(dateKey);
              
              return (
                <div key={`mobile-date-${dateKey}`} className="space-y-2">
                  {/* Header de fecha */}
                  <div
                    onClick={() => toggleDate(dateKey)}
                    className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-3 rounded-lg cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isDateExpanded ? <FaChevronDown /> : <FaChevronRight />}
                        <span className="font-bold">📅 {dateDisplay}</span>
                      </div>
                      <span className="font-bold text-white">
                        {dateGroup.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                    </div>
                    <div className="text-xs text-white/80 mt-1">
                      {dateGroup.advances.length} adelanto{dateGroup.advances.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {isDateExpanded && role === 'master' ? (
                    // Vista Master: Mostrar brokers
                    Object.entries(dateGroup.brokers).map(([brokerId, brokerData]) => {
                      const brokerKey = `${dateKey}-${brokerId}`;
                      const isBrokerExpanded = expandedDateBrokers.has(brokerKey);
                      
                      return (
                        <div key={brokerKey} className="ml-2 space-y-2">
                          {/* Header de broker */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleDateBroker(brokerKey);
                            }}
                            className="bg-gradient-to-r from-gray-100 to-gray-200 p-3 rounded-lg cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {isBrokerExpanded ? <FaChevronDown className="text-[#010139]" /> : <FaChevronRight className="text-gray-600" />}
                                <span className="font-semibold text-[#010139]">{brokerData.name}</span>
                              </div>
                              <span className="font-bold text-[#8AAA19]">
                                {brokerData.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {brokerData.advances.length} adelanto{brokerData.advances.length !== 1 ? 's' : ''}
                            </div>
                          </div>

                          {/* Adelantos del broker */}
                          {isBrokerExpanded && brokerData.advances.map(advance => (
                            <div key={`mobile-${advance.id}`} className="bg-white border-2 border-gray-200 rounded-lg p-3 space-y-2 ml-4">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-700 text-sm">
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
                                    {(advance.total_paid || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                                <Button
                                  size="sm"
                                  onClick={() => setEditingAdvance(advance)}
                                  className="flex-1 bg-[#010139] hover:bg-[#020270] text-white text-xs"
                                >
                                  <FaEdit className="text-xs text-white" /> Editar
                                </Button>
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
                    })
                  ) : isDateExpanded ? (
                    // Vista Broker: Mostrar adelantos directamente (sin nombre de broker)
                    dateGroup.advances.map(advance => (
                      <div key={`mobile-${advance.id}`} className="bg-white border-2 border-gray-200 rounded-lg p-3 space-y-2 ml-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-700 text-sm">
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
                              {(advance.total_paid || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
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
                    ))
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Renderizar tabla de pendientes (status === 'pending')
    return (
      <div className="advances-table-wrapper">
        {/* Tabla para desktop */}
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-b-2 border-gray-200 bg-gray-50">
              {role === 'master' && <TableHead className="w-10 advances-th-expand"></TableHead>}
              <TableHead className="text-gray-700 font-semibold advances-th-broker">{role === 'master' ? 'Corredor / Motivo' : 'Motivo'}</TableHead>
              <TableHead className="text-right text-gray-700 font-semibold advances-th-amount">Monto</TableHead>
              <TableHead className="text-center text-gray-700 font-semibold advances-th-date">Fecha</TableHead>
              <TableHead className="text-center text-gray-700 font-semibold advances-th-actions">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
        {Object.entries(groupedData).map(([bId, brokerData]) => {
          const advancesToShow = brokerData.advances.filter(a => {
            // Recurrentes SIEMPRE en Deudas Activas (sin importar status)
            if (a.is_recurring && a.recurrence_id) {
              return true;
            }
            // No recurrentes: solo pending o partial con monto > 0
            return ((a.status === 'pending' || a.status === 'partial') && a.amount > 0);
          });
          if (advancesToShow.length === 0) return null;

          // Ordenar: recurrentes primero, luego normales
          const sortedAdvances = advancesToShow.sort((a, b) => {
            if (a.is_recurring && !b.is_recurring) return -1;
            if (!a.is_recurring && b.is_recurring) return 1;
            return 0;
          });

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
                    {brokerData.total_pending.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-center text-gray-600">
                    {advancesToShow.length} adelanto{advancesToShow.length !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="hover:bg-[#010139] hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        
                        // Determinar quincena actual (Panamá timezone UTC-5)
                        const now = new Date();
                        const panamaDate = new Date(now.getTime() - (5 * 60 * 60 * 1000));
                        const day = panamaDate.getUTCDate();
                        const currentQuincena = day >= 16 ? 'Q1' : 'Q2';
                        
                        // Filtrar adelantos por quincena
                        const pendingAdv = advancesToShow
                          .filter(a => {
                            // Si no es recurrente, mostrarlo siempre
                            if (!a.is_recurring) return true;
                            
                            // Si es recurrente, verificar que coincida con la quincena actual
                            const reason = a.reason || '';
                            
                            // Si es Q1 y Q2 (ambas quincenas), siempre mostrar
                            if (reason.includes('Q1 y Q2')) return true;
                            
                            // Si es solo una quincena, verificar que coincida
                            if (currentQuincena === 'Q1') {
                              return reason.includes('Q1');
                            } else {
                              return reason.includes('Q2');
                            }
                          })
                          .map(a => {
                            // Si es Q1 y Q2, usar el ID y monto específico de la quincena actual
                            const quincenaGroup = (a as any).quincenaGroup;
                            if (quincenaGroup && Array.isArray(quincenaGroup)) {
                              const specific = quincenaGroup.find((g: any) => g.quincena === currentQuincena);
                              if (specific) {
                                return { 
                                  id: specific.id, 
                                  amount: specific.amount, 
                                  reason: a.reason 
                                };
                              }
                            }
                            // Adelanto normal o sin grupo
                            return { id: a.id, amount: a.amount, reason: a.reason };
                          });
                        
                        if (pendingAdv.length === 0) {
                          toast.info(`No hay adelantos para descontar en la quincena actual (${currentQuincena})`);
                          return;
                        }
                        
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
                  </TableCell>
                </TableRow>
              )}
              
              {(role === 'broker' || expandedBrokers.has(bId)) && sortedAdvances.map(advance => (
                    <TableRow 
                      key={advance.id} 
                      className="hover:bg-gray-50 transition-colors"
                    >
                      {role === 'master' && <TableCell></TableCell>}
                      <TableCell className={role === 'master' ? 'pl-12 text-gray-600' : 'text-gray-700'}>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span>{advance.reason || 'Sin motivo especificado'}</span>
                            {advance.is_recurring && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
                                🔁 RECURRENTE {
                                  (advance.reason || '').includes('Q1 y Q2') ? 'Q1 y Q2' : 
                                  (advance.reason || '').includes('Q1') ? 'Q1' : 
                                  (advance.reason || '').includes('Q2') ? 'Q2' : ''
                                }
                              </span>
                            )}
                          </div>
                          {advance.payment_details && (
                            <span className="text-xs text-gray-500">
                              📋 {advance.payment_details.client_name} - {advance.payment_details.policy_number}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-700">
                        {advance.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
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
            const advancesToShow = brokerData.advances.filter(a => {
              // Recurrentes SIEMPRE en Deudas Activas (sin importar status)
              if (a.is_recurring && a.recurrence_id) {
                return true;
              }
              // No recurrentes: solo pending o partial con monto > 0
              return ((a.status === 'pending' || a.status === 'partial') && a.amount > 0);
            });
            if (advancesToShow.length === 0) return null;

            // Ordenar: recurrentes primero
            const sortedAdvances = advancesToShow.sort((a, b) => {
              if (a.is_recurring && !b.is_recurring) return -1;
              if (!a.is_recurring && b.is_recurring) return 1;
              return 0;
            });
            
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
                        {brokerData.total_pending.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </span>
                    </div>
                    <div className="text-xs text-white/80 mt-1">
                      {advancesToShow.length} adelanto{advancesToShow.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                )}
                
                {(role === 'broker' || expandedBrokers.has(bId)) && sortedAdvances.map(advance => (
                      <div key={`mobile-${advance.id}`} className="bg-white border-2 border-gray-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-[#010139] text-sm">
                                {advance.reason || 'Sin motivo especificado'}
                              </p>
                              {advance.is_recurring && (
                                <span className="inline-block text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
                                  🔁 RECURRENTE {
                                    (advance.reason || '').includes('Q1 y Q2') ? 'Q1 y Q2' : 
                                    (advance.reason || '').includes('Q1') ? 'Q1' : 
                                    (advance.reason || '').includes('Q2') ? 'Q2' : ''
                                  }
                                </span>
                              )}
                            </div>
                            {advance.payment_details && (
                              <p className="text-xs text-gray-500 mt-1">
                                📋 {advance.payment_details.client_name} - {advance.payment_details.policy_number}
                              </p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="font-bold text-[#8AAA19] font-mono text-base">
                              {advance.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
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
                          {role === 'master' && (
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
                Descuentos
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
