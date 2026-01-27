'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  actionGetPendingItems,
  actionAutoAssignOldPendingItems,
} from '@/app/(app)/commissions/actions';
import { actionCreateAdjustmentReport } from '@/app/(app)/commissions/adjustment-actions';
import { toast } from 'sonner';
import {
  FaChevronDown,
  FaChevronRight,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaHistory,
  FaHandHoldingUsd,
  FaUserCheck,
  FaCheckCircle,
  FaPaperPlane,
  FaClock,
  FaInfoCircle,
  FaDollarSign,
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AssignBrokerDropdown } from './AssignBrokerDropdown';
import RetainedGroupedView from './RetainedGroupedView';
import PaidRetainedView from './PaidRetainedView';
import MasterAdjustmentReportReview from './MasterAdjustmentReportReview';
import ApprovedAdjustmentsView from './ApprovedAdjustmentsView';
import PaidAdjustmentsView from './PaidAdjustmentsView';
import { actionGetAdjustmentReports, actionApproveAdjustmentReport, actionRejectAdjustmentReport, actionEditAdjustmentReport } from '@/app/(app)/commissions/adjustment-actions';

interface Props {
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string }[];
  isShortcut?: boolean;
  onActionSuccess?: () => void;
  onPendingCountChange?: (count: number) => void;
}

// Componente para vista de reportes pagados de Broker
function BrokerPaidReportsList({ reports }: { reports: any[] }) {
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

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 sm:py-20">
        <FaCheckCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
          No hay ajustes pagados
        </h3>
        <p className="text-sm text-gray-500">Tu historial de ajustes pagados aparecerá aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report: any) => {
        const items = report.items || [];
        const isExpanded = expandedReports.has(report.id);
        const itemCount = items.length;
        
        return (
          <Card key={report.id} className="border-2 border-green-200 hover:shadow-md transition-shadow">
            <CardContent className="p-4">
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
                
                <Button variant="ghost" size="sm" className="ml-2">
                  {isExpanded ? '▼' : '▶'}
                </Button>
              </div>

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
                        {items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.policy_number || '—'}</TableCell>
                            <TableCell>{item.insured_name || '—'}</TableCell>
                            <TableCell>{item.insurer_name || '—'}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(Math.abs(item.commission_raw || 0))}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                              {formatMoney(Math.abs(item.broker_commission || 0))}
                            </TableCell>
                          </TableRow>
                        ))}
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
  );
}

// Componente para vista de reportes de Broker (solo lectura)
function BrokerReportsList({ reports }: { reports: any[] }) {
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

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (reports.length === 0) {
    return (
      <div className="text-center py-12 sm:py-20">
        <FaClock className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
          No hay reportes pendientes
        </h3>
        <p className="text-sm text-gray-500">Tus reportes de ajustes aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report: any) => {
        const items = report.items || [];
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
                        {items.map((item: any) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.policy_number || '—'}
                            </TableCell>
                            <TableCell>{item.insured_name || '—'}</TableCell>
                            <TableCell>{item.insurer_name || '—'}</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatMoney(Math.abs(item.commission_raw || 0))}
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                              {formatMoney(Math.abs(item.broker_commission || 0))}
                            </TableCell>
                          </TableRow>
                        ))}
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
  );
}

type PendingItemDetail = {
  id: string;
  insured_name: string | null;
  gross_amount: number;
  created_at: string;
  status: string;
  insurer_name: string | null;
};

type PendingGroup = {
  policy_number: string;
  client_name: string | null;
  insurer_names: string[];
  total_amount: number;
  oldest_date: string;
  status: string;
  items: PendingItemDetail[];
};

const PendingItemsView = ({ role, brokerId, brokers, onActionSuccess, onPendingCountChange, isShortcut }: Props) => {
  const [loading, setLoading] = useState(true);
  const [silentRefreshing, setSilentRefreshing] = useState(false);
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [showOldItemsWarning, setShowOldItemsWarning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Modo selección múltiple
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [brokerPercent, setBrokerPercent] = useState<number>(0);
  const [selectedBrokerName, setSelectedBrokerName] = useState<string>('');

  const loadPendingItems = useCallback(async (silentRefresh = false) => {
    if (silentRefresh) {
      setSilentRefreshing(true);
    } else {
      setLoading(true);
    }
    
    // Cargar porcentaje del broker si es broker
    if (role === 'broker' && brokerId) {
      const { supabaseClient } = await import('@/lib/supabase/client');
      const supabase = supabaseClient();
      const { data: brokerData } = await supabase
        .from('brokers')
        .select('percent_default')
        .eq('id', brokerId)
        .single();
      if (brokerData) {
        setBrokerPercent(brokerData.percent_default || 0);
      }
    }
    
    const result = await actionGetPendingItems();

    if (result.ok) {
      const policyGroups = new Map<string, Map<string, PendingGroup>>();
      
      (result.data || []).forEach((item: any) => {
        const policyNumber = item.policy_number || 'SIN_POLIZA';
        const clientName = item.client_name || item.insured_name || 'Sin Cliente';
        
        if (!policyGroups.has(policyNumber)) {
          policyGroups.set(policyNumber, new Map());
        }
        
        const clientGroups = policyGroups.get(policyNumber)!;
        
        if (!clientGroups.has(clientName)) {
          clientGroups.set(clientName, {
            policy_number: policyNumber,
            client_name: clientName,
            insurer_names: item.insurers?.name ? [item.insurers.name] : [],
            total_amount: 0,
            oldest_date: item.created_at,
            status: item.status,
            items: [],
          });
        }
        
        const group = clientGroups.get(clientName)!;
        
        if (item.insurers?.name && !group.insurer_names.includes(item.insurers.name)) {
          group.insurer_names.push(item.insurers.name);
        }
        
        group.total_amount += (Number(item.gross_amount) || 0);
        group.items.push({
          id: item.id,
          insured_name: item.insured_name || null,
          gross_amount: Number(item.gross_amount) || 0,
          created_at: item.created_at,
          status: item.status,
          insurer_name: item.insurers?.name || null,
        });
        
        if (new Date(item.created_at) < new Date(group.oldest_date)) {
          group.oldest_date = item.created_at;
        }
        
        if (group.status === 'open' && item.status !== 'open') {
          group.status = item.status;
        }
      });
      
      const grouped: PendingGroup[] = [];
      policyGroups.forEach((clientGroups) => {
        clientGroups.forEach((group) => {
          grouped.push(group);
        });
      });
      
      setPendingGroups(grouped);
      setShowOldItemsWarning(grouped.some(g => {
        const daysDiff = Math.floor((Date.now() - new Date(g.oldest_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 90;
      }));
    } else {
      if (!silentRefresh) {
        toast.error('Error al cargar pendientes', { description: result.error });
      }
    }

    if (silentRefresh) {
      setSilentRefreshing(false);
    } else {
      setLoading(false);
    }
  }, [role, brokerId]);

  useEffect(() => {
    loadPendingItems(false); // Carga inicial con spinner
    const interval = setInterval(() => {
      loadPendingItems(true); // Auto-refresh silencioso
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadPendingItems]);

  useEffect(() => {
    if (onPendingCountChange && !isShortcut && role === 'master') {
      onPendingCountChange(pendingGroups.length);
    }
  }, [pendingGroups, onPendingCountChange, isShortcut, role]);

  const handleSubmitReport = async () => {
    console.log('[handleSubmitReport] ===== INICIANDO =====');
    console.log('[handleSubmitReport] Role:', role);
    console.log('[handleSubmitReport] Items seleccionados:', selectedItems.size);
    console.log('[handleSubmitReport] Selected Broker:', selectedBroker);
    console.log('[handleSubmitReport] Broker Name:', selectedBrokerName);
    
    if (selectedItems.size === 0) {
      toast.error('Selecciona al menos un ajuste');
      return;
    }

    // Validación para Master
    if (role === 'master' && !selectedBroker) {
      toast.error('Debe seleccionar un corredor');
      return;
    }

    setSubmitting(true);
    try {
      const itemIds = Array.from(selectedItems);
      console.log('[handleSubmitReport] ItemIds array:', itemIds);
      let result;

      if (role === 'broker') {
        // Broker: Crear reporte de ajustes agrupado
        console.log('[handleSubmitReport] Broker: llamando actionCreateAdjustmentReport...');
        result = await actionCreateAdjustmentReport(itemIds, '');
        console.log('[handleSubmitReport] Resultado Broker:', result);
      } else {
        // Master: Crear reporte de ajustes para el broker seleccionado
        console.log('[handleSubmitReport] Master: llamando actionCreateAdjustmentReport...');
        console.log('[handleSubmitReport] Params: itemIds, notes, targetBrokerId:', itemIds, `Asignado por Master a ${selectedBrokerName}`, selectedBroker);
        result = await actionCreateAdjustmentReport(itemIds, `Asignado por Master a ${selectedBrokerName}`, selectedBroker ?? undefined);
        console.log('[handleSubmitReport] Resultado Master:', result);
      }
      
      console.log('[handleSubmitReport] Result.ok:', result?.ok);
      
      if (result && result.ok) {
        toast.success(
          role === 'broker' 
            ? 'Reporte de ajustes enviado exitosamente' 
            : 'Reporte de ajustes creado exitosamente para ' + selectedBrokerName
        );
        // Limpiar selección
        setSelectionMode(false);
        setSelectedItems(new Set());
        setSelectedBroker(null);
        setSelectedBrokerName('');
        setBrokerPercent(0);
        console.log('[handleSubmitReport] Recargando pending items...');
        // Esperar un momento para que revalidatePath tenga efecto
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadPendingItems();
        onActionSuccess && onActionSuccess();
        console.log('[handleSubmitReport] ===== COMPLETADO EXITOSAMENTE =====');
      } else {
        const errorMsg = result?.error || 'Error desconocido';
        console.error('[handleSubmitReport] Error en resultado:', errorMsg);
        toast.error('Error al crear reporte: ' + errorMsg);
      }
    } catch (error) {
      console.error('[handleSubmitReport] ===== EXCEPCIÓN =====');
      console.error('[handleSubmitReport] Error:', error);
      console.error('[handleSubmitReport] Error stack:', error instanceof Error ? error.stack : 'N/A');
      toast.error('Error al procesar reporte: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      console.log('[handleSubmitReport] Finally block - setSubmitting(false)');
      setSubmitting(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
    setSelectedBroker(null);
    setSelectedBrokerName('');
    setBrokerPercent(0);
  };

  const handleClaimItem = (itemIds: string[]) => {
    console.log('[handleClaimItem] Activando modo selección para items:', itemIds);
    // SOLO activar modo selección - NO actualizar BD aún
    setSelectionMode(true);
    // Pre-seleccionar los items clickeados
    setSelectedItems(new Set(itemIds));
    toast.info('Selecciona más pólizas para incluir en el reporte');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
        <span className="ml-3 text-gray-600">Cargando...</span>
      </div>
    );
  }
  
  const oldItems = pendingGroups.filter(group => {
    const daysDiff = Math.floor((Date.now() - new Date(group.oldest_date).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 90 && group.status === 'open';
  });

  // Calcular total seleccionado
  const selectedTotal = Array.from(selectedItems).reduce((sum, itemId) => {
    const group = pendingGroups.find(g => g.items.some(i => i.id === itemId));
    if (group) {
      const item = group.items.find(i => i.id === itemId);
      return sum + (item?.gross_amount || 0);
    }
    return sum;
  }, 0);

  // percent_default es DECIMAL (0.82 = 82%)
  // Calcular comisión para Broker (con su propio %) o Master (con % del broker seleccionado)
  const selectedBrokerCommission = brokerPercent > 0 
    ? selectedTotal * brokerPercent
    : 0;

  return (
    <div className="space-y-4">
      {/* Barra sticky - Visible en modo selección */}
      {selectionMode && selectedItems.size > 0 && (
        <div className="sticky top-[60px] sm:top-[72px] z-[100] bg-gradient-to-r from-green-50 to-white border-2 border-[#8AAA19] rounded-lg p-3 sm:p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <p className="font-bold text-[#010139]">
              {selectedItems.size} ajuste(s) seleccionado(s)
            </p>
            {role === 'broker' ? (
              <div>
                <p className="text-sm text-gray-600">
                  Total bruto: {selectedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
                {brokerPercent > 0 && (
                  <p className="text-sm font-semibold text-[#8AAA19]">
                    Tu comisión ({(brokerPercent * 100).toFixed(0)}%): {selectedBrokerCommission.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600">
                  Total bruto: {selectedTotal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
                {selectedBroker && brokerPercent > 0 ? (
                  <p className="text-sm font-semibold text-[#8AAA19]">
                    Comisión {selectedBrokerName} ({(brokerPercent * 100).toFixed(0)}%): {selectedBrokerCommission.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-[#010139]">
                    {selectedBroker ? `Asignando a: ${selectedBrokerName}` : 'Seleccionar broker'}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelSelection}
              className="border-red-500 text-red-600 hover:bg-red-50"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitReport}
              disabled={submitting || selectedItems.size === 0 || (role === 'master' && !selectedBroker)}
              className="bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white font-semibold"
            >
              <FaPaperPlane className="mr-2" size={12} />
              {submitting ? 'Enviando...' : (role === 'broker' ? 'Enviar Reporte' : 'Crear Reporte')}
            </Button>
          </div>
        </div>
      </div>
      )}

      {/* Header - Mobile First */}
      <div className="bg-white rounded-lg p-4 border-l-4 border-[#010139] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg sm:text-xl font-semibold text-[#010139]">Comisiones Sin Identificar</h2>
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#010139]"></div>
              )}
              {silentRefreshing && !loading && (
                <div className="animate-pulse flex items-center gap-1 text-xs text-gray-400">
                  <div className="h-2 w-2 rounded-full bg-green-400"></div>
                  <span>Actualizando...</span>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600">
              {pendingGroups.length} {pendingGroups.length === 1 ? 'póliza pendiente' : 'pólizas pendientes'} de asignar
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <FaExclamationTriangle className="text-amber-600 flex-shrink-0" />
            <span className="text-amber-800 font-medium">Montos brutos</span>
          </div>
        </div>
      </div>

      {/* Alerta items antiguos */}
      {showOldItemsWarning && (
        <div className="bg-orange-50 border-l-4 border-orange-500 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-gray-900">Pendientes Antiguos</p>
              <p className="text-sm text-gray-700 mt-1">
                {oldItems.length} póliza{oldItems.length !== 1 ? 's' : ''} con más de 90 días
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Lista de Ajustes - Organizado por Aseguradora */}
      <div className="space-y-6">
        {pendingGroups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FaCheckCircle className="text-5xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No hay comisiones pendientes</p>
            <p className="text-sm text-gray-500 mt-1">Todas las comisiones están asignadas</p>
          </div>
        ) : (() => {
          // Agrupar por aseguradora
          const byInsurer = new Map<string, PendingGroup[]>();
          pendingGroups.forEach(group => {
            // Usar la primera aseguradora del array como clave principal
            const insurerName = group.insurer_names[0] || 'Sin Aseguradora';
            if (!byInsurer.has(insurerName)) {
              byInsurer.set(insurerName, []);
            }
            byInsurer.get(insurerName)!.push(group);
          });

          // Ordenar aseguradoras alfabéticamente
          const sortedInsurers = Array.from(byInsurer.entries()).sort(([a], [b]) => 
            a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' })
          );

          // Ordenar grupos dentro de cada aseguradora por nombre de cliente
          sortedInsurers.forEach(([_, groups]) => {
            groups.sort((a, b) => 
              (a.client_name || '').localeCompare(b.client_name || '', 'es', { numeric: true, sensitivity: 'base' })
            );
          });

          return sortedInsurers.map(([insurerName, groups]) => (
            <div key={insurerName} className="space-y-3">
              {/* Subtítulo de Aseguradora */}
              <h5 className="text-sm font-bold text-amber-700 flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg border-l-4 border-amber-600">
                {insurerName}
              </h5>
              
              {/* Grid de 2 columnas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {groups.map((group) => {
                  const groupKey = `${group.policy_number}-${group.client_name}`;
                  const isExpanded = expandedGroups.has(groupKey);
                  const hasMultipleItems = group.items.length > 1;
                  
                  return (
                    <Card key={groupKey} className="shadow-sm hover:shadow-md transition-all border-2 border-amber-200">
                      <CardContent className="p-3">
                        {/* Main Card Content */}
                        <div className="space-y-2">
                          {/* Header con póliza y checkbox/botón */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              {/* Expand Button */}
                              {hasMultipleItems && (
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedGroups);
                                    if (isExpanded) {
                                      newExpanded.delete(groupKey);
                                    } else {
                                      newExpanded.add(groupKey);
                                    }
                                    setExpandedGroups(newExpanded);
                                  }}
                                  className="flex-shrink-0 mt-0.5 p-1 hover:bg-gray-100 rounded transition-colors"
                                >
                                  {isExpanded ? (
                                    <FaChevronDown className="text-amber-600" size={12} />
                                  ) : (
                                    <FaChevronRight className="text-gray-400" size={12} />
                                  )}
                                </button>
                              )}
                              
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-[#010139] text-sm truncate">
                                    {group.policy_number}
                                  </span>
                                  {hasMultipleItems && (
                                    <Badge className="bg-amber-600 text-white text-xs px-2 py-0.5">
                                      {group.items.length}
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-gray-900 font-medium truncate">
                                  {group.client_name}
                                </p>
                              </div>
                            </div>
                            
                            {/* Checkbox o Botón Marcar Mío */}
                            <div className="flex-shrink-0">
                              {role === 'master' ? (
                                !selectionMode ? (
                                  <AssignBrokerDropdown
                                    itemGroup={{
                                      policy_number: group.policy_number,
                                      items: group.items.map(item => ({ id: item.id })),
                                    }}
                                    brokers={brokers}
                                    onSuccess={() => {}}
                                    onSelectBroker={async (brokerId, brokerName) => {
                                      setSelectedBroker(brokerId);
                                      setSelectedBrokerName(brokerName);
                                      
                                      const { supabaseClient } = await import('@/lib/supabase/client');
                                      const supabase = supabaseClient();
                                      const { data: brokerData } = await supabase
                                        .from('brokers')
                                        .select('percent_default')
                                        .eq('id', brokerId)
                                        .single();
                                      if (brokerData) {
                                        setBrokerPercent(brokerData.percent_default || 0);
                                      }
                                      
                                      setSelectionMode(true);
                                      const itemIds = group.items.map(i => i.id);
                                      setSelectedItems(new Set(itemIds));
                                      toast.info(`Selecciona más pólizas para asignar a ${brokerName}`);
                                    }}
                                  />
                                ) : selectedBroker ? (
                                  <input
                                    type="checkbox"
                                    checked={group.items.every(i => selectedItems.has(i.id))}
                                    onChange={() => {
                                      const itemIds = group.items.map(i => i.id);
                                      setSelectedItems(prev => {
                                        const next = new Set(prev);
                                        const allSelected = itemIds.every(id => next.has(id));
                                        if (allSelected) {
                                          itemIds.forEach(id => next.delete(id));
                                        } else {
                                          itemIds.forEach(id => next.add(id));
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-5 h-5 rounded border-gray-300"
                                  />
                                ) : null
                              ) : (
                                !selectionMode ? (
                                  <Button
                                    size="sm"
                                    disabled={group.status !== 'open'}
                                    className="bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white hover:from-[#7a9617] hover:to-[#6b8514] border-0 shadow-md font-semibold text-xs px-3 py-1.5"
                                    onClick={() => handleClaimItem(group.items.map(i => i.id))}
                                  >
                                    <FaUserCheck className="mr-1" size={12} />
                                    Marcar Mío
                                  </Button>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={group.items.every(i => selectedItems.has(i.id))}
                                    onChange={() => {
                                      const itemIds = group.items.map(i => i.id);
                                      setSelectedItems(prev => {
                                        const next = new Set(prev);
                                        const allSelected = itemIds.every(id => next.has(id));
                                        if (allSelected) {
                                          itemIds.forEach(id => next.delete(id));
                                        } else {
                                          itemIds.forEach(id => next.add(id));
                                        }
                                        return next;
                                      });
                                    }}
                                    className="w-5 h-5 rounded border-gray-300"
                                  />
                                )
                              )}
                            </div>
                          </div>
                          
                          {/* Monto y estado */}
                          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                            <div className="text-lg font-bold text-gray-900">
                              {group.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              group.status === 'open'
                                ? 'bg-amber-100 text-amber-700'
                                : group.status === 'claimed'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {group.status === 'open' ? 'Pendiente' : group.status === 'claimed' ? 'Solicitado' : group.status}
                            </span>
                          </div>
                          
                          {role === 'broker' && brokerPercent > 0 && (
                            <div className="text-xs text-[#8AAA19] font-semibold">
                              Tu comisión: {(group.total_amount * brokerPercent).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                              <span className="text-xs text-gray-600 ml-1">({(brokerPercent * 100).toFixed(0)}%)</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Expanded Details */}
                        {isExpanded && hasMultipleItems && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs font-semibold text-gray-700 mb-2">
                              Detalle de Items ({group.items.length})
                            </p>
                            <div className="space-y-2">
                              {group.items.map((item) => (
                                <div key={item.id} className="bg-gray-50 rounded-lg p-2 text-xs">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{item.insured_name || 'N/A'}</p>
                                      <p className="text-gray-600 text-xs mt-0.5">{item.insurer_name || 'N/A'}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="font-semibold text-gray-900">
                                        {item.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                      </p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {new Date(item.created_at).toLocaleDateString('es-PA')}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
};

// Main Component
export default function AdjustmentsTab({ role, brokerId, brokers, onActionSuccess, onPendingCountChange, isShortcut }: Props) {
  const [activeTab, setActiveTab] = useState<'pending' | 'requests' | 'approved' | 'retained' | 'paid'>('pending');
  const [retainedSubTab, setRetainedSubTab] = useState<'pending' | 'paid'>('pending');
  const [reports, setReports] = useState<any[]>([]);
  const [paidReports, setPaidReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const loadReports = useCallback(async () => {
    if (activeTab !== 'requests') return;
    setLoadingReports(true);
    const result = await actionGetAdjustmentReports('pending');
    if (result.ok) {
      setReports(result.data || []);
    }
    setLoadingReports(false);
  }, [activeTab]);

  const loadPaidReports = useCallback(async () => {
    if (activeTab !== 'paid' || role !== 'broker') return;
    setLoadingReports(true);
    const result = await actionGetAdjustmentReports('paid');
    if (result.ok) {
      setPaidReports(result.data || []);
    }
    setLoadingReports(false);
  }, [activeTab, role]);

  const handleSuccess = () => {
    onActionSuccess?.();
    loadReports();
  };

  const handleApprove = async (reportId: string, adminNotes: string) => {
    const result = await actionApproveAdjustmentReport(reportId, adminNotes);
    if (result.ok) {
      toast.success('Reporte aprobado - Ahora selecciona reportes aprobados para decidir método de pago');
      await loadReports();
      onActionSuccess?.();
    } else {
      toast.error('Error al aprobar', { description: result.error });
    }
  };

  const handleReject = async (reportId: string, reason: string) => {
    const result = await actionRejectAdjustmentReport(reportId, reason);
    if (result.ok) {
      await loadReports();
      onActionSuccess?.();
    }
  };

  const handleEdit = async (reportId: string, itemIds: string[]) => {
    // TODO: implementar edición
    await loadReports();
  };

  useEffect(() => {
    if (activeTab === 'requests') {
      loadReports();
    } else if (activeTab === 'paid' && role === 'broker') {
      loadPaidReports();
    }
  }, [activeTab, role, loadReports, loadPaidReports]);

  const masterTabs = [
    { key: 'pending' as const, label: 'Sin identificar', icon: FaExclamationTriangle },
    { key: 'requests' as const, label: 'Identificados', icon: FaCalendarAlt },
    { key: 'approved' as const, label: 'Aprobados', icon: FaCheckCircle },
    { key: 'retained' as const, label: 'Retenidos', icon: FaHandHoldingUsd },
    { key: 'paid' as const, label: 'Pagados', icon: FaHistory },
  ];

  const brokerTabs = [
    { key: 'pending' as const, label: 'Sin identificar', icon: FaExclamationTriangle },
    { key: 'requests' as const, label: 'Reportados', icon: FaCalendarAlt },
    { key: 'paid' as const, label: 'Pagados', icon: FaHistory },
  ];

  const tabs = role === 'master' ? masterTabs : brokerTabs;

  return (
    <Card className="bg-white shadow-lg">
      <CardHeader className="bg-gradient-to-r from-[#010139] to-[#020270] text-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <FaHistory className="text-white" size={20} />
          </div>
          <CardTitle className="text-white text-xl">Gestión de Ajustes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Tabs */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    px-4 py-2.5 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-2
                    ${isActive
                      ? 'bg-[#010139] text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }
                  `}
                >
                  <Icon className="text-sm" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6">
          {activeTab === 'pending' && (
            <PendingItemsView
              role={role}
              brokerId={brokerId}
              brokers={brokers}
              onActionSuccess={handleSuccess}
              onPendingCountChange={onPendingCountChange}
              isShortcut={isShortcut}
            />
          )}
          {activeTab === 'requests' && (
            loadingReports ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
                <span className="ml-3 text-gray-600">Cargando reportes...</span>
              </div>
            ) : role === 'master' ? (
              <MasterAdjustmentReportReview
                reports={reports}
                onApprove={handleApprove}
                onReject={handleReject}
                onEdit={handleEdit}
                onReload={loadReports}
              />
            ) : (
              // BROKER VIEW - Solo lectura, sin botones ni checkboxes
              <BrokerReportsList reports={reports} />
            )
          )}
          {activeTab === 'approved' && role === 'master' && <ApprovedAdjustmentsView />}
          {activeTab === 'retained' && role === 'master' && (
            <div className="space-y-4">
              {/* Sub-tabs para retenidos */}
              <div className="flex gap-2 border-b border-gray-200 pb-2">
                <button
                  onClick={() => setRetainedSubTab('pending')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    retainedSubTab === 'pending'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <FaHandHoldingUsd className="inline mr-2" size={14} />
                  Retenidos Pendientes
                </button>
                <button
                  onClick={() => setRetainedSubTab('paid')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    retainedSubTab === 'paid'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <FaCheckCircle className="inline mr-2" size={14} />
                  Retenidos Pagados
                </button>
              </div>
              {retainedSubTab === 'pending' ? <RetainedGroupedView /> : <PaidRetainedView />}
            </div>
          )}
          {activeTab === 'paid' && (
            role === 'master' ? (
              <PaidAdjustmentsView />
            ) : (
              // BROKER VIEW - Solo lectura para ajustes pagados
              <BrokerPaidReportsList reports={paidReports} />
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}
