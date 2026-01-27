'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaHistory, FaChevronDown, FaChevronRight, FaCheckCircle, FaFilePdf, FaFileExcel, FaDownload } from 'react-icons/fa';
import { exportBrokerToPDF, exportBrokerToExcel } from '@/lib/commission-export-utils';

interface FortnightDetailViewProps {
  fortnightId: string;
  fortnightData: {
    period_start: string;
    period_end: string;
    status: string;
  };
}

interface DetailItem {
  id: string;
  policy_number: string;
  client_name: string;
  ramo: string | null;
  commission_raw: number;
  percent_applied: number;
  commission_calculated: number;
  is_assa_code: boolean;
  assa_code: string | null;
}

interface InsurerGroup {
  insurer_name: string;
  insurer_id: string;
  items: DetailItem[];
  total: number;
}

interface BrokerDetail {
  broker_id: string;
  broker_name: string;
  broker_email?: string;
  percent_default?: number;
  insurers: InsurerGroup[];
  assa_codes: DetailItem[];
  gross_amount: number;
  net_amount: number;
  discount_amount: number;
  discounts_json?: {
    adelantos?: Array<{
      description: string;
      amount: number;
    }>;
    total?: number;
  };
  is_retained?: boolean;
  adjustments?: {
    total: number;
    insurers: Array<{
      insurer_id: string;
      insurer_name: string;
      total: number;
      items: Array<{
        policy_number: string;
        insured_name: string;
        commission_raw: number;
        broker_commission: number;
        percentage: number;
      }>;
    }>;
  } | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

export default function FortnightDetailView({ fortnightId, fortnightData }: FortnightDetailViewProps) {
  const [brokers, setBrokers] = useState<BrokerDetail[]>([]);
  const [expandedBrokers, setExpandedBrokers] = useState<Set<string>>(new Set());
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState({
    total_reportes: 0,
    total_corredores: 0,
    ganancia_oficina: 0
  });
  const [fortnightInfo, setFortnightInfo] = useState<{
    period_start: string;
    period_end: string;
    status: string;
  } | null>(null);
  const [downloadBrokerModal, setDownloadBrokerModal] = useState<{
    broker: BrokerDetail;
    label: string;
  } | null>(null);
  const [ramosTotals, setRamosTotals] = useState({ vida: 0, generales: 0 });

  useEffect(() => {
    loadDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fortnightId]);

  // Constantes para filtrar datos
  const LISSA_EMAIL = 'contacto@lideresenseguros.com';

  const loadDetails = async () => {
    setLoading(true);
    try {
      // Obtener detalles de la quincena
      const response = await fetch(`/api/commissions/fortnight-details?fortnight_id=${fortnightId}`);
      const data = await response.json();
      
      if (data.ok) {
        const brokersData = data.brokers || [];
        
        // Filtrar LISSA de los brokers si está presente
        const lissaBroker = brokersData.find(b => b.broker_email === LISSA_EMAIL);
        if (lissaBroker) {
          console.log('Encontrado LISSA broker en los datos:', lissaBroker.broker_name, 'con monto:', lissaBroker.gross_amount);
        }
        
        setBrokers(brokersData);
        
        // Usar totales del API que ya vienen filtrados sin LISSA
        setTotals(data.totals || { total_reportes: 0, total_corredores: 0, ganancia_oficina: 0 });
        if (data.fortnight) {
          setFortnightInfo(data.fortnight);
        }
        
        // Calcular totales por ramo desde comm_imports
        const fetchRamosTotals = async () => {
          try {
            // Obtener imports con is_life_insurance
            const importsResponse = await fetch(`/api/commissions/imports-by-fortnight?fortnight_id=${fortnightId}`);
            
            if (!importsResponse.ok) {
              // Si no existe el endpoint, usar método alternativo
              let vida = 0;
              let generales = 0;
              
              // Calcular desde totales: usar proporción de ganancia de oficina
              const gananciaOficina = data.totals?.ganancia_oficina || 0;
              // Por ahora, asignar todo a generales si no hay info de imports
              generales = gananciaOficina;
              
              setRamosTotals({ vida, generales });
              return;
            }
            
            const importsData = await importsResponse.json();
            let vida = 0;
            let generales = 0;
            
            // Clasificar según is_life_insurance
            for (const imp of importsData.imports || []) {
              if (imp.is_life_insurance) {
                vida += imp.office_profit || 0;
              } else {
                generales += imp.office_profit || 0;
              }
            }
            
            setRamosTotals({ vida, generales });
          } catch (error) {
            console.error('Error loading ramos from imports:', error);
            // Fallback: todo a generales
            setRamosTotals({ vida: 0, generales: data.totals?.ganancia_oficina || 0 });
          }
        };
        
        fetchRamosTotals();
      }
    } catch (error) {
      console.error('Error cargando detalles:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleBroker = (brokerId: string) => {
    const newExpanded = new Set(expandedBrokers);
    if (newExpanded.has(brokerId)) {
      newExpanded.delete(brokerId);
    } else {
      newExpanded.add(brokerId);
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

  const formatPeriod = () => {
    const info = fortnightInfo || fortnightData;
    if (!info.period_start || !info.period_end) return 'Quincena';
    const start = new Date(info.period_start);
    const end = new Date(info.period_end);
    const month = end.toLocaleDateString('es-PA', { month: 'long' });
    const year = end.getFullYear();
    return `${start.getUTCDate()}-${end.getUTCDate()} ${month} ${year}`;
  };

  // Transformar broker al formato esperado por las funciones de export
  const transformBrokerForExport = (broker: any) => {
    return {
      broker_name: broker.broker_name,
      broker_email: broker.broker_email || '',
      percent_default: broker.percent_default || 0,
      total_gross: broker.gross_amount,
      total_net: broker.net_amount,
      discounts_json: broker.discounts_json || {},
      is_retained: broker.is_retained || false,
      insurers: broker.insurers.map((insurer: any) => ({
        insurer_name: insurer.insurer_name,
        total_gross: insurer.total,
        policies: insurer.items.map((item: any) => ({
          policy_number: item.policy_number,
          insured_name: item.client_name,
          gross_amount: item.commission_raw,
          percentage: item.percent_applied,
          net_amount: item.commission_calculated,
        }))
      })),
      assa_codes: (broker.assa_codes || []).map((item: any) => ({
        policy_number: item.policy_number,
        assa_code: item.assa_code,
        client_name: item.client_name,
        commission_raw: item.commission_raw,
        percent_applied: item.percent_applied,
        commission_calculated: item.commission_calculated,
        net_amount: item.commission_calculated,
      }))
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header de Quincena */}
      <Card className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-6 border-l-4 border-[#010139] shadow-md">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#010139] flex items-center gap-2">
              <FaHistory className="text-xl" />
              QUINCENA: {formatPeriod()}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold flex items-center gap-1">
                <FaCheckCircle />
                {(fortnightInfo || fortnightData).status === 'PAID' ? 'PAGADA' : (fortnightInfo || fortnightData).status}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Totales Generales */}
      <Card className="bg-white shadow-lg border-2 border-gray-100 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4">📊 TOTALES GENERALES</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium">Total Reportes</p>
            <p className="text-2xl font-bold text-blue-900 font-mono">
              ${totals.total_reportes.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gradient-to-r from-[#8AAA19]/10 to-[#8AAA19]/20 rounded-lg p-4 border-l-4 border-[#8AAA19]">
            <p className="text-sm text-gray-600 font-medium">Total Corredores</p>
            <p className="text-2xl font-bold text-[#8AAA19] font-mono">
              ${totals.total_corredores.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-l-4 border-gray-500">
            <p className="text-sm text-gray-600 font-medium">Ganancia Oficina</p>
            <p className="text-2xl font-bold text-gray-900 font-mono">
              ${totals.ganancia_oficina.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </Card>

      {/* Totales por Tipo de Seguro */}
      <Card className="bg-white shadow-lg border-2 border-gray-100 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4">🏥 TOTALES POR TIPO DE SEGURO</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-l-4 border-blue-500">
            <p className="text-sm text-blue-700 font-semibold mb-2">VIDA</p>
            <p className="text-3xl font-bold text-blue-900 font-mono">
              ${ramosTotals.vida.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-blue-600 mt-1">Seguros de vida</p>
          </div>
          <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-l-4 border-green-500">
            <p className="text-sm text-green-700 font-semibold mb-2">RAMOS GENERALES</p>
            <p className="text-3xl font-bold text-green-900 font-mono">
              ${ramosTotals.generales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-green-600 mt-1">Otros seguros (auto, hogar, etc.)</p>
          </div>
        </div>
      </Card>

      {/* Lista de Corredores */}
      <Card className="bg-white shadow-lg border-2 border-gray-100 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4">
          👥 CORREDORES PAGADOS ({brokers.length})
        </h3>

        {brokers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FaHistory className="text-4xl mx-auto mb-2 text-gray-300" />
            <p>No hay detalles disponibles para esta quincena</p>
          </div>
        ) : (
          <div className="space-y-4">
            {brokers.map((broker) => (
              <div key={broker.broker_id} className="border-2 border-gray-200 rounded-xl overflow-hidden">
                {/* Header del Broker */}
                <div className="w-full bg-gradient-to-r from-gray-50 to-gray-100 p-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <button
                      onClick={() => toggleBroker(broker.broker_id)}
                      className="flex items-center gap-3 flex-1"
                    >
                      {expandedBrokers.has(broker.broker_id) ? (
                        <FaChevronDown className="text-[#010139]" />
                      ) : (
                        <FaChevronRight className="text-[#010139]" />
                      )}
                      <span className="text-lg font-bold text-[#010139]">{broker.broker_name}</span>
                    </button>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className="text-right flex-1 md:flex-initial">
                        <p className="text-sm text-gray-600">Total Neto</p>
                        <p className="text-xl font-bold text-[#8AAA19] font-mono">
                          ${(broker.net_amount - (broker.discounts_json?.total || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDownloadBrokerModal({ broker, label: formatPeriod() });
                        }}
                        className="border-[#8AAA19] text-[#8AAA19] hover:bg-[#8AAA19]/10 px-3 py-1"
                      >
                        <FaDownload className="mr-2 h-3 w-3" />
                        Descargar
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Detalle del Broker (Expandible) */}
                {expandedBrokers.has(broker.broker_id) && (
                  <div className="p-4 space-y-4 bg-white">
                    {/* AJUSTES - Sección Separada */}
                    {broker.adjustments && broker.adjustments.total > 0 && (
                      <div className="mb-6 p-4 bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-lg font-bold text-amber-800">⚠️ AJUSTES</span>
                          <Badge className="bg-amber-600 text-white">
                            {formatCurrency(broker.adjustments.total)}
                          </Badge>
                        </div>

                        {/* Ajustes por Aseguradora */}
                        {broker.adjustments.insurers.map((adjInsurer: any) => (
                          <div key={`adj-${broker.broker_id}-${adjInsurer.insurer_id}`} className="border border-amber-200 bg-white rounded-lg overflow-hidden mb-3">
                            {/* Header de Aseguradora - Ajustes */}
                            <div className="bg-gradient-to-r from-amber-100 to-orange-100 p-3 flex justify-between items-center">
                              <div>
                                <h4 className="font-bold text-amber-900">{adjInsurer.insurer_name}</h4>
                                <p className="text-xs text-amber-700">Ajustes</p>
                              </div>
                              <span className="font-mono font-bold text-amber-800">
                                {formatCurrency(adjInsurer.total)}
                              </span>
                            </div>

                            {/* Lista de Clientes - Ajustes */}
                            <div className="p-3">
                              <div className="space-y-1">
                                {adjInsurer.items.map((item: any, idx: number) => (
                                  <div key={`adj-item-${idx}`} className="flex justify-between items-center py-2 px-3 hover:bg-amber-50 rounded border-b border-amber-100 last:border-0">
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-900 text-sm">
                                        {item.policy_number}
                                      </p>
                                      <p className="text-xs text-gray-600">{item.insured_name}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-mono text-sm text-gray-700">
                                        ${Math.abs(item.commission_raw).toFixed(2)}
                                      </p>
                                      <p className="font-mono text-xs font-semibold text-amber-700">
                                        {item.percentage}% → ${item.broker_commission.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Aseguradoras Regulares */}
                    {broker.insurers.map((insurer) => {
                      const key = `${broker.broker_id}-${insurer.insurer_id}`;
                      return (
                        <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Header de Aseguradora */}
                          <button
                            onClick={() => toggleInsurer(key)}
                            className="w-full bg-gradient-to-r from-blue-50 to-white p-3 flex items-center justify-between hover:from-blue-100 hover:to-blue-50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              {expandedInsurers.has(key) ? (
                                <FaChevronDown className="text-sm text-blue-600" />
                              ) : (
                                <FaChevronRight className="text-sm text-blue-600" />
                              )}
                              <span className="font-semibold text-[#010139]">{insurer.insurer_name}</span>
                              <span className="text-xs text-gray-500">({insurer.items.length} pólizas)</span>
                            </div>
                            <span className="font-bold text-blue-900 font-mono">
                              ${insurer.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </button>

                          {/* Items de la Aseguradora (Expandible) */}
                          {expandedInsurers.has(key) && (
                            <div className="p-3 bg-gray-50 space-y-2">
                              {insurer.items.map((item) => (
                                <div key={item.id} className="bg-white p-3 rounded border border-gray-200 text-sm">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <p className="font-semibold text-[#010139]">
                                        {item.client_name}
                                      </p>
                                      <p className="text-gray-600">
                                        {item.policy_number}
                                        {item.ramo && <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded">{item.ramo}</span>}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-bold text-gray-900 font-mono">
                                        ${item.commission_calculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        ({Math.round(item.percent_applied * 100)}%)
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Códigos ASSA */}
                    {broker.assa_codes.length > 0 && (
                      <div className="border border-yellow-300 rounded-lg overflow-hidden bg-yellow-50/30">
                        <div className="bg-gradient-to-r from-yellow-100 to-yellow-50 p-3 border-b border-yellow-300">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#010139]">
                              🔢 Códigos ASSA ({broker.assa_codes.length})
                            </span>
                            <span className="font-bold text-yellow-900 font-mono">
                              ${broker.assa_codes.reduce((sum, item) => sum + item.commission_calculated, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        <div className="p-3 space-y-2">
                          {broker.assa_codes.map((item) => (
                            <div key={item.id} className="bg-white p-2 rounded border border-yellow-200 text-sm flex items-center justify-between">
                              <span className="font-medium text-[#010139]">{item.assa_code}</span>
                              <div className="text-right">
                                <p className="font-bold text-gray-900 font-mono">
                                  ${item.commission_calculated.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs text-gray-500">(100%)</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resumen del Broker */}
                    <div className="border-t-2 border-gray-300 pt-4 mt-4 space-y-3">
                      {/* Total Bruto */}
                      <div className="flex justify-between items-center pb-2">
                        <p className="text-sm font-semibold text-gray-700">Total Bruto:</p>
                        <p className="text-lg font-bold text-gray-900 font-mono">
                          ${broker.net_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* Descuentos Detallados */}
                      {broker.discounts_json && broker.discounts_json.adelantos && broker.discounts_json.adelantos.length > 0 ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <p className="text-sm font-bold text-red-800 mb-2">DESCUENTOS APLICADOS:</p>
                          <div className="space-y-1">
                            {broker.discounts_json.adelantos.map((desc, idx) => (
                              <div key={idx} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700">• {desc.description || 'Adelanto'}</span>
                                <span className="font-mono text-red-700 font-semibold">
                                  ${desc.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-red-300">
                            <span className="text-sm font-bold text-red-900">Total Descuentos:</span>
                            <span className="font-mono text-red-900 font-bold">
                              ${(broker.discounts_json.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-sm pb-2">
                          <span className="text-gray-600">Descuentos:</span>
                          <span className="font-mono text-gray-900">$0.00</span>
                        </div>
                      )}

                      {/* Línea divisoria */}
                      <div className="border-t-2 border-gray-400 pt-3">
                        <div className="flex justify-between items-center">
                          <p className="text-base font-bold text-gray-900">TOTAL NETO:</p>
                          <p className="text-2xl font-bold text-[#8AAA19] font-mono">
                            ${(broker.net_amount - (broker.discounts_json?.total || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Alerta de Retención */}
                      {broker.is_retained && (
                        <div className="bg-red-100 border-2 border-red-400 rounded-lg p-3 text-center">
                          <p className="text-sm font-bold text-red-900">
                            ⚠️ RETENCIÓN APLICADA - PENDIENTE DE PAGO
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de Descarga por Broker */}
      {downloadBrokerModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setDownloadBrokerModal(null)}
        >
          <Card className="w-full max-w-sm m-4 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-bold text-[#010139] mb-2">Descargar Reporte</h3>
              <p className="text-sm text-gray-600 mb-2">
                {downloadBrokerModal.broker.broker_name}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {downloadBrokerModal.label}
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={async () => {
                    const transformedBroker = transformBrokerForExport(downloadBrokerModal.broker);
                    await exportBrokerToPDF(transformedBroker as any, downloadBrokerModal.label);
                    setDownloadBrokerModal(null);
                  }}
                >
                  <FaFilePdf className="mr-2" />
                  PDF
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const transformedBroker = transformBrokerForExport(downloadBrokerModal.broker);
                    exportBrokerToExcel(transformedBroker as any, downloadBrokerModal.label);
                    setDownloadBrokerModal(null);
                  }}
                >
                  <FaFileExcel className="mr-2" />
                  Excel
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => setDownloadBrokerModal(null)}
              >
                Cancelar
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
