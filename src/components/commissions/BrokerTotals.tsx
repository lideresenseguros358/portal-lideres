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
    <Card>
      <CardHeader>
        <CardTitle>Detalle de Comisiones por Corredor</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-right">Bruto</TableHead>
              <TableHead className="text-right text-red-600">Descuentos</TableHead>
              <TableHead className="text-right text-[#8AAA19] font-bold">NETO PAGADO</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedData).map(([brokerId, brokerData]) => (
              <>
                <TableRow key={brokerId} className={`font-semibold hover:bg-gray-100 ${brokerData.is_retained ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => toggleBroker(brokerId)}>
                      {expandedBrokers.has(brokerId) ? <FaChevronDown /> : <FaChevronRight />}
                    </Button>
                  </TableCell>
                  <TableCell className="font-bold text-[#010139]">
                    {brokerData.broker_name}
                    {brokerData.is_retained && (
                      <span className="ml-2 text-xs bg-red-500 text-white px-2 py-1 rounded">RETENIDO</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-gray-700">
                    {brokerData.total_gross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    -{brokerData.total_discounts.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-bold text-[#8AAA19] text-lg">
                    {brokerData.total_net.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex justify-center gap-2">
                      <Button 
                        variant="link" 
                        onClick={() => onManageAdvances(brokerId)}
                        className="text-[#010139]"
                      >
                        Descontar Adelanto
                      </Button>
                      <Button
                        size="sm"
                        variant={brokerData.is_retained ? "outline" : "ghost"}
                        onClick={() => handleRetainPayment(brokerId, brokerData.is_retained)}
                        className={brokerData.is_retained ? 'border-red-500 text-red-600 hover:bg-red-50' : 'hover:bg-red-100 hover:text-red-700'}
                      >
                        {brokerData.is_retained ? (
                          <><FaUndo className="mr-1" /> Liberar</>
                        ) : (
                          <><FaHandHoldingUsd className="mr-1" /> Retener Pago</>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>

                {expandedBrokers.has(brokerId) && Object.entries(brokerData.insurers).map(([insurerId, insurerData]) => (
                  <>
                    <TableRow key={insurerId} className="hover:bg-gray-50">
                      <TableCell></TableCell>
                      <TableCell className="pl-10">
                        <Button variant="ghost" size="sm" onClick={() => toggleInsurer(insurerId)} className="mr-2">
                          {expandedInsurers.has(insurerId) ? <FaChevronDown /> : <FaChevronRight />}
                        </Button>
                        {insurerData.insurer_name}
                      </TableCell>
                      <TableCell className="text-right font-mono">{insurerData.total_gross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                    </TableRow>

                    {expandedInsurers.has(insurerId) && insurerData.clients.map((client, index) => (
                      <TableRow key={`${insurerId}-${index}`} className="hover:bg-gray-50">
                        <TableCell></TableCell>
                        <TableCell className="pl-20 text-sm text-gray-600">{client.name}</TableCell>
                        <TableCell className="text-right text-sm text-gray-600 font-mono">{client.gross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    ))}
                  </>
                ))}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
