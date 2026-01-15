'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FaPlus, FaCalendarCheck, FaEdit } from 'react-icons/fa';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { actionCreateDraftFortnight } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';

interface Props {
  onFortnightCreated: (fortnight: any) => void;
}

interface FortnightPeriod {
  period_start: Date;
  period_end: Date;
  label: string;
  canCreate: boolean;
}

const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function CreateFortnightManager({ onFortnightCreated }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [proposedPeriod, setProposedPeriod] = useState<FortnightPeriod | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditingPeriod, setIsEditingPeriod] = useState(false);

  const getNextFortnightPeriod = (): FortnightPeriod => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    // Lógica actualizada según especificación:
    // Si estoy el 1 de octubre, debo crear Sep 16-30
    // Si estoy el 16+ de octubre, debo crear Oct 1-15
    
    if (day <= 15) {
      // Estamos en la primera quincena, creamos la Q2 del mes anterior
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const lastDay = new Date(year, month, 0).getDate(); // Último día del mes anterior
      
      return {
        period_start: new Date(prevYear, prevMonth, 16),
        period_end: new Date(prevYear, prevMonth, lastDay),
        label: `del 16 al ${lastDay} de ${months[prevMonth]} ${prevYear}`,
        canCreate: true // Ya pasó el período
      };
    } else {
      // Estamos en la segunda quincena, creamos la Q1 del mes actual
      return {
        period_start: new Date(year, month, 1),
        period_end: new Date(year, month, 15),
        label: `del 1 al 15 de ${months[month]} ${year}`,
        canCreate: true // Ya estamos en día 16+
      };
    }
  };

  const handleOpenModal = () => {
    const period = getNextFortnightPeriod();
    
    if (!period.canCreate) {
      setError(`Aún no puede crear esta quincena. Debe esperar hasta el día 16.`);
      return;
    }
    
    setProposedPeriod(period);
    setIsModalOpen(true);
    setError(null);
    setIsEditingPeriod(false);
  };

  const handleEditPeriod = () => {
    setIsEditingPeriod(true);
  };

  const handleCancelEdit = () => {
    setIsEditingPeriod(false);
    // Restaurar al período sugerido original
    const period = getNextFortnightPeriod();
    setProposedPeriod(period);
  };

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    if (!proposedPeriod) return;
    
    const newDate = new Date(value);
    if (isNaN(newDate.getTime())) return;
    
    let newStart = proposedPeriod.period_start;
    let newEnd = proposedPeriod.period_end;
    
    if (field === 'start') {
      newStart = newDate;
    } else {
      newEnd = newDate;
    }
    
    // Generar label actualizado
    const startDay = newStart.getDate();
    const endDay = newEnd.getDate();
    const month = months[newEnd.getMonth()];
    const year = newEnd.getFullYear();
    
    setProposedPeriod({
      period_start: newStart,
      period_end: newEnd,
      label: `del ${startDay} al ${endDay} de ${month} ${year}`,
      canCreate: true
    });
  };

  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleConfirmCreate = async () => {
    if (!proposedPeriod) {
      console.error('No proposed period');
      return;
    }
    
    setIsCreating(true);
    try {
      // Format dates as YYYY-MM-DD as expected by the schema
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      
      const payload = {
        period_start: formatDate(proposedPeriod.period_start),
        period_end: formatDate(proposedPeriod.period_end),
      };
      
      console.log('Creating fortnight with payload:', payload);
      const result = await actionCreateDraftFortnight(payload);

      console.log('Create result:', result);
      
      if (result.ok && result.data) {
        toast.success('Quincena en borrador creada exitosamente');
        onFortnightCreated(result.data);
        setIsModalOpen(false);
      } else {
        toast.error('Error al crear la quincena', { 
          description: result.error || 'Intente nuevamente' 
        });
      }
    } catch (err) {
      console.error('Error creating fortnight:', err);
      toast.error('Error inesperado al crear la quincena');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Card className="shadow-lg border-2 border-dashed border-gray-300 hover:border-[#010139] transition-colors">
        <CardHeader className="text-center">
          <FaCalendarCheck className="text-6xl text-gray-400 mx-auto mb-4" />
          <CardTitle className="text-xl text-gray-700">No hay quincena en borrador</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Para comenzar a gestionar comisiones, debe crear una nueva quincena.
          </p>
          <Button 
            onClick={handleOpenModal}
            className="bg-[#010139] hover:bg-[#8AAA19] text-white transition-colors"
            size="lg"
          >
            <FaPlus className="mr-2 h-4 w-4" />
            Crear Nueva Quincena
          </Button>
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md max-w-md mx-auto">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-[#010139] text-xl">Abrir Borrador de Quincena</DialogTitle>
            <DialogDescription className="text-base">
              ¿Desea abrir el borrador de la siguiente quincena?
            </DialogDescription>
          </DialogHeader>
          
          {proposedPeriod && (
            <div className="space-y-4">
              {!isEditingPeriod ? (
                <div className="py-6 text-center bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                  <p className="text-sm text-gray-600 mb-2">Período a gestionar:</p>
                  <p className="font-bold text-xl text-[#010139] mb-3">
                    {proposedPeriod.label}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEditPeriod}
                    className="text-[#010139] hover:bg-[#010139] hover:text-white"
                  >
                    <FaEdit className="mr-2 h-3 w-3" />
                    Editar Período
                  </Button>
                </div>
              ) : (
                <div className="py-6 px-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-2 border-[#010139]">
                  <p className="text-sm text-[#010139] font-semibold mb-4 text-center">Editar Período</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha Inicio
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(proposedPeriod.period_start)}
                        onChange={(e) => handleDateChange('start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#010139]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha Fin
                      </label>
                      <input
                        type="date"
                        value={formatDateForInput(proposedPeriod.period_end)}
                        onChange={(e) => handleDateChange('end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#010139]"
                      />
                    </div>
                    <div className="pt-2 text-center">
                      <p className="text-sm text-gray-600 mb-1">Período resultante:</p>
                      <p className="font-bold text-lg text-[#010139]">
                        {proposedPeriod.label}
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setIsEditingPeriod(false)}
                        className="flex-1 bg-[#8AAA19] hover:bg-[#010139] text-white"
                      >
                        Aplicar
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsModalOpen(false)} 
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirmCreate} 
              disabled={isCreating}
              className="bg-[#010139] hover:bg-[#8AAA19] text-white"
            >
              {isCreating ? 'Creando...' : 'Confirmar y Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}