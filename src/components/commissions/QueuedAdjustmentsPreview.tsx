'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FaInfoCircle, FaCalendarPlus, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { actionGetQueuedAdjustments } from '@/app/(app)/commissions/actions';
import { formatCurrency as formatMoney } from '@/lib/commissions/adjustments-utils';

export function QueuedAdjustmentsPreview() {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await actionGetQueuedAdjustments();
      if (result.ok && result.data) {
        setAdjustments(result.data);
      }
    } catch (error) {
      console.error('Error loading queued adjustments:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
            <span className="text-sm">Verificando ajustes en cola...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (adjustments.length === 0) {
    return null;
  }

  // Agrupar por broker
  const groupedByBroker = adjustments.reduce((acc: any, adj: any) => {
    const brokerId = adj.broker_id;
    const brokerName = adj.broker_name;
    
    if (!acc[brokerId]) {
      acc[brokerId] = {
        brokerId,
        brokerName,
        items: [],
        totalAmount: 0,
      };
    }
    
    acc[brokerId].items.push(adj);
    acc[brokerId].totalAmount += adj.broker_amount;
    
    return acc;
  }, {});

  const brokerGroups = Object.values(groupedByBroker);
  const totalAdjustments = adjustments.length;
  const totalAmount = adjustments.reduce((sum: number, adj: any) => sum + adj.broker_amount, 0);

  return (
    <Card className="shadow-lg border-2 border-[#8AAA19] bg-gradient-to-r from-green-50 to-white">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <FaCalendarPlus className="text-[#8AAA19] mt-1 text-xl flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-bold text-[#010139] text-lg">
                    Ajustes en Cola para Esta Quincena
                  </h3>
                  <p className="text-sm text-gray-700">
                    Estos ajustes se sumarán automáticamente al bruto de cada corredor
                  </p>
                </div>
                <Badge className="bg-[#8AAA19] text-white text-base px-3 py-1">
                  {totalAdjustments} item{totalAdjustments !== 1 ? 's' : ''}
                </Badge>
              </div>

              {/* Totales */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Corredores Afectados</p>
                  <p className="font-bold text-[#010139] text-lg">{brokerGroups.length}</p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1">Total a Agregar</p>
                  <p className="font-mono font-bold text-[#8AAA19] text-lg">
                    {formatMoney(totalAmount)}
                  </p>
                </div>
              </div>

              {/* Info Banner */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-r-lg mb-3">
                <div className="flex items-start gap-2">
                  <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" size={14} />
                  <p className="text-xs text-blue-900">
                    <strong>Al crear la quincena:</strong> Estos montos se agregarán automáticamente 
                    al bruto de cada corredor y los ajustes se marcarán como incluidos en esta quincena.
                  </p>
                </div>
              </div>

              {/* Toggle detalles */}
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 text-sm text-[#010139] hover:text-[#8AAA19] transition-colors font-semibold"
              >
                {expanded ? <FaChevronDown /> : <FaChevronRight />}
                {expanded ? 'Ocultar' : 'Ver'} detalles por corredor
              </button>

              {/* Detalles expandibles */}
              {expanded && (
                <div className="mt-3 space-y-3">
                  {brokerGroups.map((group: any) => (
                    <div key={group.brokerId} className="bg-white p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-[#010139]">{group.brokerName}</h4>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Total a sumar</p>
                          <p className="font-mono font-bold text-[#8AAA19]">
                            {formatMoney(group.totalAmount)}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="text-xs">Póliza</TableHead>
                              <TableHead className="text-xs">Cliente</TableHead>
                              <TableHead className="text-right text-xs">Monto</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((adj: any, idx: number) => (
                              <TableRow key={idx} className="text-sm">
                                <TableCell className="font-medium">{adj.policy_number}</TableCell>
                                <TableCell className="text-gray-600">{adj.client_name || '—'}</TableCell>
                                <TableCell className="text-right font-mono text-[#8AAA19] font-semibold">
                                  {formatMoney(adj.broker_amount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
