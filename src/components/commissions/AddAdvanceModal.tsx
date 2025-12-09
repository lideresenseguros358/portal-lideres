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
import { FaTimes } from 'react-icons/fa';
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
import { FaMoneyBillWave, FaUser, FaDollarSign, FaFileAlt, FaCalendarAlt, FaCog, FaInfinity, FaStopCircle } from 'react-icons/fa';
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
  const [fortnightType, setFortnightType] = useState<'Q1' | 'Q2' | 'BOTH'>('Q1');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  
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
        fortnight_type: fortnightType,
        end_date: hasEndDate && endDate ? endDate : null,
      });
      if (result.ok) {
        const adelantosCreados = fortnightType === 'BOTH' ? 2 : 1;
        const descriptionText = fortnightType === 'BOTH'
          ? 'Se han creado 2 adelantos (Q1 y Q2) y se generarán automáticamente cada mes.'
          : 'Se ha creado el primer adelanto y se generará automáticamente cada mes.';
        
        toast.success('Adelanto recurrente creado exitosamente', { 
          description: descriptionText
        });
        onSuccess();
        form.reset();
        setIsRecurrent(false);
        setHasEndDate(false);
        setEndDate('');
        setFortnightType('Q1');
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

  if (!isOpen) return null;

  return (
    <>
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
                Nuevo Adelanto
              </h2>
              <p className="standard-modal-subtitle">
                Registra un adelanto de comisión para un corredor
              </p>
            </div>
            <button onClick={onClose} className="standard-modal-close" type="button">
              <FaTimes size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="standard-modal-content">
            <Form {...form}>
              <form id="advance-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            {/* Corredor */}
            <FormField
              control={form.control}
              name="broker_id"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <FaUser className="text-[#010139]" />
                    Corredor
                  </FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <SelectTrigger className="border-2 border-gray-300 focus:border-[#8AAA19] h-10">
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
                <FormItem className="space-y-1">
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

            {/* Adelanto Recurrente */}
            <div className="border-t border-gray-200 pt-2 mt-2">
              <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200">
                <div className="flex items-center gap-2">
                  <FaCalendarAlt className="text-blue-600 text-lg" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">Adelanto Recurrente</p>
                    <p className="text-xs text-gray-600">Se crea ahora y se repetirá automáticamente cada mes</p>
                  </div>
                </div>
                <Checkbox
                  checked={isRecurrent}
                  onCheckedChange={(checked) => {
                    setIsRecurrent(checked as boolean);
                    if (!checked) {
                      setHasEndDate(false);
                      setEndDate('');
                      setFortnightType('Q1');
                    }
                  }}
                  className="data-[state=checked]:bg-[#8AAA19] data-[state=checked]:border-[#8AAA19]"
                />
              </div>

              {/* Configuración de Recurrencia */}
              {isRecurrent && (
                <div className="mt-2 p-2.5 bg-gray-50 rounded-lg border border-gray-300 space-y-2.5">
                  {/* Quincena */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      ¿En qué quincena se debe aplicar?
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setFortnightType('Q1')}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          fortnightType === 'Q1'
                            ? 'bg-[#8AAA19] border-[#8AAA19] text-white shadow-md'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-[#8AAA19]'
                        }`}
                      >
                        <div className="font-bold text-sm">Primera</div>
                        <div className="text-xs opacity-90">Días 1-15</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFortnightType('Q2')}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          fortnightType === 'Q2'
                            ? 'bg-[#8AAA19] border-[#8AAA19] text-white shadow-md'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-[#8AAA19]'
                        }`}
                      >
                        <div className="font-bold text-sm">Segunda</div>
                        <div className="text-xs opacity-90">Días 16-fin</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFortnightType('BOTH')}
                        className={`p-2 rounded-lg border-2 transition-all ${
                          fortnightType === 'BOTH'
                            ? 'bg-[#8AAA19] border-[#8AAA19] text-white shadow-md'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-[#8AAA19]'
                        }`}
                      >
                        <div className="font-bold text-sm">Ambas</div>
                        <div className="text-xs opacity-90">2 veces/mes</div>
                      </button>
                    </div>
                  </div>

                  {/* Fecha de Vencimiento */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Duración de la Recurrencia
                    </label>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => setHasEndDate(false)}
                        className={`w-full p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                          !hasEndDate
                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
                        }`}
                      >
                        <FaInfinity className={!hasEndDate ? 'text-blue-600' : 'text-gray-500'} />
                        <div className="text-left">
                          <div className="font-semibold text-sm">Recurrencia Infinita</div>
                          <div className="text-xs opacity-75">Se generará indefinidamente hasta que lo desactives</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasEndDate(true)}
                        className={`w-full p-2.5 rounded-lg border-2 transition-all flex items-center gap-2 ${
                          hasEndDate
                            ? 'bg-blue-50 border-blue-500 text-blue-900'
                            : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500'
                        }`}
                      >
                        <FaStopCircle className={hasEndDate ? 'text-blue-600' : 'text-gray-500'} />
                        <div className="text-left">
                          <div className="font-semibold text-sm">Con Fecha de Vencimiento</div>
                          <div className="text-xs opacity-75">Especifica hasta cuándo debe aplicarse</div>
                        </div>
                      </button>
                    </div>
                    {hasEndDate && (
                      <div className="mt-2">
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="border-2 border-blue-300 focus:border-blue-500 h-11"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Botón para gestionar recurrencias */}
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRecurrencesManager(true)}
                className="w-full mt-2 border-2 border-gray-300 hover:border-[#010139] hover:bg-gray-50 text-sm h-10"
              >
                <FaCog className="mr-2" />
                Gestionar Adelantos Recurrentes
              </Button>
            </div>
              </form>
            </Form>
          </div>

          {/* Footer */}
          <div className="standard-modal-footer">
            <div className="flex gap-2 w-full sm:w-auto flex-1 sm:flex-none">
              <button
                type="button"
                onClick={onClose}
                disabled={form.formState.isSubmitting}
                className="standard-modal-button-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="advance-form"
                disabled={form.formState.isSubmitting}
                className="standard-modal-button-primary"
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
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de gestión de recurrencias */}
      <RecurrencesManagerModal
        isOpen={showRecurrencesManager}
        onClose={() => setShowRecurrencesManager(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}