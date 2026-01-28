'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actionUpdateAdvance, actionDeleteAdvance, actionCheckAdvanceHasHistory, actionUpdateAdvanceRecurrence } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaTimes, FaCalendarAlt } from 'react-icons/fa';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FaMoneyBillWave, FaDollarSign, FaFileAlt, FaTrash, FaExclamationTriangle } from 'react-icons/fa';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const EditAdvanceSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  reason: z.string().min(3, 'La razón es requerida'),
  fortnight_type: z.enum(['Q1', 'Q2', 'BOTH']).optional(),
  end_date: z.string().optional(),
});

type EditAdvanceForm = z.infer<typeof EditAdvanceSchema>;

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
  brokers: { id: string; name: string | null } | null;
  is_recurring?: boolean;
  recurrence_id?: string | null;
  fortnight_type?: 'Q1' | 'Q2' | 'BOTH' | null;
  end_date?: string | null;
}

interface Props {
  advance: Advance | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditAdvanceModal({ advance, onClose, onSuccess }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [hasPaymentHistory, setHasPaymentHistory] = useState<boolean>(false);
  
  const form = useForm<EditAdvanceForm>({
    resolver: zodResolver(EditAdvanceSchema),
    defaultValues: {
      amount: advance?.amount || 0,
      reason: advance?.reason || '',
    },
  });

  useEffect(() => {
    if (advance) {
      form.reset({
        amount: advance.amount,
        reason: advance.reason || '',
        fortnight_type: advance.fortnight_type || undefined,
        end_date: advance.end_date || '',
      });
      
      // Verificar si el adelanto tiene historial de pagos
      const checkHistory = async () => {
        const result = await actionCheckAdvanceHasHistory(advance.id);
        if (result.ok) {
          setHasPaymentHistory(result.hasHistory);
        }
      };
      checkHistory();
    }
  }, [advance, form]);

  const onSubmit = async (values: EditAdvanceForm) => {
    if (!advance) return;

    // Si es recurrente, actualizar la recurrencia
    if (advance.is_recurring && advance.recurrence_id) {
      const payload: any = {
        amount: values.amount,
        reason: values.reason,
      };

      // Solo incluir campos de recurrencia si fueron proporcionados
      if (values.fortnight_type) {
        payload.fortnight_type = values.fortnight_type;
      }
      if (values.end_date !== undefined) {
        payload.end_date = values.end_date || null;
      }

      const result = await actionUpdateAdvanceRecurrence(advance.recurrence_id, payload);
      if (result.ok) {
        toast.success('Adelanto recurrente actualizado', {
          description: 'Los cambios se aplicarán a partir de la próxima quincena'
        });
        onSuccess();
        onClose();
      } else {
        toast.error('Error al actualizar', { description: result.error });
      }
    } else {
      // Adelanto normal (no recurrente)
      const result = await actionUpdateAdvance(advance.id, {
        amount: values.amount,
        reason: values.reason
      });
      if (result.ok) {
        toast.success('Adelanto actualizado exitosamente');
        onSuccess();
        onClose();
      } else {
        toast.error('Error al actualizar el adelanto', { description: result.error });
      }
    }
  };

  const handleDelete = async () => {
    if (!advance) return;
    
    setIsDeleting(true);
    try {
      const result = await actionDeleteAdvance(advance.id);
      if (result.ok) {
        toast.success(result.message || 'Adelanto eliminado');
        onSuccess();
        onClose();
      } else {
        toast.error('No se pudo eliminar', { 
          description: result.error,
          duration: 6000 
        });
      }
    } catch (error) {
      toast.error('Error inesperado al eliminar');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!advance) return null;

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-[500px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">
              <FaMoneyBillWave className="inline mr-2" />
              Editar Adelanto
            </h2>
            <p className="standard-modal-subtitle">
              Modifica los detalles del adelanto de {advance.brokers?.name || 'corredor'}
            </p>
            {advance.is_recurring && (
              <div className="mt-2 p-2 bg-purple-100/20 border border-purple-300/30 rounded-lg">
                <p className="text-xs text-white flex items-center gap-2">
                  <span>🔁</span>
                  <span>Este adelanto es parte de una recurrencia activa</span>
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
            <form id="edit-advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
              {/* Monto */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <FaDollarSign className="text-[#8AAA19]" />
                      Monto
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                        <Input 
                          type="number" 
                          placeholder="0.00" 
                          step="0.01" 
                          className="pl-8 border-2 border-gray-300 focus:border-[#8AAA19] h-10 font-mono text-base"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Razón */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <FaFileAlt className="text-[#010139]" />
                      Razón o Motivo
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Adelanto de comisiones" 
                        className="border-2 border-gray-300 focus:border-[#8AAA19] h-10"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Campos adicionales para recurrentes */}
              {advance.is_recurring && advance.recurrence_id && (
                <>
                  <div className="p-2.5 bg-purple-50 border-2 border-purple-200 rounded-lg">
                    <p className="text-xs font-semibold text-purple-900 mb-1">🔁 Configuración de Recurrencia</p>
                    <p className="text-xs text-purple-700">
                      Edita aquí la configuración que se aplicará a todas las futuras quincenas.
                    </p>
                  </div>

                  {/* Tipo de Quincena */}
                  <FormField
                    control={form.control}
                    name="fortnight_type"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                          <FaCalendarAlt className="text-purple-600" />
                          ¿En qué quincena(s) se aplicará?
                        </FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 border-2 border-gray-300 focus:border-[#8AAA19]">
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
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  {/* Fecha de Fin */}
                  <FormField
                    control={form.control}
                    name="end_date"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel className="text-sm font-semibold text-gray-700">
                          Fecha de Finalización (Opcional)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            className="h-10 border-2 border-gray-300 focus:border-[#8AAA19]"
                          />
                        </FormControl>
                        <p className="text-xs text-gray-500">
                          Dejar vacío para que sea indefinido
                        </p>
                        <FormMessage className="text-xs" />
                      </FormItem>
                    )}
                  />

                  <div className="p-2.5 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-900">
                      <span className="font-semibold">ℹ️ Nota:</span> Los cambios se aplicarán a partir de la próxima quincena. Los adelantos ya generados no se modificarán.
                    </p>
                  </div>
                </>
              )}
            </form>
          </Form>
          
          {/* Confirmación de eliminación */}
          {showDeleteConfirm && (
            <div className="mt-3 p-2.5 bg-red-50 border-l-4 border-red-500 rounded-lg">
              <div className="flex items-start gap-2">
                <FaExclamationTriangle className="text-red-600 text-lg flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-900 text-sm mb-1">¿Eliminar esta deuda?</p>
                  <p className="text-xs text-red-800 leading-relaxed">
                    {advance?.is_recurring 
                      ? 'Este adelanto recurrente se reseteará a su monto original y permanecerá activo con su historial de pagos. '
                      : 'Se eliminará permanentemente. '}
                    {!advance?.is_recurring && hasPaymentHistory 
                      ? 'Como tiene historial de pagos, se moverá a "Deudas Saldadas".'
                      : !advance?.is_recurring ? 'Como NO tiene historial de pagos, se eliminará por completo.' : ''}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="standard-modal-footer">
          <div className="flex gap-2 w-full justify-end">
            {!showDeleteConfirm ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={form.formState.isSubmitting || isDeleting}
                  className="px-3 py-1.5 border-2 border-red-400 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-500 font-medium transition text-sm flex items-center gap-1.5"
                >
                  <FaTrash className="text-sm" />
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={form.formState.isSubmitting || isDeleting}
                  className="px-4 py-1.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="edit-advance-form"
                  disabled={form.formState.isSubmitting || isDeleting}
                  className="px-4 py-1.5 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <FaMoneyBillWave className="text-white" />
                      <span>Guardar</span>
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-1.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <FaExclamationTriangle className="text-white" />
                      <span>Sí, Eliminar</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
