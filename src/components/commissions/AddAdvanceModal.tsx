'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { actionAddAdvance } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const form = useForm<AddAdvanceForm>({
    resolver: zodResolver(AddAdvanceSchema),
    defaultValues: {
      broker_id: '',
      amount: undefined,
      reason: '',
    },
  });

  const onSubmit = async (values: AddAdvanceForm) => {
    const result = await actionAddAdvance(values.broker_id, values);
    if (result.ok) {
      toast.success('Adelanto agregado exitosamente.');
      onSuccess();
      form.reset();
      onClose();
    } else {
      toast.error('Error al agregar el adelanto.', { description: result.error });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Agregar Nuevo Adelanto</DialogTitle>
          <DialogDescription>Crea un nuevo adelanto para un corredor.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="broker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Corredor</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger><SelectValue placeholder="Seleccione un corredor" /></SelectTrigger>
                      <SelectContent>
                        {brokers.map(broker => (
                          <SelectItem key={broker.id} value={broker.id}>{broker.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="0.00" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Razón o Motivo</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Adelanto de comisiones" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={form.formState.isSubmitting}>Cancelar</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Agregando...' : 'Agregar Adelanto'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}