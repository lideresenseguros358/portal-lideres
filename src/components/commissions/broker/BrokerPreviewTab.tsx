'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  FaHistory, 
  FaChevronDown, 
  FaChevronRight, 
  FaDownload, 
  FaCheckCircle,
  FaHandHoldingUsd,
  FaExclamationTriangle
} from 'react-icons/fa';
import { actionGetClosedFortnights, actionGetLastClosedFortnight, actionGetRetentionStatus } from '@/app/(app)/commissions/actions';
import { exportBrokerToPDF, exportBrokerToExcel } from '@/lib/commission-export-utils';
import { toast } from 'sonner';

interface Props {
  brokerId: string;
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

interface AdjustmentItem {
  policy_number: string;
  insured_name: string;
  commission_raw: number;
  broker_commission: number;
  percentage: number;
}

interface AdjustmentInsurer {
  insurer_id: string;
  insurer_name: string;
  total: number;
  items: AdjustmentItem[];
}

interface BrokerDetail {
  broker_id: string;
  broker_name: string;
  broker_email: string;
  insurers: InsurerGroup[];
  assa_codes: DetailItem[];
  gross_amount: number;
  net_amount: number;
  discount_amount: number;
  discounts_json?: {
    total: number;
    adelantos?: Array<{
      description: string;
      amount: number;
    }>;
    details?: Array<{
      reason: string;
      amount: number;
    }>;
  };
  is_retained?: boolean;
  adjustments?: {
    total: number;
    insurers: AdjustmentInsurer[];
  } | null;
}

interface FortnightData {
  id: string;
  label: string;
  fortnight_number: number;
  brokers: { broker_id: string; broker_name: string; net_amount: number; gross_amount: number }[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount);
};

const monthOptions = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

const yearOptions = Array.from({ length: 5 }, (_, idx) => new Date().getFullYear() - idx);

export default function BrokerPreviewTab({ brokerId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedFortnight, setSelectedFortnight] = useState<'all' | '1' | '2'>('all');
  const [fortnights, setFortnights] = useState<FortnightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);
  const [expandedFortnights, setExpandedFortnights] = useState<Set<string>>(new Set());
  const [expandedInsurers, setExpandedInsurers] = useState<Set<string>>(new Set());
  const [fortnightDetails, setFortnightDetails] = useState<Record<string, BrokerDetail | null>>({});
  const [loadingDetails, setLoadingDetails] = useState<Record<string, boolean>>({});
  const [retentionStatus, setRetentionStatus] = useState<Record<string, any>>({});
  const [downloadModal, setDownloadModal] = useState<{
    fortnightId: string;
    label: string;
  } | null>(null);

  const loadFortnights = useCallback(async () => {
    if (!initialFiltersApplied) return;
    setLoading(true);
    try {
      const fortnightNum = selectedFortnight === 'all' ? undefined : parseInt(selectedFortnight, 10);
      const result = await actionGetClosedFortnights(year, month, fortnightNum, brokerId);
      if (result.ok) {
        setFortnights((result.data as FortnightData[]) || []);
      } else {
        setFortnights([]);
        if (result.error) {
          toast.error('Error al cargar quincenas', { description: result.error });
        }
      }
    } catch (error) {
      console.error('Error loading fortnights:', error);
      toast.error('Error al cargar quincenas');
      setFortnights([]);
    } finally {
      setLoading(false);
    }
  }, [year, month, selectedFortnight, initialFiltersApplied, brokerId]);

  useEffect(() => {
    loadFortnights();
  }, [loadFortnights]);

  useEffect(() => {
    if (initialFiltersApplied) return;
    const applyLastFortnight = async () => {
      try {
        const result = await actionGetLastClosedFortnight();
        if (result.ok && result.data) {
          const endDate = new Date(result.data);
          setYear(endDate.getUTCFullYear());
          setMonth(endDate.getUTCMonth() + 1);
          setSelectedFortnight(endDate.getUTCDate() <= 15 ? '1' : '2');
        }
      } catch (error) {
        console.error('Error obteniendo última quincena cerrada', error);
      } finally {
        setInitialFiltersApplied(true);
      }
    };

    applyLastFortnight();
  }, [initialFiltersApplied]);

  const filteredFortnights = useMemo(() => {
    return fortnights.filter(fortnight => fortnight.brokers && fortnight.brokers.length > 0);
  }, [fortnights]);

  const loadFortnightDetails = async (fortnightId: string) => {
    if (fortnightDetails[fortnightId]) return;
    
    setLoadingDetails(prev => ({ ...prev, [fortnightId]: true }));
    try {
      const response = await fetch(`/api/commissions/fortnight-details?fortnight_id=${fortnightId}`);
      const data = await response.json();
      
      if (data.ok && data.brokers) {
        const myBroker = data.brokers.find((b: any) => b.broker_id === brokerId);
        setFortnightDetails(prev => ({ ...prev, [fortnightId]: myBroker || null }));
      } else {
        setFortnightDetails(prev => ({ ...prev, [fortnightId]: null }));
      }
    } catch (error) {
      console.error('Error loading fortnight details:', error);
      setFortnightDetails(prev => ({ ...prev, [fortnightId]: null }));
      toast.error('Error al cargar detalles');
    } finally {
      setLoadingDetails(prev => ({ ...prev, [fortnightId]: false }));
    }
  };

  const toggleFortnight = async (fortnightId: string) => {
    const newExpanded = new Set(expandedFortnights);
    if (newExpanded.has(fortnightId)) {
      newExpanded.delete(fortnightId);
    } else {
      newExpanded.add(fortnightId);
      loadFortnightDetails(fortnightId);
      // Cargar estado de retención
      if (!retentionStatus[fortnightId]) {
        const result = await actionGetRetentionStatus(brokerId, fortnightId);
        if (result.ok) {
          setRetentionStatus(prev => ({ ...prev, [fortnightId]: result.data }));
        }
      }
    }
    setExpandedFortnights(newExpanded);
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

  const handleDownload = (fortnightId: string, fortnightLabel: string, format: 'pdf' | 'xlsx') => {
    const details = fortnightDetails[fortnightId];
    if (!details) {
      toast.error('No hay detalles disponibles para descargar');
      return;
    }

    try {
      const transformedBroker = {
        broker_name: details.broker_name,
        broker_email: details.broker_email || '',
        percent_default: 0,
        total_gross: details.gross_amount,
        total_net: details.net_amount,
        discounts_json: details.discounts_json || {},
        is_retained: details.is_retained || false,
        insurers: details.insurers.map(insurer => ({
          insurer_name: insurer.insurer_name,
          total_gross: insurer.total,
          policies: insurer.items.map(item => ({
            policy_number: item.policy_number,
            insured_name: item.client_name,
            gross_amount: item.commission_raw,
            percentage: item.percent_applied,
            net_amount: item.commission_calculated,
          }))
        })),
        adjustments: details.adjustments
      };

      const discounts = details.discounts_json?.details ? {
        total: details.discounts_json.total,
        details: details.discounts_json.details
      } : undefined;

      if (format === 'pdf') {
        exportBrokerToPDF(transformedBroker as any, fortnightLabel, discounts);
        toast.success('PDF generado correctamente');
      } else {
        exportBrokerToExcel(transformedBroker as any, fortnightLabel, discounts);
        toast.success('Excel generado correctamente');
      }
      setDownloadModal(null);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error(`No se pudo generar el reporte ${format.toUpperCase()}`);
    }
  };

  const isLoading = loading || !initialFiltersApplied;
  const noData = !isLoading && filteredFortnights.length === 0;

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 pb-4">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <FaHistory className="text-[#010139] text-xl" />
              <h2 className="text-2xl sm:text-3xl font-bold text-[#010139]">HISTORIAL DE QUINCENAS</h2>
            </div>
            <p className="text-sm text-gray-600">
              Consulta y descarga reportes detallados de quincenas cerradas
            </p>
          </div>
          
          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">AÑO:</label>
              <Select value={String(year)} onValueChange={value => setYear(Number(value))}>
                <SelectTrigger className="w-full sm:w-28 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map(option => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">MES:</label>
              <Select value={String(month)} onValueChange={value => setMonth(Number(value))}>
                <SelectTrigger className="w-full sm:w-36 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(option => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">QUINCENA:</label>
              <Select
                value={selectedFortnight}
                onValueChange={value => setSelectedFortnight(value as 'all' | '1' | '2')}
              >
                <SelectTrigger className="w-full sm:w-48 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Quincena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ambas</SelectItem>
                  <SelectItem value="1">Primera (Q1)</SelectItem>
                  <SelectItem value="2">Segunda (Q2)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 sm:ml-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#010139]"></div>
                <span className="hidden sm:inline">Cargando...</span>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Empty State */}
      {noData && (
        <Card className="bg-white shadow-lg border-2 border-dashed border-gray-300">
          <CardContent className="text-center py-12 sm:py-20">
            <div className="mb-4">
              <FaHistory className="text-5xl sm:text-6xl text-gray-300 mx-auto" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
              No hay quincenas cerradas para el período seleccionado
            </h3>
            <p className="text-sm text-gray-500">
              Seleccione otro mes o año para ver el historial de quincenas pagadas
            </p>
          </CardContent>
        </Card>
      )}

      {/* Fortnights List */}
      {filteredFortnights.map(fortnight => {
        const myBrokerEntry = fortnight.brokers.find(b => b.broker_id === brokerId);
        if (!myBrokerEntry) return null;

        const isExpanded = expandedFortnights.has(fortnight.id);
        const details = fortnightDetails[fortnight.id];
        const isLoadingDetail = loadingDetails[fortnight.id];

        return (
          <Card key={fortnight.id} className="overflow-hidden shadow-lg border-2 border-gray-100">
            <CardHeader 
              className="flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer hover:from-gray-100 hover:to-gray-150 transition-all duration-200 gap-3"
              onClick={() => toggleFortnight(fortnight.id)}
            >
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                {isExpanded ? (
                  <FaChevronDown className="text-[#010139] transition-transform text-lg sm:text-xl" />
                ) : (
                  <FaChevronRight className="text-gray-400 transition-transform text-lg sm:text-xl" />
                )}
                <div className="flex-1">
                  <CardTitle className="text-lg sm:text-xl font-bold text-[#010139]">{fortnight.label}</CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1">
                    Total Neto: <span className="font-bold text-[#8AAA19]">
                      {formatCurrency(myBrokerEntry.net_amount)}
                    </span>
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-[#8AAA19]/20 hover:bg-[#8AAA19] hover:text-white transition-colors px-3 py-1"
                onClick={(event) => {
                  event.stopPropagation();
                  setDownloadModal({ fortnightId: fortnight.id, label: fortnight.label });
                }}
              >
                <FaDownload className="mr-2 h-3 w-3" />
                Descargar
              </Button>
            </CardHeader>

            {isExpanded && (
              <CardContent className="p-0 bg-white">
                {isLoadingDetail ? (
                  <div className="flex items-center justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
                    <span className="ml-3 text-gray-600">Cargando detalles...</span>
                  </div>
                ) : details ? (
                  <div className="p-6 space-y-6">
                    {/* Mensajes de Retención */}
                    {(() => {
                      const retention = retentionStatus[fortnight.id];
                      if (retention) {
                        // Si la retención fue pagada en OTRA quincena
                        if (retention.status === 'paid' && retention.applied_fortnight_id) {
                          const paidFortnight = retention.applied_fortnight;
                          return (
                            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                              <div className="flex items-start gap-3">
                                <FaCheckCircle className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                                <div className="flex-1">
                                  <h4 className="font-bold text-blue-800 text-sm sm:text-base mb-2">
                                    Comisión Retenida - Liberada
                                  </h4>
                                  <p className="text-xs sm:text-sm text-blue-700 leading-relaxed">
                                    Esta comisión fue <strong>retenida</strong> en esta quincena pero posteriormente fue <strong>liberada y pagada</strong>.
                                  </p>
                                  {paidFortnight && (
                                    <p className="text-xs sm:text-sm text-blue-700 mt-2 font-semibold">
                                      📍 Busca el detalle completo en la quincena: <strong>
                                        {new Date(paidFortnight.period_start).toLocaleDateString('es-PA')} - {new Date(paidFortnight.period_end).toLocaleDateString('es-PA')}
                                      </strong> (Quincena #{paidFortnight.fortnight_number})
                                    </p>
                                  )}
                                  <p className="text-xs text-blue-600 mt-2">
                                    💰 Monto liberado: <strong>{formatCurrency(retention.net_amount)}</strong>
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        
                        // Si la retención está pendiente o asociada a quincena pero no pagada aún
                        if (retention.status === 'pending' || retention.status === 'associated_to_fortnight') {
                          return (
                            <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                              <div className="flex items-start gap-3">
                                <FaHandHoldingUsd className="text-red-600 flex-shrink-0 mt-1" size={20} />
                                <div className="flex-1">
                                  <h4 className="font-bold text-red-800 text-sm sm:text-base mb-2 flex items-center gap-2">
                                    <FaExclamationTriangle size={16} />
                                    Este Pago Fue Retenido
                                  </h4>
                                  <p className="text-xs sm:text-sm text-red-700 leading-relaxed">
                                    Esta comisión ha sido <strong>retenida temporalmente</strong> y <strong>NO ha sido depositada</strong>.
                                  </p>
                                  <p className="text-xs sm:text-sm text-red-700 mt-2">
                                    Por favor <strong>contacta a un administrador</strong> para solventar el estatus de tu pago y conocer los detalles de la retención.
                                  </p>
                                  {retention.status === 'associated_to_fortnight' && retention.applied_fortnight && (
                                    <p className="text-xs text-red-600 mt-2 font-semibold">
                                      📅 Programado para liberarse en: <strong>
                                        {new Date(retention.applied_fortnight.period_start).toLocaleDateString('es-PA')} - {new Date(retention.applied_fortnight.period_end).toLocaleDateString('es-PA')}
                                      </strong>
                                    </p>
                                  )}
                                  <p className="text-xs text-red-600 mt-2">
                                    💵 Monto retenido: <strong>{formatCurrency(retention.net_amount)}</strong>
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }
                      }
                      return null;
                    })()}

                    {/* Solo mostrar detalle si NO fue pagado en otra quincena */}
                    {(() => {
                      const retention = retentionStatus[fortnight.id];
                      // Si fue pagado en otra quincena, NO mostrar detalle
                      if (retention && retention.status === 'paid' && retention.applied_fortnight_id) {
                        return null;
                      }
                      
                      // Mostrar detalle completo
                      return (
                        <>
                          {/* Resumen de Montos */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="shadow-inner">
                              <CardContent className="p-4">
                                <p className="text-sm text-gray-600">Bruto</p>
                                <p className="text-2xl font-bold text-[#010139]">{formatCurrency(details.gross_amount)}</p>
                              </CardContent>
                            </Card>
                            <Card className="shadow-inner">
                              <CardContent className="p-4">
                                <p className="text-sm text-gray-600">Descuentos</p>
                                <p className="text-2xl font-bold text-red-600">
                                  {formatCurrency(details.discounts_json?.total || 0)}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="shadow-inner">
                              <CardContent className="p-4">
                                <p className="text-sm text-gray-600">Neto Pagado</p>
                                <p className="text-2xl font-bold text-[#8AAA19]">{formatCurrency(details.net_amount)}</p>
                              </CardContent>
                            </Card>
                          </div>

                          {/* Aseguradoras con Pólizas */}
                          <div>
                      <h4 className="mb-3 text-base font-bold text-[#010139]">Detalle por Aseguradora</h4>
                      <div className="space-y-3">
                        {details.insurers.map((insurer) => {
                          const insurerKey = `${fortnight.id}-${insurer.insurer_id}`;
                          const isInsurerExpanded = expandedInsurers.has(insurerKey);
                          
                          return (
                            <Card key={insurerKey} className="border-2 border-gray-100">
                              <div
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleInsurer(insurerKey)}
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  {isInsurerExpanded ? (
                                    <FaChevronDown className="text-gray-400 flex-shrink-0" />
                                  ) : (
                                    <FaChevronRight className="text-gray-400 flex-shrink-0" />
                                  )}
                                  <div className="flex-1">
                                    <p className="font-semibold text-[#010139]">{insurer.insurer_name}</p>
                                    <p className="text-sm text-gray-600">
                                      Total: {formatCurrency(insurer.total)} • {insurer.items.length} póliza(s)
                                    </p>
                                  </div>
                                </div>
                              </div>
                              
                              {isInsurerExpanded && (
                                <div className="px-4 pb-4">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="bg-gray-50">
                                        <TableHead>Póliza</TableHead>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead className="text-right">Comisión</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {insurer.items.map((item) => (
                                        <TableRow key={item.id}>
                                          <TableCell className="font-mono text-sm">{item.policy_number}</TableCell>
                                          <TableCell>{item.client_name}</TableCell>
                                          <TableCell className="text-right font-mono">
                                            {formatCurrency(item.commission_calculated)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    </div>

                    {/* Ajustes */}
                    {details.adjustments && details.adjustments.insurers.length > 0 && (
                      <div>
                        <h4 className="mb-3 text-base font-bold text-[#010139]">
                          Ajustes • Total: {formatCurrency(details.adjustments.total)}
                        </h4>
                        <div className="space-y-3">
                          {details.adjustments.insurers.map((adjInsurer) => {
                            const adjKey = `adj-${fortnight.id}-${adjInsurer.insurer_id}`;
                            const isAdjExpanded = expandedInsurers.has(adjKey);
                            
                            return (
                              <Card key={adjKey} className="border-2 border-[#8AAA19]/30 bg-[#8AAA19]/5">
                                <div
                                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-[#8AAA19]/10 transition-colors"
                                  onClick={() => toggleInsurer(adjKey)}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {isAdjExpanded ? (
                                      <FaChevronDown className="text-[#8AAA19] flex-shrink-0" />
                                    ) : (
                                      <FaChevronRight className="text-[#8AAA19] flex-shrink-0" />
                                    )}
                                    <div className="flex-1">
                                      <p className="font-semibold text-[#010139]">{adjInsurer.insurer_name}</p>
                                      <p className="text-sm text-gray-600">
                                        Total: {formatCurrency(adjInsurer.total)} • {adjInsurer.items.length} ajuste(s)
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                
                                {isAdjExpanded && (
                                  <div className="px-4 pb-4">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="bg-[#8AAA19]/10">
                                          <TableHead>Póliza</TableHead>
                                          <TableHead>Cliente</TableHead>
                                          <TableHead className="text-right">Comisión</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {adjInsurer.items.map((item, idx) => (
                                          <TableRow key={idx}>
                                            <TableCell className="font-mono text-sm">{item.policy_number}</TableCell>
                                            <TableCell>{item.insured_name}</TableCell>
                                            <TableCell className="text-right font-mono">
                                              {formatCurrency(item.broker_commission)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}

                          {/* Adelantos Descontados */}
                          {details.discounts_json?.adelantos && details.discounts_json.adelantos.length > 0 && (
                            <div>
                              <h4 className="mb-3 text-base font-bold text-[#010139]">Adelantos Descontados</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-gray-50">
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {details.discounts_json.adelantos.map((adelanto, index) => (
                                    <TableRow key={index}>
                                      <TableCell>{adelanto.description}</TableCell>
                                      <TableCell className="text-right font-mono text-red-600">
                                        {formatCurrency(adelanto.amount)}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay detalles disponibles para esta quincena</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Download Modal */}
      {downloadModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setDownloadModal(null)}
        >
          <Card className="w-full max-w-sm m-4 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-[#010139] mb-2">Descargar Reporte</h3>
              <p className="text-sm text-gray-600 mb-4">
                {downloadModal.label}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Incluye todas tus comisiones, ajustes y adelantos descontados
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleDownload(downloadModal.fortnightId, downloadModal.label, 'pdf')}
                >
                  PDF
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleDownload(downloadModal.fortnightId, downloadModal.label, 'xlsx')}
                >
                  Excel
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => setDownloadModal(null)}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
