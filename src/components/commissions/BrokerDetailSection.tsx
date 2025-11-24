'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { FaChevronDown, FaChevronRight, FaDownload } from 'react-icons/fa';
import { actionGetBrokerCommissionDetails } from '@/app/(app)/commissions/actions';
import { exportBrokerToPDF, exportBrokerToExcel } from '@/lib/commission-export-utils';

interface Props {
  fortnightId: string;
  fortnightLabel: string;
  brokers: Array<{
    broker_id: string;
    broker_name: string;
    net_amount: number;
    gross_amount: number;
    discounts_json: { total: number; details: Array<{ reason: string; amount: number }> };
  }>;
  role: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

const capitalizeText = (text: string) => {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export function BrokerDetailSection({ fortnightId, fortnightLabel, brokers, role }: Props) {
  // Para brokers, auto-expandir todo
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(role === 'broker' ? new Set(brokers.map(b => b.broker_id)) : new Set());
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [brokerDetails, setBrokerDetails] = useState<Map<string, any>>(new Map());
  const [loadingBroker, setLoadingBroker] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState<{ brokerId: string; brokerName: string } | null>(null);

  // Auto-cargar detalles para brokers al montar
  useEffect(() => {
    if (role === 'broker' && brokers.length > 0) {
      const loadBrokerDetails = async () => {
        for (const broker of brokers) {
          if (!brokerDetails.has(broker.broker_id)) {
            setLoadingBroker(broker.broker_id);
            const result = await actionGetBrokerCommissionDetails(fortnightId, broker.broker_id);
            
            if (result.ok && result.data && result.data.length > 0) {
              setBrokerDetails(prev => {
                const newDetails = new Map(prev);
                newDetails.set(broker.broker_id, result.data[0]);
                return newDetails;
              });
            }
            setLoadingBroker(null);
          }
        }
      };
      loadBrokerDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, brokers, fortnightId]);

  const toggleBroker = async (brokerId: string) => {
    // No permitir colapsar para brokers
    if (role === 'broker') return;
    
    const newExpanded = new Set(expandedBrokers);
    
    if (newExpanded.has(brokerId)) {
      newExpanded.delete(brokerId);
    } else {
      newExpanded.add(brokerId);
      
      // Load details if not already loaded
      if (!brokerDetails.has(brokerId)) {
        setLoadingBroker(brokerId);
        const result = await actionGetBrokerCommissionDetails(fortnightId, brokerId);
        
        if (result.ok && result.data && result.data.length > 0) {
          const newDetails = new Map(brokerDetails);
          newDetails.set(brokerId, result.data[0]);
          setBrokerDetails(newDetails);
        }
        setLoadingBroker(null);
      }
    }
    
    setExpandedBrokers(newExpanded);
  };

  const toggleInsurer = (key: string) => {
    const newExpanded = new Set(expandedInsurers);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedInsurers(newExpanded);
  };

  const handleDownload = async (brokerId: string, format: 'pdf' | 'xlsx') => {
    try {
      const broker = brokers.find(b => b.broker_id === brokerId);
      if (!broker) {
        console.error('Broker no encontrado');
        return;
      }

      // Ensure details are loaded
      let details = brokerDetails.get(brokerId);
      if (!details) {
        console.log('Cargando detalles del broker...');
        const result = await actionGetBrokerCommissionDetails(fortnightId, brokerId);
        console.log('Resultado de la acción:', result);
        
        if (result.ok && result.data && result.data.length > 0) {
          details = result.data[0];
          const newDetails = new Map(brokerDetails);
          newDetails.set(brokerId, details);
          setBrokerDetails(newDetails);
        } else {
          console.error('No se pudieron cargar los detalles:', result);
          return;
        }
      }

      if (!details) {
        console.error('Detalles no disponibles');
        return;
      }

      console.log('Generando reporte...', format, details);

      if (format === 'pdf') {
        exportBrokerToPDF(details, fortnightLabel, broker.discounts_json);
      } else {
        exportBrokerToExcel(details, fortnightLabel, broker.discounts_json);
      }

      setShowDownloadModal(null);
    } catch (error) {
      console.error('Error en handleDownload:', error);
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-[#8AAA19] rounded"></div>
          <h3 className="text-lg font-bold text-gray-800">Comisiones por Corredor</h3>
        </div>
        <span className="text-sm text-gray-600">{brokers.length} corredor{brokers.length !== 1 ? 'es' : ''}</span>
      </div>

      <div className="space-y-3">
        {brokers.map((broker) => {
          const isExpanded = expandedBrokers.has(broker.broker_id);
          const details = brokerDetails.get(broker.broker_id);
          const isLoading = loadingBroker === broker.broker_id;

          return (
            <Card key={broker.broker_id} className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="p-3 sm:p-4">
                {/* Broker Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full" onClick={() => toggleBroker(broker.broker_id)} style={{ cursor: role === 'broker' ? 'default' : 'pointer' }}>
                    {role === 'master' && (
                      isExpanded ? (
                        <FaChevronDown className="text-[#8AAA19] text-sm transition-transform" />
                      ) : (
                        <FaChevronRight className="text-gray-400 text-sm transition-transform" />
                      )
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-[#010139] text-sm sm:text-base truncate">{capitalizeText(broker.broker_name)}</h4>
                      <div className="flex flex-wrap gap-2 sm:gap-4 mt-1 text-xs sm:text-sm">
                        <span className="text-gray-600 whitespace-nowrap">
                          Bruto: <span className="font-mono font-medium">{formatCurrency(broker.gross_amount)}</span>
                        </span>
                        {broker.discounts_json?.total > 0 && (
                          <span className="text-red-600 whitespace-nowrap">
                            Desc: <span className="font-mono">-{formatCurrency(broker.discounts_json.total)}</span>
                          </span>
                        )}
                        <span className="text-[#8AAA19] font-bold whitespace-nowrap">
                          Neto: <span className="font-mono text-sm sm:text-base">{formatCurrency(broker.net_amount)}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Download button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDownloadModal({ brokerId: broker.broker_id, brokerName: broker.broker_name });
                    }}
                    className="hover:bg-[#8AAA19]/10 hover:text-[#8AAA19] transition-colors text-xs sm:text-sm w-full sm:w-auto"
                  >
                    <FaDownload className="mr-2 h-3 w-3" />
                    Descargar Mi Reporte
                  </Button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 pl-0 sm:pl-7">
                    {isLoading ? (
                      <div className="text-center py-8 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#8AAA19] mx-auto mb-2"></div>
                        Cargando detalles...
                      </div>
                    ) : details ? (
                      <div className="space-y-3">
                        {/* Insurers */}
                        {details.insurers.map((insurer: any, idx: number) => {
                          const insurerKey = `${broker.broker_id}-${insurer.insurer_id}`;
                          const isInsurerExpanded = expandedInsurers.has(insurerKey);

                          return (
                            <Card key={insurerKey} className="bg-gray-50 border border-gray-200">
                              <div 
                                className="p-2 sm:p-3 cursor-pointer hover:bg-gray-100 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                                onClick={() => toggleInsurer(insurerKey)}
                              >
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  {isInsurerExpanded ? (
                                    <FaChevronDown className="text-[#010139] text-xs" />
                                  ) : (
                                    <FaChevronRight className="text-gray-400 text-xs" />
                                  )}
                                  <span className="font-medium text-[#010139] text-sm sm:text-base truncate">{insurer.insurer_name}</span>
                                </div>
                                <div className="text-xs sm:text-sm pl-5 sm:pl-0">
                                  <span className="text-gray-600">{insurer.policies.length} póliza{insurer.policies.length !== 1 ? 's' : ''}</span>
                                  <span className="ml-2 sm:ml-3 font-mono font-semibold text-[#010139]">
                                    {formatCurrency(insurer.total_gross)}
                                  </span>
                                </div>
                              </div>

                              {/* Policies */}
                              {isInsurerExpanded && (
                                <CardContent className="p-2 sm:p-3 pt-0">
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-white">
                                          <TableHead className="text-xs min-w-[80px]">Póliza</TableHead>
                                          <TableHead className="text-xs min-w-[120px]">Cliente</TableHead>
                                          <TableHead className="text-xs text-right min-w-[70px]">Bruto</TableHead>
                                          <TableHead className="text-xs text-center min-w-[40px]">%</TableHead>
                                          <TableHead className="text-xs text-right min-w-[70px]">Neto</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {insurer.policies.map((policy: any, pIdx: number) => (
                                          <TableRow key={pIdx} className="text-sm hover:bg-white">
                                            <TableCell className="font-mono text-xs">{policy.policy_number}</TableCell>
                                            <TableCell className="text-xs truncate max-w-[150px]" title={policy.insured_name}>{policy.insured_name}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{formatCurrency(policy.gross_amount)}</TableCell>
                                            <TableCell className="text-center text-xs">{(policy.percentage * 100).toFixed(0)}%</TableCell>
                                            <TableCell className="text-right font-mono text-xs font-semibold text-[#8AAA19]">
                                              {formatCurrency(policy.net_amount)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </CardContent>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        No se pudieron cargar los detalles
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Download Modal */}
      {showDownloadModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowDownloadModal(null)}
        >
          <Card className="w-full max-w-sm m-4 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-[#010139] mb-4">Descargar Reporte</h3>
              <p className="text-sm text-gray-600 mb-4">
                {capitalizeText(showDownloadModal.brokerName)}
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleDownload(showDownloadModal.brokerId, 'pdf')}
                >
                  PDF
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleDownload(showDownloadModal.brokerId, 'xlsx')}
                >
                  Excel
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => setShowDownloadModal(null)}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
