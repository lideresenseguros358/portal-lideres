'use client';

import { useState, useEffect, useMemo } from 'react';
import { actionGetDraftUnidentified, actionTempIdentifyClient, actionTempUnidentifyClient, actionTempIdentifyMultiple } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FaUser, FaUndo, FaChevronDown, FaChevronRight, FaExclamationTriangle, FaCheckCircle, FaUsers, FaFileAlt, FaTrash } from 'react-icons/fa';

interface DraftUnidentifiedItem {
  id: string;
  policy_number: string;
  insured_name: string;
  commission_raw: number;
  temp_assigned_broker_id: string | null;
  temp_assigned_at: string | null;
  created_at: string;
  insurers: { id: string; name: string } | null;
  brokers: { id: string; name: string } | null;
}

interface Props {
  fortnightId: string;
  brokers: Array<{ id: string; name: string }>;
  onUpdate: () => void;
  recalculationKey?: number; // Para auto-refresh en tiempo real
}

export default function DraftUnidentifiedTable({ fortnightId, brokers, onUpdate, recalculationKey = 0 }: Props) {
  const [items, setItems] = useState<DraftUnidentifiedItem[]>([]);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [assigningItem, setAssigningItem] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [assigningGroup, setAssigningGroup] = useState<string | null>(null);
  const [selectedBrokerGroup, setSelectedBrokerGroup] = useState<Record<string, string>>({});
  const [vidaCheckbox, setVidaCheckbox] = useState<Record<string, boolean>>({});
  const [vidaCheckboxGroup, setVidaCheckboxGroup] = useState<Record<string, boolean>>({});

  const loadItems = async () => {
    if (isInitialLoad) {
      setLoading(true);
    }
    
    const result = await actionGetDraftUnidentified(fortnightId);
    
    if (result.ok && result.data) {
      setItems(result.data);
    } else if (isInitialLoad) {
      toast.error('Error al cargar sin identificar', { description: result.error });
    }
    
    if (isInitialLoad) {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fortnightId, recalculationKey]);

  const handleIdentify = async (itemId: string) => {
    const brokerId = selectedBroker[itemId];
    if (!brokerId) {
      toast.error('Selecciona un corredor');
      return;
    }

    const overridePercent = vidaCheckbox[itemId] ? 1.0 : undefined;
    console.log(`[handleIdentify] Checkbox Vida: ${vidaCheckbox[itemId]}, overridePercent: ${overridePercent}`);
    setProcessing(itemId);
    const result = await actionTempIdentifyClient(itemId, brokerId, overridePercent);
    
    if (result.ok) {
      toast.success('Cliente identificado temporalmente');
      await loadItems();
      onUpdate();
    } else {
      toast.error('Error al identificar', { description: result.error });
    }
    setProcessing(null);
  };

  const handleUnidentify = async (itemId: string) => {
    setProcessing(itemId);
    const result = await actionTempUnidentifyClient(itemId);
    
    if (result.ok) {
      toast.success('Cliente regresado a sin identificar');
      await loadItems();
      onUpdate();
    } else {
      toast.error('Error al desidentificar', { description: result.error });
    }
    setProcessing(null);
  };

  const handleIdentifyGroup = async (groupKey: string, itemIds: string[]) => {
    const brokerId = selectedBrokerGroup[groupKey];
    if (!brokerId) {
      toast.error('Selecciona un corredor para el grupo');
      return;
    }

    const overridePercent = vidaCheckboxGroup[groupKey] ? 1.0 : undefined;
    setProcessing(groupKey);
    const result = await actionTempIdentifyMultiple(itemIds, brokerId, overridePercent);
    
    if (result.ok) {
      toast.success(`✅ ${result.data?.processed || 0} items identificados`, {
        description: `Asignados al corredor seleccionado`
      });
      await loadItems();
      onUpdate();
      setAssigningGroup(null);
    } else {
      toast.error('Error al identificar grupo', { description: result.error });
    }
    setProcessing(null);
  };

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const unidentifiedItems = items.filter(item => !item.temp_assigned_broker_id);
  const identifiedItems = items.filter(item => item.temp_assigned_broker_id);

  // Tipo unificado para items y grupos
  type UnifiedItem = {
    type: 'group' | 'individual';
    key: string;
    displayName: string;
    insurerName: string;
    insurerId: string;
    items: DraftUnidentifiedItem[];
    totalCommission: number;
  };

  // Combinar grupos e items individuales ordenados por aseguradora
  const organizedUnidentified = useMemo(() => {
    // 1. Agrupar por cliente (prioridad) o póliza
    const groupsByClient = new Map<string, DraftUnidentifiedItem[]>();
    const groupsByPolicy = new Map<string, DraftUnidentifiedItem[]>();
    
    // Primero agrupar por cliente
    unidentifiedItems.forEach(item => {
      const clientKey = item.insured_name?.trim().toUpperCase() || 'SIN_NOMBRE';
      if (!groupsByClient.has(clientKey)) {
        groupsByClient.set(clientKey, []);
      }
      groupsByClient.get(clientKey)!.push(item);
    });
    
    // Luego agrupar por póliza solo items que NO se agruparon por cliente
    const processedByClient = new Set<string>();
    groupsByClient.forEach((items, key) => {
      if (items.length > 1) {
        items.forEach(item => processedByClient.add(item.id));
      }
    });
    
    unidentifiedItems.forEach(item => {
      if (!processedByClient.has(item.id)) {
        const policyKey = item.policy_number?.trim().toUpperCase() || 'SIN_POLIZA';
        if (policyKey !== 'SIN_POLIZA') {
          if (!groupsByPolicy.has(policyKey)) {
            groupsByPolicy.set(policyKey, []);
          }
          groupsByPolicy.get(policyKey)!.push(item);
        }
      }
    });

    // 2. Crear lista unificada de items y grupos
    const unified: UnifiedItem[] = [];
    const processedItemIds = new Set<string>();

    // Agregar grupos por cliente (2+ items)
    groupsByClient.forEach((items, key) => {
      if (items.length > 1 && items[0]) {
        items.forEach(item => processedItemIds.add(item.id));
        unified.push({
          type: 'group',
          key: `client_${key}`,
          displayName: items[0].insured_name || 'Sin nombre',
          insurerName: items[0].insurers?.name || 'Sin aseguradora',
          insurerId: items[0].insurers?.id || '',
          items,
          totalCommission: items.reduce((sum, item) => sum + item.commission_raw, 0)
        });
      }
    });
    
    // Agregar grupos por póliza (2+ items)
    groupsByPolicy.forEach((items, key) => {
      if (items.length > 1 && items[0]) {
        items.forEach(item => processedItemIds.add(item.id));
        unified.push({
          type: 'group',
          key: `policy_${key}`,
          displayName: items[0].insured_name || 'Sin nombre',
          insurerName: items[0].insurers?.name || 'Sin aseguradora',
          insurerId: items[0].insurers?.id || '',
          items,
          totalCommission: items.reduce((sum, item) => sum + item.commission_raw, 0)
        });
      }
    });

    // Agregar individuales (no agrupados)
    unidentifiedItems.forEach(item => {
      if (!processedItemIds.has(item.id)) {
        unified.push({
          type: 'individual',
          key: item.id,
          displayName: item.insured_name || 'Sin nombre',
          insurerName: item.insurers?.name || 'Sin aseguradora',
          insurerId: item.insurers?.id || '',
          items: [item],
          totalCommission: item.commission_raw
        });
      }
    });

    // 3. Agrupar por aseguradora y ordenar alfabéticamente
    const byInsurer = new Map<string, UnifiedItem[]>();
    unified.forEach(item => {
      const insurerKey = `${item.insurerId}|${item.insurerName}`;
      if (!byInsurer.has(insurerKey)) {
        byInsurer.set(insurerKey, []);
      }
      byInsurer.get(insurerKey)!.push(item);
    });

    // Ordenar items dentro de cada aseguradora alfabéticamente (numeric: true para ordenar números correctamente)
    byInsurer.forEach(items => {
      items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es', { numeric: true, sensitivity: 'base' }));
    });

    // Ordenar aseguradoras alfabéticamente
    const sortedInsurers = Array.from(byInsurer.entries())
      .sort(([keyA], [keyB]) => {
        const nameA = keyA.split('|')[1] || '';
        const nameB = keyB.split('|')[1] || '';
        return nameA.localeCompare(nameB);
      });

    return sortedInsurers;
  }, [unidentifiedItems]);

  // Organizar items IDENTIFICADOS igual que sin identificar
  const organizedIdentified = useMemo(() => {
    // 1. Agrupar por cliente (prioridad) o póliza
    const groupsByClient = new Map<string, DraftUnidentifiedItem[]>();
    const groupsByPolicy = new Map<string, DraftUnidentifiedItem[]>();
    
    // Primero agrupar por cliente
    identifiedItems.forEach(item => {
      const clientKey = item.insured_name?.trim().toUpperCase() || 'SIN_NOMBRE';
      if (!groupsByClient.has(clientKey)) {
        groupsByClient.set(clientKey, []);
      }
      groupsByClient.get(clientKey)!.push(item);
    });
    
    // Luego agrupar por póliza solo items que NO se agruparon por cliente
    const processedByClient = new Set<string>();
    groupsByClient.forEach((items, key) => {
      if (items.length > 1) {
        items.forEach(item => processedByClient.add(item.id));
      }
    });
    
    identifiedItems.forEach(item => {
      if (!processedByClient.has(item.id)) {
        const policyKey = item.policy_number?.trim().toUpperCase() || 'SIN_POLIZA';
        if (policyKey !== 'SIN_POLIZA') {
          if (!groupsByPolicy.has(policyKey)) {
            groupsByPolicy.set(policyKey, []);
          }
          groupsByPolicy.get(policyKey)!.push(item);
        }
      }
    });

    // 2. Crear lista unificada de items y grupos
    const unified: UnifiedItem[] = [];
    const processedItemIds = new Set<string>();

    // Agregar grupos por cliente (2+ items)
    groupsByClient.forEach((items, key) => {
      if (items.length > 1 && items[0]) {
        items.forEach(item => processedItemIds.add(item.id));
        unified.push({
          type: 'group',
          key: `client_${key}`,
          displayName: items[0].insured_name || 'Sin nombre',
          insurerName: items[0].insurers?.name || 'Sin aseguradora',
          insurerId: items[0].insurers?.id || '',
          items,
          totalCommission: items.reduce((sum, item) => sum + item.commission_raw, 0)
        });
      }
    });
    
    // Agregar grupos por póliza (2+ items)
    groupsByPolicy.forEach((items, key) => {
      if (items.length > 1 && items[0]) {
        items.forEach(item => processedItemIds.add(item.id));
        unified.push({
          type: 'group',
          key: `policy_${key}`,
          displayName: items[0].insured_name || 'Sin nombre',
          insurerName: items[0].insurers?.name || 'Sin aseguradora',
          insurerId: items[0].insurers?.id || '',
          items,
          totalCommission: items.reduce((sum, item) => sum + item.commission_raw, 0)
        });
      }
    });

    // Agregar individuales (no agrupados)
    identifiedItems.forEach(item => {
      if (!processedItemIds.has(item.id)) {
        unified.push({
          type: 'individual',
          key: item.id,
          displayName: item.insured_name || 'Sin nombre',
          insurerName: item.insurers?.name || 'Sin aseguradora',
          insurerId: item.insurers?.id || '',
          items: [item],
          totalCommission: item.commission_raw
        });
      }
    });

    // 3. Agrupar por aseguradora y ordenar alfabéticamente
    const byInsurer = new Map<string, UnifiedItem[]>();
    unified.forEach(item => {
      const insurerKey = `${item.insurerId}|${item.insurerName}`;
      if (!byInsurer.has(insurerKey)) {
        byInsurer.set(insurerKey, []);
      }
      byInsurer.get(insurerKey)!.push(item);
    });

    // Ordenar items dentro de cada aseguradora alfabéticamente
    byInsurer.forEach(items => {
      items.sort((a, b) => a.displayName.localeCompare(b.displayName, 'es', { numeric: true, sensitivity: 'base' }));
    });

    // Ordenar aseguradoras alfabéticamente
    const sortedInsurers = Array.from(byInsurer.entries())
      .sort(([keyA], [keyB]) => {
        const nameA = keyA.split('|')[1] || '';
        const nameB = keyB.split('|')[1] || '';
        return nameA.localeCompare(nameB, 'es', { numeric: true, sensitivity: 'base' });
      });

    return sortedInsurers;
  }, [identifiedItems]);

  if (loading) {
    return (
      <Card className="border-2 border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-amber-700">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-700"></div>
            <span className="text-sm">Cargando clientes sin identificar...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-white overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-4 overflow-x-auto">
          {/* Header */}
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-amber-600 mt-1 text-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="flex flex-col gap-3 mb-2">
                <div>
                  <h3 className="font-bold text-[#010139] text-lg">
                    Clientes Sin Identificar - Zona de Trabajo
                  </h3>
                  <p className="text-sm text-gray-700">
                    Identifica clientes antes de confirmar PAGADO. Los identificados irán a preliminar.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex gap-2 flex-wrap">
                  <Badge className="bg-red-500 text-white text-sm px-3 py-1">
                    ❌ Sin identificar: {unidentifiedItems.length}
                  </Badge>
                  <Badge className="bg-blue-500 text-white text-sm px-3 py-1">
                    ✓ Identificados: {identifiedItems.length}
                  </Badge>
                </div>
              </div>

              {/* Toggle detalles */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm text-[#010139] hover:text-amber-600 transition-colors font-semibold"
              >
                {isExpanded ? <FaChevronDown /> : <FaChevronRight />}
                {isExpanded ? 'Ocultar' : 'Mostrar'} clientes
              </button>

              {/* Detalles expandibles */}
              {isExpanded && (
                <div className="mt-4 space-y-6">
                  {/* Sin Identificar - Unificado por Aseguradora */}
                  {unidentifiedItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                        <FaExclamationTriangle />
                        Pendientes de Identificar ({unidentifiedItems.length})
                      </h4>
                      
                      <div className="space-y-6">
                        {organizedUnidentified.map(([insurerKey, items]) => {
                          const insurerName = insurerKey.split('|')[1];
                          return (
                            <div key={insurerKey} className="space-y-3">
                              {/* Subtítulo de Aseguradora */}
                              <h5 className="text-sm font-bold text-red-700 flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border-l-4 border-red-600">
                                {insurerName}
                              </h5>
                              
                              {/* Grid de 2 columnas para todos los items */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {items.map(item => {
                                  const isGroup = item.type === 'group';
                                  const isExpanded = expandedGroups.has(item.key);
                                  const assigningKey = isGroup ? assigningGroup : assigningItem;
                                  const isAssigning = assigningKey === item.key;
                                  
                                  return (
                                    <div key={item.key} className="bg-white rounded-lg border-2 border-red-200">
                                      {/* Línea compacta */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                                        {/* Cliente/Nombre */}
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                          {isGroup && (
                                            <button
                                              onClick={() => toggleGroup(item.key)}
                                              className="text-red-600 hover:text-red-700"
                                            >
                                              {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                                            </button>
                                          )}
                                          <p className="font-semibold text-gray-900 text-sm truncate">
                                            {item.displayName}
                                          </p>
                                          {isGroup && (
                                            <Badge className="bg-red-600 text-white text-xs px-2 py-1">
                                              {item.items.length} items
                                            </Badge>
                                          )}
                                        </div>
                                        {/* Comisión */}
                                        <div className="flex-shrink-0">
                                          <p className="font-mono font-bold text-[#8AAA19] text-sm">
                                            ${item.totalCommission.toFixed(2)}
                                          </p>
                                        </div>
                                        {/* Botón Asignar - solo mostrar si NO está asignando */}
                                        {!isAssigning && (
                                          <div className="flex-shrink-0">
                                            <button
                                              onClick={() => isGroup ? setAssigningGroup(item.key) : setAssigningItem(item.key)}
                                              disabled={processing === item.key}
                                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                                            >
                                              <FaUser className="text-white" size={12} />
                                              {processing === item.key ? 'Procesando...' : 'Asignar'}
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                      
                                      {/* Selector desplegable */}
                                      {isAssigning && (
                                        <div className="px-3 pb-3 flex flex-col sm:flex-row gap-2">
                                          <select
                                            value={(isGroup ? selectedBrokerGroup : selectedBroker)[item.key] || ''}
                                            onChange={(e) => isGroup 
                                              ? setSelectedBrokerGroup({ ...selectedBrokerGroup, [item.key]: e.target.value })
                                              : setSelectedBroker({ ...selectedBroker, [item.key]: e.target.value })
                                            }
                                            className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                            disabled={processing === item.key}
                                          >
                                            <option value="">Seleccionar corredor{isGroup ? ' para todo el grupo' : ''}...</option>
                                            {brokers.map(broker => (
                                              <option key={broker.id} value={broker.id}>
                                                {broker.name}
                                              </option>
                                            ))}
                                          </select>
                                          {/* Checkbox Vida - solo para ASSA */}
                                          {item.insurerName.toUpperCase() === 'ASSA' && (
                                            <label className="flex items-center gap-2 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm bg-white whitespace-nowrap cursor-pointer hover:border-blue-400 transition-colors">
                                              <input
                                                type="checkbox"
                                                checked={(isGroup ? vidaCheckboxGroup : vidaCheckbox)[item.key] || false}
                                                onChange={(e) => isGroup
                                                  ? setVidaCheckboxGroup({ ...vidaCheckboxGroup, [item.key]: e.target.checked })
                                                  : setVidaCheckbox({ ...vidaCheckbox, [item.key]: e.target.checked })
                                                }
                                                disabled={processing === item.key}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                              />
                                              <span className="text-gray-700 font-medium">Vida</span>
                                            </label>
                                          )}
                                          <button
                                            onClick={() => isGroup 
                                              ? handleIdentifyGroup(item.key, item.items.map(i => i.id))
                                              : handleIdentify(item.key)
                                            }
                                            disabled={!(isGroup ? selectedBrokerGroup : selectedBroker)[item.key] || processing === item.key}
                                            className="px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9515] disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                                          >
                                            ✓ Confirmar{isGroup ? ` (${item.items.length})` : ''}
                                          </button>
                                        </div>
                                      )}
                                      
                                      {/* Detalles expandibles del grupo */}
                                      {isGroup && isExpanded && (
                                        <div className="px-3 pb-3 space-y-2">
                                          {item.items.map(subItem => (
                                            <div key={subItem.id} className="flex items-center gap-2 text-xs p-2 bg-gray-50 rounded border border-gray-200">
                                              <span className="flex-1 truncate text-gray-700">{subItem.insured_name}</span>
                                              <span className="font-mono text-[#8AAA19] font-semibold">${subItem.commission_raw.toFixed(2)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Identificados Temporalmente - Unificado por Aseguradora */}
                  {identifiedItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                        <FaCheckCircle />
                        Identificados Temporalmente ({identifiedItems.length})
                      </h4>
                      
                      <div className="space-y-6">
                        {organizedIdentified.map(([insurerKey, items]) => {
                          const insurerName = insurerKey.split('|')[1];
                          return (
                            <div key={insurerKey} className="space-y-3">
                              {/* Subtítulo de Aseguradora */}
                              <h5 className="text-sm font-bold text-blue-700 flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg border-l-4 border-blue-600">
                                {insurerName}
                              </h5>
                              
                              {/* Grid de 2 columnas para todos los items */}
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {items.map(item => {
                                  const isGroup = item.type === 'group';
                                  const isExpanded = expandedGroups.has(item.key);
                                  
                                  return (
                                    <div key={item.key} className="bg-white rounded-lg border-2 border-blue-200">
                                      {/* Línea compacta */}
                                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                                        {/* Cliente/Nombre */}
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                          {isGroup && (
                                            <button
                                              onClick={() => toggleGroup(item.key)}
                                              className="text-blue-600 hover:text-blue-700"
                                            >
                                              {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                                            </button>
                                          )}
                                          <p className="font-semibold text-gray-900 text-sm truncate">
                                            {item.displayName}
                                            {isGroup && <span className="ml-1 text-xs text-gray-500">({item.items.length})</span>}
                                          </p>
                                        </div>
                                        {/* Comisión Total */}
                                        <div className="flex-shrink-0">
                                          <p className="font-mono font-bold text-[#8AAA19] text-sm">
                                            ${item.totalCommission.toFixed(2)}
                                          </p>
                                        </div>
                                        {/* Corredor asignado */}
                                        <div className="flex-shrink-0">
                                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            {item.items[0]?.brokers?.name || 'N/A'}
                                          </span>
                                        </div>
                                        {/* Ícono Desasignar - INLINE (individuales y grupos) */}
                                        <div className="flex-shrink-0">
                                          <button
                                            onClick={() => {
                                              if (isGroup) {
                                                // Para grupos, desasignar todos los items
                                                item.items.forEach(subItem => handleUnidentify(subItem.id));
                                              } else if (item.items[0]) {
                                                handleUnidentify(item.items[0].id);
                                              }
                                            }}
                                            disabled={processing !== null}
                                            className="text-gray-400 hover:text-red-500 disabled:text-gray-300 transition-colors cursor-pointer"
                                            title="Desasignar"
                                          >
                                            <FaTrash size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Detalles expandidos del grupo */}
                                      {isGroup && isExpanded && (
                                        <div className="border-t border-blue-100 p-3 bg-blue-50 space-y-2">
                                          {item.items.map(subItem => (
                                            <div key={subItem.id} className="flex items-center justify-between text-xs bg-white p-2 rounded border border-blue-100">
                                              <span className="text-gray-600">{subItem.policy_number}</span>
                                              <span className="font-mono text-[#8AAA19] font-semibold">
                                                ${subItem.commission_raw.toFixed(2)}
                                              </span>
                                              <button
                                                onClick={() => handleUnidentify(subItem.id)}
                                                disabled={processing === subItem.id}
                                                className="text-gray-400 hover:text-red-500 disabled:text-gray-300 transition-colors cursor-pointer"
                                                title="Desasignar"
                                              >
                                                <FaTrash size={12} />
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nota informativa */}
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg">
                    <p className="text-xs text-blue-900">
                      <strong>📝 Importante:</strong> Al confirmar la quincena como PAGADO, los clientes <strong>identificados</strong> se registrarán automáticamente en <strong>preliminar de base de datos</strong>. Los <strong>sin identificar</strong> irán a <strong>ajustes pendientes</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
