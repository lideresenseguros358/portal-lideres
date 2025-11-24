'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { FaPaperPlane, FaTrash, FaCalculator, FaTimes, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'sonner';

interface PendingItem {
  id: string;
  policy_number: string;
  insured_name: string | null;
  gross_amount: number;
  commission_raw: number;
  insurer_id: string;
  insurer_name?: string;
  created_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  pendingItems: PendingItem[];
  brokerPercent: number;
  onSubmit: (itemIds: string[], notes: string) => Promise<void>;
}

export default function AdjustmentReportModal({ 
  isOpen, 
  onClose, 
  pendingItems, 
  brokerPercent,
  onSubmit 
}: Props) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectionTotals = useMemo(() => {
    const selected = pendingItems.filter(item => selectedItems.has(item.id));
    const totalRaw = selected.reduce((sum, item) => sum + Math.abs(Number(item.commission_raw) || 0), 0);
    const totalBroker = totalRaw * (brokerPercent / 100);

    return {
      count: selected.length,
      totalRaw,
      totalBroker,
      percent: brokerPercent,
      items: selected
    };
  }, [selectedItems, pendingItems, brokerPercent]);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedItems.size === pendingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map(i => i.id)));
    }
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setNotes('');
  };

  const handleSubmit = async () => {
    if (selectedItems.size === 0) {
      toast.error('Debes seleccionar al menos un ajuste');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(Array.from(selectedItems), notes);
      clearSelection();
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#010139] flex items-center gap-2">
            <FaCheckCircle className="text-[#8AAA19]" />
            Crear Reporte de Ajustes
          </DialogTitle>
          <DialogDescription>
            Selecciona todos los ajustes que deseas incluir en este reporte
          </DialogDescription>
        </DialogHeader>

        {/* Panel de Selección */}
        {selectedItems.size > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-white border-2 border-[#8AAA19] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <FaCalculator className="text-[#8AAA19]" />
              <h3 className="font-bold text-[#010139]">
                Items Seleccionados: {selectionTotals.count}
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Monto Crudo Total</p>
                <p className="font-mono font-semibold text-gray-700 text-lg">
                  {formatCurrency(selectionTotals.totalRaw)}
                </p>
              </div>
              <div>
                <p className="text-gray-600">Tu Porcentaje</p>
                <p className="font-mono font-semibold text-[#010139] text-lg">
                  {selectionTotals.percent}%
                </p>
              </div>
              <div>
                <p className="text-gray-600">Tu Comisión Total</p>
                <p className="font-mono font-bold text-[#8AAA19] text-xl">
                  {formatCurrency(selectionTotals.totalBroker)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notas */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notas o Comentarios (opcional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Agrega cualquier comentario o justificación para este reporte..."
            rows={3}
            className="resize-none"
          />
        </div>

        {/* Tabla de Items */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[400px]">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedItems.size === pendingItems.length && pendingItems.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="font-semibold">Póliza</TableHead>
                  <TableHead className="font-semibold">Cliente</TableHead>
                  <TableHead className="font-semibold">Aseguradora</TableHead>
                  <TableHead className="text-right font-semibold">Monto Crudo</TableHead>
                  <TableHead className="text-right font-semibold">Tu Comisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No hay ajustes disponibles
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingItems.map((item) => {
                    const isSelected = selectedItems.has(item.id);
                    const rawAmount = Math.abs(Number(item.commission_raw) || 0);
                    const brokerAmount = rawAmount * (brokerPercent / 100);

                    return (
                      <TableRow 
                        key={item.id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => toggleItem(item.id)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.policy_number}
                        </TableCell>
                        <TableCell>{item.insured_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.insurer_name || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(rawAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                          {isSelected ? formatCurrency(brokerAmount) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={clearSelection}
            variant="outline"
            disabled={selectedItems.size === 0 || submitting}
            className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
          >
            <FaTrash className="mr-2" />
            Limpiar Selección
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            disabled={submitting}
            className="flex-1"
          >
            <FaTimes className="mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedItems.size === 0 || submitting}
            className="flex-1 bg-gradient-to-r from-[#8AAA19] to-[#7a9617] hover:from-[#7a9617] hover:to-[#6b8514] text-white font-semibold shadow-lg"
          >
            <FaPaperPlane className="mr-2" />
            {submitting ? 'Enviando...' : `Enviar Reporte (${selectedItems.size})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
