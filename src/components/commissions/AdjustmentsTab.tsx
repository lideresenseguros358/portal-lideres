'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { actionGetPendingItems, actionClaimPendingItem } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { FaChevronDown, FaChevronRight, FaCalendarAlt, FaExclamationTriangle, FaFileDownload, FaHistory } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssignBrokerDropdown } from './AssignBrokerDropdown';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
function groupItemsByPolicy(items: any[]): any[] {
  const groups: Record<string, any> = {};
  
  items.forEach((item) => {
    const policyNumber = item.policy_number || 'NO_POLICY';
    if (!groups[policyNumber]) {
      groups[policyNumber] = {
        policy_number: policyNumber,
        items: [],
        total_amount: 0,
        insurers: new Set<string>(),
        clients: new Set<string>(),
        oldest_date: item.created_at,
      };
    }
    
    groups[policyNumber].items.push(item);
    // Use Math.abs to ensure positive commission values
    groups[policyNumber].total_amount += Math.abs(Number(item.gross_amount) || 0);
    
    // Add insurer name
    if (item.insurers?.name) {
      groups[policyNumber].insurers.add(item.insurers.name);
    }
    
    // Add client name
    if (item.insured_name) {
      groups[policyNumber].clients.add(item.insured_name);
    }
    
    // Track oldest date
    if (new Date(item.created_at) < new Date(groups[policyNumber].oldest_date)) {
      groups[policyNumber].oldest_date = item.created_at;
    }
  });
  
  return Object.values(groups);
}

const PendingItemsView = ({ role, brokerId, brokers, onActionSuccess, onPendingCountChange, isShortcut }: Props) => {
  const [pendingGroups, setPendingGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOldItemsWarning, setShowOldItemsWarning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const loadPendingItems = useCallback(async () => {
    setLoading(true);
    const result = await actionGetPendingItems();
    if (result.ok) {
      const grouped = groupItemsByPolicy(result.data || []);
      setPendingGroups(grouped);
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
    return daysDiff >= 90;
  });

  const handleAssignToOffice = async () => {
    if (oldItems.length === 0) return;
    
    // TODO: Implement actual assignment to office
    toast.success(`${oldItems.length} grupos asignados a Oficina automáticamente`);
    
    // Remove old items from pending
    setPendingGroups(prev => prev.filter(g => !oldItems.some(old => old.policy_number === g.policy_number)));
    onActionSuccess && onActionSuccess();
    setShowOldItemsWarning(false);
  };

  return (
    <div className="space-y-4">
      {/* 90-day rule warning */}
      {oldItems.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-amber-600 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                Regla de 90 días
              </p>
              <p className="text-sm text-amber-700">
                Hay {oldItems.length} grupos de pólizas con más de 90 días sin identificar.
                Estos deben ser asignados automáticamente a Oficina.
              </p>
              <Button
                onClick={handleAssignToOffice}
                className="mt-3 bg-amber-600 hover:bg-amber-700 text-white"
                size="sm"
              >
                <FaCalendarAlt className="mr-2" />
                Aplicar Regla 90 Días (Enviar a Oficina)
              </Button>
            </div>
          </div>
        </div>
      )}
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Póliza</TableHead>
              <TableHead>Cliente | Aseguradora(s)</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-center">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  No hay items pendientes de asignación.
                </TableCell>
              </TableRow>
            ) : (
              pendingGroups.map((group: any) => {
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
                          {Array.from(group.clients).length > 0 && (
                            <span className="font-semibold text-[#010139]">
                              {Array.from(group.clients).join(', ')}
                            </span>
                          )}
                          {Array.from(group.insurers).length > 0 && (
                            <span className="text-sm text-gray-600">
                              {Array.from(group.insurers).join(', ')}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{group.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                      <TableCell className="text-right">{group.items.length}</TableCell>
                      <TableCell className="text-center">
                        {role === 'master' ? (
                          <AssignBrokerDropdown 
                            itemGroup={group}
                            brokers={brokers}
                            onSuccess={() => {
                              loadPendingItems();
                              onActionSuccess && onActionSuccess();
                            }}
                          />
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              const result = await actionClaimPendingItem(group.items.map((i: any) => i.id));
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
                        <TableCell colSpan={6} className="bg-gray-50 p-0">
                          <div className="px-4 py-2">
                            <Table>
                              <TableHeader>
                                <TableRow className="border-0">
                                  <TableHead className="text-xs">Cliente</TableHead>
                                  <TableHead className="text-xs text-right">Monto</TableHead>
                                  <TableHead className="text-xs">Fecha</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.items.map((item: any, idx: number) => (
                                  <TableRow key={idx} className="border-0">
                                    <TableCell className="text-sm py-1">{item.insured_name || 'N/A'}</TableCell>
                                    <TableCell className="text-sm py-1 text-right">
                                      {Math.abs(Number(item.gross_amount)).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                    </TableCell>
                                    <TableCell className="text-sm py-1">
                                      {new Date(item.created_at).toLocaleDateString()}
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

// Solicitudes "mío" View
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

export default function AdjustmentsTab({ role, brokerId, brokers, isShortcut, onActionSuccess, onPendingCountChange }: Props) {
  const [_, startTransition] = useTransition();
  const [key, setKey] = useState(0);

  const handleActionSuccess = () => {
    startTransition(() => {
      setKey(prev => prev + 1);
      if (onActionSuccess) onActionSuccess();
    });
  };

  if (isShortcut) {
    return (
      <PendingItemsView 
        key={key} 
        role={role} 
        brokerId={brokerId} 
        brokers={brokers} 
        onActionSuccess={handleActionSuccess}
        onPendingCountChange={onPendingCountChange}
        isShortcut={isShortcut}
      />
    );
  }

  if (role === 'broker') {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139]">Mis Pendientes por Identificar</CardTitle>
          <p className="text-sm text-muted-foreground">Aquí puedes ver los items de comisión que aún no han sido asignados y marcarlos como tuyos.</p>
        </CardHeader>
        <CardContent>
          <PendingItemsView 
            key={key} 
            role={role} 
            brokerId={brokerId} 
            brokers={brokers} 
            onActionSuccess={handleActionSuccess}
            onPendingCountChange={onPendingCountChange}
            isShortcut={isShortcut}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-[#010139]">Ajustes de Comisión</CardTitle>
        <p className="text-sm text-muted-foreground">Aquí puedes ver los ajustes de comisión que te corresponden.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-t-lg rounded-b-none bg-gray-100">
            <TabsTrigger value="pending">Pendientes sin Identificar</TabsTrigger>
            <TabsTrigger value="requests">Solicitudes 'mío'</TabsTrigger>
            <TabsTrigger value="paid">Pagados</TabsTrigger>
          </TabsList>
          <div className="p-6">
            <TabsContent value="pending">
              <PendingItemsView 
                key={key} 
                role={role} 
                brokerId={brokerId} 
                brokers={brokers} 
                onActionSuccess={handleActionSuccess}
                onPendingCountChange={onPendingCountChange}
                isShortcut={isShortcut}
              />
            </TabsContent>
            <TabsContent value="requests">
              <RequestsView role={role} onActionSuccess={handleActionSuccess} />
            </TabsContent>
            <TabsContent value="paid">
              <PaidAdjustmentsView />
            </TabsContent>
          </div>
        </Tabs>
      </CardContent>
    </Card>
  );
}
