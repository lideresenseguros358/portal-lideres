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
import { FaChevronDown, FaChevronRight, FaHandHoldingUsd, FaUndo, FaMinus, FaEllipsisV } from 'react-icons/fa';
import DiscountModal from './DiscountModal';

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
  onTotalNetChange?: (totalNet: number) => void;
  recalculationKey?: number; // Key para forzar recarga de datos
}

export default function BrokerTotals({ draftFortnightId, onManageAdvances, brokerTotals = [], onRetentionChange = () => {}, onTotalNetChange, recalculationKey = 0 }: Props) {
  const [details, setDetails] = useState<CommItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Solo mostrar spinner en primera carga
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [brokerDiscounts, setBrokerDiscounts] = useState<Record<string, number>>({});
  const [openMenuBroker, setOpenMenuBroker] = useState<string | null>(null);
  const [discountModalData, setDiscountModalData] = useState<{
    brokerId: string;
    brokerName: string;
    grossAmount: number;
  } | null>(null);

  useEffect(() => {
    const loadDetails = async () => {
      // Solo mostrar loading en la primera carga, luego actualizar en background
      if (isInitialLoad) {
        setLoading(true);
      }
      
      const result = await actionGetDraftDetails(draftFortnightId);
      if (result.ok) {
        setDetails(result.data || []);
        
        // Calcular descuentos por corredor desde fortnight_broker_totals
        const discounts: Record<string, number> = {};
        // TODO: Cargar desde fortnight_broker_totals cuando esté disponible
        setBrokerDiscounts(discounts);
      } else {
        // Solo mostrar error si es la primera carga
        if (isInitialLoad) {
          toast.error('Error al cargar detalles de la quincena', { description: result.error });
        }
      }
      
      if (isInitialLoad) {
        setLoading(false);
        setIsInitialLoad(false);
      }
    };
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFortnightId, recalculationKey]);

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

      // SUMAR comm_items directamente
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

  // Calcular y emitir total neto - Se ejecuta cada vez que groupedData cambia
  useEffect(() => {
    if (onTotalNetChange) {
      const totalNet = Object.keys(groupedData).length > 0
        ? Object.values(groupedData).reduce((sum, broker) => sum + broker.total_net, 0)
        : 0;
      onTotalNetChange(totalNet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedData]);

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
              <TableHead className="font-semibold text-gray-700">Corredor / Aseguradora</TableHead>
              <TableHead className="text-right font-semibold text-gray-700">Comisión Bruta</TableHead>
              <TableHead className="text-right font-semibold text-red-700">Descuentos</TableHead>
              <TableHead className="text-right font-semibold text-[#8AAA19] text-base">Neto a Pagar</TableHead>
              <TableHead className="text-center font-semibold text-gray-700 w-20">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedData)
              .sort(([, a], [, b]) => a.broker_name.localeCompare(b.broker_name))
              .map(([brokerId, brokerData]) => (
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
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuBroker(openMenuBroker === brokerId ? null : brokerId);
                        }}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <FaEllipsisV className="text-gray-600" />
                      </Button>
                      {openMenuBroker === brokerId && (
                        <>
                          <div 
                            className="fixed inset-0 z-[100]" 
                            onClick={() => setOpenMenuBroker(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                            <button
                              onClick={() => {
                                onManageAdvances(brokerId);
                                setOpenMenuBroker(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm text-gray-700"
                            >
                              💰 Adelantos
                            </button>
                            <button
                              onClick={() => {
                                handleRetainPayment(brokerId, brokerData.is_retained);
                                setOpenMenuBroker(null);
                              }}
                              className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-sm ${
                                brokerData.is_retained ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {brokerData.is_retained ? (
                                <><FaUndo size={14} /> Liberar Pago</>
                              ) : (
                                <><FaHandHoldingUsd size={14} /> Retener Pago</>
                              )}
                            </button>
                            {!brokerData.is_retained && (
                              <>
                                <div className="border-t border-gray-100 my-1"></div>
                                <button
                                  onClick={() => {
                                    setDiscountModalData({
                                      brokerId,
                                      brokerName: brokerData.broker_name,
                                      grossAmount: brokerData.total_gross
                                    });
                                    setOpenMenuBroker(null);
                                  }}
                                  className="w-full text-left px-4 py-2.5 hover:bg-orange-50 flex items-center gap-3 text-sm text-orange-700"
                                >
                                  <FaMinus size={14} /> Aplicar Descuento
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
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

      {/* Modal de Descuentos */}
      {discountModalData && (
        <DiscountModal
          isOpen={true}
          onClose={() => setDiscountModalData(null)}
          brokerId={discountModalData.brokerId}
          brokerName={discountModalData.brokerName}
          fortnightId={draftFortnightId}
          grossAmount={discountModalData.grossAmount}
          onSuccess={() => {
            setDiscountModalData(null);
            // Recargar datos
            onRetentionChange();
          }}
        />
      )}
    </div>
  );
}
