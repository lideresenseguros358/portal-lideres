'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  actionGetPendingItems,
  actionClaimPendingItem,
  actionAutoAssignOldPendingItems,
} from '@/app/(app)/commissions/actions';
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
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AssignBrokerDropdown } from './AssignBrokerDropdown';
import { RetainedTab } from './RetainedTab';
import { MasterClaimsView } from './MasterClaimsView';

interface Props {
  role: string;
  brokerId: string | null;
  brokers: { id: string; name: string }[];
  isShortcut?: boolean;
  onActionSuccess?: () => void;
  onPendingCountChange?: (count: number) => void;
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
  const [pendingGroups, setPendingGroups] = useState<PendingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOldItemsWarning, setShowOldItemsWarning] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Modo selección múltiple
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPendingItems = useCallback(async () => {
    setLoading(true);
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
      toast.error('Error al cargar pendientes', { description: result.error });
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadPendingItems();
    const interval = setInterval(() => {
      loadPendingItems();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadPendingItems]);

  useEffect(() => {
    if (onPendingCountChange && !isShortcut && role === 'master') {
      onPendingCountChange(pendingGroups.length);
    }
  }, [pendingGroups, onPendingCountChange, isShortcut, role]);

  // Auto-assign old items (>90 days) to office
  useEffect(() => {
    const checkAndAutoAssignOldItems = async () => {
      if (role !== 'master' || isShortcut) return;
      
      const oldItemsExist = pendingGroups.some(g => {
        const daysDiff = Math.floor((Date.now() - new Date(g.oldest_date).getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= 90 && g.status === 'open';
      });

      if (oldItemsExist) {
        const result = await actionAutoAssignOldPendingItems();
        if (result.ok && result.data.assigned > 0) {
          toast.success(`${result.data.assigned} comisión(es) antigua(s) asignada(s) automáticamente a Oficina`);
          await loadPendingItems();
          onActionSuccess && onActionSuccess();
        }
      }
    };

    // Run check on mount and when groups change
    const timer = setTimeout(checkAndAutoAssignOldItems, 1000);
    return () => clearTimeout(timer);
  }, [pendingGroups, role, isShortcut, onActionSuccess, loadPendingItems]);

  const handleSubmitReport = async () => {
    if (selectedItems.size === 0) {
      toast.error('Selecciona al menos un ajuste');
      return;
    }

    setSubmitting(true);
    try {
      const itemIds = Array.from(selectedItems);
      const result = await actionClaimPendingItem(itemIds);
      
      if (result.ok) {
        toast.success('Reporte enviado exitosamente');
        setSelectionMode(false);
        setSelectedItems(new Set());
        await loadPendingItems();
        onActionSuccess && onActionSuccess();
      } else {
        toast.error('Error al enviar reporte', { description: result.error });
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Error al enviar reporte');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedItems(new Set());
    setSelectedBroker(null);
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

  return (
    <div className="space-y-4">
      {/* Barra de selección múltiple */}
      {selectionMode && (
        <div className="bg-gradient-to-r from-green-50 to-white border-2 border-[#8AAA19] rounded-lg p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <p className="font-bold text-[#010139]">
                {selectedItems.size} ajuste(s) seleccionado(s)
              </p>
              <p className="text-sm text-gray-600">
                {role === 'broker' ? 'Creando reporte de ajustes' : `Asignando a: ${selectedBroker || 'broker'}`}
              </p>
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
                disabled={submitting || selectedItems.size === 0}
                className="bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white font-semibold"
              >
                <FaPaperPlane className="mr-2" size={12} />
                {submitting ? 'Enviando...' : `Enviar Reporte (${selectedItems.size})`}
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

      {/* Lista de Ajustes - Mobile First */}
      <div className="space-y-3">
        {pendingGroups.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <FaCheckCircle className="text-5xl text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 font-medium">No hay comisiones pendientes</p>
            <p className="text-sm text-gray-500 mt-1">Todas las comisiones están asignadas</p>
          </div>
        ) : (
          pendingGroups.map((group) => {
            const groupKey = `${group.policy_number}-${group.client_name}`;
            const isExpanded = expandedGroups.has(groupKey);
            const hasMultipleItems = group.items.length > 1;
            
            return (
              <Card key={groupKey} className="shadow-sm hover:shadow-md transition-all border border-gray-200">
                <CardContent className="p-4">
                  {/* Main Card Content */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Left Section - Policy Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-3">
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
                            className="flex-shrink-0 mt-1 p-1.5 hover:bg-gray-100 rounded transition-colors"
                          >
                            {isExpanded ? (
                              <FaChevronDown className="text-[#010139]" size={14} />
                            ) : (
                              <FaChevronRight className="text-gray-400" size={14} />
                            )}
                          </button>
                        )}
                        
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-[#010139] text-base">
                              {group.policy_number}
                            </span>
                            {hasMultipleItems && (
                              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                {group.items.length} items
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm text-gray-900 font-medium truncate">
                            {group.client_name}
                          </p>
                          
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {group.insurer_names.map((insurer, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                {insurer}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Right Section - Amount & Actions */}
                    <div className="flex flex-col sm:items-end gap-3">
                      {/* Amount */}
                      <div className="text-left sm:text-right">
                        <div className="text-xl font-bold text-gray-900">
                          {group.total_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
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
                      </div>
                      
                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        {role === 'master' ? (
                          !selectionMode ? (
                            <AssignBrokerDropdown
                              itemGroup={{
                                policy_number: group.policy_number,
                                items: group.items.map(item => ({ id: item.id })),
                              }}
                              brokers={brokers}
                              onSuccess={(brokerId) => {
                                if (brokerId) {
                                  // Activar modo selección para seguir asignando al mismo broker
                                  setSelectionMode(true);
                                  setSelectedBroker(brokerId);
                                  const itemIds = group.items.map(i => i.id);
                                  setSelectedItems(new Set(itemIds));
                                }
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
                              variant="default"
                              size="sm"
                              disabled={group.status !== 'open'}
                              className="bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white hover:from-[#7a9617] hover:to-[#6b8514] border-0 shadow-md font-semibold"
                              onClick={() => {
                                // Activar modo selección
                                setSelectionMode(true);
                                // Seleccionar estos items automáticamente
                                const itemIds = group.items.map(i => i.id);
                                setSelectedItems(new Set(itemIds));
                              }}
                            >
                              <FaUserCheck className="mr-2" size={14} />
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
                  </div>
                  
                  {/* Expanded Details */}
                  {isExpanded && hasMultipleItems && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm font-semibold text-gray-700 mb-3">
                        Detalle de Items ({group.items.length})
                      </p>
                      <div className="space-y-2">
                        {group.items.map((item) => (
                          <div key={item.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{item.insured_name || 'N/A'}</p>
                                <p className="text-gray-600 text-xs mt-1">{item.insurer_name || 'N/A'}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">
                                  {item.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
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
          })
        )}
      </div>
    </div>
  );
};

// Vista de ajustes pagados
const PaidAdjustmentsView = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <FaHistory className="text-5xl text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
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

  const masterTabs = [
    { key: 'pending' as const, label: 'Sin identificar', icon: FaExclamationTriangle },
    { key: 'requests' as const, label: 'Identificados', icon: FaCalendarAlt },
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
          {activeTab === 'requests' && <MasterClaimsView />}
          {activeTab === 'retained' && role === 'master' && <RetainedTab />}
          {activeTab === 'paid' && <PaidAdjustmentsView />}
        </div>
      </CardContent>
    </Card>
  );
}
