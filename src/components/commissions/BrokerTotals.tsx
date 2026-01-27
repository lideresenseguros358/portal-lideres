'use client';

import { useState, useEffect, useMemo } from 'react';
import { actionGetDraftDetails, actionRetainBrokerPayment, actionUnretainBrokerPayment, actionRefreshCommItems } from '@/app/(app)/commissions/actions';
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
import { FaChevronDown, FaChevronRight, FaHandHoldingUsd, FaUndo, FaEllipsisV, FaMoneyBillWave, FaFilePdf, FaSyncAlt } from 'react-icons/fa';
import { AdvancesManagementModal } from './AdvancesManagementModal';
import { exportBrokerToPDF, exportCompleteReportToPDF } from '@/lib/commission-export-utils';

// Types
interface CommItem {
  id: string;
  gross_amount: number;
  insured_name: string | null;
  policy_number: string | null;
  brokers: { id: string; name: string | null; email: string | null; percent_default: number | null } | null;
  insurers: { id: string; name: string | null } | null;
}

interface GroupedData {
  [brokerId: string]: {
    broker_name: string;
    broker_email: string | null;
    percent_default: number;
    total_gross: number;
    total_discounts: number;
    total_net: number;
    is_retained: boolean;
    insurers: {
      [insurerId: string]: {
        insurer_name: string;
        total_gross: number;
        clients: { name: string; gross: number; policy_number: string }[];
      };
    };
  };
}

const toTitleCaseName = (value: string) => {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

interface Props {
  draftFortnightId: string;
  fortnightLabel?: string;
  totalImported?: number;
  onManageAdvances: (brokerId: string) => void;
  brokerTotals?: Array<{ broker_id: string; is_retained?: boolean }>;
  onRetentionChange?: () => void;
  onTotalNetChange?: (totalNet: number) => void;
  recalculationKey?: number;
}

export default function BrokerTotals({ draftFortnightId, fortnightLabel = 'Quincena', totalImported = 0, onManageAdvances, brokerTotals = [], onRetentionChange = () => {}, onTotalNetChange, recalculationKey = 0 }: Props) {
  const [details, setDetails] = useState<CommItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true); // Solo mostrar spinner en primera carga
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [brokerDiscounts, setBrokerDiscounts] = useState<Record<string, number>>({});
  const [managementModal, setManagementModal] = useState<{
    isOpen: boolean;
    brokerId: string;
    brokerName: string;
    grossAmount: number;
  } | null>(null);
  const [openMenuBroker, setOpenMenuBroker] = useState<string | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      // Solo mostrar loading en la primera carga, luego actualizar en background
      if (isInitialLoad) {
        setLoading(true);
      }
      
      const result = await actionGetDraftDetails(draftFortnightId);
      if (result.ok) {
        setDetails(result.data || []);
        
        // Cargar descuentos temporales desde fortnight_discounts
        try {
          const response = await fetch(`/api/commissions/fortnight-discounts?fortnight_id=${draftFortnightId}`);
          const discountsData = await response.json();
          
          if (discountsData.ok) {
            // Agrupar descuentos por broker_id
            const discountsByBroker: Record<string, number> = {};
            (discountsData.data || []).forEach((d: any) => {
              if (!discountsByBroker[d.broker_id]) {
                discountsByBroker[d.broker_id] = 0;
              }
              discountsByBroker[d.broker_id] += d.amount;
            });
            setBrokerDiscounts(discountsByBroker);
          }
        } catch (error) {
          console.error('Error loading temporary discounts:', error);
          setBrokerDiscounts({});
        }
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
        acc[brokerId] = {
          broker_name: item.brokers.name || 'N/A',
          broker_email: item.brokers.email || null,
          percent_default: item.brokers.percent_default || 1.0,
          total_gross: 0,
          total_discounts: 0,
          total_net: 0,
          is_retained: brokerTotals.find(bt => bt.broker_id === brokerId)?.is_retained || false,
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

      // SUMAR comm_items directamente - RESPETAR NEGATIVOS (FEDPA, etc.)
      const grossAmount = Number(item.gross_amount) || 0; // SIN Math.abs()
      acc[brokerId]!.total_gross += grossAmount;
      acc[brokerId]!.insurers[insurerId]!.total_gross += grossAmount;
      acc[brokerId]!.insurers[insurerId]!.clients.push({
        name: item.insured_name || 'N/A',
        gross: grossAmount,
        policy_number: item.policy_number || 'N/A',
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

  // Calcular y emitir total neto (EXCLUIR LISSA) - Se ejecuta cada vez que groupedData cambia
  useEffect(() => {
    if (onTotalNetChange) {
      const totalNet = Object.keys(groupedData).length > 0
        ? Object.values(groupedData)
            .filter(broker => broker.broker_email?.toLowerCase() !== 'contacto@lideresenseguros.com')
            .reduce((sum, broker) => sum + broker.total_net, 0)
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

  const handleRefreshCommissions = async () => {
    setIsRefreshing(true);
    try {
      const result = await actionRefreshCommItems(draftFortnightId);
      
      if (result.ok) {
        toast.success('Comisiones actualizadas', {
          description: result.data?.message || 'Los cálculos se han actualizado correctamente',
        });
        
        // Recargar datos
        const reloadResult = await actionGetDraftDetails(draftFortnightId);
        if (reloadResult.ok) {
          setDetails(reloadResult.data || []);
        }
        
        // Notificar cambio para actualizar otros componentes
        onRetentionChange();
      } else {
        toast.error('Error al actualizar', {
          description: result.error,
        });
      }
    } catch (error) {
      console.error('Error refrescando comisiones:', error);
      toast.error('Error inesperado al actualizar');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportAll = async () => {
    setIsExportingAll(true);
    try {
      // Transformar todos los corredores al formato BrokerDetail[]
      const allBrokers = Object.entries(groupedData).map(([brokerId, brokerData]) => ({
        broker_name: brokerData.broker_name,
        broker_email: brokerData.broker_email || 'sin-email@ejemplo.com',
        percent_default: brokerData.percent_default,
        total_gross: brokerData.total_gross,
        total_net: brokerData.total_net,
        insurers: Object.values(brokerData.insurers).map(insurer => ({
          insurer_name: insurer.insurer_name,
          total_gross: insurer.total_gross,
          policies: insurer.clients.map(client => ({
            policy_number: client.policy_number,
            insured_name: client.name,
            gross_amount: client.gross,
            percentage: brokerData.percent_default,
            net_amount: client.gross,
          })),
        })),
      }));

      // Calcular totales
      const totalPaidToBrokers = allBrokers.reduce((sum, b) => sum + b.total_net, 0);
      const officeProfit = totalImported - totalPaidToBrokers;

      // Generar UN SOLO PDF con todos los corredores
      exportCompleteReportToPDF(
        allBrokers,
        fortnightLabel,
        {
          total_imported: totalImported,
          total_paid_net: totalPaidToBrokers,
          total_office_profit: officeProfit,
        }
      );
      
      toast.success('Reporte completo generado exitosamente');
    } catch (error) {
      console.error('Error generando reporte:', error);
      toast.error('Error al generar reporte');
    } finally {
      setIsExportingAll(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center">Cargando totales...</div>;
  }

  return (
    <div className="w-full space-y-4">
      {/* Botones globales */}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshCommissions}
          disabled={isRefreshing || Object.keys(groupedData).length === 0}
          className="text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Actualizar comisiones desde la base de datos"
        >
          <FaSyncAlt className={`mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Actualizando...' : 'Refrescar'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExportAll}
          disabled={isExportingAll || Object.keys(groupedData).length === 0}
          className="text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors"
        >
          <FaFilePdf className="mr-2" />
          {isExportingAll ? 'Generando...' : 'Descargar PDF'}
        </Button>
      </div>

      {/* Vista Mobile - Cards */}
      <div className="block lg:hidden space-y-3">
        {Object.entries(groupedData)
          .sort(([, a], [, b]) => toTitleCaseName(a.broker_name).localeCompare(toTitleCaseName(b.broker_name)))
          .map(([brokerId, brokerData]) => (
            <div key={brokerId} className={`rounded-lg border-l-4 overflow-hidden ${
              brokerData.is_retained 
                ? 'bg-red-50 border-red-500' 
                : 'bg-blue-50/50 border-blue-500'
            }`}>
              {/* Header del Broker */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => toggleBroker(brokerId)}
                        className="p-1 h-auto"
                      >
                        {expandedBrokers.has(brokerId) ? <FaChevronDown size={14} /> : <FaChevronRight size={14} />}
                      </Button>
                      <h3 className="font-bold text-[#010139] text-sm">{toTitleCaseName(brokerData.broker_name)}</h3>
                      {brokerData.is_retained && (
                        <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full font-semibold">RET</span>
                      )}
                    </div>
                  </div>
                  <div className="relative flex-shrink-0 overflow-visible">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuBroker(openMenuBroker === brokerId ? null : brokerId);
                      }}
                      className="p-2 h-auto"
                    >
                      <FaEllipsisV size={14} className="text-gray-600" />
                    </Button>
                    {openMenuBroker === brokerId && (
                      <>
                        <div 
                          className="fixed inset-0 z-[100]" 
                          onClick={() => setOpenMenuBroker(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                          <button
                            onClick={() => {
                              setManagementModal({
                                isOpen: true,
                                brokerId,
                                brokerName: brokerData.broker_name,
                                grossAmount: brokerData.total_gross
                              });
                              setOpenMenuBroker(null);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-[#8AAA19]/10 flex items-center gap-3 text-sm text-[#8AAA19] font-semibold"
                          >
                            <FaMoneyBillWave size={14} /> Gestionar Adelantos
                          </button>
                          <div className="border-t border-gray-100 my-1"></div>
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
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Montos */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-gray-600 mb-1">Bruta</div>
                    <div className="font-mono font-semibold text-gray-800">
                      ${brokerData.total_gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-red-600 mb-1">Desc.</div>
                    <div className="font-mono font-semibold text-red-700">
                      -${brokerData.total_discounts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[#8AAA19] mb-1">Neto</div>
                    <div className="font-mono font-bold text-[#8AAA19] text-base">
                      ${brokerData.total_net.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Aseguradoras expandidas */}
              {expandedBrokers.has(brokerId) && (
                <div className="border-t border-gray-200 bg-white">
                  {Object.entries(brokerData.insurers).map(([insurerId, insurerData]) => (
                    <div key={insurerId} className="border-b border-gray-100 last:border-b-0">
                      <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => toggleInsurer(insurerId)} 
                            className="p-1 h-auto flex-shrink-0"
                          >
                            {expandedInsurers.has(insurerId) ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                          </Button>
                          <span className="text-sm font-semibold text-gray-700 truncate">{insurerData.insurer_name}</span>
                        </div>
                        <span className="text-sm font-mono text-gray-700 flex-shrink-0">
                          ${insurerData.total_gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {expandedInsurers.has(insurerId) && (
                        <div className="px-3 pb-3 space-y-1">
                          {insurerData.clients.map((client, index) => (
                            <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                              <span className="text-gray-600 flex-1 min-w-0 truncate">
                                <span className="inline-block w-1 h-1 bg-gray-400 rounded-full mr-2"></span>
                                {client.name}
                              </span>
                              <span className="font-mono text-gray-700 ml-2 flex-shrink-0">
                                ${client.gross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Vista Desktop - Tabla */}
      <div className="hidden lg:block bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
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
              .sort(([, a], [, b]) => toTitleCaseName(a.broker_name).localeCompare(toTitleCaseName(b.broker_name)))
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
                      <span>{toTitleCaseName(brokerData.broker_name)}</span>
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
                    <div className="relative overflow-visible">
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
                          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[101]">
                            <button
                              onClick={() => {
                                setManagementModal({
                                  isOpen: true,
                                  brokerId,
                                  brokerName: brokerData.broker_name,
                                  grossAmount: brokerData.total_gross
                                });
                                setOpenMenuBroker(null);
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-[#8AAA19]/10 flex items-center gap-3 text-sm text-[#8AAA19] font-semibold"
                            >
                              <FaMoneyBillWave size={14} /> Gestionar Adelantos
                            </button>
                            <div className="border-t border-gray-100 my-1"></div>
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
      {managementModal?.isOpen && (
        <AdvancesManagementModal
          isOpen={managementModal.isOpen}
          onClose={() => setManagementModal(null)}
          brokerId={managementModal.brokerId}
          brokerName={managementModal.brokerName}
          fortnightId={draftFortnightId}
          grossAmount={managementModal.grossAmount}
          onDiscountsApplied={async () => {
            // Recargar descuentos temporales inmediatamente
            try {
              const response = await fetch(`/api/commissions/fortnight-discounts?fortnight_id=${draftFortnightId}`);
              const discountsData = await response.json();
              
              if (discountsData.ok) {
                const discountsByBroker: Record<string, number> = {};
                (discountsData.data || []).forEach((d: any) => {
                  if (!discountsByBroker[d.broker_id]) {
                    discountsByBroker[d.broker_id] = 0;
                  }
                  discountsByBroker[d.broker_id] += d.amount;
                });
                setBrokerDiscounts(discountsByBroker);
              }
            } catch (error) {
              console.error('Error reloading discounts:', error);
            }
            
            // Forzar recarga completa
            onRetentionChange();
          }}
        />
      )}
    </div>
  );
}
