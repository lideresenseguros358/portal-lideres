'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  FaClipboardList, 
  FaCheckCircle, 
  FaClock, 
  FaTimesCircle, 
  FaPaperPlane, 
  FaTrash, 
  FaInfoCircle,
  FaCalculator 
} from 'react-icons/fa';
import { toast } from 'sonner';
import { 
  actionGetPendingItems, 
  actionSubmitClaimsReport,
  actionGetClaimsReports,
  actionGetCurrentBroker
} from '@/app/(app)/commissions/actions';
import { 
  calculateBrokerCommission, 
  formatCurrency as formatMoney, 
  formatPercent 
} from '@/lib/commissions/adjustments-utils';

interface Props {
  brokerId: string;
}

export default function BrokerPendingTab({ brokerId }: Props) {
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [paidAdjustments, setPaidAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [brokerPercent, setBrokerPercent] = useState(0);

  // Cargar datos
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Obtener datos del broker (incluye porcentaje)
      const brokerResult = await actionGetCurrentBroker();
      if (brokerResult.ok && brokerResult.data) {
        setBrokerPercent(brokerResult.data.percent_default || 0);
      }

      // Cargar pendientes sin identificar
      const pendingResult = await actionGetPendingItems();
      if (pendingResult.ok) {
        setPendingItems(pendingResult.data || []);
      }

      // Cargar mis reportes/solicitudes
      const claimsResult = await actionGetClaimsReports('pending');
      if (claimsResult.ok) {
        const myClaims = (claimsResult.data || []).filter((c: any) => c.broker_id === brokerId);
        setMyRequests(myClaims);
      }

      // Cargar ajustes pagados
      const paidResult = await actionGetClaimsReports('paid');
      if (paidResult.ok) {
        const myPaid = (paidResult.data || []).filter((c: any) => c.broker_id === brokerId);
        setPaidAdjustments(myPaid);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  }, [brokerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calcular totales de items seleccionados
  const selectionTotals = useMemo(() => {
    const selected = pendingItems.filter(item => selectedItems.has(item.id));
    const totalRaw = selected.reduce((sum, item) => sum + Math.abs(item.gross_amount), 0);
    const totalBroker = totalRaw * (brokerPercent / 100);

    return {
      count: selected.length,
      totalRaw,
      totalBroker,
      percent: brokerPercent,
    };
  }, [selectedItems, pendingItems, brokerPercent]);

  // Toggle selección de item
  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Seleccionar/Deseleccionar todos
  const toggleAll = () => {
    if (selectedItems.size === pendingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map(i => i.id)));
    }
  };

  // Limpiar selección
  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  // Enviar reporte
  const handleSubmitReport = async () => {
    if (selectedItems.size === 0) {
      toast.error('Selecciona al menos un ajuste');
      return;
    }

    setSubmitting(true);
    try {
      const itemIds = Array.from(selectedItems);
      const result = await actionSubmitClaimsReport(itemIds);
      
      if (result.ok) {
        toast.success(result.message || 'Reporte enviado exitosamente');
        clearSelection();
        await loadData();
      } else {
        toast.error(result.error || 'Error al enviar reporte');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Error al enviar reporte');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card - Mejorado */}
      <Card className="shadow-xl border-t-4 border-t-[#8AAA19] overflow-hidden">
        <CardContent className="p-6 sm:p-8 bg-gradient-to-br from-[#010139] via-[#020270] to-[#010139] relative">
          {/* Background pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-[#8AAA19]/20 to-transparent" />
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl shadow-lg">
              <FaClipboardList className="text-white text-2xl" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">AJUSTES Y PENDIENTES</h2>
              <p className="text-sm text-white/80">
                Gestiona tus solicitudes de ajustes y revisa pendientes sin identificar
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs con estilo mejorado */}
      <Tabs defaultValue="pending" className="w-full">
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-3 shadow-sm">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-3 bg-transparent">
            <TabsTrigger 
              value="pending" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#010139] data-[state=active]:via-[#020270] data-[state=active]:to-[#010139] data-[state=active]:text-white data-[state=active]:shadow-lg bg-white rounded-xl py-3 transition-all duration-300 hover:shadow-md"
            >
              <FaClipboardList className="text-sm" />
              <span className="font-semibold">Sin Identificar</span>
              {pendingItems.length > 0 && (
                <Badge className="ml-1 bg-orange-500 text-white">{pendingItems.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="requests" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#010139] data-[state=active]:via-[#020270] data-[state=active]:to-[#010139] data-[state=active]:text-white data-[state=active]:shadow-lg bg-white rounded-xl py-3 transition-all duration-300 hover:shadow-md"
            >
              <FaClock className="text-sm" />
              <span className="font-semibold">Mis Solicitudes</span>
              {myRequests.length > 0 && (
                <Badge className="ml-1 bg-blue-500 text-white">{myRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="paid" 
              className="flex items-center justify-center gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#010139] data-[state=active]:via-[#020270] data-[state=active]:to-[#010139] data-[state=active]:text-white data-[state=active]:shadow-lg bg-white rounded-xl py-3 transition-all duration-300 hover:shadow-md"
            >
              <FaCheckCircle className="text-sm" />
              <span className="font-semibold">Pagados</span>
              {paidAdjustments.length > 0 && (
                <Badge className="ml-1 bg-green-500 text-white">{paidAdjustments.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        
        {/* TAB 1: PENDIENTES SIN IDENTIFICAR */}
        <TabsContent value="pending" className="mt-6 space-y-4">
          {/* Panel de Selección */}
          {selectedItems.size > 0 && (
            <Card className="shadow-lg border-2 border-[#8AAA19] bg-gradient-to-r from-green-50 to-white">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FaCalculator className="text-[#8AAA19]" />
                      <h3 className="font-bold text-[#010139]">Items Seleccionados: {selectionTotals.count}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-600">Monto Crudo</p>
                        <p className="font-mono font-semibold text-gray-700">
                          {formatMoney(selectionTotals.totalRaw)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tu Porcentaje</p>
                        <p className="font-mono font-semibold text-[#010139]">
                          {formatPercent(selectionTotals.percent)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Monto Bruto (Tu Comisión)</p>
                        <p className="font-mono font-bold text-[#8AAA19] text-lg">
                          {formatMoney(selectionTotals.totalBroker)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={clearSelection}
                      variant="outline"
                      size="sm"
                      className="border-red-500 text-red-600 hover:bg-red-50"
                    >
                      <FaTrash className="mr-2" size={12} />
                      Limpiar
                    </Button>
                    <Button
                      onClick={handleSubmitReport}
                      disabled={submitting}
                      className="bg-[#010139] hover:bg-[#8AAA19] text-white"
                      size="sm"
                    >
                      <FaPaperPlane className="mr-2" size={12} />
                      {submitting ? 'Enviando...' : 'Enviar Reporte'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabla de Pendientes */}
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {pendingItems.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaClipboardList className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay pendientes sin identificar
                  </h3>
                  <p className="text-sm text-gray-500">Los ajustes pendientes aparecerán aquí</p>
                </div>
              ) : (
                <>
                  {/* Info Banner */}
                  <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <FaInfoCircle className="text-amber-600 mt-1 flex-shrink-0" />
                      <div className="text-xs text-amber-900">
                        <p className="font-semibold mb-1">Cómo funciona:</p>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Selecciona los ajustes que consideras tuyos</li>
                          <li>Verás el cálculo automático con tu porcentaje de comisión</li>
                          <li>Click "Enviar Reporte" para que Master los revise</li>
                          <li>Aparecerán en "Mis Solicitudes" mientras Master los aprueba/rechaza</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="w-12">
                            <Checkbox
                              checked={selectedItems.size === pendingItems.length && pendingItems.length > 0}
                              onCheckedChange={toggleAll}
                            />
                          </TableHead>
                          <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                          <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                          <TableHead className="text-right font-semibold text-gray-700">Monto Crudo</TableHead>
                          <TableHead className="text-right font-semibold text-gray-700">Tu Comisión</TableHead>
                          <TableHead className="font-semibold text-gray-700">Fecha</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingItems.map((item) => {
                          const isSelected = selectedItems.has(item.id);
                          const rawAmount = Math.abs(item.gross_amount);
                          const brokerAmount = rawAmount * (brokerPercent / 100);

                          return (
                            <TableRow 
                              key={item.id} 
                              className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-green-50' : ''}`}
                              onClick={() => toggleItem(item.id)}
                            >
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleItem(item.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium text-gray-700">{item.policy_number}</TableCell>
                              <TableCell className="text-gray-600">{item.insured_name}</TableCell>
                              <TableCell className="text-right font-mono text-gray-600">
                                {formatMoney(rawAmount)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                                {isSelected ? formatMoney(brokerAmount) : '—'}
                              </TableCell>
                              <TableCell className="text-gray-600 text-sm">
                                {new Date(item.created_at).toLocaleDateString('es-PA')}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 2: MIS SOLICITUDES */}
        <TabsContent value="requests" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {/* Info Banner */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <FaClock className="text-blue-600 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      Ajustes Reportados - Solo Lectura
                    </p>
                    <p className="text-xs text-blue-800">
                      Estos son los ajustes que marcaste como "mío" desde pendientes sin identificar. 
                      Master revisará y aprobará o rechazará cada solicitud. Una vez aprobados y confirmados como pagados, 
                      aparecerán en la pestaña "Ajustes Pagados".
                    </p>
                  </div>
                </div>
              </div>
              
              {myRequests.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaClock className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay solicitudes pendientes
                  </h3>
                  <p className="text-sm text-gray-500">Tus solicitudes de ajustes aparecerán aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                        <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto</TableHead>
                        <TableHead className="font-semibold text-gray-700">Estado</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myRequests.map((claim: any) => {
                        const item = claim.comm_items;
                        return (
                          <TableRow key={claim.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="font-medium text-gray-700">
                              {item?.policy_number || '—'}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {item?.insured_name || '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#010139] font-semibold">
                              {item ? formatMoney(Math.abs(item.gross_amount)) : '—'}
                            </TableCell>
                            <TableCell>
                              {claim.status === 'pending' && (
                                <Badge variant="warning">
                                  <FaClock className="mr-1" size={10} /> Esperando Revisión
                                </Badge>
                              )}
                              {claim.status === 'approved' && (
                                <Badge variant="success">
                                  <FaCheckCircle className="mr-1" size={10} /> Aprobado
                                </Badge>
                              )}
                              {claim.status === 'rejected' && (
                                <Badge variant="danger">
                                  <FaTimesCircle className="mr-1" size={10} /> Rechazado
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {new Date(claim.created_at).toLocaleDateString('es-PA')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* TAB 3: AJUSTES PAGADOS */}
        <TabsContent value="paid" className="mt-6">
          <Card className="shadow-lg border-2 border-gray-100">
            <CardContent className="p-4 sm:p-6">
              {paidAdjustments.length === 0 ? (
                <div className="text-center py-12 sm:py-20">
                  <FaCheckCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
                    No hay ajustes pagados
                  </h3>
                  <p className="text-sm text-gray-500">Tu historial de ajustes pagados aparecerá aquí</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-gray-700">Póliza</TableHead>
                        <TableHead className="font-semibold text-gray-700">Cliente</TableHead>
                        <TableHead className="text-right font-semibold text-gray-700">Monto</TableHead>
                        <TableHead className="font-semibold text-gray-700">Fecha Pagado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paidAdjustments.map((claim: any) => {
                        const item = claim.comm_items;
                        return (
                          <TableRow key={claim.id} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="font-medium text-gray-700">
                              {item?.policy_number || '—'}
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {item?.insured_name || '—'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#8AAA19] font-bold text-lg">
                              {item ? formatMoney(Math.abs(item.gross_amount)) : '—'}
                            </TableCell>
                            <TableCell className="text-gray-600 text-sm">
                              {claim.paid_date ? new Date(claim.paid_date).toLocaleDateString('es-PA') : '—'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
