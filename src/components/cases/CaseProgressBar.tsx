'use client';

import { useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaCheck, FaClock } from 'react-icons/fa';
import { toast } from 'sonner';

interface CaseProgress {
  id: string;
  case_id: string;
  current_step_number: number;
  total_steps: number;
  step_name: string;
  step_started_at: string;
  step_completed_at?: string | null;
  notes?: string | null;
  updated_at: string;
}

interface CaseProgressBarProps {
  caseId: string;
  progress: CaseProgress | null;
  variant?: 'compact' | 'full';
  editable?: boolean; // Solo para Master
  onProgressUpdate?: () => void;
}

export default function CaseProgressBar({ 
  caseId, 
  progress, 
  variant = 'compact',
  editable = false,
  onProgressUpdate 
}: CaseProgressBarProps) {
  const [updating, setUpdating] = useState(false);

  if (!progress) {
    return (
      <div className="text-xs text-gray-500">
        Sin información de progreso
      </div>
    );
  }

  const percentage = Math.round((progress.current_step_number / progress.total_steps) * 100);
  const isCompleted = progress.current_step_number === progress.total_steps && progress.step_completed_at;

  const handleAdvance = async (action: 'next' | 'previous') => {
    if (!editable) return;

    setUpdating(true);
    try {
      const res = await fetch('/api/cases/progress', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          case_id: caseId,
          action,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Paso ${action === 'next' ? 'avanzado' : 'retrocedido'}`);
        onProgressUpdate?.();
      } else {
        toast.error(data.error || 'Error al actualizar progreso');
      }
    } catch (error) {
      console.error('Error updating progress:', error);
      toast.error('Error al actualizar progreso');
    } finally {
      setUpdating(false);
    }
  };

  const getDaysElapsed = () => {
    const start = new Date(progress.step_started_at);
    const now = new Date();
    const diff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-3">
        {/* Barra de progreso */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-semibold ${
              isCompleted ? 'text-green-600' : 'text-[#010139]'
            }`}>
              {progress.current_step_number}/{progress.total_steps} pasos
            </span>
            <span className="text-xs text-gray-500">
              {percentage}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isCompleted 
                  ? 'bg-green-500' 
                  : 'bg-gradient-to-r from-[#8AAA19] to-[#7a9916]'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1 truncate">
            {isCompleted ? '✓ Completado' : progress.step_name}
          </p>
        </div>

        {/* Controles (solo si es editable) */}
        {editable && !isCompleted && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAdvance('previous')}
              disabled={updating || progress.current_step_number === 1}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Paso anterior"
            >
              <FaChevronLeft size={12} />
            </button>
            <button
              onClick={() => handleAdvance('next')}
              disabled={updating || progress.current_step_number === progress.total_steps}
              className="p-1.5 text-[#8AAA19] hover:bg-green-50 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              title="Siguiente paso"
            >
              <FaChevronRight size={12} />
            </button>
          </div>
        )}
      </div>
    );
  }

  // Variant === 'full'
  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[#010139] flex items-center gap-2">
            {isCompleted ? (
              <>
                <FaCheck className="text-green-600" />
                Proceso Completado
              </>
            ) : (
              <>
                <FaClock className="text-[#8AAA19]" />
                En Progreso
              </>
            )}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Paso {progress.current_step_number} de {progress.total_steps} • {percentage}% completado
          </p>
        </div>

        {editable && !isCompleted && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdvance('previous')}
              disabled={updating || progress.current_step_number === 1}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold"
            >
              <FaChevronLeft size={12} />
              Anterior
            </button>
            <button
              onClick={() => handleAdvance('next')}
              disabled={updating || progress.current_step_number === progress.total_steps}
              className="px-3 py-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-semibold"
            >
              Siguiente
              <FaChevronRight size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Barra de progreso grande */}
      <div>
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCompleted 
                ? 'bg-gradient-to-r from-green-500 to-green-600' 
                : 'bg-gradient-to-r from-[#8AAA19] to-[#7a9916]'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Paso actual */}
      <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-bold text-blue-900">
              {isCompleted ? 'Proceso completado' : `Paso actual: ${progress.step_name}`}
            </p>
            <p className="text-xs text-blue-700 mt-1">
              {isCompleted 
                ? `Finalizado hace ${getDaysElapsed()} días`
                : `En proceso desde hace ${getDaysElapsed()} día${getDaysElapsed() !== 1 ? 's' : ''}`
              }
            </p>
            {progress.notes && (
              <p className="text-xs text-blue-600 mt-2 italic">
                Nota: {progress.notes}
              </p>
            )}
          </div>
          {isCompleted && (
            <FaCheck className="text-3xl text-green-600" />
          )}
        </div>
      </div>

      {/* Lista de pasos (opcional - solo si hay pasos configurados) */}
      {/* Esto se puede expandir para mostrar todos los pasos del workflow */}
    </div>
  );
}
