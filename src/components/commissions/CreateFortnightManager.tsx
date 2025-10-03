'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FaPlus, FaCalendarCheck } from 'react-icons/fa';
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
            <div className="py-6 text-center bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-2">Período a gestionar:</p>
              <p className="font-bold text-xl text-[#010139]">
                {proposedPeriod.label}
              </p>
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