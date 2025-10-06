'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { actionGetAdvances } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FaChevronDown, FaChevronRight, FaMoneyBillWave, FaPlus, FaHistory, FaDollarSign } from 'react-icons/fa';
import { AddAdvanceModal } from './AddAdvanceModal';
import { AdvanceHistoryModal } from './AdvanceHistoryModal';
import { PayAdvanceModal } from './PayAdvanceModal';

// Types
type AdvanceStatus = 'pending' | 'paid';

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
  status: AdvanceStatus;
  created_at: string;
  brokers: { id: string; name: string | null } | null;
}

interface GroupedAdvances {
  [brokerId: string]: {
    broker_name: string;
    total_pending: number;
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
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedAdvanceId, setSelectedAdvanceId] = useState<string | null>(null);
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

  const loadAdvances = useCallback(async () => {
    setLoading(true);
    try {
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
          };
          console.log('[AdvancesTab] Normalized advance:', advance.id, advance.status, advance.amount);
          return advance;
        });
        setAllAdvances(normalized);
      } else {
        console.error('[AdvancesTab] Error loading advances:', result.error);
        toast.error('Error al cargar adelantos', { description: result.error });
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
    const grouped = allAdvances.reduce<GroupedAdvances>((acc, advance) => {
      const bId = advance.brokers?.id || 'unknown';
      if (!acc[bId]) {
        acc[bId] = {
          broker_name: advance.brokers?.name || 'Desconocido',
          total_pending: 0,
          advances: [],
        };
      }
      if (advance.status === 'pending') {
        acc[bId].total_pending += advance.amount;
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
                    {brokerData.total_pending.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-center text-gray-600">
                    {advancesToShow.length} adelantos
                  </TableCell>
                  <TableCell className="text-center">
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
                    {advance.reason || 'Sin motivo especificado'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-700">
                    {advance.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-center text-gray-500 text-sm">
                    {new Date(advance.created_at).toLocaleDateString('es-PA')}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost" 
                      onClick={() => setSelectedAdvanceId(advance.id)}
                      className="hover:bg-[#8AAA19] hover:text-white"
                    >
                      Ver Historial
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </React.Fragment>
          );
        })}
        </TableBody>
        </Table>
        <style jsx global>{`
          .advances-table-wrapper {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          
          /* Responsive para tabla de adelantos */
          @media (max-width: 768px) {
            .advances-th-date,
            .advances-table-wrapper tbody td:nth-child(4) {
              display: none;
            }
          }
          
          @media (max-width: 640px) {
            .advances-th-amount,
            .advances-table-wrapper tbody td:nth-child(3) {
              font-size: 0.875rem;
            }
            .advances-th-actions,
            .advances-table-wrapper tbody td:nth-child(5) {
              min-width: 120px;
            }
          }
          
          @media (max-width: 480px) {
            .advances-table-wrapper {
              font-size: 0.875rem;
            }
            .advances-table-wrapper button {
              font-size: 0.75rem;
              padding: 0.375rem 0.75rem;
            }
          }
        `}</style>
      </div>
    );
  };

  // Calculate totals
  const totals = useMemo(() => {
    const pendingTotal = allAdvances
      .filter(a => a.status === 'pending')
      .reduce((sum, a) => sum + a.amount, 0);
    const paidTotal = allAdvances
      .filter(a => a.status === 'paid')
      .reduce((sum, a) => sum + a.amount, 0);
    return { pendingTotal, paidTotal };
  }, [allAdvances]);

  return (
    <div className="space-y-6">
      <AddAdvanceModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSuccess={loadAdvances} brokers={brokers} />
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
        <Card className="shadow-lg border-l-4 border-l-[#010139]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <FaMoneyBillWave className="text-[#010139]" />
              Total Adelantos Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#010139] font-mono">
              {totals.pendingTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {Object.keys(groupedData).length} corredores con adelantos
            </p>
          </CardContent>
        </Card>
        
        <Card className="shadow-lg border-l-4 border-l-[#8AAA19]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
              <FaDollarSign className="text-[#8AAA19]" />
              Total Adelantos Saldados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#8AAA19] font-mono">
              {totals.paidTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </p>
            <p className="text-xs text-gray-500 mt-1">En el año {year}</p>
          </CardContent>
        </Card>
        
        {role === 'master' && (
          <Card className="shadow-lg border-l-4 border-l-green-500 hover:shadow-xl transition-shadow cursor-pointer"
                onClick={() => setIsAddModalOpen(true)}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600 flex items-center gap-2">
                <FaPlus className="text-green-500" />
                Crear Nuevo Adelanto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-gray-700">Click para agregar</p>
              <p className="text-xs text-gray-500 mt-1">Registrar adelanto a corredor</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Main Table */}
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FaHistory className="text-[#010139] text-lg" />
              <CardTitle className="text-[#010139]">Gestión de Adelantos</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
                <SelectTrigger className="w-24 border-[#010139]/20">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              {role === 'master' && (
                <Button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="bg-[#010139] hover:bg-[#8AAA19] text-white transition-colors"
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
            <TabsList className="grid w-full grid-cols-2 rounded-t-none bg-gray-100">
              <TabsTrigger value="pending" className="data-[state=active]:bg-white data-[state=active]:text-[#010139]">
                Deudas Activas
              </TabsTrigger>
              <TabsTrigger value="paid" className="data-[state=active]:bg-white data-[state=active]:text-[#8AAA19]">
                Deudas Saldadas
              </TabsTrigger>
            </TabsList>
            <div className="p-6">
              <TabsContent value="pending">
                <Card className="shadow-inner">
                  <CardContent className="p-3">
                    {renderTable('pending')}
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="paid">
                <Card className="shadow-inner">
                  <CardContent className="p-3">
                    {renderTable('paid')}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
