'use client';

import { useState, useEffect, useMemo } from 'react';
import { actionGetRetainedCommissions } from '@/app/(app)/commissions/actions';
import { actionProcessRetainedCommissions } from '@/app/(app)/commissions/retained-actions';
import { toast } from 'sonner';
import { 
  FaHandHoldingUsd, 
  FaChevronDown, 
  FaChevronRight,
  FaInfoCircle,
  FaCalendarAlt,
  FaCheckCircle
} from 'react-icons/fa';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

interface RetainedCommission {
  id: string;
  broker_id: string;
  fortnight_id: string;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
  insurers_detail: any;
  brokers: { id: string; name: string };
  fortnights: { period_start: string; period_end: string };
}

interface GroupedRetained {
  broker_id: string;
  broker_name: string;
  total_amount: number;
  commissions: RetainedCommission[];
}

export default function RetainedGroupedView() {
  const [retainedCommissions, setRetainedCommissions] = useState<RetainedCommission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadRetainedCommissions();
  }, []);

  const loadRetainedCommissions = async () => {
    setLoading(true);
    const result = await actionGetRetainedCommissions();
    if (result.ok) {
      setRetainedCommissions(result.data as RetainedCommission[]);
    } else {
      toast.error('Error al cargar comisiones retenidas');
    }
    setLoading(false);
  };

  // Filtrar por año
  const filteredByYear = useMemo(() => {
    return retainedCommissions.filter(r => {
      const year = new Date(r.created_at).getFullYear();
      return year === selectedYear;
    });
  }, [retainedCommissions, selectedYear]);

  // Agrupar por broker
  const groupedRetained = useMemo(() => {
    const grouped = new Map<string, GroupedRetained>();
    
    filteredByYear.forEach(commission => {
      const brokerId = commission.broker_id;
      if (!grouped.has(brokerId)) {
        grouped.set(brokerId, {
          broker_id: brokerId,
          broker_name: commission.brokers.name,
          total_amount: 0,
          commissions: []
        });
      }
      const group = grouped.get(brokerId)!;
      group.total_amount += commission.net_amount;
      group.commissions.push(commission);
    });

    return Array.from(grouped.values()).sort((a, b) => b.total_amount - a.total_amount);
  }, [filteredByYear]);

  // Obtener años disponibles
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    retainedCommissions.forEach(r => {
      years.add(new Date(r.created_at).getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [retainedCommissions]);

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

  const handleOpenPaymentModal = (brokerId: string) => {
    setSelectedBroker(brokerId);
    setShowPaymentModal(true);
  };

  const handlePayRetained = async () => {
    if (!selectedBroker) return;

    const brokerGroup = groupedRetained.find(g => g.broker_id === selectedBroker);
    if (!brokerGroup) return;

    const retainedIds = brokerGroup.commissions.map(c => c.id);

    const result = await actionProcessRetainedCommissions({
      retained_ids: retainedIds,
      payment_mode: 'next_fortnight'
    });

    if (result.ok) {
      toast.success(`${retainedIds.length} retención(es) asociada(s) a la siguiente quincena`);
      setShowPaymentModal(false);
      setSelectedBroker(null);
      loadRetainedCommissions();
    } else {
      toast.error('Error al procesar', { description: result.error });
    }
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('es-PA', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('es-PA', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const totalRetained = filteredByYear.reduce((sum, r) => sum + r.net_amount, 0);
  const selectedBrokerData = groupedRetained.find(g => g.broker_id === selectedBroker);

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
          <FaHandHoldingUsd className="text-red-500 text-xl sm:text-2xl" />
          <h2 className="text-lg sm:text-xl font-bold text-[#010139]">Comisiones Retenidas</h2>
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
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <FaHandHoldingUsd className="text-red-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Retenido</p>
                <p className="text-xl sm:text-2xl font-bold text-red-600">
                  ${totalRetained.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                <p className="text-xs sm:text-sm text-gray-600">Brokers Afectados</p>
                <p className="text-xl sm:text-2xl font-bold text-[#010139]">{groupedRetained.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaInfoCircle className="text-purple-600" size={20} />
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
      {groupedRetained.length === 0 ? (
        <Card className="shadow-lg">
          <div className="p-8 sm:p-12 text-center">
            <FaInfoCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
              No hay comisiones retenidas en {selectedYear}
            </h3>
            <p className="text-sm text-gray-500">
              Cambia el año en el filtro superior para ver otros períodos
            </p>
          </div>
        </Card>
      ) : (
        groupedRetained.map((group) => {
          const isExpanded = expandedBrokers.has(group.broker_id);

          return (
            <Card key={group.broker_id} className="overflow-hidden shadow hover:shadow-md transition-shadow">
              <div className="p-3 sm:p-4">
                {/* Header del broker */}
                <div className="flex items-start gap-2 sm:gap-3">
                  {/* Icono de estado */}
                  <div className="flex-shrink-0 p-2 bg-red-100 rounded-lg">
                    <FaHandHoldingUsd className="text-red-600" size={16} />
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
                            {group.commissions.length} retención(es)
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs sm:text-sm font-semibold text-red-600">
                            ${group.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Botones */}
                      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleOpenPaymentModal(group.broker_id)}
                          className="text-xs sm:text-sm bg-[#8AAA19] hover:bg-[#6d8814] text-white"
                        >
                          <FaCalendarAlt className="mr-1" size={12} />
                          Pagar
                        </Button>
                        <button
                          onClick={() => toggleBroker(group.broker_id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
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
                </div>

                {/* Detalle expandido */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700">Retenciones:</span>
                    <div className="space-y-1.5">
                      {group.commissions.map((commission) => (
                        <div key={commission.id} className="p-2 bg-gray-50 rounded text-xs">
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-gray-800">
                                Quincena: {formatPeriod(commission.fortnights.period_start, commission.fortnights.period_end)}
                              </p>
                              <div className="flex gap-2 text-[10px] text-gray-600 mt-1">
                                <span>Bruto: ${commission.gross_amount.toFixed(2)}</span>
                                <span>•</span>
                                <span>Descuento: ${commission.discount_amount.toFixed(2)}</span>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-red-600">
                                ${commission.net_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

      {/* Modal de pago (solo siguiente quincena) */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar Comisiones Retenidas</DialogTitle>
            <DialogDescription>
              Corredor: <span className="font-semibold">{selectedBrokerData?.broker_name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FaHandHoldingUsd className="text-red-600" />
                <span className="font-semibold text-gray-800">Total a Pagar:</span>
              </div>
              <p className="text-2xl font-bold text-red-600">
                ${selectedBrokerData?.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {selectedBrokerData?.commissions.length} retención(es) del año {selectedYear}
              </p>
            </div>

            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <FaCalendarAlt className="text-blue-600" />
                <span className="font-semibold text-gray-800">Método de Pago:</span>
              </div>
              <p className="text-sm text-gray-700">
                Las retenciones se asociarán a la <strong>siguiente quincena DRAFT</strong> y se pagarán cuando se cierre esa quincena.
              </p>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentModal(false);
                setSelectedBroker(null);
              }}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handlePayRetained}
              className="w-full sm:w-auto bg-[#8AAA19] hover:bg-[#6d8814] text-white"
            >
              <FaCalendarAlt className="mr-2" />
              Asociar a Siguiente Quincena
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
