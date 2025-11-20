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
      // Agrupar por póliza primero, luego por cliente
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
      });
      
      // Aplanar los grupos anidados manteniendo el orden
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
      toast.error('Error al cargar pendientes', { description: result.error });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadPendingItems();
    
    // Auto-actualizar cada 30 segundos
    const interval = setInterval(() => {
      loadPendingItems();
    }, 30000);
    
    return () => clearInterval(interval);
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
      <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-4 sm:p-6 border-l-4 border-[#010139] shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-[#010139] mb-2">💼 Ajustes Sin Identificar</h2>
            <p className="text-sm sm:text-base text-gray-700 mb-3">
              Comisiones pendientes de asignar a corredor. Se actualizan automáticamente cada 30 segundos.
            </p>
            <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg">
              <p className="text-sm text-amber-800 font-medium">
                ⚠️ <strong>Nota:</strong> Los montos mostrados son valores brutos sin ningún porcentaje de comisión aplicado hasta que se asignen a un corredor.
              </p>
            </div>
          </div>
          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-600 ml-4">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#010139]"></div>
              <span className="hidden sm:inline">Actualizando...</span>
            </div>
          )}
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

      {/* Tabla de Ajustes - Responsive */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100">
                <TableHead className="w-12"></TableHead>
                <TableHead className="font-bold text-[#010139]">N° Póliza</TableHead>
                <TableHead className="font-bold text-[#010139]">Aseguradora</TableHead>
                <TableHead className="font-bold text-[#010139]">Cliente</TableHead>
                <TableHead className="text-right font-bold text-[#010139]">Total Bruto</TableHead>
                <TableHead className="text-center font-bold text-[#010139]">Estado</TableHead>
                <TableHead className="text-center font-bold text-[#010139]">Acciones</TableHead>
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
                const groupKey = `${group.policy_number}-${group.client_name}`;
                const isExpanded = expandedGroups.has(groupKey);
                const hasMultipleItems = group.items.length > 1;

                return (
                  <>
                    <TableRow key={`${group.policy_number}-${group.client_name}`} className="hover:bg-gray-50 transition-colors">
                      <TableCell className="w-12">
                        {hasMultipleItems && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-0 h-6 w-6 hover:bg-[#010139] hover:text-white transition-colors"
                            onClick={() => {
                              const newExpanded = new Set(expandedGroups);
                              if (isExpanded) {
                                newExpanded.delete(groupKey);
                              } else {
                                newExpanded.add(groupKey);
                              }
                              setExpandedGroups(newExpanded);
                            }}
                          >
                            {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-[#010139] whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📝</span>
                          {group.policy_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {group.insurer_names.length > 0 && (
                            <span className="font-semibold text-gray-700">
                              {group.insurer_names.join(', ')}
                            </span>
                          )}
                          {group.items.length > 1 && (
                            <span className="text-xs text-gray-500">{group.items.length} registros</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-[#010139]">
                          {group.client_name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-lg text-gray-900 font-mono">
                            {group.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                          </span>
                          <span className="text-xs text-amber-600 font-medium">Sin % aplicado</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${
                            group.status === 'open'
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : group.status === 'claimed'
                              ? 'bg-blue-100 text-blue-800 border border-blue-300'
                              : 'bg-gray-100 text-gray-700 border border-gray-300'
                          }`}
                        >
                          {group.status === 'open' ? '⏳ Pendiente' : group.status === 'claimed' ? '👤 Solicitado' : group.status.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {role === 'master' ? (
                          <div className="flex flex-col gap-2 items-center">
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
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={group.status !== 'open'}
                                className="text-xs bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
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
                                💵 Ahora
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={group.status !== 'open'}
                                className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-300"
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
                                📅 Próxima
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={group.status !== 'open'}
                            className="bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:from-[#020270] hover:to-[#010139] border-0 shadow-md font-semibold"
                            onClick={async () => {
                              const result = await actionClaimPendingItem(group.items.map((i) => i.id));
                              if (result.ok) {
                                toast.success('Ajuste marcado como tuyo exitosamente.');
                                await loadPendingItems();
                                onActionSuccess && onActionSuccess();
                              } else {
                                toast.error('Error al marcar ajuste.', { description: result.error });
                              }
                            }}
                          >
                            👋 Marcar como Mío
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {isExpanded && hasMultipleItems && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-gradient-to-r from-blue-50 to-gray-50 p-0 border-l-4 border-[#8AAA19]">
                          <div className="px-4 py-3">
                            <div className="mb-2">
                              <h4 className="text-sm font-bold text-[#010139]">📊 Detalle de Items ({group.items.length})</h4>
                            </div>
                            <div className="overflow-x-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-white border-b-2 border-gray-200">
                                    <TableHead className="text-xs font-bold text-[#010139]">Item ID</TableHead>
                                    <TableHead className="text-xs font-bold text-[#010139]">Cliente</TableHead>
                                    <TableHead className="text-xs font-bold text-[#010139]">Aseguradora</TableHead>
                                    <TableHead className="text-xs text-right font-bold text-[#010139]">Monto</TableHead>
                                    <TableHead className="text-xs font-bold text-[#010139]">Fecha</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.items.map((item) => (
                                    <TableRow key={item.id} className="border-0 hover:bg-white/80 transition-colors">
                                      <TableCell className="text-xs font-mono py-2 text-gray-700">{item.id.substring(0, 8)}...</TableCell>
                                      <TableCell className="text-xs py-2 font-medium">{item.insured_name || 'N/A'}</TableCell>
                                      <TableCell className="text-xs py-2">{item.insurer_name || 'N/A'}</TableCell>
                                      <TableCell className="text-xs py-2 text-right font-bold font-mono">
                                        {item.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                      </TableCell>
                                      <TableCell className="text-xs py-2 text-gray-600">
                                        {new Date(item.created_at).toLocaleDateString('es-PA')}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
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
    </div>
  );
};
// Vista de ajustes pagados (historial)
const PaidAdjustmentsView = () => {
  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-green-50 to-white rounded-xl p-4 sm:p-6 border-l-4 border-[#8AAA19] shadow-md">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-[#010139] mb-2">✅ Ajustes Pagados</h2>
            <p className="text-sm sm:text-base text-gray-700">
              Historial de ajustes que ya fueron pagados a los corredores.
            </p>
          </div>
        </div>
      </div>
      
      {/* Empty State */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-12 text-center">
        <div className="mb-4">
          <FaHistory className="text-6xl text-gray-300 mx-auto" />
        </div>
        <h3 className="text-xl font-semibold text-gray-600 mb-2">
          Historial de Ajustes Pagados
        </h3>
        <p className="text-gray-500">
          Esta funcionalidad estará disponible próximamente
        </p>
      </div>
    </div>
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
    <Card className="bg-white shadow-xl">
      <CardHeader className="bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-t-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <FaHistory className="text-white" size={20} />
          </div>
          <CardTitle className="text-white text-xl">Gestión de Ajustes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Tabs simplificados y elegantes */}
        <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 py-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 min-w-fit
                    ${isActive
                      ? 'bg-[#010139] text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className={`text-sm ${isActive ? 'text-white' : 'text-gray-600'}`} />
                  <span className="text-sm">{tab.label}</span>
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
