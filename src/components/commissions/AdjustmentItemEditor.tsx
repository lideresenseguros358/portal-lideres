'use client';

/**
 * ADJUSTMENT ITEM EDITOR
 * Modal para editar items de ajuste individualmente
 * Permite ajustar override percent y recalcular comisiones
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FaPercent, FaDollarSign, FaSave, FaTimes, FaUndo } from 'react-icons/fa';
import { toast } from 'sonner';

interface AdjustmentItem {
  id: string;
  policy_number: string;
  insured_name: string | null;
  commission_raw: number;
  broker_commission: number;
  insurer_name: string | null;
  override_percent?: number;
}

interface Props {
  items: AdjustmentItem[];
  defaultPercent: number;
  onSave: (updatedItems: Array<{ id: string; override_percent: number; broker_commission: number }>) => void;
  onClose: () => void;
}

export default function AdjustmentItemEditor({ items, defaultPercent, onSave, onClose }: Props) {
  const [editedItems, setEditedItems] = useState<Map<string, { percent: number; commission: number }>>(new Map());

  useEffect(() => {
    // Inicializar con valores actuales
    const initial = new Map<string, { percent: number; commission: number }>();
    items.forEach(item => {
      const currentPercent = item.override_percent ?? defaultPercent;
      initial.set(item.id, {
        percent: currentPercent,
        commission: item.broker_commission
      });
    });
    setEditedItems(initial);
  }, [items, defaultPercent]);

  const handlePercentChange = (itemId: string, newPercent: number, rawAmount: number) => {
    if (newPercent < 0 || newPercent > 1) {
      toast.error('El porcentaje debe estar entre 0 y 1');
      return;
    }

    const newCommission = Math.abs(rawAmount) * newPercent;
    setEditedItems(prev => {
      const next = new Map(prev);
      next.set(itemId, { percent: newPercent, commission: newCommission });
      return next;
    });
  };

  const handleResetItem = (itemId: string, rawAmount: number) => {
    const newCommission = Math.abs(rawAmount) * defaultPercent;
    setEditedItems(prev => {
      const next = new Map(prev);
      next.set(itemId, { percent: defaultPercent, commission: newCommission });
      return next;
    });
    toast.info('Restaurado al porcentaje por defecto del broker');
  };

  const handleSave = () => {
    const updates = Array.from(editedItems.entries()).map(([id, data]) => ({
      id,
      override_percent: data.percent,
      broker_commission: data.commission
    }));
    onSave(updates);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const totalCommission = Array.from(editedItems.values()).reduce((sum, item) => sum + item.commission, 0);
  const hasChanges = Array.from(editedItems.entries()).some(([id, data]) => {
    const item = items.find(i => i.id === id);
    return item && (data.percent !== (item.override_percent ?? defaultPercent) || data.commission !== item.broker_commission);
  });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#010139] flex items-center gap-2">
            <FaPercent className="text-[#8AAA19]" />
            Ajustar Override Percent por Item
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Modifica el porcentaje de comisión por cada item. 
            Útil para pólizas de vida (1.0) u otros casos especiales.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Info General */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-sm text-blue-900">
              <strong>Porcentaje por defecto del broker:</strong> {(defaultPercent * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Los cambios se aplicarán solo a este reporte. El porcentaje por defecto del broker no se modificará.
            </p>
          </div>

          {/* Tabla Desktop */}
          <div className="hidden md:block border rounded-lg overflow-hidden bg-white">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Póliza</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Aseguradora</TableHead>
                  <TableHead className="text-right font-semibold">Monto Crudo</TableHead>
                  <TableHead className="text-center font-semibold">Override %</TableHead>
                  <TableHead className="text-right font-semibold">Comisión</TableHead>
                  <TableHead className="text-center font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const edited = editedItems.get(item.id);
                  const currentPercent = edited?.percent ?? defaultPercent;
                  const currentCommission = edited?.commission ?? item.broker_commission;
                  const hasItemChange = currentPercent !== (item.override_percent ?? defaultPercent);

                  return (
                    <TableRow key={item.id} className={hasItemChange ? 'bg-yellow-50' : ''}>
                      <TableCell className="font-medium">{item.policy_number}</TableCell>
                      <TableCell className="text-sm">{item.insured_name || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{item.insurer_name || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCurrency(Math.abs(item.commission_raw))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-center">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="1"
                            value={currentPercent}
                            onChange={(e) => handlePercentChange(item.id, parseFloat(e.target.value) || 0, item.commission_raw)}
                            className="w-20 text-center font-mono text-sm"
                          />
                          <FaPercent className="text-gray-400 text-xs" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`font-mono font-semibold text-sm ${hasItemChange ? 'text-[#8AAA19]' : 'text-gray-700'}`}>
                          {formatCurrency(currentCommission)}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResetItem(item.id, item.commission_raw)}
                          disabled={!hasItemChange}
                          title="Restaurar al % por defecto"
                          className="h-8 w-8 p-0"
                        >
                          <FaUndo className="text-gray-600" size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="bg-gray-100 font-bold">
                  <TableCell colSpan={5} className="text-right text-base">
                    TOTAL COMISIÓN:
                  </TableCell>
                  <TableCell className="text-right font-mono text-[#8AAA19] text-lg">
                    {formatCurrency(totalCommission)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Lista Mobile */}
          <div className="md:hidden space-y-3">
            {items.map((item) => {
              const edited = editedItems.get(item.id);
              const currentPercent = edited?.percent ?? defaultPercent;
              const currentCommission = edited?.commission ?? item.broker_commission;
              const hasItemChange = currentPercent !== (item.override_percent ?? defaultPercent);

              return (
                <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${hasItemChange ? 'bg-yellow-50 border-yellow-300' : 'bg-white'}`}>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Póliza</p>
                    <p className="font-semibold text-sm text-[#010139]">{item.policy_number}</p>
                    {item.insured_name && (
                      <p className="text-xs text-gray-600 mt-1">{item.insured_name}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <p className="text-xs text-gray-500">Monto Crudo</p>
                      <p className="text-sm font-mono">{formatCurrency(Math.abs(item.commission_raw))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Aseguradora</p>
                      <p className="text-sm">{item.insurer_name || '—'}</p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs mb-2 block">Override Percent</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="1"
                        value={currentPercent}
                        onChange={(e) => handlePercentChange(item.id, parseFloat(e.target.value) || 0, item.commission_raw)}
                        className="flex-1 text-center font-mono"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetItem(item.id, item.commission_raw)}
                        disabled={!hasItemChange}
                      >
                        <FaUndo size={12} />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500">Comisión Calculada</p>
                    <p className={`text-lg font-mono font-semibold ${hasItemChange ? 'text-[#8AAA19]' : 'text-gray-700'}`}>
                      {formatCurrency(currentCommission)}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-700">TOTAL COMISIÓN:</span>
                <span className="font-mono font-bold text-[#8AAA19] text-xl">
                  {formatCurrency(totalCommission)}
                </span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3 justify-end pt-4 border-t sticky bottom-0 bg-white pb-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-300"
            >
              <FaTimes className="mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="bg-[#8AAA19] hover:bg-[#7a9617] text-white"
            >
              <FaSave className="mr-2" />
              Guardar Cambios
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
