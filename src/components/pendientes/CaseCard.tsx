'use client';

/**
 * CASE CARD - Tarjeta Individual de Caso
 * =======================================
 * Card compacto estilo Monday para cada caso
 * - Info principal: ticket, estado, broker, aseguradora
 * - Badges de estado con colores
 * - Íconos indicadores (SLA vencido, sin clasificar, aplazado)
 * - Click para abrir modal de detalle
 * - Hover con info adicional
 */

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Calendar, Mail, FileText } from 'lucide-react';
import type { CasoPendiente, EstadoSimple } from '@/types/pendientes';
import { formatDatePanama } from '@/lib/timezone/time';

interface CaseCardProps {
  caso: CasoPendiente;
  onClick: () => void;
}

const ESTADO_COLORS: Record<EstadoSimple, string> = {
  'Nuevo': 'bg-blue-500 text-white',
  'Sin clasificar': 'bg-gray-500 text-white',
  'En proceso': 'bg-yellow-500 text-white',
  'Pendiente cliente': 'bg-orange-400 text-white',
  'Pendiente broker': 'bg-purple-500 text-white',
  'Enviado': 'bg-indigo-500 text-white',
  'Aplazado': 'bg-amber-600 text-white',
  'Cerrado aprobado': 'bg-green-600 text-white',
  'Cerrado rechazado': 'bg-red-600 text-white',
};

const RAMO_LABELS: Record<string, string> = {
  '01': 'Vida',
  '02': 'Salud',
  '03': 'Auto',
  '04': 'Hogar',
  '05': 'Empresarial',
  '06': 'AP',
  '07': 'Colectivos',
  '99': 'Otro',
};

export default function CaseCard({ caso, onClick }: CaseCardProps) {
  const isOverdue = caso.sla_due_date && new Date(caso.sla_due_date) < new Date();
  const isPaused = !!caso.sla_paused_at;
  
  return (
    <Card
      className="p-4 hover:shadow-lg transition-shadow cursor-pointer border-l-4"
      style={{ borderLeftColor: isOverdue ? '#ef4444' : '#8AAA19' }}
      onClick={onClick}
    >
      {/* Header con ticket y estado */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-[#010139] text-lg">
            {caso.ticket || '(sin ticket)'}
          </h3>
          <p className="text-xs text-gray-500">
            {caso.brokers?.name || 'Sin broker'}
          </p>
        </div>
        
        <Badge className={`${caso.estado_simple && ESTADO_COLORS[caso.estado_simple as EstadoSimple] ? ESTADO_COLORS[caso.estado_simple as EstadoSimple] : 'bg-gray-500 text-white'} text-xs font-semibold`}>
          {caso.estado_simple || 'Sin estado'}
        </Badge>
      </div>

      {/* Info principal */}
      <div className="space-y-2 text-sm">
        {/* Ramo y Tipo */}
        {caso.ramo_code && (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700">
              {caso.ramo_code || 'Sin ramo'}
            </span>
          </div>
        )}

        {/* SLA */}
        {caso.sla_due_date && (
          <div className="flex items-center gap-2">
            <Clock className={`w-4 h-4 ${isOverdue ? 'text-red-500' : isPaused ? 'text-yellow-500' : 'text-gray-400'}`} />
            <span className={isOverdue ? 'text-red-600 font-semibold' : 'text-gray-600'}>
              {isPaused && '⏸ '}
              {formatDatePanama(caso.sla_due_date, false)}
            </span>
          </div>
        )}

        {/* Correos vinculados */}
        {caso.emails_count && caso.emails_count > 0 && (
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">
              {caso.emails_count} {caso.emails_count === 1 ? 'correo' : 'correos'}
            </span>
          </div>
        )}
      </div>

      {/* Badges de alertas */}
      <div className="flex flex-wrap gap-2 mt-3">
        {caso.estado_simple === 'Sin clasificar' && (
          <Badge variant="outline" className="text-xs border-amber-500 text-amber-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            Requiere clasificación
          </Badge>
        )}
        
        {caso.aplazado_until && (
          <Badge variant="outline" className="text-xs border-purple-500 text-purple-700">
            <Calendar className="w-3 h-3 mr-1" />
            Hasta {formatDatePanama(caso.aplazado_until, false)}
          </Badge>
        )}
        
        {caso.ai_confidence !== null && caso.ai_confidence < 0.72 && (
          <Badge variant="outline" className="text-xs border-orange-500 text-orange-700">
            AI: {Math.round(caso.ai_confidence * 100)}%
          </Badge>
        )}
      </div>

      {/* Footer con fecha */}
      <div className="mt-3 pt-3 border-t text-xs text-gray-400">
        Creado {formatDatePanama(caso.created_at)}
      </div>
    </Card>
  );
}
