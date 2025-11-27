'use client';

import { useState, useEffect, useMemo } from 'react';
import { actionGetPaidRetained } from '@/app/(app)/commissions/retained-actions';
import { toast } from 'sonner';
import { 
  FaHistory, 
  FaChevronDown, 
  FaChevronRight,
  FaInfoCircle,
  FaCheckCircle,
  FaHandHoldingUsd,
  FaCalendarAlt
} from 'react-icons/fa';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaidRetained {
  id: string;
  broker_id: string;
  fortnight_id: string;
  applied_fortnight_id: string | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
  updated_at: string | null;
  insurers_detail: any;
  brokers: { name: string };
  fortnights: { period_start: string; period_end: string };
  applied_fortnight: { period_start: string; period_end: string } | null;
}

interface GroupedPaid {
  broker_id: string;
  broker_name: string;
  total_amount: number;
  retentions: PaidRetained[];
}

export default function PaidRetainedView() {
  const [paidRetained, setPaidRetained] = useState<PaidRetained[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadPaidRetained();
  }, []);

  const loadPaidRetained = async () => {
    setLoading(true);
    const result = await actionGetPaidRetained();
    if (result.ok) {
      setPaidRetained(result.data as PaidRetained[]);
    } else {
      toast.error('Error al cargar retenciones pagadas');
    }
    setLoading(false);
  };

  // Filtrar por año
  const filteredByYear = useMemo(() => {
    return paidRetained.filter(r => {
      const year = new Date(r.updated_at || r.created_at).getFullYear();
      return year === selectedYear;
    });
  }, [paidRetained, selectedYear]);

  // Agrupar por broker
  const groupedPaid = useMemo(() => {
    const grouped = new Map<string, GroupedPaid>();
    
    filteredByYear.forEach(retention => {
      const brokerId = retention.broker_id;
      if (!grouped.has(brokerId)) {
        grouped.set(brokerId, {
          broker_id: brokerId,
          broker_name: retention.brokers.name,
          total_amount: 0,
          retentions: []
        });
      }
      const group = grouped.get(brokerId)!;
      group.total_amount += retention.net_amount;
      group.retentions.push(retention);
    });

    return Array.from(grouped.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [filteredByYear]);

  // Obtener años disponibles
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    paidRetained.forEach(r => {
      years.add(new Date(r.updated_at || r.created_at).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [paidRetained]);

  const toggleBroker = (brokerId: string) => {
    setExpandedBrokers(prev => {
      const next = new Set(prev);
      if (next.has(brokerId)) {
        next.delete(brokerId);
      } else {
        next.add(brokerId);
      }
      return next;
    });
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('es-PA', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('es-PA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const totalPaid = filteredByYear.reduce((sum, r) => sum + r.net_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
        <span className="ml-3 text-gray-600">Cargando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header con filtro de año */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <FaHistory className="text-green-500 text-xl sm:text-2xl" />
          <h2 className="text-lg sm:text-xl font-bold text-[#010139]">Retenciones Pagadas</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-600">Año:</span>
          <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
            <SelectTrigger className="w-24 sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaCheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Liberado</p>
                <p className="text-xl sm:text-2xl font-bold text-[#8AAA19]">
                  ${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaCalendarAlt className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Brokers</p>
                <p className="text-xl sm:text-2xl font-bold text-[#010139]">{groupedPaid.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaHistory className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Items</p>
                <p className="text-xl sm:text-2xl font-bold text-[#010139]">{filteredByYear.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista agrupada por broker */}
      {groupedPaid.length === 0 ? (
        <Card className="shadow-lg">
          <div className="p-8 sm:p-12 text-center">
            <FaInfoCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
              No hay retenciones pagadas en {selectedYear}
            </h3>
            <p className="text-sm text-gray-500">
              Cambia el año en el filtro superior para ver otros períodos
            </p>
          </div>
        </Card>
      ) : (
        groupedPaid.map((group) => {
          const isExpanded = expandedBrokers.has(group.broker_id);

          return (
            <Card key={group.broker_id} className="overflow-hidden shadow hover:shadow-md transition-shadow">
              <div className="p-3 sm:p-4">
                {/* Header del broker */}
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Icono de estado */}
                  <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg">
                    <FaCheckCircle className="text-green-600" size={16} />
                  </div>

                  {/* Info del broker */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[#010139] text-sm sm:text-base truncate">
                          {group.broker_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs sm:text-sm text-gray-600">
                            {group.retentions.length} retención(es) liberada(s)
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs sm:text-sm font-semibold text-[#8AAA19]">
                            ${group.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Botón Expandir */}
                      <button
                        onClick={() => toggleBroker(group.broker_id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                      >
                        {isExpanded ? (
                          <FaChevronDown className="text-gray-600" size={14} />
                        ) : (
                          <FaChevronRight className="text-gray-600" size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700">Detalle de retenciones:</span>
                    <div className="space-y-1.5">
                      {group.retentions.map((retention) => (
                        <div key={retention.id} className="p-2 bg-gray-50 rounded text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">
                                <FaHandHoldingUsd className="inline mr-1 text-red-500" size={10} />
                                Retenido en: {formatPeriod(retention.fortnights.period_start, retention.fortnights.period_end)}
                              </p>
                              {retention.applied_fortnight && (
                                <p className="text-[10px] text-green-700 mt-1">
                                  <FaCheckCircle className="inline mr-1" size={10} />
                                  Asociado a: {formatPeriod(retention.applied_fortnight.period_start, retention.applied_fortnight.period_end)}
                                </p>
                              )}
                              <div className="flex gap-2 text-[10px] text-gray-600 mt-1">
                                <span>Bruto: ${retention.gross_amount.toFixed(2)}</span>
                                <span>•</span>
                                <span>Descuento: ${retention.discount_amount.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-[#8AAA19]">
                                ${retention.net_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
