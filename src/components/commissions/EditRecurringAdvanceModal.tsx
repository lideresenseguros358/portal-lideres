'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actionUpdateAdvanceRecurrence } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaTimes, FaCalendarAlt, FaMoneyBillWave, FaSave } from 'react-icons/fa';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EditRecurringSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  reason: z.string().min(3, 'La razón es requerida (mínimo 3 caracteres)'),
  fortnight_type: z.enum(['Q1', 'Q2', 'BOTH'], {
    required_error: 'Selecciona en qué quincena(s) se aplicará'
  }),
  end_date: z.string().optional(),
});

type EditRecurringForm = z.infer<typeof EditRecurringSchema>;

interface Recurrence {
  id: string;
  amount: number;
  reason: string;
  fortnight_type: 'Q1' | 'Q2' | 'BOTH';
  end_date: string | null;
  recurrence_count: number;
  broker_id: string;
  brokers?: { name: string | null };
}

interface Props {
  recurrence: Recurrence | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditRecurringAdvanceModal({ recurrence, onClose, onSuccess }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  
  const form = useForm<EditRecurringForm>({
    resolver: zodResolver(EditRecurringSchema),
    defaultValues: {
      amount: recurrence?.amount || 0,
      reason: recurrence?.reason || '',
      fortnight_type: recurrence?.fortnight_type || 'Q1',
      end_date: recurrence?.end_date || '',
    },
  });

  useEffect(() => {
    if (recurrence) {
      form.reset({
        amount: recurrence.amount,
        reason: recurrence.reason,
        fortnight_type: recurrence.fortnight_type,
        end_date: recurrence.end_date || '',
      });
    }
  }, [recurrence, form]);

  const onSubmit = async (values: EditRecurringForm) => {
    if (!recurrence) return;

    setIsSaving(true);
    try {
      const payload: any = {
        amount: values.amount,
        reason: values.reason,
        fortnight_type: values.fortnight_type,
      };

      // Solo incluir end_date si hay valor
      if (values.end_date && values.end_date.trim() !== '') {
        payload.end_date = values.end_date;
      } else {
        payload.end_date = null; // Indefinido
      }

      const result = await actionUpdateAdvanceRecurrence(recurrence.id, payload);
      
      if (result.ok) {
        toast.success('Adelanto recurrente actualizado exitosamente', {
          description: 'El histórico de aplicaciones se mantiene intacto'
        });
        onSuccess();
        onClose();
      } else {
        toast.error('Error al actualizar', { description: result.error });
      }
    } catch (error) {
      toast.error('Error inesperado al actualizar');
    } finally {
      setIsSaving(false);
    }
  };

  if (!recurrence) return null;

  const brokerName = recurrence.brokers?.name || 'corredor';

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-[600px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaCalendarAlt className="inline mr-2" />
              Editar Adelanto Recurrente
            </h2>
            <p className="standard-modal-subtitle">
              Modifica los detalles del adelanto recurrente de {brokerName}
            </p>
            {recurrence.recurrence_count > 0 && (
              <div className="mt-2 p-2 bg-blue-100/20 border border-blue-300/30 rounded-lg">
                <p className="text-xs text-white flex items-center gap-2">
                  <span>📊</span>
                  <span>Este adelanto ya se ha aplicado {recurrence.recurrence_count} {recurrence.recurrence_count === 1 ? 'vez' : 'veces'}. El histórico se mantendrá intacto.</span>
                </p>
              </div>
            )}
          </div>
          <button onClick={onClose} className="standard-modal-close" type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              
              {/* Monto */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-bold text-[#010139]">
                      <FaMoneyBillWave className="text-green-600" />
                      Monto a Descontar
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Ej: 100.00"
                        {...field}
                        className="h-11 text-base border-2 border-gray-300 focus:border-[#8AAA19]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Razón */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-[#010139]">
                      Motivo / Descripción
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Ej: Adelanto mensual acordado"
                        {...field}
                        className="h-11 text-base border-2 border-gray-300 focus:border-[#8AAA19]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tipo de Quincena */}
              <FormField
                control={form.control}
                name="fortnight_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-bold text-[#010139]">
                      <FaCalendarAlt className="text-purple-600" />
                      ¿En qué quincena(s) se aplicará?
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-11 text-base border-2 border-gray-300 focus:border-[#8AAA19]">
                          <SelectValue placeholder="Selecciona quincena..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Q1">
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">Primera Quincena (Q1)</span>
                            <span className="text-xs text-gray-500">Días 1-15 de cada mes</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="Q2">
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">Segunda Quincena (Q2)</span>
                            <span className="text-xs text-gray-500">Días 16-fin de cada mes</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="BOTH">
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">Ambas Quincenas (2x mes)</span>
                            <span className="text-xs text-gray-500">Se aplicará dos veces al mes</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Fecha de Fin (Opcional) */}
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-bold text-[#010139]">
                      Fecha de Finalización (Opcional)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        className="h-11 text-base border-2 border-gray-300 focus:border-[#8AAA19]"
                      />
                    </FormControl>
                    <p className="text-xs text-gray-500 mt-1">
                      Dejar vacío para que sea indefinido. Si especificas una fecha, el adelanto se detendrá automáticamente después de esa fecha.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Info Box */}
              <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <p className="text-xs text-amber-900 font-semibold mb-1">
                  ⚠️ Importante:
                </p>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li>• Los cambios se aplicarán a partir de la próxima quincena</li>
                  <li>• El histórico de aplicaciones anteriores se mantendrá sin cambios</li>
                  <li>• Los adelantos ya generados NO se modificarán</li>
                </ul>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 h-11"
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 bg-[#8AAA19] hover:bg-[#7a9916] text-white"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <FaSave className="mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
