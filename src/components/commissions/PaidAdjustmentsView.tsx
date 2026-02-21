'use client';

import { useState, useEffect } from 'react';
import { actionGetAdjustmentReports } from '@/app/(app)/commissions/adjustment-actions';
import { toast } from 'sonner';
import { 
  FaHistory, 
  FaChevronDown, 
  FaChevronRight,
  FaInfoCircle,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaCheckCircle,
  FaFilePdf,
  FaFileExcel,
  FaDownload,
} from 'react-icons/fa';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdjustmentReport {
  id: string;
  broker_id: string;
  broker_name: string;
  status: string;
  total_amount: number;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  paid_date: string | null;
  payment_mode: string | null;
  fortnight_id: string | null;
  items: AdjustmentItem[];
}

interface AdjustmentItem {
  id: string;
  policy_number: string;
  insured_name: string | null;
  commission_raw: number;
  broker_commission: number;
  insurer_name: string | null;
}

// Helper: group reports by paid_date
function groupByDate(reports: AdjustmentReport[]): Map<string, AdjustmentReport[]> {
  const map = new Map<string, AdjustmentReport[]>();
  for (const r of reports) {
    const key = r.paid_date
      ? new Date(r.paid_date).toLocaleDateString('es-PA')
      : new Date(r.created_at).toLocaleDateString('es-PA');
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

export default function PaidAdjustmentsView() {
  const [reports, setReports] = useState<AdjustmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [downloadModal, setDownloadModal] = useState<AdjustmentReport | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'xlsx' | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const result = await actionGetAdjustmentReports('paid');
    if (result.ok) {
      setReports(result.data || []);
    } else {
      toast.error('Error al cargar reportes', { description: result.error });
    }
    setLoading(false);
  };

  const toggleReport = (reportId: string) => {
    setExpandedReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const handleDownloadReport = async (report: AdjustmentReport, format: 'pdf' | 'xlsx') => {
    setDownloading(format);
    try {
      const paidDate = report.paid_date
        ? new Date(report.paid_date).toLocaleDateString('es-PA')
        : new Date(report.created_at).toLocaleDateString('es-PA');

      if (format === 'pdf') {
        const { default: jsPDF } = await import('jspdf');
        const { default: autoTable } = await import('jspdf-autotable');

        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFontSize(16);
        doc.setTextColor(1, 1, 57);
        doc.text('Reporte de Ajuste Pagado', 14, 16);
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Corredor: ${report.broker_name}`, 14, 23);
        doc.text(`Fecha de pago: ${paidDate}  |  Total: $${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}  |  ${report.items.length} items`, 14, 28);
        doc.text(`Modo: ${report.payment_mode === 'immediate' ? 'Pago Inmediato' : 'Quincena'}`, 14, 33);

        const rows = report.items.map((item) => [
          item.insured_name || '—',
          item.policy_number,
          item.insurer_name || '—',
          `$${item.commission_raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          `$${item.broker_commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        ]);

        autoTable(doc, {
          startY: 38,
          head: [['Asegurado', 'Póliza', 'Aseguradora', 'Bruto', 'Comisión']],
          body: rows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [138, 170, 25], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          margin: { left: 14, right: 14 },
        });

        const safeFileName = report.broker_name.replace(/[^a-zA-Z0-9]/g, '_');
        doc.save(`ajuste_${safeFileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success('PDF descargado');
      } else {
        const XLSX = await import('xlsx');
        const wb = XLSX.utils.book_new();

        const detailRows: (string | number)[][] = [
          ['Corredor', 'Fecha Pago', 'Asegurado', 'Póliza', 'Aseguradora', 'Bruto ($)', 'Comisión ($)', 'Modo Pago'],
        ];
        for (const item of report.items) {
          detailRows.push([
            report.broker_name,
            paidDate,
            item.insured_name || '',
            item.policy_number,
            item.insurer_name || '',
            item.commission_raw,
            item.broker_commission,
            report.payment_mode === 'immediate' ? 'Inmediato' : 'Quincena',
          ]);
        }
        detailRows.push([]);
        detailRows.push(['', '', '', '', 'TOTAL:', '', report.total_amount]);

        const ws = XLSX.utils.aoa_to_sheet(detailRows);
        ws['!cols'] = [
          { wch: 22 }, { wch: 14 }, { wch: 24 }, { wch: 18 },
          { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle');

        const safeFileName = report.broker_name.replace(/[^a-zA-Z0-9]/g, '_');
        XLSX.writeFile(wb, `ajuste_${safeFileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        toast.success('Excel descargado');
      }
      setDownloadModal(null);
    } catch (err) {
      console.error(err);
      toast.error(`Error al generar ${format.toUpperCase()}`);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#010139]"></div>
        <span className="ml-3 text-gray-600">Cargando...</span>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <Card className="shadow-lg">
        <div className="p-8 sm:p-12 text-center">
          <FaInfoCircle className="text-5xl sm:text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-600 mb-2">
            No hay ajustes pagados
          </h3>
          <p className="text-sm text-gray-500">
            Los ajustes aparecerán aquí después de que se procesen los pagos
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-white border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FaCheckCircle className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Reportes</p>
                <p className="text-xl sm:text-2xl font-bold text-[#010139]">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FaMoneyBillWave className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Pagado</p>
                <p className="text-xl sm:text-2xl font-bold text-[#8AAA19]">
                  ${reports.reduce((sum, r) => sum + r.total_amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FaHistory className="text-purple-600" size={20} />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Total Items</p>
                <p className="text-xl sm:text-2xl font-bold text-[#010139]">
                  {reports.reduce((sum, r) => sum + r.items.length, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de reportes agrupados por fecha de pago */}
      {(() => {
        const grouped = groupByDate(reports);
        return Array.from(grouped.entries()).map(([dateLabel, dateReports]) => {
          const isDateExpanded = expandedDates.has(dateLabel);
          const dateTotal = dateReports.reduce((s, r) => s + r.total_amount, 0);
          const dateItems = dateReports.reduce((s, r) => s + r.items.length, 0);

          return (
            <Card key={dateLabel} className="overflow-hidden shadow-lg border-2 border-gray-100">
              {/* Date group header - clickable */}
              <div
                className="flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-gray-100 cursor-pointer hover:from-gray-100 hover:to-gray-150 transition-all"
                onClick={() => {
                  setExpandedDates(prev => {
                    const next = new Set(prev);
                    next.has(dateLabel) ? next.delete(dateLabel) : next.add(dateLabel);
                    return next;
                  });
                }}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {isDateExpanded ? (
                    <FaChevronDown className="text-[#010139] text-sm" />
                  ) : (
                    <FaChevronRight className="text-gray-400 text-sm" />
                  )}
                  <div>
                    <h3 className="font-bold text-[#010139] text-sm sm:text-base">
                      <FaCalendarAlt className="inline mr-1.5" size={12} />
                      {dateLabel}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {dateReports.length} reporte(s) · {dateItems} item(s)
                    </p>
                  </div>
                </div>
                <span className="text-sm sm:text-base font-bold text-[#8AAA19]">
                  ${dateTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Expanded: broker reports inside this date */}
              {isDateExpanded && (
                <div className="p-2 sm:p-3 space-y-2">
                  {dateReports.map((report) => {
                    const isExpanded = expandedReports.has(report.id);
                    const isImmediate = report.payment_mode === 'immediate';

                    return (
                      <div
                        key={report.id}
                        className="border rounded-lg overflow-hidden hover:shadow-sm transition-shadow"
                      >
                        {/* Broker card header - entire area clickable */}
                        <div
                          className="flex items-center gap-2 sm:gap-3 p-3 cursor-pointer"
                          onClick={() => toggleReport(report.id)}
                        >
                          <div className="flex-shrink-0 p-1.5 bg-green-100 rounded-lg">
                            <FaCheckCircle className="text-green-600" size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-[#010139] text-sm truncate">
                              {report.broker_name}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-600">
                                {report.items.length} item(s)
                              </span>
                              <span className="text-xs text-gray-400">•</span>
                              <span className="text-xs font-semibold text-[#8AAA19]">
                                ${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              {isImmediate ? (
                                <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Inmediato</span>
                              ) : (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Quincena</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDownloadModal(report); }}
                              className="p-1.5 hover:bg-blue-50 rounded transition-colors"
                              title="Descargar reporte"
                            >
                              <FaDownload className="text-[#010139]" size={13} />
                            </button>
                            {isExpanded ? (
                              <FaChevronDown className="text-gray-400" size={12} />
                            ) : (
                              <FaChevronRight className="text-gray-400" size={12} />
                            )}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2">
                            {report.notes && (
                              <div className="text-xs">
                                <span className="font-semibold text-gray-700">Nota broker:</span>
                                <p className="text-gray-600 italic mt-0.5">{report.notes}</p>
                              </div>
                            )}
                            {report.admin_notes && (
                              <div className="text-xs">
                                <span className="font-semibold text-gray-700">Nota master:</span>
                                <p className="text-gray-600 italic mt-0.5">{report.admin_notes}</p>
                              </div>
                            )}
                            <div className="space-y-1">
                              {report.items.map((item) => (
                                <div key={item.id} className="p-2 bg-gray-50 rounded text-xs">
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-800 truncate">{item.insured_name}</p>
                                      <p className="text-gray-600 text-[10px]">{item.policy_number} • {item.insurer_name}</p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="font-semibold text-[#8AAA19]">
                                        ${item.broker_commission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                      <p className="text-gray-500 text-[10px]">
                                        Bruto: ${item.commission_raw.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        });
      })()}

      {/* Modal de selección de formato */}
      {downloadModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => { if (!downloading) setDownloadModal(null); }}
        >
          <Card className="w-full max-w-sm m-4 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-[#010139] mb-2">Descargar Reporte</h3>
              <p className="text-sm text-gray-600 mb-1">
                {downloadModal.broker_name}
              </p>
              <p className="text-xs text-gray-500 mb-4">
                {downloadModal.items.length} item(s) · ${downloadModal.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                  disabled={downloading !== null}
                  onClick={() => handleDownloadReport(downloadModal, 'pdf')}
                >
                  {downloading === 'pdf' ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  ) : (
                    <FaFilePdf className="mr-2" />
                  )}
                  PDF
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={downloading !== null}
                  onClick={() => handleDownloadReport(downloadModal, 'xlsx')}
                >
                  {downloading === 'xlsx' ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  ) : (
                    <FaFileExcel className="mr-2" />
                  )}
                  Excel
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full mt-3"
                disabled={downloading !== null}
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
