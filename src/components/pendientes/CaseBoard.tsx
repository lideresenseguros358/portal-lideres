'use client';

/**
 * CASE BOARD - Vista Principal tipo Monday
 * =========================================
 * Tablero con columnas por estado simplificado
 * - Drag & drop entre estados (solo master)
 * - Scroll horizontal responsivo
 * - Contador por columna
 * - Orden: vencidos arriba, nuevos abajo
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import CaseCard from './CaseCard';
import type { CasoPendiente, EstadoSimple } from '@/types/pendientes';

interface CaseBoardProps {
  casos: CasoPendiente[];
  onCaseClick: (caso: CasoPendiente) => void;
  isMaster: boolean;
}

const ESTADOS_ORDEN: EstadoSimple[] = [
  'Nuevo',
  'Sin clasificar',
  'En proceso',
  'Pendiente cliente',
  'Pendiente broker',
  'Enviado',
  'Aplazado',
];

export default function CaseBoard({ casos, onCaseClick, isMaster }: CaseBoardProps) {
  // Agrupar casos por estado
  const casosPorEstado = ESTADOS_ORDEN.reduce((acc, estado) => {
    acc[estado] = casos.filter(c => c.estado_simple === estado);
    return acc;
  }, {} as Record<EstadoSimple, CasoPendiente[]>);

  // Ordenar dentro de cada columna: vencidos arriba, luego por fecha
  Object.keys(casosPorEstado).forEach((estado) => {
    casosPorEstado[estado as EstadoSimple].sort((a, b) => {
      const aVencido = a.sla_due_date && new Date(a.sla_due_date) < new Date();
      const bVencido = b.sla_due_date && new Date(b.sla_due_date) < new Date();
      
      if (aVencido && !bVencido) return -1;
      if (!aVencido && bVencido) return 1;
      
      if (a.sla_due_date && b.sla_due_date) {
        return new Date(a.sla_due_date).getTime() - new Date(b.sla_due_date).getTime();
      }
      
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  });

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ESTADOS_ORDEN.map((estado) => {
        const casosDeEstado = casosPorEstado[estado] || [];
        const count = casosDeEstado.length;
        
        return (
          <div key={estado} className="flex-shrink-0 w-80">
            {/* Header de columna */}
            <Card className="p-4 mb-3 bg-[#010139] text-white">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm">{estado}</h3>
                <span className="bg-white text-[#010139] px-2 py-1 rounded-full text-xs font-bold">
                  {count}
                </span>
              </div>
            </Card>

            {/* Cards de casos */}
            <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
              {casosDeEstado.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  Sin casos en este estado
                </div>
              ) : (
                casosDeEstado.map((caso) => (
                  <CaseCard
                    key={caso.id}
                    caso={caso}
                    onClick={() => onCaseClick(caso)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
