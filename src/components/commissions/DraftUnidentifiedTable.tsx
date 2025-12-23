'use client';

import { useState, useEffect } from 'react';
import { actionGetDraftUnidentified, actionTempIdentifyClient, actionTempUnidentifyClient } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FaUser, FaUndo, FaChevronDown, FaChevronRight, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

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

  const loadItems = async () => {
    // Solo mostrar loading en la primera carga
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

  // Auto-refresh cuando cambia recalculationKey
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

    setProcessing(itemId);
    const result = await actionTempIdentifyClient(itemId, brokerId);
    
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

  const unidentifiedItems = items.filter(item => !item.temp_assigned_broker_id);
  const identifiedItems = items.filter(item => item.temp_assigned_broker_id);

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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-bold text-[#010139] text-lg">
                    Clientes Sin Identificar - Zona de Trabajo
                  </h3>
                  <p className="text-sm text-gray-700">
                    Identifica clientes antes de confirmar PAGADO. Los identificados irán a preliminar.
                  </p>
                </div>
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
                <div className="mt-4 space-y-4">
                  {/* Sin Identificar */}
                  {unidentifiedItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-red-700 mb-3 flex items-center gap-2">
                        <FaExclamationTriangle />
                        Pendientes de Identificar ({unidentifiedItems.length})
                      </h4>
                      <div className="space-y-2">
                        {unidentifiedItems.map(item => (
                          <div key={item.id} className="bg-white rounded-lg border-2 border-red-200">
                            {/* Línea compacta */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                              {/* Cliente */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{item.insured_name || 'Sin nombre'}</p>
                              </div>
                              {/* Aseguradora */}
                              <div className="flex-shrink-0">
                                <p className="text-sm text-gray-600">{item.insurers?.name || 'N/A'}</p>
                              </div>
                              {/* Comisión */}
                              <div className="flex-shrink-0">
                                <p className="font-mono font-bold text-[#8AAA19] text-sm">
                                  ${((item.insurers as any)?.invert_negatives ? -item.commission_raw : item.commission_raw).toFixed(2)}
                                </p>
                              </div>
                              {/* Botón Asignar */}
                              <div className="flex-shrink-0">
                                <button
                                  onClick={() => setAssigningItem(assigningItem === item.id ? null : item.id)}
                                  disabled={processing === item.id}
                                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                  <FaUser className="text-white" size={12} />
                                  {processing === item.id ? 'Procesando...' : 'Asignar'}
                                </button>
                              </div>
                            </div>
                            {/* Selector desplegable */}
                            {assigningItem === item.id && (
                              <div className="px-3 pb-3 flex flex-col sm:flex-row gap-2">
                                <select
                                  value={selectedBroker[item.id] || ''}
                                  onChange={(e) => setSelectedBroker({ ...selectedBroker, [item.id]: e.target.value })}
                                  className="flex-1 px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                                  disabled={processing === item.id}
                                >
                                  <option value="">Seleccionar corredor...</option>
                                  {brokers.map(broker => (
                                    <option key={broker.id} value={broker.id}>
                                      {broker.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleIdentify(item.id)}
                                  disabled={!selectedBroker[item.id] || processing === item.id}
                                  className="px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9515] disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-colors whitespace-nowrap"
                                >
                                  ✓ Confirmar
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Identificados Temporalmente */}
                  {identifiedItems.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-blue-700 mb-3 flex items-center gap-2">
                        <FaCheckCircle />
                        Identificados Temporalmente ({identifiedItems.length})
                      </h4>
                      <div className="space-y-2">
                        {identifiedItems.map(item => (
                          <div key={item.id} className="bg-white rounded-lg border-2 border-blue-200">
                            {/* Línea compacta */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3">
                              {/* Cliente */}
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 text-sm truncate">{item.insured_name || 'Sin nombre'}</p>
                              </div>
                              {/* Aseguradora */}
                              <div className="flex-shrink-0">
                                <p className="text-sm text-gray-600">{item.insurers?.name || 'N/A'}</p>
                              </div>
                              {/* Comisión */}
                              <div className="flex-shrink-0">
                                <p className="font-mono font-bold text-[#8AAA19] text-sm">
                                  ${((item.insurers as any)?.invert_negatives ? -item.commission_raw : item.commission_raw).toFixed(2)}
                                </p>
                              </div>
                              {/* Corredor asignado */}
                              <div className="flex-shrink-0">
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                  {item.brokers?.name || 'N/A'}
                                </span>
                              </div>
                              {/* Botón Desasignar */}
                              <div className="flex-shrink-0">
                                <button
                                  onClick={() => handleUnidentify(item.id)}
                                  disabled={processing === item.id}
                                  className="px-4 py-2 border-2 border-red-300 text-red-600 hover:bg-red-50 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                                >
                                  <FaUndo size={12} />
                                  {processing === item.id ? 'Procesando...' : 'Desasignar'}
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
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
