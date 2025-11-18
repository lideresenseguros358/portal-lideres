'use client';

import { useState, useEffect, useMemo } from 'react';
import { actionGetDraftDetails, actionRetainBrokerPayment, actionUnretainBrokerPayment } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FaChevronDown, FaChevronRight, FaHandHoldingUsd, FaUndo } from 'react-icons/fa';

// Types
interface CommItem {
  id: string;
  gross_amount: number;
  insured_name: string | null;
  brokers: { id: string; name: string | null } | null;
  insurers: { id: string; name: string | null } | null;
}

interface GroupedData {
  [brokerId: string]: {
    broker_name: string;
    total_gross: number;
    total_discounts: number;
    total_net: number;
    is_retained: boolean;
    insurers: {
      [insurerId: string]: {
        insurer_name: string;
        total_gross: number;
        clients: { name: string; gross: number }[];
      };
    };
  };
}

interface Props {
  draftFortnightId: string;
  onManageAdvances: (brokerId: string) => void;
  brokerTotals?: Array<{ broker_id: string; is_retained?: boolean }>;
  onRetentionChange?: () => void;
}

export default function BrokerTotals({ draftFortnightId, onManageAdvances, brokerTotals = [], onRetentionChange = () => {} }: Props) {
  const [details, setDetails] = useState<CommItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [brokerDiscounts, setBrokerDiscounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      const result = await actionGetDraftDetails(draftFortnightId);
      if (result.ok) {
        setDetails(result.data || []);
        
        // Calcular descuentos por corredor desde fortnight_broker_totals
        const discounts: Record<string, number> = {};
        // TODO: Cargar desde fortnight_broker_totals cuando esté disponible
        setBrokerDiscounts(discounts);
      } else {
        toast.error('Error al cargar detalles de la quincena', { description: result.error });
      }
      setLoading(false);
    };
    loadDetails();
  }, [draftFortnightId]);

  const groupedData = useMemo(() => {
    const grouped = details.reduce<GroupedData>((acc, item) => {
      if (!item.brokers || !item.insurers) return acc;
      const brokerId = item.brokers.id;
      const insurerId = item.insurers.id;

      if (!acc[brokerId]) {
        const brokerTotal = brokerTotals.find(bt => bt.broker_id === brokerId);
        acc[brokerId] = {
          broker_name: item.brokers.name || 'N/A',
          total_gross: 0,
          total_discounts: 0,
          total_net: 0,
          is_retained: brokerTotal?.is_retained || false,
          insurers: {},
        };
      }

      if (!acc[brokerId]!.insurers[insurerId]) {
        acc[brokerId]!.insurers[insurerId] = {
          insurer_name: item.insurers.name || 'N/A',
          total_gross: 0,
          clients: [],
        };
      }

      // Use Math.abs to ensure positive commission values
      const grossAmount = Math.abs(item.gross_amount);
      acc[brokerId]!.total_gross += grossAmount;
      acc[brokerId]!.insurers[insurerId]!.total_gross += grossAmount;
      acc[brokerId]!.insurers[insurerId]!.clients.push({
        name: item.insured_name || 'N/A',
        gross: grossAmount,
      });

      return acc;
    }, {});
    
    // Calcular neto = bruto - descuentos
    Object.keys(grouped).forEach(brokerId => {
      const discounts = brokerDiscounts[brokerId] || 0;
      grouped[brokerId]!.total_discounts = discounts;
      grouped[brokerId]!.total_net = grouped[brokerId]!.total_gross - discounts;
    });
    
    return grouped;
  }, [details, brokerDiscounts, brokerTotals]);

  const toggleBroker = (id: string) => {
    const newSet = new Set(expandedBrokers);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedBrokers(newSet);
  };

  const toggleInsurer = (id: string) => {
    const newSet = new Set(expandedInsurers);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedInsurers(newSet);
  };

  const handleRetainPayment = async (brokerId: string, isCurrentlyRetained: boolean) => {
    const action = isCurrentlyRetained ? actionUnretainBrokerPayment : actionRetainBrokerPayment;
    const result = await action({
      fortnight_id: draftFortnightId,
      broker_id: brokerId,
    });

    if (result.ok) {
      toast.success(isCurrentlyRetained ? 'Retención removida' : 'Pago retenido exitosamente');
      onRetentionChange();
    } else {
      toast.error('Error al procesar', { description: result.error });
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Cargando totales...</div>;
  }

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
              <TableHead className="w-12"></TableHead>
              <TableHead className="font-bold text-gray-700">Corredor / Aseguradora</TableHead>
              <TableHead className="text-right font-bold text-gray-700">Comisión Bruta</TableHead>
              <TableHead className="text-right font-bold text-red-700">Descuentos</TableHead>
              <TableHead className="text-right font-bold text-[#8AAA19] text-base">NETO A PAGAR</TableHead>
              <TableHead className="text-center font-bold text-gray-700">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedData).map(([brokerId, brokerData]) => (
              <>
                <TableRow key={brokerId} className={`font-semibold transition-colors ${brokerData.is_retained ? 'bg-red-50 hover:bg-red-100 border-l-4 border-red-500' : 'bg-blue-50/50 hover:bg-blue-100/50 border-l-4 border-blue-500'}`}>
                  <TableCell className="py-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => toggleBroker(brokerId)}
                      className="hover:bg-white/50"
                    >
                      {expandedBrokers.has(brokerId) ? <FaChevronDown className="text-gray-600" /> : <FaChevronRight className="text-gray-600" />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-bold text-[#010139] text-base py-4">
                    <div className="flex items-center gap-2">
                      <span>{brokerData.broker_name}</span>
                      {brokerData.is_retained && (
                        <span className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-full font-semibold shadow-sm">RETENIDO</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-800 text-base py-4">
                    {brokerData.total_gross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-700 font-semibold text-base py-4">
                    -{brokerData.total_discounts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-[#8AAA19] text-lg py-4">
                    {brokerData.total_net.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-center py-4">
                    <div className="flex flex-col sm:flex-row justify-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onManageAdvances(brokerId)}
                        className="bg-white hover:bg-[#010139] hover:text-white border-[#010139] text-[#010139] font-medium transition-all"
                      >
                        💰 Adelantos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetainPayment(brokerId, brokerData.is_retained)}
                        className={brokerData.is_retained 
                          ? 'bg-red-100 border-red-600 text-red-700 hover:bg-red-200 font-medium' 
                          : 'bg-white border-gray-400 text-gray-700 hover:bg-red-50 hover:border-red-500 hover:text-red-700 font-medium'
                        }
                      >
                        {brokerData.is_retained ? (
                          <><FaUndo className="mr-1" /> Liberar</>
                        ) : (
                          <><FaHandHoldingUsd className="mr-1" /> Retener</>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {expandedBrokers.has(brokerId) && Object.entries(brokerData.insurers).map(([insurerId, insurerData]) => (
                  <>
                    <TableRow key={insurerId} className="bg-white hover:bg-gray-50 transition-colors">
                      <TableCell className="py-3"></TableCell>
                      <TableCell className="pl-10 py-3">
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleInsurer(insurerId)} 
                            className="hover:bg-gray-100 p-1"
                          >
                            {expandedInsurers.has(insurerId) ? <FaChevronDown size={12} className="text-gray-500" /> : <FaChevronRight size={12} className="text-gray-500" />}
                          </Button>
                          <span className="font-semibold text-gray-700">{insurerData.insurer_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-gray-700 py-3">{insurerData.total_gross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                      <TableCell className="py-3"></TableCell>
                      <TableCell className="py-3"></TableCell>
                      <TableCell className="py-3"></TableCell>
                    </TableRow>

                    {expandedInsurers.has(insurerId) && insurerData.clients.map((client, index) => (
                      <TableRow key={`${insurerId}-${index}`} className="bg-gray-50/50 hover:bg-gray-100/50 transition-colors">
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="pl-20 text-sm text-gray-600 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            {client.name}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm text-gray-700 font-mono py-2">{client.gross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                        <TableCell className="py-2"></TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
