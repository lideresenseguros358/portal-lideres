'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actionUpdateAdvance, actionDeleteAdvance, actionCheckAdvanceHasHistory } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FaTimes } from 'react-icons/fa';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FaMoneyBillWave, FaDollarSign, FaFileAlt, FaTrash, FaExclamationTriangle } from 'react-icons/fa';

const EditAdvanceSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  reason: z.string().min(3, 'La razón es requerida'),
});

type EditAdvanceForm = z.infer<typeof EditAdvanceSchema>;

interface Advance {
  id: string;
  amount: number;
  reason: string | null;
  brokers: { id: string; name: string | null } | null;
  is_recurring?: boolean;
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

    const result = await actionUpdateAdvance(advance.id, values);
    if (result.ok) {
      toast.success('Adelanto actualizado exitosamente');
      onSuccess();
      onClose();
    } else {
      toast.error('Error al actualizar el adelanto', { description: result.error });
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
            <form id="edit-advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Monto */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
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
                          className="pl-8 border-2 border-gray-300 focus:border-[#8AAA19] h-11 font-mono text-lg"
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
                  <FormItem>
                    <FormLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <FaFileAlt className="text-[#010139]" />
                      Razón o Motivo
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej: Adelanto de comisiones" 
                        className="border-2 border-gray-300 focus:border-[#8AAA19] h-11"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />

              {/* Info sobre recurrencia */}
              {advance.is_recurring && (
                <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="text-amber-600 text-lg flex-shrink-0">⚠️</div>
                    <div className="text-xs text-gray-700">
                      <p className="font-semibold text-amber-800 mb-0.5">Nota sobre adelantos recurrentes</p>
                      <p className="text-xs">
                        Los cambios solo afectarán este adelanto específico. Para modificar todos los adelantos futuros,
                        edita la configuración en "Gestionar Adelantos Recurrentes".
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>
          </Form>
          
          {/* Confirmación de eliminación */}
          {showDeleteConfirm && (
            <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg">
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
          {!showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={form.formState.isSubmitting || isDeleting}
              className="px-3 py-2 border-2 border-red-400 text-red-700 rounded-lg hover:bg-red-50 hover:border-red-500 font-medium transition text-sm flex items-center gap-1.5"
            >
              <FaTrash className="text-sm" />
              Eliminar
            </button>
          )}
          {showDeleteConfirm && <div></div>}
          
          <div className="flex gap-2 w-full sm:w-auto flex-1 sm:flex-none">
            {!showDeleteConfirm ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={form.formState.isSubmitting || isDeleting}
                  className="standard-modal-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="edit-advance-form"
                  disabled={form.formState.isSubmitting || isDeleting}
                  className="standard-modal-button-primary"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <FaMoneyBillWave className="mr-2" />
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
                  className="standard-modal-button-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {isDeleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <FaExclamationTriangle className="text-sm" />
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
