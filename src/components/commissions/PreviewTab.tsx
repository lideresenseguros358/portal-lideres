'use client';

import { useState, useEffect, useTransition, useMemo, MouseEvent } from 'react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FaChevronDown, FaChevronRight, FaFilePdf, FaFileExcel, FaHistory, FaExclamationTriangle } from 'react-icons/fa';
import { actionGetClosedFortnights, actionGetLastClosedFortnight } from '@/app/(app)/commissions/actions';
import { toast } from 'sonner';

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
  total_paid_gross: number;
  total_office_profit: number;
  totalsByInsurer: Array<{ name: string; total: number; isLifeInsurance?: boolean }>;
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

export function PreviewTab({ role, brokerId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fortnights, setFortnights] = useState<FortnightData[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedFortnight, setSelectedFortnight] = useState<'all' | '1' | '2'>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);

  // Function to generate insurer reports with office calculations
  const generateInsurerReports = (fortnight: FortnightData) => {
    // Mock data for now - should be calculated from actual data
    return fortnight.totalsByInsurer.map(insurer => {
      // Mock broker commissions - in real implementation, calculate from fortnight.brokers
      const brokerCommissions = insurer.total * 0.7; // Mock: 70% goes to brokers
      const officeTotal = insurer.total - brokerCommissions;
      const officePercentage = (officeTotal / insurer.total) * 100;
      
      // Mock life insurance detection - should come from backend
      const isLifeInsurance = insurer.name ? insurer.name.toLowerCase().includes('vida') : false;

      return {
        id: insurer.name,
        name: insurer.name,
        reportAmount: insurer.total,
        brokerCommissions,
        officeTotal,
        officePercentage,
        isLifeInsurance
      };
    });
  };

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
  }, [selectedYear, selectedMonth, selectedFortnight, initialFiltersApplied]);

  useEffect(() => {
    if (initialFiltersApplied) return;
    const applyLastFortnight = async () => {
      try {
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

  const sanitizeLabel = (label: string) =>
    label
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñ\s-]/gi, '')
      .replace(/\s+/g, '_');

  const handleDownloadPdf = (event: MouseEvent<HTMLButtonElement>, fortnight: FortnightData) => {
    event.stopPropagation();
    try {
      const doc = new jsPDF();
      const safeLabel = sanitizeLabel(fortnight.label);

      doc.setFontSize(16);
      doc.text(`Resumen ${fortnight.label}`, 14, 20);
      doc.setFontSize(12);
      doc.text(`Total Reportado: ${formatCurrency(fortnight.total_imported)}`, 14, 30);
      doc.text(`Total Pagado (Bruto): ${formatCurrency(fortnight.total_paid_gross)}`, 14, 38);
      doc.text(`Ganancia Oficina: ${formatCurrency(fortnight.total_office_profit)}`, 14, 46);

      let cursorY = 58;
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle por Corredor', 14, cursorY);
      doc.setFont('helvetica', 'normal');
      cursorY += 8;

      fortnight.brokers.forEach((broker) => {
        if (cursorY > 270) {
          doc.addPage();
          cursorY = 20;
        }
        const discountTotal = broker.discounts_json?.total ?? 0;
        doc.text(
          `${broker.broker_name}: Neto ${formatCurrency(broker.net_amount)} | Bruto ${formatCurrency(broker.gross_amount)} | Descuentos ${formatCurrency(discountTotal)}`,
          14,
          cursorY
        );
        cursorY += 8;
      });

      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle por Aseguradora', 14, 20);
      doc.setFont('helvetica', 'normal');
      let insurerCursorY = 30;
      fortnight.totalsByInsurer.forEach((insurer) => {
        if (insurerCursorY > 270) {
          doc.addPage();
          insurerCursorY = 20;
        }
        doc.text(`${insurer.name}: ${formatCurrency(insurer.total)}`, 14, insurerCursorY);
        insurerCursorY += 8;
      });

      doc.save(`quincena_${safeLabel}.pdf`);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el PDF');
    }
  };

  const handleDownloadExcel = (event: MouseEvent<HTMLButtonElement>, fortnight: FortnightData) => {
    event.stopPropagation();
    try {
      const safeLabel = sanitizeLabel(fortnight.label);
      const workbook = XLSX.utils.book_new();

      const summarySheet = XLSX.utils.aoa_to_sheet([
        ['Quincena', fortnight.label],
        ['Total Reportado', fortnight.total_imported],
        ['Total Pagado (Bruto)', fortnight.total_paid_gross],
        ['Ganancia Oficina', fortnight.total_office_profit],
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      const brokersSheet = XLSX.utils.json_to_sheet(
        fortnight.brokers.map((broker) => ({
          Corredor: broker.broker_name,
          NetoPagado: broker.net_amount,
          Bruto: broker.gross_amount,
          Descuentos: broker.discounts_json?.total ?? 0,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, brokersSheet, 'Corredores');

      const insurersSheet = XLSX.utils.json_to_sheet(
        fortnight.totalsByInsurer.map((insurer) => ({
          Aseguradora: insurer.name,
          TotalReporte: insurer.total,
        }))
      );
      XLSX.utils.book_append_sheet(workbook, insurersSheet, 'Aseguradoras');

      XLSX.writeFile(workbook, `quincena_${safeLabel}.xlsx`);
      toast.success('Excel generado correctamente');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el Excel');
    }
  };

  const summary = useMemo(() => {
    return fortnights.reduce((acc, f) => {
      acc.totalImported += f.total_imported;
      acc.totalPaidGross += f.total_paid_gross;
      acc.totalOfficeProfit += f.total_office_profit;
      return acc;
    }, { totalImported: 0, totalPaidGross: 0, totalOfficeProfit: 0 });
  }, [fortnights]);

  const dataToDisplay = useMemo(() => {
    if (role === 'broker') {
      return fortnights.filter((f) => f && f.brokers && f.brokers.length > 0);
    }
    return fortnights;
  }, [fortnights, role]);

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card className="shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <FaHistory className="text-[#010139] text-lg" />
              <h3 className="text-lg font-bold text-[#010139]">Historial de Quincenas Cerradas</h3>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-20 sm:w-28 border-[#010139]/20">
                  <SelectValue placeholder="Año" />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-28 sm:w-36 border-[#010139]/20">
                  <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={String(month.value)}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={selectedFortnight}
                onValueChange={(value) => setSelectedFortnight(value as 'all' | '1' | '2')}
              >
                <SelectTrigger className="w-28 sm:w-36 border-[#010139]/20">
                  <SelectValue placeholder="Quincena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ambas</SelectItem>
                  <SelectItem value="1">Primera (Q1)</SelectItem>
                  <SelectItem value="2">Segunda (Q2)</SelectItem>
                </SelectContent>
              </Select>
              {isPending && (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#010139]"></div>
                  <span className="text-sm text-gray-600">Cargando...</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards - Solo para MASTER */}
      {role === 'master' && dataToDisplay.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-lg border-l-4 border-l-[#010139]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Total Comisiones Importadas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#010139]">{formatCurrency(summary.totalImported)}</p>
              <p className="text-xs text-gray-500 mt-1">De reportes de aseguradoras</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-l-4 border-l-[#8AAA19]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Total Pagado a Corredores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#010139]">{formatCurrency(summary.totalPaidGross)}</p>
              <p className="text-xs text-gray-500 mt-1">Monto bruto antes de descuentos</p>
            </CardContent>
          </Card>
          <Card className="shadow-lg border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-600">Ganancia Oficina</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#8AAA19]">{formatCurrency(summary.totalOfficeProfit)}</p>
              <p className="text-xs text-gray-500 mt-1">Diferencia entre importado y pagado</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fortnights List */}
      {dataToDisplay.map(fortnight => (
        <Card key={fortnight.id} className="overflow-hidden shadow-lg border-2 border-gray-100">
          <CardHeader 
            className="flex-row items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer hover:from-gray-100 hover:to-gray-150 transition-all duration-200"
            onClick={() => toggleExpand(fortnight.id)}
          >
            <div className="flex items-center gap-3">
              {expandedItems.has(fortnight.id) ? (
                <FaChevronDown className="text-[#010139] transition-transform" />
              ) : (
                <FaChevronRight className="text-gray-400 transition-transform" />
              )}
              <div>
                <CardTitle className="text-xl font-bold text-[#010139]">{fortnight.label}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Total Neto Pagado: <span className="font-bold text-[#8AAA19]">
                    {formatCurrency(fortnight.brokers.reduce((sum: number, b: any) => sum + b.net_amount, 0))}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-[#010139]/20 hover:bg-[#010139] hover:text-white transition-colors"
                onClick={(event) => handleDownloadPdf(event, fortnight)}
              >
                <FaFilePdf className="mr-2 h-3 w-3" />
                PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-[#8AAA19]/20 hover:bg-[#8AAA19] hover:text-white transition-colors"
                onClick={(event) => handleDownloadExcel(event, fortnight)}
              >
                <FaFileExcel className="mr-2 h-3 w-3" />
                Excel
              </Button>
            </div>
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
                    <CardContent className="p-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Aseguradora</TableHead>
                            <TableHead className="text-right">Total Reporte</TableHead>
                            <TableHead className="text-right">Comisiones Corredores</TableHead>
                            <TableHead className="text-right">Total Oficina</TableHead>
                            <TableHead className="text-center">% Oficina</TableHead>
                            <TableHead className="text-center">Tipo</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {generateInsurerReports(fortnight).map((report, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{report.name}</TableCell>
                              <TableCell className="text-right font-mono">
                                {formatCurrency(report.reportAmount)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-gray-600">
                                {formatCurrency(report.brokerCommissions)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-[#8AAA19]">
                                {formatCurrency(report.officeTotal)}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge 
                                  variant={report.officePercentage <= 20 ? 'danger' : 'success'}
                                >
                                  {report.officePercentage.toFixed(1)}%
                                  {report.officePercentage <= 20 && (
                                    <FaExclamationTriangle className="inline ml-1" size={10} />
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant={report.isLifeInsurance ? 'outline-blue' : 'outline-olive'}>
                                  {report.isLifeInsurance ? 'Vida' : 'Ramos Gen.'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                          {/* Totals Row */}
                          <TableRow className="bg-gray-100 font-bold">
                            <TableCell>TOTALES</TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(
                                generateInsurerReports(fortnight).reduce((sum, r) => sum + r.reportAmount, 0)
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {formatCurrency(
                                generateInsurerReports(fortnight).reduce((sum, r) => sum + r.brokerCommissions, 0)
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-[#8AAA19]">
                              {formatCurrency(
                                generateInsurerReports(fortnight).reduce((sum, r) => sum + r.officeTotal, 0)
                              )}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                          {/* Total Vida and Total Ramos Generales */}
                          <TableRow className="bg-blue-50">
                            <TableCell colSpan={3} className="text-right font-bold">Total Vida:</TableCell>
                            <TableCell className="text-right font-mono font-bold text-blue-600">
                              {formatCurrency(
                                generateInsurerReports(fortnight)
                                  .filter(r => r.isLifeInsurance)
                                  .reduce((sum, r) => sum + r.officeTotal, 0)
                              )}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                          <TableRow className="bg-orange-50">
                            <TableCell colSpan={3} className="text-right font-bold">Total Ramos Generales:</TableCell>
                            <TableCell className="text-right font-mono font-bold text-orange-600">
                              {formatCurrency(
                                generateInsurerReports(fortnight)
                                  .filter(r => !r.isLifeInsurance)
                                  .reduce((sum, r) => sum + r.officeTotal, 0)
                              )}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              )}
              
              {/* Existing content */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Totales por Aseguradora */}
                <div className="lg:col-span-1">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-[#010139] rounded"></div>
                    <h4 className="font-bold text-gray-800">Totales por Aseguradora</h4>
                  </div>
                  <Card className="shadow-inner border-gray-200">
                    <CardContent className="p-3">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-gray-200">
                            <TableHead className="text-gray-700 font-semibold">Aseguradora</TableHead>
                            <TableHead className="text-right text-gray-700 font-semibold">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fortnight.totalsByInsurer.map((insurer: any) => (
                            <TableRow key={insurer.name} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium text-gray-700">{insurer.name}</TableCell>
                              <TableCell className="text-right font-mono text-[#010139] font-semibold">
                                {formatCurrency(insurer.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2 border-gray-300 bg-gray-50">
                            <TableCell className="font-bold">TOTAL</TableCell>
                            <TableCell className="text-right font-mono font-bold text-[#010139]">
                              {formatCurrency(fortnight.total_imported)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Consolidado por Corredor */}
                <div className="lg:col-span-2">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="w-1 h-5 bg-[#8AAA19] rounded"></div>
                    <h4 className="font-bold text-gray-800">Consolidado por Corredor</h4>
                    <span className="ml-auto text-sm text-gray-600">
                      Neto como número principal (según esquema)
                    </span>
                  </div>
                  <Card className="shadow-inner border-gray-200">
                    <CardContent className="p-3">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b-2 border-gray-200 bg-gray-50">
                            <TableHead className="text-gray-700 font-semibold">Corredor</TableHead>
                            <TableHead className="text-right text-[#8AAA19] font-bold">NETO PAGADO</TableHead>
                            <TableHead className="text-right text-gray-700 font-semibold">Bruto</TableHead>
                            <TableHead className="text-right text-gray-700 font-semibold">Descuentos</TableHead>
                            <TableHead className="text-center text-gray-700 font-semibold">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fortnight.brokers.map((broker: any) => (
                            <TableRow key={broker.broker_id} className="hover:bg-gray-50 transition-colors">
                              <TableCell className="font-medium text-gray-700">{broker.broker_name}</TableCell>
                              <TableCell className="text-right font-bold text-[#8AAA19] text-lg font-mono">
                                {formatCurrency(broker.net_amount)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-gray-600">
                                {formatCurrency(broker.gross_amount)}
                              </TableCell>
                              <TableCell className="text-right text-red-600 font-mono">
                                -{formatCurrency(broker.discounts_json?.total || 0)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="hover:bg-red-50 hover:text-red-700 transition-colors"
                                  >
                                    <FaFilePdf className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="hover:bg-green-50 hover:text-green-700 transition-colors"
                                  >
                                    <FaFileExcel className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="border-t-2 border-gray-300 bg-gray-50">
                            <TableCell className="font-bold">TOTALES</TableCell>
                            <TableCell className="text-right font-bold text-[#8AAA19] text-lg font-mono">
                              {formatCurrency(fortnight.brokers.reduce((sum: number, b: any) => sum + b.net_amount, 0))}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-gray-700">
                              {formatCurrency(fortnight.total_paid_gross)}
                            </TableCell>
                            <TableCell className="text-right text-red-600 font-mono font-bold">
                              -{formatCurrency(fortnight.brokers.reduce((sum: number, b: any) => sum + (b.discounts_json?.total || 0), 0))}
                            </TableCell>
                            <TableCell></TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Empty State */}
      {dataToDisplay.length === 0 && !isPending && (
        <Card className="shadow-lg border-2 border-dashed border-gray-300">
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
    </div>
  );
}