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
  FaCheckCircle
} from 'react-icons/fa';
import { Card, CardContent } from '@/components/ui/card';

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

export default function PaidAdjustmentsView() {
  const [reports, setReports] = useState<AdjustmentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

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
                  ${reports.reduce((sum, r) => sum + r.total_amount, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
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

      {/* Lista de reportes pagados */}
      {reports.map((report) => {
        const isExpanded = expandedReports.has(report.id);
        const paidDate = report.paid_date ? new Date(report.paid_date) : new Date(report.created_at);
        const isImmediate = report.payment_mode === 'immediate';

        return (
          <Card key={report.id} className="overflow-hidden shadow hover:shadow-md transition-shadow">
            <div className="p-3 sm:p-4">
              {/* Header del reporte */}
              <div className="flex items-start gap-2 sm:gap-3">
                {/* Icono de estado */}
                <div className="flex-shrink-0 p-2 bg-green-100 rounded-lg">
                  <FaCheckCircle className="text-green-600" size={16} />
                </div>

                {/* Info del reporte */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#010139] text-sm sm:text-base truncate">
                        {report.broker_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-xs sm:text-sm text-gray-600">
                          {report.items.length} item(s)
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs sm:text-sm font-semibold text-[#8AAA19]">
                          ${report.total_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="text-[10px] sm:text-xs text-gray-500">
                          <FaCalendarAlt className="inline mr-1" size={10} />
                          Pagado: {paidDate.toLocaleDateString('es-PA')}
                        </span>
                        {isImmediate ? (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            Pago Inmediato
                          </span>
                        ) : (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                            Quincena
                          </span>
                        )}
                      </div>
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

                  {/* Notas si existen y no está expandido */}
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

                  {/* Información de pago */}
                  <div className="text-xs sm:text-sm bg-gray-50 rounded p-2">
                    <span className="font-semibold text-gray-700">Método de pago:</span>
                    <p className="text-gray-600 mt-1">
                      {isImmediate ? (
                        <>
                          <FaMoneyBillWave className="inline mr-1" />
                          Pago inmediato (TXT Banco General)
                        </>
                      ) : (
                        <>
                          <FaCalendarAlt className="inline mr-1" />
                          Siguiente quincena
                          {report.fortnight_id && ` (ID: ${report.fortnight_id.slice(0, 8)}...)`}
                        </>
                      )}
                    </p>
                  </div>

                  {/* Items del reporte */}
                  <div className="text-xs sm:text-sm">
                    <span className="font-semibold text-gray-700">Items pagados:</span>
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
    </div>
  );
}
