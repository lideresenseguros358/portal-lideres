'use client';

import { useState, useEffect } from 'react';
import { actionGetAdvanceRecurrences } from '@/app/(app)/commissions/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FaCalendarAlt, FaMoneyBillWave, FaInfinity, FaStopCircle, FaInfoCircle, FaEdit } from 'react-icons/fa';
import { toast } from 'sonner';
import { EditRecurringAdvanceModal } from '../EditRecurringAdvanceModal';

interface Recurrence {
  id: string;
  amount: number;
  reason: string;
  fortnight_type: 'Q1' | 'Q2' | 'BOTH';
  end_date: string | null;
  recurrence_count: number;
  last_generated_at: string | null;
  is_active: boolean;
  broker_id: string;
  brokers?: { name: string | null };
}

interface Props {
  brokerId: string;
}

export function BrokerRecurringAdvancesCard({ brokerId }: Props) {
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRecurrence, setEditingRecurrence] = useState<Recurrence | null>(null);

  const loadRecurrences = async () => {
    setLoading(true);
    try {
      console.log('[BrokerRecurringAdvancesCard] Loading for broker:', brokerId);
      const result = await actionGetAdvanceRecurrences(brokerId);
      console.log('[BrokerRecurringAdvancesCard] Result:', result);
      
      if (result.ok) {
        // Filtrar solo las recurrencias activas
        const filtered = (result.data as Recurrence[]).filter((rec) => rec.is_active);
        console.log('[BrokerRecurringAdvancesCard] Filtered active recurrences:', filtered.length);
        setRecurrences(filtered);
      } else {
        console.error('[BrokerRecurringAdvancesCard] Error:', result.error);
        toast.error('Error al cargar adelantos recurrentes');
      }
    } catch (error) {
      console.error('[BrokerRecurringAdvancesCard] Exception:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (brokerId) {
      loadRecurrences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brokerId]);

  if (loading) {
    return (
      <Card className="border-2 border-purple-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b-2 border-purple-200">
          <CardTitle className="text-lg font-bold text-[#010139] flex items-center gap-2">
            <FaCalendarAlt className="text-purple-600" />
            Descuentos Recurrentes Programados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recurrences.length === 0) {
    return (
      <Card className="border-2 border-gray-200 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
          <CardTitle className="text-lg font-bold text-[#010139] flex items-center gap-2">
            <FaCalendarAlt className="text-gray-400" />
            Descuentos Recurrentes Programados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">
            <FaInfoCircle className="text-4xl mx-auto mb-3 text-gray-300" />
            <p className="font-medium">No tienes descuentos recurrentes programados</p>
            <p className="text-sm mt-1">Los adelantos recurrentes aparecerán aquí cuando sean configurados</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="border-2 border-purple-200 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 border-b-2 border-purple-200">
        <CardTitle className="text-lg font-bold text-[#010139] flex items-center gap-2">
          <FaCalendarAlt className="text-purple-600" />
          Descuentos Recurrentes Programados
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Estos montos se descontarán automáticamente de tus comisiones cada mes
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {recurrences.map((rec) => {
            const fortnightText = rec.fortnight_type === 'Q1' 
              ? 'Primera Quincena (días 1-15)' 
              : rec.fortnight_type === 'Q2'
              ? 'Segunda Quincena (días 16-fin)'
              : 'Ambas Quincenas (2 veces al mes)';
            
            const isExpired = rec.end_date && new Date(rec.end_date) < new Date();

            return (
              <div
                key={rec.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  isExpired
                    ? 'bg-gray-50 border-gray-300 opacity-60'
                    : 'bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300 hover:shadow-md'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <FaMoneyBillWave className="text-purple-600" />
                      {rec.reason}
                    </h3>
                    {isExpired && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-semibold rounded">
                        Vencido
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-[#010139] font-mono">
                        ${rec.amount.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-500">por mes</div>
                    </div>
                    <button
                      onClick={() => setEditingRecurrence(rec)}
                      className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-700 transition-colors"
                      title="Editar adelanto recurrente"
                    >
                      <FaEdit size={16} />
                    </button>
                  </div>
                </div>

                {/* Información de Quincena */}
                <div className="flex items-center gap-2 mb-2 p-2 bg-white rounded border border-purple-200">
                  <FaCalendarAlt className="text-purple-600" />
                  <div>
                    <div className="text-xs font-semibold text-gray-600">Se aplicará en:</div>
                    <div className="font-bold text-sm text-[#010139]">{fortnightText}</div>
                  </div>
                </div>

                {/* Duración */}
                <div className={`flex items-center gap-2 p-2 rounded border ${
                  rec.end_date 
                    ? 'bg-amber-50 border-amber-200' 
                    : 'bg-blue-50 border-blue-200'
                }`}>
                  {rec.end_date ? (
                    <>
                      <FaStopCircle className="text-amber-600" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-gray-600">Finaliza el:</div>
                        <div className="font-bold text-sm text-amber-700">
                          {new Date(rec.end_date).toLocaleDateString('es-PA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <FaInfinity className="text-blue-600" />
                      <div>
                        <div className="text-xs font-semibold text-gray-600">Duración:</div>
                        <div className="font-bold text-sm text-blue-700">Indefinido</div>
                      </div>
                    </>
                  )}
                </div>

                {/* Estadísticas */}
                {rec.recurrence_count > 0 && (
                  <div className="mt-3 pt-3 border-t border-purple-200">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>Ya se ha aplicado {rec.recurrence_count} {rec.recurrence_count === 1 ? 'vez' : 'veces'}</span>
                      {rec.last_generated_at && (
                        <span>
                          Última aplicación: {new Date(rec.last_generated_at).toLocaleDateString('es-PA')}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <FaInfoCircle className="text-blue-600 text-xl flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-[#010139] mb-1">¿Cómo funcionan los descuentos recurrentes?</p>
              <ul className="space-y-1 text-xs">
                <li>• Se descontarán automáticamente en la quincena especificada cada mes</li>
                <li>• El monto se restará de tus comisiones brutas antes del pago</li>
                <li>• Aparecerán en tu historial de adelantos marcados como "RECURRENTE"</li>
                <li>• Si tienes dudas, contacta al administrador</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

      {/* Modal de Edición */}
      {editingRecurrence && (
        <EditRecurringAdvanceModal
          recurrence={editingRecurrence}
          onClose={() => setEditingRecurrence(null)}
          onSuccess={() => {
            setEditingRecurrence(null);
            loadRecurrences(); // Recargar lista
          }}
        />
      )}
    </>
  );
}
