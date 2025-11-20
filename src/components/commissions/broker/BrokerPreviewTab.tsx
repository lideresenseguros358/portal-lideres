'use client';

import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FaFileExcel, FaFilePdf, FaHistory } from 'react-icons/fa';
import { actionGetClosedFortnights, actionGetLastClosedFortnight } from '@/app/(app)/commissions/actions';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

interface Props {
  brokerId: string;
}

interface DiscountDetail {
  reason: string;
  amount: number;
}

interface BrokerEntry {
  broker_id: string;
  broker_name: string;
  net_amount: number;
  gross_amount: number;
  discounts_json: { total: number; details?: DiscountDetail[] } | null;
}

interface FortnightData {
  id: string;
  label: string;
  total_imported: number;
  total_paid_gross: number;
  total_office_profit: number;
  totalsByInsurer: Array<{ name: string; total: number }>;
  brokers: BrokerEntry[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

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

const sanitizeLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');

export default function BrokerPreviewTab({ brokerId }: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [selectedFortnight, setSelectedFortnight] = useState<'all' | '1' | '2'>('all');
  const [fortnights, setFortnights] = useState<FortnightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialFiltersApplied, setInitialFiltersApplied] = useState(false);

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

  const handleDownloadPdf = (
    event: MouseEvent<HTMLButtonElement>,
    fortnight: FortnightData,
    brokerEntry: BrokerEntry
  ) => {
    event.stopPropagation();
    try {
      const doc = new jsPDF();
      const safeLabel = sanitizeLabel(`${fortnight.label}_${brokerEntry.broker_name}`);
      const discountsTotal = brokerEntry.discounts_json?.total ?? 0;
      const discountDetails = Array.isArray(brokerEntry.discounts_json?.details)
        ? brokerEntry.discounts_json?.details ?? []
        : [];

      doc.setFontSize(16);
      doc.text(`Resumen ${fortnight.label}`, 14, 20);
      doc.setFontSize(12);
      doc.text(`Corredor: ${brokerEntry.broker_name}`, 14, 30);
      doc.text(`Neto Pagado: ${formatCurrency(brokerEntry.net_amount)}`, 14, 38);
      doc.text(`Bruto: ${formatCurrency(brokerEntry.gross_amount)}`, 14, 46);
      doc.text(`Descuentos: ${formatCurrency(discountsTotal)}`, 14, 54);

      let cursorY = 68;
      if (discountDetails.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Detalle de Descuentos', 14, cursorY);
        doc.setFont('helvetica', 'normal');
        cursorY += 10;

        discountDetails.forEach(detail => {
          if (cursorY > 275) {
            doc.addPage();
            cursorY = 20;
          }
          doc.text(`${detail.reason}: ${formatCurrency(detail.amount)}`, 14, cursorY);
          cursorY += 8;
        });
      }

      doc.save(`quincena_${safeLabel}.pdf`);
      toast.success('PDF generado correctamente');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el PDF');
    }
  };

  const handleDownloadExcel = (
    event: MouseEvent<HTMLButtonElement>,
    fortnight: FortnightData,
    brokerEntry: BrokerEntry
  ) => {
    event.stopPropagation();
    try {
      const safeLabel = sanitizeLabel(`${fortnight.label}_${brokerEntry.broker_name}`);
      const workbook = XLSX.utils.book_new();
      const discountsTotal = brokerEntry.discounts_json?.total ?? 0;
      const discountDetails = Array.isArray(brokerEntry.discounts_json?.details)
        ? brokerEntry.discounts_json?.details ?? []
        : [];

      const summarySheet = XLSX.utils.aoa_to_sheet([
        ['Corredor', brokerEntry.broker_name],
        ['Quincena', fortnight.label],
        ['Neto Pagado', brokerEntry.net_amount],
        ['Bruto', brokerEntry.gross_amount],
        ['Descuentos', discountsTotal],
      ]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      if (discountDetails.length > 0) {
        const discountsSheet = XLSX.utils.json_to_sheet(
          discountDetails.map(detail => ({ Motivo: detail.reason, Monto: detail.amount }))
        );
        XLSX.utils.book_append_sheet(workbook, discountsSheet, 'Descuentos');
      }

      XLSX.writeFile(workbook, `quincena_${safeLabel}.xlsx`);
      toast.success('Excel generado correctamente');
    } catch (error) {
      console.error(error);
      toast.error('No se pudo generar el Excel');
    }
  };

  const isLoading = loading || !initialFiltersApplied;
  const noData = !isLoading && filteredFortnights.length === 0;

  return (
    <div className="space-y-6">
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
                      {option.label.toUpperCase()}
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
                <SelectTrigger className="w-full sm:w-36 border-[#010139]/20 bg-white">
                  <SelectValue placeholder="Quincena" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">AMBAS</SelectItem>
                  <SelectItem value="1">PRIMERA (Q1)</SelectItem>
                  <SelectItem value="2">SEGUNDA (Q2)</SelectItem>
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

      {filteredFortnights.map(fortnight => {
        const brokerEntry = fortnight.brokers.find(entry => entry.broker_id === brokerId);
        if (!brokerEntry) return null;
        const discountDetails = Array.isArray(brokerEntry.discounts_json?.details)
          ? brokerEntry.discounts_json?.details ?? []
          : [];

        return (
          <Card key={fortnight.id} className="overflow-hidden border-2 border-gray-100 shadow-lg">
            <CardHeader className="flex-row items-center justify-between bg-gradient-to-r from-gray-50 to-gray-100 p-4">
              <div>
                <CardTitle className="text-xl font-bold text-[#010139]">{fortnight.label}</CardTitle>
                <p className="mt-1 text-sm text-gray-600">
                  Neto pagado: <span className="font-bold text-[#8AAA19]">{formatCurrency(brokerEntry.net_amount)}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-[#010139]/20 hover:bg-[#010139] hover:text-white transition-colors"
                  onClick={event => handleDownloadPdf(event, fortnight, brokerEntry)}
                >
                  <FaFilePdf className="mr-2 h-3 w-3" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-white border-[#8AAA19]/20 hover:bg-[#8AAA19] hover:text-white transition-colors"
                  onClick={event => handleDownloadExcel(event, fortnight, brokerEntry)}
                >
                  <FaFileExcel className="mr-2 h-3 w-3" />
                  Excel
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 p-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card className="shadow-inner">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Bruto</p>
                    <p className="text-2xl font-bold text-[#010139]">{formatCurrency(brokerEntry.gross_amount)}</p>
                  </CardContent>
                </Card>
                <Card className="shadow-inner">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Descuentos</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(brokerEntry.discounts_json?.total ?? 0)}
                    </p>
                  </CardContent>
                </Card>
                <Card className="shadow-inner">
                  <CardContent className="p-4">
                    <p className="text-sm text-gray-600">Neto Pagado</p>
                    <p className="text-2xl font-bold text-[#8AAA19]">{formatCurrency(brokerEntry.net_amount)}</p>
                  </CardContent>
                </Card>
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700">
                  Detalle del Corredor
                </h4>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Bruto</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(brokerEntry.gross_amount)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Descuentos</TableCell>
                      <TableCell className="text-right font-mono text-red-600">
                        {formatCurrency(brokerEntry.discounts_json?.total ?? 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell>Neto Pagado</TableCell>
                      <TableCell className="text-right font-mono text-[#8AAA19]">
                        {formatCurrency(brokerEntry.net_amount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-700">Detalle de Descuentos</h4>
                {discountDetails.length === 0 ? (
                  <p className="text-sm text-gray-500">No hay descuentos aplicados en esta quincena.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Motivo</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {discountDetails.map((detail, index) => (
                        <TableRow key={`${fortnight.id}-detail-${index}`}>
                          <TableCell>{detail.reason}</TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(detail.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
