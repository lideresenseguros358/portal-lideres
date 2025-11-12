'use client';

import { useState, useEffect } from 'react';
import {
  actionGetAdvanceRecurrences,
  actionUpdateAdvanceRecurrence,
  actionDeleteAdvanceRecurrence,
} from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FaEdit, FaTrash, FaSave, FaTimes, FaToggleOn, FaToggleOff } from 'react-icons/fa';

interface Recurrence {
  id: string;
  amount: number;
  reason: string;
  is_active: boolean;
  broker_id: string;
  brokers: { id: string; name: string } | null;
  fortnight_type: 'Q1' | 'Q2' | 'BOTH';
  end_date: string | null;
  recurrence_count: number;
  last_generated_at: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RecurrencesManagerModal({ isOpen, onClose, onSuccess }: Props) {
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', reason: '' });

  useEffect(() => {
    if (isOpen) {
      loadRecurrences();
    }
  }, [isOpen]);

  const loadRecurrences = async () => {
    setLoading(true);
    const result = await actionGetAdvanceRecurrences();
    if (result.ok) {
      setRecurrences(result.data as Recurrence[]);
    } else {
      toast.error('Error al cargar recurrencias');
    }
    setLoading(false);
  };

  const handleEdit = (recurrence: Recurrence) => {
    setEditingId(recurrence.id);
    setEditForm({ amount: recurrence.amount.toString(), reason: recurrence.reason });
  };

  const handleSaveEdit = async (id: string) => {
    const amount = parseFloat(editForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }
    if (!editForm.reason.trim()) {
      toast.error('El motivo es requerido');
      return;
    }

    const result = await actionUpdateAdvanceRecurrence(id, {
      amount,
      reason: editForm.reason,
    });

    if (result.ok) {
      toast.success('Recurrencia actualizada');
      setEditingId(null);
      loadRecurrences();
      onSuccess();
    } else {
      toast.error('Error al actualizar');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    const result = await actionUpdateAdvanceRecurrence(id, { is_active: !isActive });
    if (result.ok) {
      toast.success(isActive ? 'Recurrencia pausada' : 'Recurrencia activada');
      loadRecurrences();
      onSuccess();
    } else {
      toast.error('Error al cambiar estado');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta recurrencia?')) return;

    const result = await actionDeleteAdvanceRecurrence(id);
    if (result.ok) {
      toast.success('Recurrencia eliminada');
      loadRecurrences();
      onSuccess();
    } else {
      toast.error('Error al eliminar');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-[#010139]">
            Gestionar Adelantos Recurrentes
          </DialogTitle>
          <DialogDescription>
            Adelantos que se crean automáticamente cada mes
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
            </div>
          ) : recurrences.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No hay adelantos recurrentes configurados
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Corredor</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-center">Quincena</TableHead>
                  <TableHead className="text-center">Vencimiento</TableHead>
                  <TableHead className="text-center">Generaciones</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurrences.map((rec) => (
                  <TableRow key={rec.id}>
                    <TableCell className="font-medium">
                      {rec.brokers?.name || 'Sin nombre'}
                    </TableCell>
                    <TableCell>
                      {editingId === rec.id ? (
                        <Input
                          value={editForm.reason}
                          onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                          className="text-sm"
                        />
                      ) : (
                        rec.reason
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {editingId === rec.id ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                          className="text-right text-sm"
                        />
                      ) : (
                        `$${rec.amount.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        rec.fortnight_type === 'Q1'
                          ? 'bg-blue-100 text-blue-800'
                          : rec.fortnight_type === 'Q2'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {rec.fortnight_type === 'Q1' ? 'Q1 (1-15)' : rec.fortnight_type === 'Q2' ? 'Q2 (16-fin)' : 'AMBAS (2x/mes)'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-sm">
                      {rec.end_date ? (
                        <span className="text-amber-700 font-medium">
                          {new Date(rec.end_date).toLocaleDateString('es-PA')}
                        </span>
                      ) : (
                        <span className="text-gray-500 italic">∞ Infinita</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className="text-lg font-bold text-[#010139]">{rec.recurrence_count}</span>
                        {rec.last_generated_at && (
                          <span className="text-xs text-gray-500">
                            Última: {new Date(rec.last_generated_at).toLocaleDateString('es-PA')}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(rec.id, rec.is_active)}
                        className={rec.is_active ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-500'}
                      >
                        {rec.is_active ? <FaToggleOn className="text-2xl" /> : <FaToggleOff className="text-2xl" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        {editingId === rec.id ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleSaveEdit(rec.id)}
                              className="hover:bg-green-100 hover:text-green-700"
                            >
                              <FaSave />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingId(null)}
                              className="hover:bg-gray-100"
                            >
                              <FaTimes />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(rec)}
                              className="hover:bg-blue-100 hover:text-blue-700"
                            >
                              <FaEdit />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(rec.id)}
                              className="hover:bg-red-100 hover:text-red-700"
                            >
                              <FaTrash />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="flex-shrink-0 flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
