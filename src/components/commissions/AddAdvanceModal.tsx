'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actionAddAdvance, actionCreateAdvanceRecurrence } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { FaMoneyBillWave, FaUser, FaDollarSign, FaFileAlt, FaCalendarAlt, FaCog } from 'react-icons/fa';
import { RecurrencesManagerModal } from './RecurrencesManagerModal';

const AddAdvanceSchema = z.object({
  broker_id: z.string().min(1, 'Debe seleccionar un corredor'),
  amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
  reason: z.string().min(3, 'La razón es requerida'),
});

type AddAdvanceForm = z.infer<typeof AddAdvanceSchema>;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  brokers: { id: string; name: string }[];
}

export function AddAdvanceModal({ isOpen, onClose, onSuccess, brokers }: Props) {
  const [isRecurrent, setIsRecurrent] = useState(false);
  const [showRecurrencesManager, setShowRecurrencesManager] = useState(false);
  
  const form = useForm<AddAdvanceForm>({
    resolver: zodResolver(AddAdvanceSchema),
    defaultValues: {
      broker_id: '',
      amount: undefined,
      reason: '',
    },
  });

  const onSubmit = async (values: AddAdvanceForm) => {
    if (isRecurrent) {
      // Crear recurrencia
      const result = await actionCreateAdvanceRecurrence({
        broker_id: values.broker_id,
        amount: values.amount,
        reason: values.reason,
      });
      if (result.ok) {
        toast.success('Adelanto recurrente creado. Se generará automáticamente cada mes.');
        onSuccess();
        form.reset();
        setIsRecurrent(false);
        onClose();
      } else {
        toast.error('Error al crear recurrencia.', { description: result.error });
      }
    } else {
      // Crear adelanto único
      const result = await actionAddAdvance(values.broker_id, values);
      if (result.ok) {
        toast.success('Adelanto agregado exitosamente.');
        onSuccess();
        form.reset();
        onClose();
      } else {
        toast.error('Error al agregar el adelanto.', { description: result.error });
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden">
        {/* Header con gradiente corporativo */}
        <DialogHeader className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/10 rounded-lg">
              <FaMoneyBillWave className="text-2xl" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white">Nuevo Adelanto</DialogTitle>
              <DialogDescription className="text-gray-200 mt-1">
                Registra un adelanto de comisión para un corredor
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Corredor */}
            <FormField
              control={form.control}
              name="broker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FaUser className="text-[#010139]" />
                    Corredor
                  </FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="border-2 border-gray-300 focus:border-[#8AAA19] h-11">
                        <SelectValue placeholder="Seleccione un corredor" />
                      </SelectTrigger>
                      <SelectContent>
                        {brokers.map(broker => (
                          <SelectItem key={broker.id} value={broker.id}>
                            {broker.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

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

            {/* Adelanto Recurrente */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-3">
                  <FaCalendarAlt className="text-blue-600 text-xl" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Adelanto Recurrente</p>
                    <p className="text-xs text-gray-600">Se creará automáticamente cada mes</p>
                  </div>
                </div>
                <Checkbox
                  checked={isRecurrent}
                  onCheckedChange={(checked) => setIsRecurrent(checked as boolean)}
                  className="data-[state=checked]:bg-[#8AAA19] data-[state=checked]:border-[#8AAA19]"
                />
              </div>

              {/* Botón para gestionar recurrencias */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRecurrencesManager(true)}
                className="w-full mt-3 border-2 border-gray-300 hover:border-[#010139] hover:bg-gray-50"
              >
                <FaCog className="mr-2" />
                Gestionar Adelantos Recurrentes
              </Button>
            </div>

            {/* Footer con botones */}
            <DialogFooter className="gap-3 sm:gap-2 pt-4 border-t border-gray-200">
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
                    {isRecurrent ? 'Creando recurrencia...' : 'Agregando...'}
                  </>
                ) : (
                  <>
                    {isRecurrent ? <FaCalendarAlt className="mr-2" /> : <FaMoneyBillWave className="mr-2" />}
                    {isRecurrent ? 'Crear Recurrencia' : 'Agregar Adelanto'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Modal de gestión de recurrencias */}
      <RecurrencesManagerModal
        isOpen={showRecurrencesManager}
        onClose={() => setShowRecurrencesManager(false)}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}