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
  const [temporaryDiscounts, setTemporaryDiscounts] = useState<Map<string, number>>(new Map());
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
      const result = await actionGetAdvances(brokerId);

      if (result.ok) {
        // Filtrar solo pending y partial
        const filteredAdvances = (result.data || []).filter(
          (a: any) => a.status === 'pending' || a.status === 'partial'
        );
        setAdvances(filteredAdvances as Advance[]);
      } else {
        toast.error('Error al cargar adelantos');
      }

      // 2. Cargar descuentos temporales existentes para esta quincena
      const response = await fetch(`/api/commissions/fortnight-discounts?fortnight_id=${fortnightId}&broker_id=${brokerId}`);
      const discountsData = await response.json();
      
      if (discountsData.ok) {
        setExistingDiscounts(discountsData.data || []);
        
        // Inicializar mapa de descuentos temporales
        const discountsMap = new Map<string, number>();
        (discountsData.data || []).forEach((d: TemporaryDiscount) => {
          discountsMap.set(d.advance_id, d.amount);
        });
        setTemporaryDiscounts(discountsMap);
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
    const newMap = new Map(temporaryDiscounts);
    
    if (newMap.has(advanceId)) {
      newMap.delete(advanceId);
    } else {
      // Por defecto aplicar el monto completo o lo que queda del bruto
      const remaining = grossAmount - getTotalDiscounts();
      const amountToApply = Math.min(maxAmount, remaining);
      newMap.set(advanceId, amountToApply);
    }
    
    setTemporaryDiscounts(newMap);
  };

  // Cambiar monto de descuento
  const handleAmountChange = (advanceId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    const advance = advances.find(a => a.id === advanceId);
    
    if (!advance) return;
    
    const maxAmount = advance.amount - (advance.total_paid || 0);
    const validAmount = Math.min(Math.max(0, amount), maxAmount);
    
    const newMap = new Map(temporaryDiscounts);
    newMap.set(advanceId, validAmount);
    setTemporaryDiscounts(newMap);
  };

  // Guardar descuentos temporales
  const handleSaveDiscounts = async () => {
    if (getTotalDiscounts() > grossAmount) {
      toast.error('El total de descuentos excede el monto bruto');
      return;
    }

    setSaving(true);
    try {
      const discountsArray = Array.from(temporaryDiscounts.entries()).map(([advance_id, amount]) => ({
        advance_id,
        amount
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="text-2xl font-bold text-[#010139]">
              Gestión de Adelantos
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {brokerName} • Bruto: ${grossAmount.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'manage'
                  ? 'border-[#8AAA19] text-[#8AAA19]'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Gestionar Adelantos
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
                activeTab === 'history'
                  ? 'border-[#8AAA19] text-[#8AAA19]'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              <FaHistory className="inline mr-2" />
              Historial
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
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-blue-700 font-semibold">Bruto</p>
                      <p className="text-2xl font-bold text-blue-900 font-mono">
                        ${grossAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-red-700 font-semibold">Descuentos</p>
                      <p className="text-2xl font-bold text-red-900 font-mono">
                        -${getTotalDiscounts().toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-green-700 font-semibold">Neto</p>
                      <p className="text-2xl font-bold text-green-900 font-mono">
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
                        const remainingBalance = advance.amount - (advance.total_paid || 0);

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
                                      Total: ${advance.amount.toFixed(2)} | 
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
                                    type="number"
                                    value={selectedAmount}
                                    onChange={(e) => handleAmountChange(advance.id, e.target.value)}
                                    max={remainingBalance}
                                    step="0.01"
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
                <div className="text-center py-12 text-gray-500">
                  <FaHistory size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Historial completo de adelantos</p>
                  <p className="text-sm mt-2">
                    Para ver el historial detallado, visita la sección "Adelantos" en el menú principal
                  </p>
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
                  {temporaryDiscounts.size} adelanto(s) seleccionado(s) • Total: ${getTotalDiscounts().toFixed(2)}
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
