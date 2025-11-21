'use client';

import { useState, useEffect, useTransition, useMemo, MouseEvent } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaChevronDown, FaChevronRight, FaDownload, FaHistory, FaExclamationTriangle } from 'react-icons/fa';
import { actionGetClosedFortnights, actionGetLastClosedFortnight, actionGetAvailablePeriods, actionGetBrokerCommissionDetails } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';
import { BrokerDetailSection } from './BrokerDetailSection';
import { exportCompleteReportToPDF, exportCompleteReportToExcel } from '@/lib/commission-export-utils';

// Types from spec
interface BrokerData {
  broker_id: string;
  broker_name: string;
  net_amount: number;
  gross_amount: number;
  discounts_json: { total: number; details: Array<{ reason: string; amount: number }> };
}

interface FortnightData {
  id: string;
  label: string;
  total_imported: number;
  total_paid_net: number;
  total_office_profit: number;
  totalsByInsurer: Array<{ name: string; total: number; paid: number; office_total: number }>;
  brokers: BrokerData[];
}

interface Props {
  role: string;
  brokerId?: string;
}

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = [
  { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, 'label': 'Septiembre' },
  { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Los reportes reales ahora vienen de la BD (comm_imports)

export function PreviewTab({ role, brokerId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fortnights, setFortnights] = useState<FortnightData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedFortnight, setSelectedFortnight] = useState<'all' | '1' | '2'>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableMonths, setAvailableMonths] = useState<{year: number, month: number}[]>([]);
  const [availableFortnights, setAvailableFortnights] = useState<{year: number, month: number, fortnight: string}[]>([]);
  const [showCompleteDownloadModal, setShowCompleteDownloadModal] = useState<{fortnightId: string, fortnightLabel: string} | null>(null);

  // Los reportes por aseguradora ya vienen calculados desde el backend

  useEffect(() => {
    if (!initialFiltersApplied) return;
    const loadData = async () => {
      const fortnightNum = selectedFortnight === 'all' ? undefined : parseInt(selectedFortnight, 10);
      const result = await actionGetClosedFortnights(
        selectedYear,
        selectedMonth,
        fortnightNum,
        role === 'broker' ? brokerId ?? null : undefined
      );
      if (result.ok) {
        setFortnights(result.data as FortnightData[]);
      } else {
        toast.error('Error al cargar historial', { description: result.error });
        setFortnights([]);
      }
    };
    
    startTransition(() => {
      loadData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedMonth, selectedFortnight, initialFiltersApplied]);

  useEffect(() => {
    if (initialFiltersApplied) return;
    const applyLastFortnight = async () => {
      try {
        // Cargar períodos disponibles
        const periodsResult = await actionGetAvailablePeriods();
        if (periodsResult.ok && periodsResult.data) {
          const { years, months, fortnights } = periodsResult.data;
          
          // Procesar años disponibles
          setAvailableYears(years);
          
          // Procesar meses disponibles
          const monthsList: { year: number; month: number }[] = [];
          months.forEach(m => {
            const parts = m.split('-');
            if (parts.length === 2) {
              const year = parseInt(parts[0] || '', 10);
              const month = parseInt(parts[1] || '', 10);
              if (!isNaN(year) && !isNaN(month)) {
                monthsList.push({ year, month });
              }
            }
          });
          setAvailableMonths(monthsList);
          
          // Procesar quincenas disponibles
          const fortnightsList: { year: number; month: number; fortnight: string }[] = [];
          fortnights.forEach(f => {
            const parts = f.split('-');
            if (parts.length === 3) {
              const year = parseInt(parts[0] || '', 10);
              const month = parseInt(parts[1] || '', 10);
              const fortnight = parts[2] || '';
              if (!isNaN(year) && !isNaN(month) && fortnight) {
                fortnightsList.push({ year, month, fortnight });
              }
            }
          });
          setAvailableFortnights(fortnightsList);
        }
        
        // Obtener última quincena cerrada
        const result = await actionGetLastClosedFortnight();
        if (result.ok && result.data) {
          const endDate = new Date(result.data);
          const year = endDate.getUTCFullYear();
          const month = endDate.getUTCMonth() + 1;
          const fortnightValue = endDate.getUTCDate() <= 15 ? '1' : '2';
          setSelectedYear(year);
          setSelectedMonth(month);
          setSelectedFortnight(fortnightValue);
        }
      } catch (error) {
        console.error('Error al obtener última quincena cerrada', error);
      } finally {
        setInitialFiltersApplied(true);
      }
    };

    applyLastFortnight();
  }, [initialFiltersApplied]);

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedItems);
    newSet.has(id) ? newSet.delete(id) : newSet.add(id);
    setExpandedItems(newSet);
  };

  const handleCompleteDownload = async (fortnightId: string, fortnightLabel: string, format: 'pdf' | 'xlsx') => {
    try {
      console.log('Iniciando descarga completa:', fortnightId, format);
      
      const result = await actionGetBrokerCommissionDetails(fortnightId);
      console.log('Resultado de carga de detalles:', result);
      
      if (!result.ok || !result.data) {
        console.error('Error cargando detalles:', result);
        toast.error('No se pudieron cargar los detalles de las comisiones');
        return;
      }

      const fortnight = fortnights.find(f => f.id === fortnightId);
      if (!fortnight) {
        console.error('Fortnight no encontrada:', fortnightId);
        toast.error('No se encontró la quincena');
        return;
      }

      const totals = {
        total_imported: fortnight.total_imported,
        total_paid_net: fortnight.total_paid_net,
        total_office_profit: fortnight.total_office_profit,
      };

      console.log('Datos a exportar:', {
        brokers: result.data.length,
        format,
        totals
      });

      if (format === 'pdf') {
        exportCompleteReportToPDF(result.data, fortnightLabel, totals);
      } else {
        exportCompleteReportToExcel(result.data, fortnightLabel, totals);
      }

      toast.success(`Reporte ${format.toUpperCase()} generado correctamente`);
      setShowCompleteDownloadModal(null);
    } catch (error) {
      console.error('Error en handleCompleteDownload:', error);
      toast.error('No se pudo generar el reporte');
    }
  };

  const summary = useMemo(() => {
    return fortnights.reduce((acc, f) => {
      acc.totalImported += f.total_imported;
      acc.totalPaidNet += f.total_paid_net;
      acc.totalOfficeProfit += f.total_office_profit;
      return acc;
    }, { totalImported: 0, totalPaidNet: 0, totalOfficeProfit: 0 });
  }, [fortnights]);

  const dataToDisplay = useMemo(() => {
    if (role === 'broker') {
      return fortnights.filter((f) => f && f.brokers && f.brokers.length > 0);
    }
    return fortnights;
  }, [fortnights, role]);

  return (
    <div className="space-y-6">
      {/* Header & Filters Section */}
      <Card className="shadow-lg border-2 border-gray-100">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 pb-4">
          {/* Title centered */}
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              <FaHistory className="text-[#010139] text-xl" />
              <h2 className="text-2xl sm:text-3xl font-bold text-[#010139]">HISTORIAL DE QUINCENAS</h2>
            </div>
            <p className="text-sm text-gray-600">
              Consulta y descarga reportes de quincenas cerradas
            </p>
          </div>
          
          {/* Filters Row - Responsive */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">AÑO:</label>
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-full sm:w-28 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0 ? (
                    availableYears.map(year => (
                      <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                    ))
                  ) : (
                    <SelectItem value={String(currentYear)} disabled>Sin datos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">MES:</label>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-full sm:w-36 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {availableMonths.filter(m => m.year === selectedYear).length > 0 ? (
                    availableMonths
                      .filter(m => m.year === selectedYear)
                      .map(m => {
                        const monthObj = months.find(month => month.value === m.month);
                        // Primera letra mayúscula, resto minúsculas
                        const monthLabel = monthObj?.label || '';
                        const formattedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1).toLowerCase();
                        return (
                          <SelectItem key={m.month} value={String(m.month)}>
                            {formattedMonth}
                          </SelectItem>
                        );
                      })
                  ) : (
                    <SelectItem value="0" disabled>Sin datos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-600 whitespace-nowrap">QUINCENA:</label>
              <Select
                value={selectedFortnight}
                onValueChange={(value) => setSelectedFortnight(value as 'all' | '1' | '2')}
              >
                <SelectTrigger className="w-full sm:w-48 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Quincena" />
                </SelectTrigger>
                <SelectContent>
                  {availableFortnights.filter(f => f.year === selectedYear && f.month === selectedMonth).length > 0 ? (
                    <>
                      {availableFortnights.filter(f => f.year === selectedYear && f.month === selectedMonth).length > 1 && (
                        <SelectItem value="all">AMBAS</SelectItem>
                      )}
                      {availableFortnights
                        .filter(f => f.year === selectedYear && f.month === selectedMonth)
                        .map(f => (
                          <SelectItem key={f.fortnight} value={f.fortnight}>
                            {f.fortnight === '1' ? 'Primera (Q1)' : 'Segunda (Q2)'}
                          </SelectItem>
                        ))}
                    </>
                  ) : (
                    <SelectItem value="none" disabled>Sin datos</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 sm:ml-4">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#010139]"></div>
                <span className="hidden sm:inline">Cargando...</span>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards - Solo para MASTER */}
      {role === 'master' && dataToDisplay.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-lg border-l-4 border-l-[#010139] bg-gradient-to-br from-[#010139]/5 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Total Comisiones Importadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#010139]">{formatCurrency(summary.totalImported)}</p>
              <p className="text-xs text-gray-500 mt-1">De reportes de aseguradoras</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-l-4 border-l-[#8AAA19] bg-gradient-to-br from-[#8AAA19]/5 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Total Pagado a Corredores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#010139]">{formatCurrency(summary.totalPaidNet)}</p>
              <p className="text-xs text-gray-500 mt-1">Monto neto pagado</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Ganancia Oficina</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#8AAA19]">{formatCurrency(summary.totalOfficeProfit)}</p>
              <p className="text-xs text-gray-500 mt-1">Margen neto de comisiones</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fortnights List */}
      {dataToDisplay.map(fortnight => (
        <Card key={fortnight.id} className="overflow-hidden shadow-lg border-2 border-gray-100">
          <CardHeader 
            className="flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer hover:from-gray-100 hover:to-gray-150 transition-all duration-200 gap-3"
            onClick={() => toggleExpand(fortnight.id)}
          >
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
              {expandedItems.has(fortnight.id) ? (
                <FaChevronDown className="text-[#010139] transition-transform text-lg sm:text-xl" />
              ) : (
                <FaChevronRight className="text-gray-400 transition-transform text-lg sm:text-xl" />
              )}
              <div className="flex-1">
                <CardTitle className="text-lg sm:text-xl font-bold text-[#010139]">{fortnight.label}</CardTitle>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Total Neto: <span className="font-bold text-[#8AAA19]">
                    {formatCurrency(fortnight.brokers.reduce((sum: number, b: any) => sum + b.net_amount, 0))}
                  </span>
                </p>
              </div>
            </div>
            {role === 'master' && (
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-[#8AAA19]/20 hover:bg-[#8AAA19] hover:text-white transition-colors text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowCompleteDownloadModal({ fortnightId: fortnight.id, fortnightLabel: fortnight.label });
                }}
              >
                <FaDownload className="mr-1 sm:mr-2 h-3 w-3" />
                <span className="hidden sm:inline">Descargar Reporte (Todos)</span>
                <span className="sm:hidden">Descargar</span>
              </Button>
            )}
          </CardHeader>
          {expandedItems.has(fortnight.id) && (
            <CardContent className="p-6 bg-white">
              {/* Total Oficina by Insurer Section - Only for MASTER */}
              {role === 'master' && (
                <div className="mb-6">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="w-1 h-5 bg-[#010139] rounded"></div>
                    <h3 className="text-lg font-bold text-[#010139]">Total Oficina por Aseguradora</h3>
                  </div>
                  <Card className="shadow-inner border-gray-200">
                    <CardContent className="p-4 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Aseguradora</TableHead>
                            <TableHead className="text-right">Total Reporte</TableHead>
                            <TableHead className="text-right">Pagado a Corredores</TableHead>
                            <TableHead className="text-right">Total Oficina</TableHead>
                            <TableHead className="text-center">% Oficina</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fortnight.totalsByInsurer.map((insurer, idx) => {
                            const officePercentage = insurer.total > 0 ? (insurer.office_total / insurer.total) * 100 : 0;
                            return (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">{insurer.name}</TableCell>
                                <TableCell className="text-right font-mono">
                                  {formatCurrency(insurer.total)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-gray-600">
                                  {formatCurrency(insurer.paid)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-[#8AAA19]">
                                  {formatCurrency(insurer.office_total)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge variant={officePercentage >= 20 ? 'success' : 'danger'}>
                                    {officePercentage.toFixed(1)}%
                                    {officePercentage < 20 && (
                                      <FaExclamationTriangle className="inline ml-1" size={10} />
                                    )}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Totals Row */}
                          <TableRow className="bg-gray-100 font-bold">
                            <TableCell>TOTALES</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(fortnight.totalsByInsurer.reduce((sum, i) => sum + i.total, 0))}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(fortnight.totalsByInsurer.reduce((sum, i) => sum + i.paid, 0))}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#8AAA19]">
                              {formatCurrency(fortnight.totalsByInsurer.reduce((sum, i) => sum + i.office_total, 0))}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Brokers Detail Section */}
              <BrokerDetailSection
                fortnightId={fortnight.id}
                fortnightLabel={fortnight.label}
                brokers={fortnight.brokers}
                role={role}
              />
            </CardContent>
          )}
        </Card>
      ))}

      {/* Empty State */}
      {dataToDisplay.length === 0 && !isPending && (
        <Card className="bg-white shadow-lg border-2 border-dashed border-gray-300">
          <CardContent className="text-center py-20">
            <div className="mb-4">
              <FaHistory className="text-6xl text-gray-300 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No hay quincenas cerradas para el período seleccionado
            </h3>
            <p className="text-gray-500">
              Seleccione otro mes o año para ver el historial de quincenas pagadas
            </p>
          </CardContent>
        </Card>
      )}

      {/* Download Modal */}
      {showCompleteDownloadModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowCompleteDownloadModal(null)}
        >
          <Card className="w-full max-w-sm m-4 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-[#010139] mb-2">Descargar Reporte Completo</h3>
              <p className="text-sm text-gray-600 mb-4">
                {showCompleteDownloadModal.fortnightLabel}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Incluye todos los brokers con sus aseguradoras, clientes y comisiones detalladas
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => handleCompleteDownload(showCompleteDownloadModal.fortnightId, showCompleteDownloadModal.fortnightLabel, 'pdf')}
                >
                  PDF
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleCompleteDownload(showCompleteDownloadModal.fortnightId, showCompleteDownloadModal.fortnightLabel, 'xlsx')}
                >
                  Excel
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => setShowCompleteDownloadModal(null)}
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