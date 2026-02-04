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
import { FaPercent, FaDollarSign, FaSave, FaTimes, FaUndo, FaCalculator } from 'react-icons/fa';
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
  const [editedItems, setEditedItems] = useState<Map<string, { percent: number | null; commission: number | null; calculated: boolean }>>(new Map());

  useEffect(() => {
    // Inicializar con comisiones ORIGINALES visibles pero NOT CALCULATED (no se guardan a menos que se editen)
    const initial = new Map<string, { percent: number | null; commission: number | null; calculated: boolean }>();
    items.forEach(item => {
      initial.set(item.id, {
        percent: null,
        commission: item.broker_commission, // Mostrar comisión original
        calculated: false // No calculado = no se guarda a menos que se edite
      });
    });
    setEditedItems(initial);
  }, [items]);

  const handlePercentChange = (itemId: string, newPercent: string) => {
    setEditedItems(prev => {
      const next = new Map(prev);
      const current = next.get(itemId) || { percent: null, commission: null, calculated: false };
      next.set(itemId, { 
        ...current, 
        percent: newPercent ? parseFloat(newPercent) : null,
        calculated: false // Marcar como no calculado cuando cambia
      });
      return next;
    });
  };

  const handleCalculateItem = (itemId: string, rawAmount: number) => {
    const edited = editedItems.get(itemId);
    const percent = edited?.percent;
    
    if (percent === null || percent === undefined) {
      toast.error('Ingresa un porcentaje primero');
      return;
    }

    if (percent < 0 || percent > 1) {
      toast.error('El porcentaje debe estar entre 0 y 1');
      return;
    }

    const newCommission = Math.abs(rawAmount) * percent;
    setEditedItems(prev => {
      const next = new Map(prev);
      next.set(itemId, { percent, commission: newCommission, calculated: true });
      return next;
    });
    toast.success('Comisión calculada');
  };

  const handleResetItem = (itemId: string) => {
    setEditedItems(prev => {
      const next = new Map(prev);
      next.set(itemId, { percent: null, commission: null, calculated: false });
      return next;
    });
    toast.info('Campo limpiado');
  };

  const handleSave = () => {
    // Solo guardar items que fueron CALCULADOS (editados por el usuario)
    const updates: Array<{ id: string; override_percent: number; broker_commission: number }> = [];
    
    for (const [id, data] of editedItems.entries()) {
      if (data.calculated && data.percent !== null && data.commission !== null) {
        updates.push({
          id,
          override_percent: data.percent,
          broker_commission: data.commission
        });
      }
    }

    if (updates.length === 0) {
      toast.error('No has editado ningún item. Si no necesitas cambios, simplemente cierra el modal.');
      return;
    }

    // Guardar solo los items editados
    // El parent (MasterAdjustmentReportReview) maneja el resultado y cierra el modal
    onSave(updates);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Total incluye TODAS las comisiones: originales + editadas
  const totalCommission = Array.from(editedItems.values())
    .filter(item => item.commission !== null)
    .reduce((sum, item) => sum + (item.commission || 0), 0);
  
  const hasChanges = Array.from(editedItems.values()).some(item => item.calculated);
  const calculatedCount = Array.from(editedItems.values()).filter(item => item.calculated).length;
  const totalItems = items.length;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#010139] flex items-center gap-2">
            <FaPercent className="text-[#8AAA19]" />
            Ajustar Override Percent por Item
          </DialogTitle>
          <p className="text-sm text-gray-600 mt-2">
            Las comisiones actuales se muestran calculadas con el % del broker.
            Solo edita los items que requieran un porcentaje diferente (ej: vida 1.0).
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Info General */}
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <p className="text-sm text-blue-900 mb-2">
              <strong>Porcentaje por defecto del broker:</strong> {(defaultPercent * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-blue-700">
              💡 <strong>Los items que NO edites mantendrán su comisión actual.</strong> Solo modifica los que necesiten un % diferente:
            </p>
            <ol className="text-xs text-blue-700 mt-2 ml-4 list-decimal space-y-1">
              <li>Ingresa el % nuevo en el item (ej: 1.0 para pólizas de vida)</li>
              <li>Presiona <FaCalculator className="inline" size={10} /> para recalcular</li>
              <li>Repite solo para los items que necesites ajustar</li>
              <li>Guarda - los demás mantienen su comisión original</li>
            </ol>
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
                  const currentPercent = edited?.percent ?? '';
                  const currentCommission = edited?.commission;
                  const isCalculated = edited?.calculated || false;
                  const hasValue = edited?.percent !== null && edited?.percent !== undefined;

                  return (
                    <TableRow key={item.id} className={isCalculated ? 'bg-green-50' : ''}>
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
                            onChange={(e) => handlePercentChange(item.id, e.target.value)}
                            placeholder="0.00"
                            className="w-20 text-center font-mono text-sm"
                          />
                          <FaPercent className="text-gray-400 text-xs" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isCalculated && currentCommission !== null && currentCommission !== undefined ? (
                          <span className="font-mono font-semibold text-sm text-[#8AAA19]">
                            {formatCurrency(currentCommission)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex gap-1 justify-center">
                          <Button
                            size="sm"
                            onClick={() => handleCalculateItem(item.id, item.commission_raw)}
                            disabled={!hasValue || isCalculated}
                            title="Calcular comisión"
                            className="h-8 w-8 p-0 bg-[#8AAA19] hover:bg-[#7a9617] text-white"
                          >
                            <FaCalculator size={12} />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResetItem(item.id)}
                            disabled={!hasValue}
                            title="Limpiar"
                            className="h-8 w-8 p-0"
                          >
                            <FaTimes className="text-gray-600" size={12} />
                          </Button>
                        </div>
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
              const currentPercent = edited?.percent ?? '';
              const currentCommission = edited?.commission;
              const isCalculated = edited?.calculated || false;
              const hasValue = edited?.percent !== null && edited?.percent !== undefined;

              return (
                <div key={item.id} className={`border rounded-lg p-4 space-y-3 ${isCalculated ? 'bg-green-50 border-green-300' : 'bg-white'}`}>
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
                        onChange={(e) => handlePercentChange(item.id, e.target.value)}
                        placeholder="0.00"
                        className="flex-1 text-center font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleCalculateItem(item.id, item.commission_raw)}
                        disabled={!hasValue || isCalculated}
                        className="bg-[#8AAA19] hover:bg-[#7a9617] text-white"
                      >
                        <FaCalculator size={12} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleResetItem(item.id)}
                        disabled={!hasValue}
                      >
                        <FaTimes size={12} />
                      </Button>
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs text-gray-500">Comisión Calculada</p>
                    {isCalculated && currentCommission !== null && currentCommission !== undefined ? (
                      <p className="text-lg font-mono font-semibold text-[#8AAA19]">
                        {formatCurrency(currentCommission)}
                      </p>
                    ) : (
                      <p className="text-lg text-gray-400">—</p>
                    )}
                  </div>
                </div>
              );
            })}

            <div className="bg-gray-100 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-gray-700">TOTAL COMISIÓN:</span>
                <span className="font-mono font-bold text-[#8AAA19] text-xl">
                  {formatCurrency(totalCommission)}
                </span>
              </div>
              <p className="text-xs text-gray-600 text-center">
                {calculatedCount > 0 
                  ? `${calculatedCount} editado(s) de ${totalItems} items`
                  : `${totalItems} items con comisión original`
                }
              </p>
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
