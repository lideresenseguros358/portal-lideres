'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  actionGetPendingItems,
  actionClaimPendingItem,
  actionMarkPendingAsPayNow,
  actionMarkPendingAsNextFortnight,
} from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { FaChevronDown, FaChevronRight, FaCalendarAlt, FaExclamationTriangle, FaFileDownload, FaHistory, FaHandHoldingUsd } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssignBrokerDropdown } from './AssignBrokerDropdown';
import { RetainedTab } from './RetainedTab';
import { MasterClaimsView } from './MasterClaimsView';
// Tabs removed - using button pattern instead
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Props {
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string }[];
  isShortcut?: boolean;
  onActionSuccess?: () => void;
  onPendingCountChange?: (count: number) => void;
}

// Group items by policy_number
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
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOldItemsWarning, setShowOldItemsWarning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadPendingItems = useCallback(async () => {
    setLoading(true);
    const result = await actionGetPendingItems();

    if (result.ok) {
      const grouped: PendingGroup[] = (result.data || []).reduce((acc: PendingGroup[], item: any) => {
        const policyNumber = item.policy_number || 'SIN_POLIZA';
        let group = acc.find(g => g.policy_number === policyNumber);

        if (!group) {
          group = {
            policy_number: policyNumber,
            client_name: item.client_name || item.insured_name || null,
            insurer_names: item.insurers?.name ? [item.insurers.name] : [],
            total_amount: 0,
            oldest_date: item.created_at,
            status: item.status,
            items: [],
          };
          acc.push(group);
        }

        if (item.insurers?.name && !group.insurer_names.includes(item.insurers.name)) {
          group.insurer_names.push(item.insurers.name);
        }

        group.total_amount += Math.abs(Number(item.gross_amount) || 0);
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

        return acc;
      }, []);

      setPendingGroups(grouped);
      setShowOldItemsWarning(grouped.some(g => {
        const daysDiff = Math.floor((Date.now() - new Date(g.oldest_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 90;
      }));
    } else {
      toast.error('Error al cargar pendientes', { description: result.error });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadPendingItems();
  }, [loadPendingItems]);

  // Update pending count when items change
  useEffect(() => {
    if (onPendingCountChange && !isShortcut && role === 'master') {
      onPendingCountChange(pendingGroups.length);
    }
  }, [pendingGroups, onPendingCountChange, isShortcut, role]);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando pendientes...</div>;
  }
  
  // Check for items older than 90 days
  const oldItems = pendingGroups.filter(group => {
    const daysDiff = Math.floor((Date.now() - new Date(group.oldest_date).getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff >= 90 && group.status === 'open';
  });

  const handleAssignToOffice = async () => {
    if (oldItems.length === 0) return;
    
    // TODO: Implement actual assignment to office
    toast.success(`${oldItems.length} grupos asignados a Oficina automáticamente`);
    
    // Remove old items from pending
    onActionSuccess && onActionSuccess();
    setShowOldItemsWarning(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">Ajustes Pendientes</h2>
          <p className="text-sm sm:text-base text-gray-600">
            Gestiona comisiones sin identificar y solicitudes de brokers
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => loadPendingItems()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all text-sm disabled:opacity-50"
          >
            <FaHistory size={14} />
            {loading ? 'Cargando...' : 'Refrescar'}
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-all text-sm"
          >
            <FaFileDownload size={14} />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Mostrar alerta si hay items > 90 días */}
      {showOldItemsWarning && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-2xl p-4 sm:p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <div className="p-2 bg-orange-500 rounded-lg">
                <FaExclamationTriangle className="text-white" size={20} />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#010139] text-lg">Pendientes Antiguos Detectados</p>
              <p className="text-gray-700 mt-1">
                Hay <span className="font-semibold text-orange-600">{oldItems.length} grupos</span> con items mayores a 90 días.
                Considera reasignarlos a la oficina o procesarlos pronto.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabla de Ajustes */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Póliza</TableHead>
              <TableHead>Cliente | Aseguradora(s)</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24">
                  No hay items pendientes de asignación.
                </TableCell>
              </TableRow>
            ) : (
              pendingGroups.map((group) => {
                const isExpanded = expandedGroups.has(group.policy_number);
                const hasMultipleItems = group.items.length > 1;

                return (
                  <>
                    <TableRow key={group.policy_number}>
                      <TableCell className="w-12">
                        {hasMultipleItems && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-6 w-6"
                            onClick={() => {
                              const newExpanded = new Set(expandedGroups);
                              if (isExpanded) {
                                newExpanded.delete(group.policy_number);
                              } else {
                                newExpanded.add(group.policy_number);
                              }
                              setExpandedGroups(newExpanded);
                            }}
                          >
                            {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{group.policy_number}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {group.client_name && (
                            <span className="font-semibold text-[#010139]">
                              {group.client_name}
                            </span>
                          )}
                          {group.insurer_names.length > 0 && (
                            <span className="text-sm text-gray-600">
                              {group.insurer_names.join(', ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{group.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                      <TableCell className="text-right">{group.items.length}</TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            group.status === 'open'
                              ? 'bg-amber-100 text-amber-700'
                              : group.status === 'claimed'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {group.status === 'open' ? 'Pendiente' : group.status === 'claimed' ? 'Solicitado' : group.status.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {role === 'master' ? (
                          <div className="flex flex-col gap-2 justify-center">
                            <div className="flex flex-wrap items-center gap-2 justify-center">
                              <AssignBrokerDropdown
                                itemGroup={{
                                  policy_number: group.policy_number,
                                  items: group.items.map(item => ({ id: item.id })),
                                }}
                                brokers={brokers}
                                onSuccess={() => {
                                  loadPendingItems();
                                  onActionSuccess && onActionSuccess();
                                }}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={group.status !== 'open'}
                                onClick={async () => {
                                  const result = await actionMarkPendingAsPayNow({
                                    policy_number: group.policy_number,
                                    item_ids: group.items.map(item => item.id),
                                  });
                                  if (result.ok) {
                                    toast.success('Items marcados como pago inmediato.');
                                    await loadPendingItems();
                                    onActionSuccess && onActionSuccess();
                                  } else {
                                    toast.error('No se pudo marcar como pago ahora.', { description: result.error });
                                  }
                                }}
                              >
                                Pago ahora
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={group.status !== 'open'}
                                onClick={async () => {
                                  const result = await actionMarkPendingAsNextFortnight({
                                    policy_number: group.policy_number,
                                    item_ids: group.items.map(item => item.id),
                                  });
                                  if (result.ok) {
                                    toast.success('Items enviados a próxima quincena.');
                                    await loadPendingItems();
                                    onActionSuccess && onActionSuccess();
                                  } else {
                                    toast.error('No se pudo enviar a próxima quincena.', { description: result.error });
                                  }
                                }}
                              >
                                Próxima quincena
                              </Button>
                            </div>
                            {group.status !== 'open' && (
                              <p className="text-[11px] text-gray-500 text-center">
                                Solo se pueden resolver pendientes con estado `Pendiente`.
                              </p>
                            )}
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              const result = await actionClaimPendingItem(group.items.map((i) => i.id));
                              if (result.ok) {
                                toast.success('Reclamo enviado exitosamente.');
                                await loadPendingItems();
                                onActionSuccess && onActionSuccess();
                              } else {
                                toast.error('Error al enviar reclamo.', { description: result.error });
                              }
                            }}
                          >
                            Marcar mío
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasMultipleItems && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gray-50 p-0">
                          <div className="px-4 py-2">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-0">
                                  <TableHead className="text-xs">Item ID</TableHead>
                                  <TableHead className="text-xs">Cliente</TableHead>
                                  <TableHead className="text-xs">Aseguradora</TableHead>
                                  <TableHead className="text-xs text-right">Monto</TableHead>
                                  <TableHead className="text-xs">Fecha</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.items.map((item) => (
                                  <TableRow key={item.id} className="border-0">
                                    <TableCell className="text-xs font-mono py-1">{item.id}</TableCell>
                                    <TableCell className="text-xs py-1">{item.insured_name || 'N/A'}</TableCell>
                                    <TableCell className="text-xs py-1">{item.insurer_name || 'N/A'}</TableCell>
                                    <TableCell className="text-xs py-1 text-right">
                                      {item.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </TableCell>
                                    <TableCell className="text-xs py-1">
                                      {new Date(item.created_at).toLocaleDateString('es-PA')}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
const RequestsView = ({ role, onActionSuccess }: { role: string; onActionSuccess?: () => void }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set());
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());

  useEffect(() => {
    // TODO: Load actual requests from database
    // For now, using demo data
    setRequests([
      {
        id: '1',
        broker_id: 'broker-1',
        broker_name: 'Juan Pérez',
        policy_number: 'POL-12345',
        client_name: 'Cliente ABC',
        amount: 500,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      {
        id: '2',
        broker_id: 'broker-1',
        broker_name: 'Juan Pérez',
        policy_number: 'POL-12346',
        client_name: 'Cliente XYZ',
        amount: 750,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
      {
        id: '3',
        broker_id: 'broker-2',
        broker_name: 'María García',
        policy_number: 'POL-67890',
        client_name: 'Cliente DEF',
        amount: 1200,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ]);
    setLoading(false);
  }, []);

  // Group requests by broker
  const groupedRequests = requests.reduce((acc, request) => {
    const brokerId = request.broker_id || request.broker_name;
    if (!acc[brokerId]) {
      acc[brokerId] = {
        broker_id: request.broker_id,
        broker_name: request.broker_name,
        requests: [],
        total_amount: 0,
        percentage: 0,
      };
    }
    acc[brokerId].requests.push(request);
    acc[brokerId].total_amount += request.amount;
    return acc;
  }, {} as Record<string, any>);

  // Calculate percentages
  const totalAmount = Object.values(groupedRequests).reduce((sum: number, group: any) => sum + group.total_amount, 0);
  Object.values(groupedRequests).forEach((group: any) => {
    group.percentage = totalAmount > 0 ? (group.total_amount / totalAmount) * 100 : 0;
  });

  const toggleBroker = (brokerId: string) => {
    const newSet = new Set(expandedBrokers);
    if (newSet.has(brokerId)) {
      newSet.delete(brokerId);
    } else {
      newSet.add(brokerId);
    }
    setExpandedBrokers(newSet);
  };

  const handleApproveAll = async (brokerId: string, paymentType: 'now' | 'next_fortnight') => {
    const brokerRequests = groupedRequests[brokerId].requests;
    toast.success(`Todas las solicitudes de ${groupedRequests[brokerId].broker_name} aprobadas para pagar ${paymentType === 'now' ? 'ahora' : 'en próxima quincena'}`);
    // Update all requests for this broker
    setRequests(prev => prev.map(r => 
      brokerRequests.find((br: any) => br.id === r.id) ? { ...r, status: 'approved', payment_type: paymentType } : r
    ));
    onActionSuccess?.();
  };

  const handleApprove = async (requestId: string, paymentType: 'now' | 'next_fortnight') => {
    toast.success(`Solicitud aprobada para pagar ${paymentType === 'now' ? 'ahora' : 'en próxima quincena'}`);
    // Update the request status
    setRequests(prev => prev.map(r => 
      r.id === requestId ? { ...r, status: 'approved' } : r
    ));
    onActionSuccess?.();
  };

  const handleReject = async (requestId: string) => {
    toast.info('Solicitud rechazada');
    setRequests(prev => prev.filter(r => r.id !== requestId));
    onActionSuccess?.();
  };

  const handleGenerateCSV = async () => {
    if (selectedRequests.size === 0) {
      toast.error('Seleccione al menos una solicitud aprobada');
      return;
    }
    setIsGeneratingCSV(true);
    try {
      // Generate CSV for selected approved requests
      const selectedData = requests.filter(r => selectedRequests.has(r.id));
      const csvContent = `Corredor,Cliente,Póliza,Monto\n${selectedData.map(r => 
        `${r.broker_name},${r.client_name},${r.policy_number},${r.amount}`
      ).join('\n')}`;
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ajustes_aprobados_${new Date().getTime()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('CSV de ajustes generado exitosamente');
      // Mark as paid
      setRequests(prev => prev.map(r => 
        selectedRequests.has(r.id) ? { ...r, status: 'paid' } : r
      ));
      setSelectedRequests(new Set());
    } catch (err) {
      toast.error('Error al generar CSV');
    } finally {
      setIsGeneratingCSV(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando solicitudes...</div>;
  }

  return (
    <Card className="shadow-inner">
      <CardContent className="p-4">
        {requests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No hay solicitudes "mío" pendientes</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Actions Bar */}
            {Object.values(groupedRequests).some((g: any) => g.requests.some((r: any) => r.status === 'approved')) && (
              <div className="flex justify-end gap-2 p-3 bg-gray-50 rounded-lg">
                <Button
                  onClick={handleGenerateCSV}
                  disabled={isGeneratingCSV || selectedRequests.size === 0}
                  className="bg-[#8AAA19] hover:bg-[#8AAA19]/90 text-white"
                  size="sm"
                >
                  <FaFileDownload className="mr-2" size={12} />
                  {isGeneratingCSV ? 'Generando...' : 'Descargar CSV Ajustes'}
                </Button>
                <Button
                  onClick={() => {
                    // Mark selected as paid
                    setRequests(prev => prev.map(r => 
                      selectedRequests.has(r.id) ? { ...r, status: 'paid' } : r
                    ));
                    setSelectedRequests(new Set());
                    toast.success('Ajustes marcados como pagados');
                  }}
                  disabled={selectedRequests.size === 0}
                  className="bg-green-600 hover:bg-green-700 text-white"
                  size="sm"
                >
                  Marcar como Pagado
                </Button>
              </div>
            )}

            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-gray-200 bg-gray-50">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Corredor</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">%</TableHead>
                  <TableHead className="text-center">Solicitudes</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedRequests).map(([brokerId, group]: [string, any]) => (
                  <>
                    <TableRow 
                      key={brokerId}
                      className="hover:bg-gray-50 cursor-pointer font-semibold"
                      onClick={() => toggleBroker(brokerId)}
                    >
                      <TableCell>
                        {expandedBrokers.has(brokerId) ? 
                          <FaChevronDown className="text-[#010139]" /> : 
                          <FaChevronRight className="text-gray-400" />
                        }
                      </TableCell>
                      <TableCell>{group.broker_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {group.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm text-gray-600">
                          {group.percentage.toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-xs">
                          {group.requests.length}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="relative group">
                            <Button
                              size="sm"
                              variant="outline"
                              className="hover:bg-green-50 hover:text-green-700"
                            >
                              Aceptar Todos
                            </Button>
                            <div className="absolute hidden group-hover:block top-full mt-1 left-0 bg-white border rounded-lg shadow-lg p-1 z-10">
                              <button
                                onClick={() => handleApproveAll(brokerId, 'now')}
                                className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm whitespace-nowrap"
                              >
                                Pagar ahora
                              </button>
                              <button
                                onClick={() => handleApproveAll(brokerId, 'next_fortnight')}
                                className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm whitespace-nowrap"
                              >
                                Próxima quincena
                              </button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedBrokers.has(brokerId) && group.requests.map((request: any) => (
                      <TableRow key={request.id} className="bg-gray-50/50 hover:bg-gray-100/50">
                        <TableCell>
                          {request.status === 'approved' && (
                            <input
                              type="checkbox"
                              checked={selectedRequests.has(request.id)}
                              onChange={(e) => {
                                const newSet = new Set(selectedRequests);
                                if (e.target.checked) {
                                  newSet.add(request.id);
                                } else {
                                  newSet.delete(request.id);
                                }
                                setSelectedRequests(newSet);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          )}
                        </TableCell>
                        <TableCell colSpan={2} className="text-sm">
                          <div>
                            <span className="font-medium">{request.policy_number}</span> - {request.client_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {request.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </TableCell>
                        <TableCell className="text-center">
                          {request.status === 'pending' && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">Pendiente</span>
                          )}
                          {request.status === 'approved' && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Aprobado</span>
                          )}
                          {request.status === 'paid' && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">Pagado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {request.status === 'pending' && (
                            <div className="flex justify-center gap-2">
                              <div className="relative group">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="hover:bg-green-50 hover:text-green-700"
                                >
                                  Aprobar
                                </Button>
                                <div className="absolute hidden group-hover:block top-full mt-1 left-0 bg-white border rounded-lg shadow-lg p-1 z-10">
                                  <button
                                    onClick={() => handleApprove(request.id, 'now')}
                                    className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                                  >
                                    Pagar ahora
                                  </button>
                                  <button
                                    onClick={() => handleApprove(request.id, 'next_fortnight')}
                                    className="block w-full text-left px-3 py-1 hover:bg-gray-100 text-sm"
                                  >
                                    Próxima quincena
                                  </button>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleReject(request.id)}
                                className="hover:bg-red-50 hover:text-red-700"
                              >
                                Rechazar
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Ajustes Pagados View
const PaidAdjustmentsView = () => {
  const [paidAdjustments, setPaidAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load actual paid adjustments from database
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Cargando ajustes pagados...</div>;
  }

  return (
    <Card className="shadow-inner">
      <CardContent className="p-8 text-center">
        <FaHistory className="text-6xl text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No hay ajustes pagados en el historial</p>
      </CardContent>
    </Card>
  );
};

// Main Component
export default function AdjustmentsTab({ role, brokerId, brokers, onActionSuccess, onPendingCountChange, isShortcut }: Props) {
  const [activeTab, setActiveTab] = useState<'pending' | 'requests' | 'paid' | 'retained'>('pending');

  const handleSuccess = () => {
    onActionSuccess?.();
  };

  // Configuración de tabs por rol
  const masterTabs = [
    { key: 'pending' as const, label: 'Sin identificar', icon: FaExclamationTriangle },
    { key: 'requests' as const, label: 'Identificados', icon: FaCalendarAlt },
    { key: 'retained' as const, label: 'Retenidos', icon: FaHandHoldingUsd },
    { key: 'paid' as const, label: 'Pagados', icon: FaHistory },
  ];

  const brokerTabs = [
    { key: 'pending' as const, label: 'Sin identificar', icon: FaExclamationTriangle },
    { key: 'requests' as const, label: 'Ajustes Reportados', icon: FaCalendarAlt },
    { key: 'paid' as const, label: 'Pagados', icon: FaHistory },
  ];

  const tabs = role === 'master' ? masterTabs : brokerTabs;

  return (
    <Card className="shadow-lg">
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
        <CardTitle className="text-[#010139] flex items-center gap-2">
          <FaHistory />
          Ajustes de Comisión
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Tabs con patrón de Pendientes */}
        <div className="border-b-2 border-gray-200 px-4 sm:px-6">
          <div className="flex gap-2 sm:gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    px-4 py-2 rounded-t-lg font-semibold whitespace-nowrap transition-all flex items-center gap-2
                    ${activeTab === tab.key 
                      ? 'bg-[#010139] text-white border-b-4 border-[#8AAA19]' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }
                  `}
                >
                  <Icon className="text-sm" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-6 space-y-6">
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
            <MasterClaimsView />
          )}
          {activeTab === 'retained' && role === 'master' && (
            <RetainedTab />
          )}
          {activeTab === 'paid' && (
            <PaidAdjustmentsView />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
