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
          <h2 className="text-xl sm:text-2xl font-bold text-[#010139]">Ajustes Sin Identificar</h2>
          <p className="text-sm sm:text-base text-gray-600">
            Comisiones pendientes de asignar a corredor. Una vez identificadas, pasan a "Identificados"
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
// Vista de ajustes pagados (historial)
const PaidAdjustmentsView = () => {
  return (
    <div className="p-8 text-center bg-white rounded-lg">
      <FaHistory className="text-6xl text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-600 mb-2">Historial de Ajustes Pagados</h3>
      <p className="text-sm text-gray-500">Esta funcionalidad estará disponible próximamente</p>
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
        {/* Tabs mejorados con diseño moderno */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 sm:px-6 py-3">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`
                    group relative px-5 py-3 rounded-xl font-semibold whitespace-nowrap transition-all duration-300 flex items-center gap-3 min-w-fit
                    ${isActive
                      ? 'bg-gradient-to-br from-[#010139] via-[#020270] to-[#010139] text-white shadow-lg shadow-[#010139]/30 scale-105'
                      : 'bg-white text-gray-700 hover:bg-gradient-to-br hover:from-gray-50 hover:to-white hover:shadow-md border-2 border-gray-200 hover:border-[#8AAA19]/30'
                    }
                  `}
                >
                  {/* Icono con efecto */}
                  <div className={`
                    p-2 rounded-lg transition-all duration-300
                    ${isActive 
                      ? 'bg-white/20 shadow-inner' 
                      : 'bg-gray-100 group-hover:bg-[#8AAA19]/10'
                    }
                  `}>
                    <Icon className={`text-base transition-transform duration-300 ${
                      isActive ? 'text-white' : 'text-gray-600 group-hover:text-[#8AAA19] group-hover:scale-110'
                    }`} />
                  </div>
                  
                  {/* Label */}
                  <span className={`text-sm font-bold ${
                    isActive ? 'text-white' : 'text-gray-700 group-hover:text-[#010139]'
                  }`}>
                    {tab.label}
                  </span>
                  
                  {/* Indicador activo (barra inferior) */}
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-[#8AAA19] to-transparent rounded-t-full shadow-lg shadow-[#8AAA19]/50" />
                  )}
                  
                  {/* Glow effect cuando está activo */}
                  {isActive && (
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#8AAA19]/0 via-[#8AAA19]/10 to-[#8AAA19]/0 animate-pulse" />
                  )}
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
