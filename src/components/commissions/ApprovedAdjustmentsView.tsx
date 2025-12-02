'use client';

import { useState, useEffect } from 'react';
import { actionGetApprovedReports, actionProcessApprovedReports } from '@/app/(app)/commissions/process-adjustments';
import { actionGenerateBankTXT } from '@/app/(app)/commissions/generate-bank-txt';
import { toast } from 'sonner';
import { 
  FaCheckCircle, 
  FaMoneyBillWave, 
  FaCalendarPlus, 
  FaChevronDown, 
  FaChevronRight,
  FaInfoCircle
} from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

interface AdjustmentReport {
  id: string;
  broker_id: string;
  broker_name: string;
  status: string;
  total_amount: number;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
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

export default function ApprovedAdjustmentsView() {
  const [reports, setReports] = useState<AdjustmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'immediate' | 'next_fortnight'>('next_fortnight');
  const [processing, setProcessing] = useState(false);
  const [processedReportIds, setProcessedReportIds] = useState<string[]>([]);
  const [showDownloadButton, setShowDownloadButton] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const result = await actionGetApprovedReports();
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

  const toggleSelectReport = (reportId: string) => {
    setSelectedReports(prev => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedReports.size === reports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports.map(r => r.id)));
    }
  };

  const handleProcessPayment = async () => {
    if (selectedReports.size === 0) {
      toast.error('Selecciona al menos un reporte');
      return;
    }

    setProcessing(true);
    try {
      const result = await actionProcessApprovedReports(
        Array.from(selectedReports),
        paymentMode
      );

      if (result.ok) {
        toast.success(result.message);
        
        // Si es pago inmediato, descargar TXT automáticamente
        if (result.mode === 'immediate' && result.reportIds) {
          setProcessedReportIds(result.reportIds);
          setShowDownloadButton(true);
          
          // Descargar automáticamente el TXT después de un breve delay
          toast.info('Generando archivo TXT bancario...');
          setTimeout(async () => {
            await handleDownloadTXT(result.reportIds);
          }, 500);
        }
        
        setSelectedReports(new Set());
        setShowPaymentModal(false);
        await loadReports();
      } else {
        toast.error('Error al procesar', { description: result.error });
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast.error('Error al procesar reportes');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadTXT = async (reportIds?: string[]) => {
    try {
      const idsToUse = reportIds || processedReportIds;
      const result = await actionGenerateBankTXT(idsToUse);
      
      if (result.ok && result.data) {
        // Crear blob y descargar archivo
        const blob = new Blob([result.data.content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.data.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast.success(`TXT descargado: ${result.data.count} línea(s)`);
        setShowDownloadButton(false);
        setProcessedReportIds([]);
      } else {
        toast.error('Error al generar TXT', { description: result.error });
      }
    } catch (error) {
      console.error('Error downloading TXT:', error);
      toast.error('Error al descargar archivo');
    }
  };

  const totalSelected = Array.from(selectedReports).reduce((sum, id) => {
    const report = reports.find(r => r.id === id);
    return sum + (report?.total_amount || 0);
  }, 0);

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
            No hay reportes aprobados
          </h3>
          <p className="text-sm text-gray-500">
            Los reportes aparecerán aquí después de que apruebes reportes pendientes
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Botón para descargar TXT - Aparece después de procesar con pagar ya */}
      {showDownloadButton && (
        <div className="sticky top-[60px] sm:top-[72px] z-[100] bg-gradient-to-r from-blue-50 to-white border-2 border-blue-500 rounded-lg p-3 sm:p-4 shadow-lg animate-pulse">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg">
                <FaMoneyBillWave className="text-blue-600" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-[#010139] text-sm sm:text-base">
                  Ajustes Procesados - Descarga TXT
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1">
                  Los ajustes están marcados como pagados. Descarga el archivo TXT para Banco General.
                </p>
              </div>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowDownloadButton(false);
                  setProcessedReportIds([]);
                }}
                className="flex-1 sm:flex-none text-xs sm:text-sm"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => handleDownloadTXT()}
                className="flex-1 sm:flex-none text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold"
              >
                <FaMoneyBillWave className="mr-1 sm:mr-2" size={12} />
                Descargar TXT
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky bar - Selección múltiple - Ocultar cuando modal abierto */}
      {selectedReports.size > 0 && !showPaymentModal && (
        <div className="sticky top-[60px] sm:top-[72px] z-[100] bg-gradient-to-r from-green-50 to-white border-2 border-[#8AAA19] rounded-lg p-3 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex-1">
              <p className="font-bold text-[#010139] text-sm sm:text-base">
                {selectedReports.size} reporte(s) seleccionado(s)
              </p>
              <p className="text-xs sm:text-sm text-gray-600">
                Total: <span className="font-semibold text-[#8AAA19]">
                  ${totalSelected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReports(new Set())}
                className="flex-1 sm:flex-none text-xs sm:text-sm border-red-500 text-red-600 hover:bg-red-50"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => setShowPaymentModal(true)}
                disabled={processing}
                className="flex-1 sm:flex-none text-xs sm:text-sm bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white font-semibold"
              >
                <FaMoneyBillWave className="mr-1 sm:mr-2" size={12} />
                Procesar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Botón Seleccionar Todos */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          className="text-xs sm:text-sm"
        >
          <FaCheckCircle className="mr-1 sm:mr-2" size={12} />
          {selectedReports.size === reports.length ? 'Deseleccionar' : 'Seleccionar'} Todos
        </Button>
      </div>

      {/* Lista de reportes */}
      {reports.map((report) => {
        const isExpanded = expandedReports.has(report.id);
        const isSelected = selectedReports.has(report.id);

        return (
          <Card 
            key={report.id} 
            className={`overflow-hidden transition-all ${
              isSelected ? 'ring-2 ring-[#8AAA19] shadow-md' : 'shadow hover:shadow-md'
            }`}
          >
            <div className="p-3 sm:p-4">
              {/* Header del reporte */}
              <div className="flex items-start gap-2 sm:gap-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelectReport(report.id)}
                  className="mt-1 h-4 w-4 sm:h-5 sm:w-5 rounded border-gray-300 text-[#8AAA19] focus:ring-[#8AAA19] flex-shrink-0 cursor-pointer"
                />

                {/* Info del reporte */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#010139] text-sm sm:text-base truncate">
                        {report.broker_name}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-600">
                        {report.items.length} item(s) • ${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-500">
                        Aprobado: {new Date(report.reviewed_at || report.created_at).toLocaleDateString('es-PA')}
                      </p>
                    </div>

                    {/* Botón Expandir */}
                    <button
                      onClick={() => toggleReport(report.id)}
                      className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                    >
                      {isExpanded ? (
                        <FaChevronDown className="text-gray-600" size={14} />
                      ) : (
                        <FaChevronRight className="text-gray-600" size={14} />
                      )}
                    </button>
                  </div>

                  {/* Notas si existen */}
                  {(report.notes || report.admin_notes) && !isExpanded && (
                    <div className="mt-2 text-xs text-gray-600 italic truncate">
                      {report.admin_notes || report.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  {/* Notas */}
                  {report.notes && (
                    <div className="text-xs sm:text-sm">
                      <span className="font-semibold text-gray-700">Nota broker:</span>
                      <p className="text-gray-600 italic mt-1">{report.notes}</p>
                    </div>
                  )}
                  {report.admin_notes && (
                    <div className="text-xs sm:text-sm">
                      <span className="font-semibold text-gray-700">Nota master:</span>
                      <p className="text-gray-600 italic mt-1">{report.admin_notes}</p>
                    </div>
                  )}

                  {/* Items del reporte */}
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold text-gray-700">Items:</span>
                    <div className="mt-2 space-y-1.5">
                      {report.items.map((item) => (
                        <div 
                          key={item.id} 
                          className="p-2 bg-gray-50 rounded text-xs"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-800 truncate">{item.insured_name}</p>
                              <p className="text-gray-600 text-[10px]">{item.policy_number} • {item.insurer_name}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-semibold text-[#8AAA19]">
                                ${item.broker_commission.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                              <p className="text-gray-500 text-[10px]">
                                Bruto: ${item.commission_raw.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        );
      })}

      {/* Modal de Método de Pago */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="w-[95vw] max-w-md mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Método de Pago</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Selecciona cómo quieres procesar los {selectedReports.size} reporte(s) seleccionado(s)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Total a procesar */}
            <div className="p-3 bg-[#8AAA19]/10 rounded-lg border border-[#8AAA19]/30">
              <p className="text-xs sm:text-sm text-gray-600 mb-1">Total a procesar:</p>
              <p className="text-xl sm:text-2xl font-bold text-[#8AAA19]">
                ${totalSelected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            {/* Opciones de pago */}
            <RadioGroup value={paymentMode} onValueChange={(value: any) => setPaymentMode(value)}>
              <div className="space-y-3">
                {/* Pagar Ya */}
                <div 
                  className={`flex items-start gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    paymentMode === 'immediate' 
                      ? 'border-[#8AAA19] bg-[#8AAA19]/5' 
                      : 'border-gray-200 hover:border-[#8AAA19]/50'
                  }`}
                  onClick={() => setPaymentMode('immediate')}
                >
                  <RadioGroupItem value="immediate" id="immediate" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="immediate" className="cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <FaMoneyBillWave className="text-[#8AAA19]" />
                        <span className="font-bold text-sm sm:text-base">Pagar Ya</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Genera TXT para Banco General y confirma pago inmediato. Los ajustes se registrarán como pagados hoy.
                      </p>
                    </Label>
                  </div>
                </div>

                {/* Siguiente Quincena */}
                <div 
                  className={`flex items-start gap-3 p-3 sm:p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    paymentMode === 'next_fortnight' 
                      ? 'border-[#8AAA19] bg-[#8AAA19]/5' 
                      : 'border-gray-200 hover:border-[#8AAA19]/50'
                  }`}
                  onClick={() => setPaymentMode('next_fortnight')}
                >
                  <RadioGroupItem value="next_fortnight" id="next_fortnight" className="mt-0.5" />
                  <div className="flex-1">
                    <Label htmlFor="next_fortnight" className="cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <FaCalendarPlus className="text-[#8AAA19]" />
                        <span className="font-bold text-sm sm:text-base">Siguiente Quincena</span>
                      </div>
                      <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
                        Asocia estos ajustes a la siguiente quincena. Se pagarán junto con las comisiones regulares.
                      </p>
                    </Label>
                  </div>
                </div>
              </div>
            </RadioGroup>

            {/* Botones de acción */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setShowPaymentModal(false)}
                disabled={processing}
                className="flex-1 text-sm"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleProcessPayment}
                disabled={processing}
                className="flex-1 text-sm bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white font-semibold"
              >
                {processing ? 'Procesando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
