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
  FaCalculator,
  FaCalendarAlt,
  FaDollarSign
} from 'react-icons/fa';
import { toast } from 'sonner';
import { 
  actionGetPendingItems, 
  actionGetCurrentBroker
} from '@/app/(app)/commissions/actions';
import { 
  actionCreateAdjustmentReport,
  actionGetAdjustmentReports
} from '@/app/(app)/commissions/adjustment-actions';
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
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  const toggleReport = (reportId: string) => {
    setExpandedReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

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

      // Cargar mis reportes de ajustes pendientes
      const pendingReportsResult = await actionGetAdjustmentReports('pending');
      if (pendingReportsResult.ok) {
        setMyRequests(pendingReportsResult.data || []);
      }

      // Cargar ajustes pagados
      const paidResult = await actionGetAdjustmentReports('paid');
      if (paidResult.ok) {
        setPaidAdjustments(paidResult.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Calcular totales de items seleccionados
  const selectionTotals = useMemo(() => {
    const selected = pendingItems.filter(item => selectedItems.has(item.id));
    const totalRaw = selected.reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);
    const totalBroker = Math.abs(totalRaw) * brokerPercent; // percent_default es DECIMAL (0.82), NO dividir /100

    return {
      count: selected.length,
      totalRaw,
      totalBroker,
      percent: brokerPercent * 100, // Multiplicar por 100 solo para DISPLAY
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
    console.log('[BrokerPendingTab] handleSubmitReport - Iniciando');
    console.log('[BrokerPendingTab] Items seleccionados:', selectedItems.size);
    
    if (selectedItems.size === 0) {
      toast.error('Selecciona al menos un ajuste');
      return;
    }

    setSubmitting(true);
    try {
      const itemIds = Array.from(selectedItems);
      console.log('[BrokerPendingTab] Llamando actionCreateAdjustmentReport con items:', itemIds);
      
      // Usar el nuevo sistema de adjustment_reports
      const result = await actionCreateAdjustmentReport(itemIds, '');
      console.log('[BrokerPendingTab] Resultado:', result);
      
      if (result.ok) {
        toast.success(result.message || 'Reporte enviado exitosamente');
        clearSelection();
        
        // Esperar un momento para que revalidatePath tenga efecto (igual que Master)
        console.log('[BrokerPendingTab] Esperando 500ms para revalidación...');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('[BrokerPendingTab] Recargando datos...');
        await loadData();
        console.log('[BrokerPendingTab] Datos recargados exitosamente');
      } else {
        console.error('[BrokerPendingTab] Error en resultado:', result.error);
        toast.error(result.error || 'Error al enviar reporte');
      }
    } catch (error) {
      console.error('[BrokerPendingTab] Error submitting report:', error);
      toast.error('Error al enviar reporte');
    } finally {
      console.log('[BrokerPendingTab] Finalizando - setSubmitting(false)');
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
                          {formatMoney(Math.abs(selectionTotals.totalRaw))}
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
                      className="bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white hover:from-[#7a9617] hover:to-[#6b8514] border-0 shadow-md font-semibold"
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
                          const rawAmount = Number(item.gross_amount) || 0;
                          // Usar net_amount si está disponible, sino calcular con porcentaje
                          const brokerAmount = item.net_amount 
                            ? Math.abs(Number(item.net_amount) || 0)
                            : Math.abs(rawAmount) * brokerPercent; // percent_default es DECIMAL, NO dividir /100

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
                                {formatMoney(Math.abs(rawAmount))}
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
                    No hay reportes pendientes
                  </h3>
                  <p className="text-sm text-gray-500">Tus reportes de ajustes aparecerán aquí</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myRequests.map((report: any) => {
                    const items = report.adjustment_report_items || [];
                    const isExpanded = expandedReports.has(report.id);
                    const itemCount = items.length;
                    
                    return (
                      <Card key={report.id} className="border-2 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          {/* Header - Siempre visible */}
                          <div 
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => toggleReport(report.id)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-base font-bold text-[#010139]">
                                  Reporte de Ajustes
                                </h3>
                                {report.status === 'pending' && (
                                  <Badge className="bg-amber-500 text-white">
                                    <FaClock className="mr-1" size={10} /> Esperando Revisión
                                  </Badge>
                                )}
                                {report.status === 'approved' && (
                                  <Badge className="bg-green-600 text-white">
                                    <FaCheckCircle className="mr-1" size={10} /> Aprobado
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <FaCalendarAlt className="text-gray-400" size={12} />
                                  Enviado: {new Date(report.created_at).toLocaleDateString('es-PA', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                <span className="flex items-center gap-1">
                                  <FaInfoCircle className="text-gray-400" size={12} />
                                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                </span>
                                <span className="flex items-center gap-1 font-semibold text-[#010139]">
                                  <FaDollarSign className="text-green-600" size={12} />
                                  {formatMoney(Math.abs(report.total_amount || 0))}
                                </span>
                              </div>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </Button>
                          </div>

                          {/* Detalles expandibles */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Detalle de Items:</h4>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50">
                                      <TableHead>Póliza</TableHead>
                                      <TableHead>Asegurado</TableHead>
                                      <TableHead>Aseguradora</TableHead>
                                      <TableHead className="text-right">Comisión Bruta</TableHead>
                                      <TableHead className="text-right">Tu Comisión</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {items.map((item: any) => {
                                      const pending = item.pending_items;
                                      return (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">
                                            {pending?.policy_number || '—'}
                                          </TableCell>
                                          <TableCell>{pending?.insured_name || '—'}</TableCell>
                                          <TableCell>{pending?.insurers?.name || '—'}</TableCell>
                                          <TableCell className="text-right font-mono">
                                            {formatMoney(Math.abs(item.commission_raw || 0))}
                                          </TableCell>
                                          <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                                            {formatMoney(Math.abs(item.broker_commission || 0))}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
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
                <div className="space-y-4">
                  {paidAdjustments.map((report: any) => {
                    const items = report.adjustment_report_items || [];
                    const isExpanded = expandedReports.has(report.id);
                    const itemCount = items.length;
                    
                    return (
                      <Card key={report.id} className="border-2 border-green-200 hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          {/* Header - Siempre visible */}
                          <div 
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => toggleReport(report.id)}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-base font-bold text-[#010139]">
                                  Reporte de Ajustes
                                </h3>
                                <Badge className="bg-green-600 text-white">
                                  <FaCheckCircle className="mr-1" size={10} /> Pagado
                                </Badge>
                              </div>
                              
                              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                <span className="flex items-center gap-1">
                                  <FaCalendarAlt className="text-gray-400" size={12} />
                                  Enviado: {new Date(report.created_at).toLocaleDateString('es-PA', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })}
                                </span>
                                {report.paid_date && (
                                  <span className="flex items-center gap-1 font-semibold text-green-700">
                                    <FaCheckCircle className="text-green-600" size={12} />
                                    Pagado: {new Date(report.paid_date).toLocaleDateString('es-PA', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <FaInfoCircle className="text-gray-400" size={12} />
                                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                </span>
                                <span className="flex items-center gap-1 font-bold text-[#8AAA19] text-lg">
                                  <FaDollarSign className="text-green-600" size={14} />
                                  {formatMoney(Math.abs(report.total_amount || 0))}
                                </span>
                              </div>
                            </div>
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-2"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </Button>
                          </div>

                          {/* Detalles expandibles */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Detalle de Items:</h4>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow className="bg-gray-50">
                                      <TableHead>Póliza</TableHead>
                                      <TableHead>Asegurado</TableHead>
                                      <TableHead>Aseguradora</TableHead>
                                      <TableHead className="text-right">Comisión Bruta</TableHead>
                                      <TableHead className="text-right">Tu Comisión</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {items.map((item: any) => {
                                      const pending = item.pending_items;
                                      return (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-medium">
                                            {pending?.policy_number || '—'}
                                          </TableCell>
                                          <TableCell>{pending?.insured_name || '—'}</TableCell>
                                          <TableCell>{pending?.insurers?.name || '—'}</TableCell>
                                          <TableCell className="text-right font-mono">
                                            {formatMoney(Math.abs(item.commission_raw || 0))}
                                          </TableCell>
                                          <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                                            {formatMoney(Math.abs(item.broker_commission || 0))}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
