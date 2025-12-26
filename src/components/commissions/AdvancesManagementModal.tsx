'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FaPlus, FaTrash, FaHistory, FaCheckCircle, FaTimes, FaExclamationTriangle } from 'react-icons/fa';
import { actionCreateAdvance, actionDeleteAdvance, actionGetAdvances } from '@/app/(app)/commissions/actions';

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'partial' | 'paid';
  created_at: string;
  total_paid?: number;
  last_payment_date?: string | null;
  is_recurring?: boolean;
  payment_logs?: Array<{ date: string; amount: number }>;
}

interface TemporaryDiscount {
  advance_id: string;
  amount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  brokerId: string;
  brokerName: string;
  fortnightId: string;
  grossAmount: number;
  onDiscountsApplied: () => void;
}

export function AdvancesManagementModal({
  isOpen,
  onClose,
  brokerId,
  brokerName,
  fortnightId,
  grossAmount,
  onDiscountsApplied
}: Props) {
  const [activeTab, setActiveTab] = useState<'manage' | 'history'>('manage');
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [allAdvances, setAllAdvances] = useState<Advance[]>([]); // Para historial completo
  const [temporaryDiscounts, setTemporaryDiscounts] = useState<Map<string, number>>(new Map());
  const [inputValues, setInputValues] = useState<Map<string, string>>(new Map()); // State local para inputs
  const [existingDiscounts, setExistingDiscounts] = useState<TemporaryDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Estado para crear nuevo adelanto
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAdvance, setNewAdvance] = useState({
    amount: '',
    reason: '',
    is_recurring: false
  });

  // Cargar adelantos activos y descuentos temporales existentes
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Cargar adelantos activos del broker (filtrado por status se hace en el componente)
      console.log('[AdvancesManagementModal] Loading advances for broker:', brokerId);
      const result = await actionGetAdvances(brokerId);

      console.log('[AdvancesManagementModal] Result:', result);
      
      if (result.ok) {
        console.log('[AdvancesManagementModal] Total advances:', result.data?.length);
        console.log('[AdvancesManagementModal] Sample data:', result.data?.[0]);
        console.log('[AdvancesManagementModal] All status:', result.data?.map((a: any) => ({ id: a.id.substring(0, 8), status: a.status, amount: a.amount })));
        
        // Guardar todos los adelantos para el historial
        setAllAdvances((result.data || []) as Advance[]);
        
        // Filtrar adelantos con saldo > 0 (amount en BD ya es el saldo actual)
        const filteredAdvances = (result.data || []).filter(
          (a: any) => a.amount > 0
        );
        
        console.log('[AdvancesManagementModal] Filtered advances (with balance):', filteredAdvances.length);
        console.log('[AdvancesManagementModal] Filtered data:', filteredAdvances.map((a: any) => ({ id: a.id.substring(0, 8), amount: a.amount, paid: a.total_paid, remaining: a.amount - (a.total_paid || 0) })));
        
        setAdvances(filteredAdvances as Advance[]);
      } else {
        console.error('[AdvancesManagementModal] Error loading advances:', result.error);
        toast.error('Error al cargar adelantos');
      }

      // 2. Cargar descuentos temporales existentes para esta quincena
      const response = await fetch(`/api/commissions/fortnight-discounts?fortnight_id=${fortnightId}&broker_id=${brokerId}`);
      const discountsData = await response.json();
      
      if (discountsData.ok) {
        // Filtrar solo descuentos válidos (positivos)
        const validDiscounts = (discountsData.data || []).filter((d: TemporaryDiscount) => d.amount > 0);
        setExistingDiscounts(validDiscounts);
        
        // Inicializar mapa de descuentos temporales Y inputs
        const discountsMap = new Map<string, number>();
        const inputsMap = new Map<string, string>();
        validDiscounts.forEach((d: TemporaryDiscount) => {
          discountsMap.set(d.advance_id, d.amount);
          inputsMap.set(d.advance_id, d.amount.toFixed(2));
        });
        setTemporaryDiscounts(discountsMap);
        setInputValues(inputsMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, [brokerId, fortnightId]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // Calcular totales
  const getTotalDiscounts = () => {
    return Array.from(temporaryDiscounts.values()).reduce((sum, amt) => sum + amt, 0);
  };

  const getNetAmount = () => {
    return grossAmount - getTotalDiscounts();
  };

  // Manejar selección/deselección de adelanto
  const handleToggleAdvance = (advanceId: string, maxAmount: number) => {
    const newDiscountsMap = new Map(temporaryDiscounts);
    const newInputsMap = new Map(inputValues);
    
    if (newDiscountsMap.has(advanceId)) {
      newDiscountsMap.delete(advanceId);
      newInputsMap.delete(advanceId);
    } else {
      // Por defecto aplicar el monto completo o lo que queda del bruto
      const remaining = grossAmount - getTotalDiscounts();
      const amountToApply = Math.min(maxAmount, remaining);
      newDiscountsMap.set(advanceId, amountToApply);
      newInputsMap.set(advanceId, amountToApply.toFixed(2));
    }
    
    setTemporaryDiscounts(newDiscountsMap);
    setInputValues(newInputsMap);
  };

  // Cambiar monto de descuento
  const handleAmountChange = (advanceId: string, value: string) => {
    // Actualizar input local inmediatamente (permite edición libre)
    const newInputsMap = new Map(inputValues);
    newInputsMap.set(advanceId, value);
    setInputValues(newInputsMap);
    
    // Si está vacío, setear a 0 en el Map de descuentos
    if (value === '' || value === '-') {
      const newDiscountsMap = new Map(temporaryDiscounts);
      newDiscountsMap.set(advanceId, 0);
      setTemporaryDiscounts(newDiscountsMap);
      return;
    }
    
    const amount = parseFloat(value);
    
    // Si no es un número válido, solo actualizar el input pero no el Map
    if (isNaN(amount)) return;
    
    // Validación simple: solo que sea positivo
    const validAmount = Math.max(0, amount);
    
    const newDiscountsMap = new Map(temporaryDiscounts);
    newDiscountsMap.set(advanceId, validAmount);
    setTemporaryDiscounts(newDiscountsMap);
  };

  // Guardar descuentos temporales
  const handleSaveDiscounts = async () => {
    if (getTotalDiscounts() > grossAmount) {
      toast.error('El total de descuentos excede el monto bruto');
      return;
    }

    setSaving(true);
    try {
      // Filtrar solo descuentos con monto > 0 y asegurar valores positivos
      const discountsArray = Array.from(temporaryDiscounts.entries())
        .filter(([_, amount]) => amount > 0)
        .map(([advance_id, amount]) => ({
          advance_id,
          amount: Math.abs(amount) // Asegurar que sea positivo
        }));

      const response = await fetch('/api/commissions/fortnight-discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fortnight_id: fortnightId,
          broker_id: brokerId,
          discounts: discountsArray
        })
      });

      const result = await response.json();

      if (result.ok) {
        toast.success('Descuentos guardados correctamente');
        onDiscountsApplied();
        onClose();
      } else {
        toast.error(result.error || 'Error al guardar descuentos');
      }
    } catch (error) {
      console.error('Error saving discounts:', error);
      toast.error('Error al guardar descuentos');
    } finally {
      setSaving(false);
    }
  };

  // Crear nuevo adelanto
  const handleCreateAdvance = async () => {
    if (!newAdvance.amount || !newAdvance.reason.trim()) {
      toast.error('Completa todos los campos');
      return;
    }

    const amount = parseFloat(newAdvance.amount);
    if (amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      const result = await actionCreateAdvance({
        broker_id: brokerId,
        amount,
        reason: newAdvance.reason.trim()
      });

      if (result.ok) {
        toast.success('Adelanto creado correctamente');
        setNewAdvance({ amount: '', reason: '', is_recurring: false });
        setShowCreateForm(false);
        loadData();
      } else {
        toast.error(result.error || 'Error al crear adelanto');
      }
    } catch (error) {
      console.error('Error creating advance:', error);
      toast.error('Error al crear adelanto');
    }
  };

  // Eliminar adelanto
  const handleDeleteAdvance = async (advanceId: string) => {
    if (!confirm('¿Estás seguro de eliminar este adelanto?')) return;

    try {
      const result = await actionDeleteAdvance(advanceId);

      if (result.ok) {
        toast.success('Adelanto eliminado');
        
        // Remover de descuentos temporales si estaba seleccionado
        const newMap = new Map(temporaryDiscounts);
        newMap.delete(advanceId);
        setTemporaryDiscounts(newMap);
        
        loadData();
      } else {
        toast.error(result.error || 'Error al eliminar adelanto');
      }
    } catch (error) {
      console.error('Error deleting advance:', error);
      toast.error('Error al eliminar adelanto');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#010139] px-6 py-4 rounded-t-lg flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Gestión de Adelantos
            </h2>
            <p className="text-sm text-white/80 mt-1">
              {brokerName} • Bruto: ${grossAmount.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-white hover:text-white/80 transition-colors"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('manage')}
              className={`pb-3 pt-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'manage'
                  ? 'border-[#8AAA19] text-[#8AAA19]'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              💰 Adelantos Activos
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-3 pt-4 font-semibold transition-colors border-b-2 ${
                activeTab === 'history'
                  ? 'border-[#8AAA19] text-[#8AAA19]'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              <FaHistory className="inline mr-2" />
              Historial Completo
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-[#8AAA19] border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {activeTab === 'manage' && (
                <div className="space-y-6">
                  {/* Resumen de descuentos */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-blue-700 font-semibold">Bruto</p>
                      <p className="text-lg sm:text-2xl font-bold text-blue-900 font-mono break-all">
                        ${grossAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-red-700 font-semibold">Descuentos</p>
                      <p className="text-lg sm:text-2xl font-bold text-red-900 font-mono break-all">
                        -${Math.abs(getTotalDiscounts()).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 sm:p-4">
                      <p className="text-xs sm:text-sm text-green-700 font-semibold">Neto</p>
                      <p className="text-lg sm:text-2xl font-bold text-green-900 font-mono break-all">
                        ${getNetAmount().toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Advertencia si excede */}
                  {getTotalDiscounts() > grossAmount && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded flex items-start gap-3">
                      <FaExclamationTriangle className="text-red-600 mt-1" size={20} />
                      <div>
                        <p className="text-red-800 font-semibold">
                          El total de descuentos excede el monto bruto
                        </p>
                        <p className="text-red-700 text-sm mt-1">
                          Reduce los montos para poder guardar los cambios
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Botón crear adelanto */}
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-[#010139]">
                      Adelantos Activos ({advances.length})
                    </h3>
                    <button
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#7a9416] transition-colors"
                    >
                      <FaPlus className="text-white" />
                      Crear Adelanto
                    </button>
                  </div>

                  {/* Formulario crear adelanto */}
                  {showCreateForm && (
                    <div className="bg-gray-50 rounded-lg p-4 border-2 border-[#8AAA19]">
                      <h4 className="font-semibold text-[#010139] mb-3">Nuevo Adelanto</h4>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Monto ($)
                          </label>
                          <input
                            type="number"
                            value={newAdvance.amount}
                            onChange={(e) => setNewAdvance({ ...newAdvance, amount: e.target.value })}
                            step="0.01"
                            min="0"
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#8AAA19]"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Motivo
                          </label>
                          <input
                            type="text"
                            value={newAdvance.reason}
                            onChange={(e) => setNewAdvance({ ...newAdvance, reason: e.target.value })}
                            className="w-full border-2 border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:border-[#8AAA19]"
                            placeholder="Ej: Préstamo personal"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-4">
                        <input
                          type="checkbox"
                          id="recurring"
                          checked={newAdvance.is_recurring}
                          onChange={(e) => setNewAdvance({ ...newAdvance, is_recurring: e.target.checked })}
                          className="w-4 h-4 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                        />
                        <label htmlFor="recurring" className="text-sm text-gray-700">
                          Adelanto recurrente (se aplicará cada quincena)
                        </label>
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={handleCreateAdvance}
                          className="flex items-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#7a9416] transition-colors"
                        >
                          <FaCheckCircle className="text-white" />
                          Crear
                        </button>
                        <button
                          onClick={() => {
                            setShowCreateForm(false);
                            setNewAdvance({ amount: '', reason: '', is_recurring: false });
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Lista de adelantos */}
                  {advances.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <p>No hay adelantos activos para este corredor</p>
                      <p className="text-sm mt-2">Crea uno usando el botón "Crear Adelanto"</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {advances.map((advance) => {
                        const isSelected = temporaryDiscounts.has(advance.id);
                        const selectedAmount = temporaryDiscounts.get(advance.id) || 0;
                        const inputValue = inputValues.get(advance.id) || '';
                        // Usar misma lógica que historial: Total = amount + total_paid, Saldo = amount
                        const initialAmount = advance.amount + (advance.total_paid || 0);
                        const remainingBalance = advance.amount;

                        return (
                          <div
                            key={advance.id}
                            className={`border-2 rounded-lg p-4 transition-all ${
                              isSelected
                                ? 'border-[#8AAA19] bg-[#8AAA19]/5'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleAdvance(advance.id, remainingBalance)}
                                className="mt-1 w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                              />

                              {/* Info */}
                              <div className="flex-1">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-semibold text-[#010139]">
                                      {advance.reason}
                                      {advance.is_recurring && (
                                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                          Recurrente
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-sm text-gray-600 mt-1">
                                      Total: ${initialAmount.toFixed(2)} | 
                                      Pagado: ${(advance.total_paid || 0).toFixed(2)} | 
                                      Saldo: <span className="font-semibold">${remainingBalance.toFixed(2)}</span>
                                    </p>
                                    {advance.status === 'partial' && advance.last_payment_date && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Último pago: {new Date(advance.last_payment_date).toLocaleDateString('es-PA')}
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-500">
                                      Creado: {new Date(advance.created_at).toLocaleDateString('es-PA')}
                                    </p>
                                  </div>

                                  {/* Botón eliminar */}
                                  <button
                                    onClick={() => handleDeleteAdvance(advance.id)}
                                    className="text-red-600 hover:text-red-800 p-2"
                                    title="Eliminar adelanto"
                                  >
                                    <FaTrash size={16} />
                                  </button>
                                </div>
                              </div>

                              {/* Input de Monto */}
                              {isSelected && (
                                <div className="w-32">
                                  <label className="block text-xs text-gray-600 mb-1">Aplicar:</label>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={inputValue}
                                    onChange={(e) => handleAmountChange(advance.id, e.target.value)}
                                    placeholder="0.00"
                                    className="w-full border-2 border-[#8AAA19] rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#8AAA19]"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[#010139]">
                      Historial Completo
                    </h3>
                    <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                      {allAdvances.length} adelanto{allAdvances.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {allAdvances.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <FaHistory size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No hay adelantos registrados para este corredor</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {allAdvances.map((advance) => {
                        // Deuda inicial = saldo actual (amount) + lo que ya se pagó (total_paid)
                        const initialAmount = advance.amount + (advance.total_paid || 0);
                        // Saldo restante = amount (ya que amount es el saldo actual en BD)
                        const remainingBalance = advance.amount;
                        const statusColor = 
                          advance.status === 'paid' ? 'bg-green-100 text-green-800' :
                          advance.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800';
                        const statusText = 
                          advance.status === 'paid' ? 'Saldado' :
                          advance.status === 'partial' ? 'Parcial' :
                          'Pendiente';

                        return (
                          <div
                            key={advance.id}
                            className={`border-2 rounded-lg p-4 transition-all ${
                              advance.status === 'paid'
                                ? 'border-green-200 bg-green-50/30'
                                : remainingBalance > 0
                                ? 'border-blue-200 bg-blue-50/30'
                                : 'border-gray-200'
                            } hover:shadow-md`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-bold text-[#010139] text-lg">{advance.reason}</p>
                                  {advance.is_recurring && (
                                    <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">
                                      🔁 Recurrente
                                    </span>
                                  )}
                                </div>
                                <span className={`text-xs px-3 py-1 rounded-full font-bold ${statusColor}`}>
                                  {statusText}
                                </span>
                                <div className="grid grid-cols-3 gap-4 mt-3">
                                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                    <span className="text-xs text-gray-600 block mb-1">Monto Inicial</span>
                                    <span className="font-bold text-lg text-gray-800">${initialAmount.toFixed(2)}</span>
                                  </div>
                                  <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                                    <span className="text-xs text-green-700 block mb-1">Pagado</span>
                                    <span className="font-bold text-lg text-green-700">${(advance.total_paid || 0).toFixed(2)}</span>
                                  </div>
                                  <div className={`rounded-lg p-3 border ${
                                    remainingBalance === 0 
                                      ? 'bg-gray-50 border-gray-200' 
                                      : 'bg-blue-50 border-blue-200'
                                  }`}>
                                    <span className={`text-xs block mb-1 ${
                                      remainingBalance === 0 ? 'text-gray-600' : 'text-blue-700'
                                    }`}>Saldo</span>
                                    <span className={`font-bold text-lg ${
                                      remainingBalance === 0 ? 'text-gray-600' : 'text-blue-700'
                                    }`}>${remainingBalance.toFixed(2)}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                              <span>Creado: {new Date(advance.created_at).toLocaleDateString('es-PA')}</span>
                              {advance.last_payment_date && (
                                <span>Último pago: {new Date(advance.last_payment_date).toLocaleDateString('es-PA')}</span>
                              )}
                            </div>

                            {/* Historial de pagos */}
                            {advance.payment_logs && advance.payment_logs.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <p className="text-xs font-semibold text-gray-700 mb-2">Pagos realizados:</p>
                                <div className="space-y-1">
                                  {advance.payment_logs.map((log, idx) => (
                                    <div key={idx} className="flex justify-between text-xs text-gray-600">
                                      <span>{new Date(log.date).toLocaleDateString('es-PA')}</span>
                                      <span className="font-mono">${log.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {activeTab === 'manage' && (
          <div className="standard-modal-footer">
            <div>
              {temporaryDiscounts.size > 0 && (
                <p className="text-sm text-gray-600">
                  {temporaryDiscounts.size} adelanto(s) seleccionado(s) • Total: ${Math.abs(getTotalDiscounts()).toFixed(2)}
                </p>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={saving}
                className="standard-modal-button-secondary"
              >
                Cerrar
              </button>
              <button
                onClick={handleSaveDiscounts}
                disabled={saving || temporaryDiscounts.size === 0 || getTotalDiscounts() > grossAmount}
                className="standard-modal-button-primary"
              >
                {saving ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <FaCheckCircle className="text-white" />
                    <span>Guardar Descuentos</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
