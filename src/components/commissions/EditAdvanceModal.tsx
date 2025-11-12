'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actionUpdateAdvance } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FaMoneyBillWave, FaDollarSign, FaFileAlt } from 'react-icons/fa';

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

  if (!advance) return null;

  return (
    <Dialog open={!!advance} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header con gradiente corporativo */}
        <DialogHeader className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 pb-8 flex-shrink-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/10 rounded-lg">
              <FaMoneyBillWave className="text-2xl" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white">Editar Adelanto</DialogTitle>
              <DialogDescription className="text-gray-200 mt-1">
                Modifica los detalles del adelanto de {advance.brokers?.name || 'corredor'}
              </DialogDescription>
            </div>
          </div>
          {advance.is_recurring && (
            <div className="mt-3 p-2 bg-purple-100/20 border border-purple-300/30 rounded-lg">
              <p className="text-xs text-white flex items-center gap-2">
                <span>🔁</span>
                <span>Este adelanto es parte de una recurrencia activa</span>
              </p>
            </div>
          )}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="overflow-y-auto flex-1">
            <div className="p-6 space-y-6">
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
                <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="text-amber-600 text-xl">⚠️</div>
                    <div className="text-sm text-gray-700">
                      <p className="font-semibold text-amber-800 mb-1">Nota sobre adelantos recurrentes</p>
                      <p className="text-xs">
                        Los cambios solo afectarán este adelanto específico. Para modificar todos los adelantos futuros,
                        edita la configuración en "Gestionar Adelantos Recurrentes".
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer con botones */}
            <DialogFooter className="gap-3 sm:gap-2 pt-4 border-t border-gray-200 flex-shrink-0 px-6 pb-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose} 
                disabled={form.formState.isSubmitting}
                className="border-2 border-gray-300 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={form.formState.isSubmitting}
                className="bg-gradient-to-r from-[#8AAA19] to-[#6d8814] hover:from-[#6d8814] hover:to-[#8AAA19] text-white shadow-lg transition-all duration-200"
              >
                {form.formState.isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Actualizando...
                  </>
                ) : (
                  <>
                    <FaMoneyBillWave className="mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
