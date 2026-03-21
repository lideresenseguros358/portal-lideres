'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaTimes, FaPlus, FaTrash, FaUser, FaFileInvoiceDollar } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  actionGetPaidFortnightsList,
  actionGetInsurersList,
  actionCreateManualAdjustmentReport,
  actionAddManualItemsToReport,
} from '@/app/(app)/commissions/adjustment-actions';

interface ManualItem {
  id: string; // local temp id
  fortnight_id: string;
  insurer_id: string;
  policy_number: string;
  insured_name: string;
  commission_raw: string; // string for input control
}

interface ExistingItem {
  id: string;
  policy_number: string;
  insured_name: string | null;
  commission_raw: number;
  broker_commission: number;
  insurer_name: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brokers: { id: string; name: string }[];
  // For edit mode: existing report data
  editReportId?: string | null;
  editBrokerId?: string | null;
  editBrokerName?: string | null;
  editBrokerPercent?: number;
  editExistingItems?: ExistingItem[];
}

const emptyItem = (): ManualItem => ({
  id: crypto.randomUUID(),
  fortnight_id: '',
  insurer_id: '',
  policy_number: '',
  insured_name: '',
  commission_raw: '',
});

export default function ManualAdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  brokers,
  editReportId = null,
  editBrokerId = null,
  editBrokerName = null,
  editBrokerPercent = 0,
  editExistingItems = [],
}: Props) {
  const [selectedBrokerId, setSelectedBrokerId] = useState('');
  const [brokerPercent, setBrokerPercent] = useState(0);
  const [manualItems, setManualItems] = useState<ManualItem[]>([emptyItem()]);
  const [fortnights, setFortnights] = useState<Array<{ id: string; label: string; status: string }>>([]);
  const [insurers, setInsurers] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingBrokerPercent, setLoadingBrokerPercent] = useState(false);

  const isEditMode = !!editReportId;

  // Load dropdowns
  const loadDropdowns = useCallback(async () => {
    setLoading(true);
    const [fortnightsResult, insurersResult] = await Promise.all([
      actionGetPaidFortnightsList(),
      actionGetInsurersList(),
    ]);
    if (fortnightsResult.ok) setFortnights(fortnightsResult.data || []);
    if (insurersResult.ok) setInsurers(insurersResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDropdowns();
      // In edit mode, pre-fill broker
      if (isEditMode && editBrokerId) {
        setSelectedBrokerId(editBrokerId);
        setBrokerPercent(editBrokerPercent || 0);
      } else {
        setSelectedBrokerId('');
        setBrokerPercent(0);
      }
      setManualItems([emptyItem()]);
    }
  }, [isOpen, isEditMode, editBrokerId, editBrokerPercent, loadDropdowns]);

  // Load broker percent when broker changes
  const handleBrokerChange = async (brokerId: string) => {
    setSelectedBrokerId(brokerId);
    if (!brokerId) {
      setBrokerPercent(0);
      return;
    }
    setLoadingBrokerPercent(true);
    try {
      const { supabaseClient } = await import('@/lib/supabase/client');
      const supabase = supabaseClient();
      const { data } = await supabase
        .from('brokers')
        .select('percent_default')
        .eq('id', brokerId)
        .single();
      setBrokerPercent(data?.percent_default || 0);
    } catch {
      setBrokerPercent(0);
    }
    setLoadingBrokerPercent(false);
  };

  const updateItem = (id: string, field: keyof ManualItem, value: string) => {
    setManualItems(prev => prev.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addItem = () => {
    setManualItems(prev => [...prev, emptyItem()]);
  };

  const removeItem = (id: string) => {
    if (manualItems.length <= 1) return;
    setManualItems(prev => prev.filter(item => item.id !== id));
  };

  const calculateBrokerCommission = (rawAmount: string) => {
    const raw = parseFloat(rawAmount) || 0;
    return raw * brokerPercent;
  };

  const totalRaw = manualItems.reduce((sum, item) => sum + (parseFloat(item.commission_raw) || 0), 0);
  const totalBrokerCommission = totalRaw * brokerPercent;

  const validateItems = (): boolean => {
    for (const item of manualItems) {
      if (!item.fortnight_id) {
        toast.error('Seleccione la quincena para cada item');
        return false;
      }
      if (!item.insurer_id) {
        toast.error('Seleccione la aseguradora para cada item');
        return false;
      }
      if (!item.policy_number.trim()) {
        toast.error('Ingrese el número de póliza para cada item');
        return false;
      }
      if (!item.insured_name.trim()) {
        toast.error('Ingrese el nombre del cliente para cada item');
        return false;
      }
      if (!item.commission_raw || parseFloat(item.commission_raw) === 0) {
        toast.error('Ingrese el monto de comisión para cada item');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!selectedBrokerId) {
      toast.error('Seleccione un corredor');
      return;
    }
    if (manualItems.length === 0) {
      toast.error('Agregue al menos un item');
      return;
    }
    if (!validateItems()) return;

    setSubmitting(true);
    try {
      const itemsPayload = manualItems.map(item => ({
        fortnight_id: item.fortnight_id,
        insurer_id: item.insurer_id,
        policy_number: item.policy_number.trim(),
        insured_name: item.insured_name.trim(),
        commission_raw: parseFloat(item.commission_raw) || 0,
      }));

      let result;
      if (isEditMode && editReportId) {
        result = await actionAddManualItemsToReport(editReportId, itemsPayload);
      } else {
        result = await actionCreateManualAdjustmentReport(selectedBrokerId, itemsPayload);
      }

      if (result.ok) {
        toast.success(result.message);
        onSuccess();
        onClose();
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error('Error inesperado: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);

  return (
    <div
      className="fixed inset-0 flex items-start justify-center z-50 pt-4 sm:pt-10 px-3"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget && !submitting) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FaFileInvoiceDollar className="text-white" size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {isEditMode ? 'Agregar Items al Reporte' : 'Nuevo Reporte Manual'}
              </h3>
              <p className="text-xs text-white/70">
                {isEditMode ? `Editando reporte de ${editBrokerName}` : 'Crear reporte de ajuste desde cero'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <FaTimes size={16} />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
              <span className="ml-3 text-gray-600">Cargando datos...</span>
            </div>
          ) : (
            <>
              {/* Step 1: Broker Selection */}
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FaUser className="text-[#010139]" size={14} />
                  <h4 className="font-bold text-[#010139] text-sm">1. Corredor</h4>
                </div>
                {isEditMode ? (
                  <div className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 border-2 border-[#8AAA19]">
                    <span className="font-semibold text-[#010139]">{editBrokerName}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {(brokerPercent * 100).toFixed(0)}%
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedBrokerId}
                      onChange={(e) => handleBrokerChange(e.target.value)}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none bg-white"
                    >
                      <option value="">Seleccionar corredor...</option>
                      {brokers.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {selectedBrokerId && !loadingBrokerPercent && (
                      <p className="text-xs text-[#8AAA19] font-semibold">
                        Porcentaje del corredor: {(brokerPercent * 100).toFixed(0)}%
                      </p>
                    )}
                    {loadingBrokerPercent && (
                      <p className="text-xs text-gray-400">Cargando porcentaje...</p>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Existing Items (edit mode only) */}
              {isEditMode && editExistingItems.length > 0 && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                  <h4 className="font-bold text-[#010139] text-sm mb-3">
                    Items existentes ({editExistingItems.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {editExistingItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-xs border">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">{item.policy_number}</span>
                          <span className="text-gray-500 ml-2">{item.insured_name || '—'}</span>
                          {item.insurer_name && (
                            <span className="text-gray-400 ml-2">({item.insurer_name})</span>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right ml-2">
                          <span className="font-mono text-gray-700">{formatCurrency(Math.abs(item.commission_raw))}</span>
                          <span className="text-[#8AAA19] font-semibold ml-2">{formatCurrency(Math.abs(item.broker_commission))}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Manual Items */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FaFileInvoiceDollar className="text-[#010139]" size={14} />
                  <h4 className="font-bold text-[#010139] text-sm">
                    {isEditMode ? '2. Agregar nuevos items' : '2. Clientes'}
                  </h4>
                </div>

                <div className="space-y-4">
                  {manualItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="bg-white border-2 border-gray-200 rounded-xl p-3 sm:p-4 space-y-3 relative hover:border-[#8AAA19]/50 transition-colors"
                    >
                      {/* Item number and remove */}
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-[#010139] bg-gray-100 px-2 py-1 rounded-full">
                          #{index + 1}
                        </span>
                        {manualItems.length > 1 && (
                          <button
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar item"
                          >
                            <FaTrash size={12} />
                          </button>
                        )}
                      </div>

                      {/* Row 1: Fortnight + Insurer */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Quincena</label>
                          <select
                            value={item.fortnight_id}
                            onChange={(e) => updateItem(item.id, 'fortnight_id', e.target.value)}
                            className="w-full max-w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none bg-white"
                          >
                            <option value="">Seleccionar...</option>
                            {fortnights.map(f => (
                              <option key={f.id} value={f.id}>{f.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Aseguradora</label>
                          <select
                            value={item.insurer_id}
                            onChange={(e) => updateItem(item.id, 'insurer_id', e.target.value)}
                            className="w-full max-w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none bg-white"
                          >
                            <option value="">Seleccionar...</option>
                            {insurers.map(ins => (
                              <option key={ins.id} value={ins.id}>{ins.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Policy + Client Name */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nro. Póliza</label>
                          <input
                            type="text"
                            value={item.policy_number}
                            onChange={(e) => updateItem(item.id, 'policy_number', e.target.value)}
                            placeholder="Ej: 10-04-1234567-0"
                            className="w-full max-w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          />
                        </div>
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Nombre del Cliente</label>
                          <input
                            type="text"
                            value={item.insured_name}
                            onChange={(e) => updateItem(item.id, 'insured_name', e.target.value)}
                            placeholder="Nombre completo"
                            className="w-full max-w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Row 3: Commission Raw + Auto-calculated */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Monto Comisión (Bruto)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={item.commission_raw}
                              onChange={(e) => updateItem(item.id, 'commission_raw', e.target.value)}
                              placeholder="0.00"
                              className="w-full max-w-full pl-7 pr-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                            />
                          </div>
                        </div>
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Comisión Corredor ({(brokerPercent * 100).toFixed(0)}%)
                          </label>
                          <div className="px-3 py-2 bg-green-50 border-2 border-green-200 rounded-lg text-sm font-semibold text-[#8AAA19]">
                            {formatCurrency(calculateBrokerCommission(item.commission_raw))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add item button */}
                <button
                  onClick={addItem}
                  className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:text-[#8AAA19] hover:border-[#8AAA19] transition-colors"
                >
                  <FaPlus size={12} />
                  Agregar otro cliente
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer - Fixed */}
        <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-4">
          {/* Totals */}
          {manualItems.length > 0 && selectedBrokerId && (
            <div className="flex items-center justify-between mb-3 text-sm">
              <div>
                <span className="text-gray-500">Total bruto:</span>{' '}
                <span className="font-bold text-gray-900">{formatCurrency(totalRaw)}</span>
              </div>
              <div>
                <span className="text-gray-500">Comisión corredor:</span>{' '}
                <span className="font-bold text-[#8AAA19]">{formatCurrency(totalBrokerCommission)}</span>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 border-gray-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedBrokerId || manualItems.length === 0}
              className="flex-1 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:from-[#7a9617] hover:to-[#5c7311] text-white font-semibold shadow-md hover:shadow-lg active:scale-[0.98] transition-all"
            >
              {submitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Guardando...
                </div>
              ) : isEditMode ? (
                `Agregar ${manualItems.length} Item${manualItems.length > 1 ? 's' : ''}`
              ) : (
                `Crear Reporte (${manualItems.length} item${manualItems.length > 1 ? 's' : ''})`
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
