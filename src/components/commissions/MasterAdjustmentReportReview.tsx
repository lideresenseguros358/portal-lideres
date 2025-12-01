'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  FaCheckCircle, 
  FaTimesCircle, 
  FaEdit, 
  FaClock, 
  FaCalendarAlt,
  FaDollarSign,
  FaInfoCircle
} from 'react-icons/fa';
import { toast } from 'sonner';

interface AdjustmentReport {
  id: string;
  broker_id: string;
  broker_name: string;
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  total_amount: number;
  notes: string | null;
  created_at: string;
  items: AdjustmentItem[];
  payment_mode?: 'immediate' | 'next_fortnight' | null;
  fortnight_id?: string | null;
  paid_date?: string | null;
}

interface AdjustmentItem {
  id: string;
  policy_number: string;
  insured_name: string | null;
  commission_raw: number;
  broker_commission: number;
  insurer_name: string | null;
}

interface Props {
  reports: AdjustmentReport[];
  onApprove: (reportId: string, adminNotes: string) => Promise<void>;
  onReject: (reportId: string, reason: string) => Promise<void>;
  onEdit: (reportId: string, itemIds: string[]) => Promise<void>;
  onReload: () => void;
}

export default function MasterAdjustmentReportReview({ 
  reports, 
  onApprove, 
  onReject, 
  onEdit,
  onReload 
}: Props) {
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [reviewingReport, setReviewingReport] = useState<AdjustmentReport | null>(null);
  const [batchApproving, setBatchApproving] = useState(false);
  const [batchPaymentMode, setBatchPaymentMode] = useState<'immediate' | 'next_fortnight'>('next_fortnight');
  const [paymentMode, setPaymentMode] = useState<'immediate' | 'next_fortnight'>('next_fortnight');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectingReport, setRejectingReport] = useState<AdjustmentReport | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [editingReport, setEditingReport] = useState<AdjustmentReport | null>(null);

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

  const handleApprove = async () => {
    if (!reviewingReport) return;

    setProcessing(true);
    try {
      await onApprove(reviewingReport.id, adminNotes);
      toast.success('Reporte aprobado - Ahora selecciona reportes aprobados para decidir método de pago');
      setReviewingReport(null);
      setAdminNotes('');
      onReload();
    } catch (error) {
      console.error('Error approving report:', error);
      toast.error('Error al aprobar reporte');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingReport || !rejectReason.trim()) {
      toast.error('Debes proporcionar una razón para el rechazo');
      return;
    }

    setProcessing(true);
    try {
      await onReject(rejectingReport.id, rejectReason);
      toast.success('Reporte rechazado');
      setRejectingReport(null);
      setRejectReason('');
      onReload();
    } catch (error) {
      console.error('Error rejecting report:', error);
      toast.error('Error al rechazar reporte');
    } finally {
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-PA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-amber-500 text-white">
            <FaClock className="mr-1" size={10} />
            Pendiente
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-blue-500 text-white">
            <FaCheckCircle className="mr-1" size={10} />
            Aprobado
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-red-500 text-white">
            <FaTimesCircle className="mr-1" size={10} />
            Rechazado
          </Badge>
        );
      case 'paid':
        return (
          <Badge className="bg-green-500 text-white">
            <FaDollarSign className="mr-1" size={10} />
            Pagado
          </Badge>
        );
      default:
        return null;
    }
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

  const toggleSelectAll = () => {
    if (selectedReports.size === reports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(reports.map(r => r.id)));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedReports.size === 0) {
      toast.error('Debes seleccionar al menos un reporte');
      return;
    }

    setBatchApproving(true);
    try {
      for (const reportId of selectedReports) {
        await onApprove(reportId, ''); // Solo aprobar, sin decidir método de pago aún
      }
      toast.success(`${selectedReports.size} reporte(s) aprobado(s) - Ahora selecciona reportes aprobados para decidir método de pago`);
      setSelectedReports(new Set());
      onReload();
    } catch (error) {
      console.error('Error in batch approve:', error);
      toast.error('Error al aprobar reportes');
    } finally {
      setBatchApproving(false);
    }
  };

  if (reports.length === 0) {
    return (
      <Card className="shadow-lg">
        <CardContent className="p-12 text-center">
          <FaInfoCircle className="text-6xl text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-600 mb-2">
            No hay reportes de ajustes pendientes
          </h3>
          <p className="text-gray-500">
            Los reportes enviados por brokers aparecerán aquí
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Batch Actions Bar */}
      {selectedReports.size > 0 && (
        <Card className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="w-full sm:w-auto">
                <p className="font-bold text-blue-900 text-sm sm:text-base">
                  {selectedReports.size} {selectedReports.size === 1 ? 'reporte' : 'reportes'}
                </p>
                <p className="text-xs sm:text-sm text-blue-700">
                  Total: {formatCurrency(reports.filter(r => selectedReports.has(r.id)).reduce((sum, r) => sum + r.total_amount, 0))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedReports(new Set())}
                  className="border-gray-500 text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  onClick={handleBatchApprove}
                  disabled={batchApproving}
                  className="bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm flex-1 sm:flex-none"
                >
                  <FaCheckCircle className="mr-1 sm:mr-2" />
                  {batchApproving ? 'Aprobando...' : 'Aprobar'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Select All Checkbox */}
      {reports.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
          <input
            type="checkbox"
            checked={selectedReports.size === reports.length && reports.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">
            Seleccionar todos los reportes
          </span>
        </div>
      )}
      {reports.map(report => (
        <Card key={report.id} className={`shadow-lg border-2 hover:shadow-xl transition-shadow ${
          selectedReports.has(report.id) ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100'
        }`}>
          <CardHeader 
            className="cursor-pointer bg-gradient-to-r from-gray-50 to-white hover:from-gray-100 hover:to-gray-50 transition-colors"
            onClick={() => toggleReport(report.id)}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Checkbox de selección */}
              {report.status === 'pending' && (
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedReports.has(report.id)}
                    onChange={() => toggleSelectReport(report.id)}
                    className="w-5 h-5 rounded border-gray-300 mr-4"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <CardTitle className="text-base sm:text-lg font-bold text-[#010139] truncate">
                    {report.broker_name}
                  </CardTitle>
                  {getStatusBadge(report.status)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600 space-y-1">
                  <p>
                    <span className="font-semibold">{report.items.length}</span> {report.items.length === 1 ? 'ajuste' : 'ajustes'} •{' '}
                    <span className="font-mono font-semibold text-[#8AAA19]">
                      {formatCurrency(report.total_amount)}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {formatDate(report.created_at)}
                  </p>
                </div>
              </div>
              
              {report.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setReviewingReport(report);
                    }}
                    className="bg-white border-green-500 text-green-700 hover:bg-green-50 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    <FaCheckCircle className="sm:mr-2" />
                    <span className="hidden sm:inline">Aprobar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingReport(report);
                    }}
                    className="bg-white border-yellow-500 text-yellow-700 hover:bg-yellow-50 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    <FaEdit className="sm:mr-2" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRejectingReport(report);
                    }}
                    className="bg-white border-red-500 text-red-700 hover:bg-red-50 text-xs sm:text-sm px-2 sm:px-3"
                  >
                    <FaTimesCircle className="sm:mr-2" />
                    <span className="hidden sm:inline">Rechazar</span>
                  </Button>
                </div>
              )}

              {(report.status === 'approved' || report.status === 'paid') && report.payment_mode && (
                <Badge className="bg-blue-100 text-blue-800 text-xs">
                  {report.payment_mode === 'immediate' ? (
                    <>
                      <FaDollarSign className="mr-1" />
                      Pago Inmediato
                    </>
                  ) : (
                    <>
                      <FaCalendarAlt className="mr-1" />
                      Siguiente Quincena
                    </>
                  )}
                </Badge>
              )}
            </div>
          </CardHeader>

          {expandedReports.has(report.id) && (
            <CardContent className="p-6 bg-gray-50">
              {/* Notas del Broker */}
              {report.notes && (
                <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                  <p className="text-sm font-semibold text-blue-900 mb-1">Notas del Broker:</p>
                  <p className="text-sm text-blue-800">{report.notes}</p>
                </div>
              )}

              {/* Tabla de Items - Desktop */}
              <div className="hidden md:block bg-white rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="font-semibold">Póliza</TableHead>
                      <TableHead className="font-semibold">Cliente</TableHead>
                      <TableHead className="font-semibold">Aseguradora</TableHead>
                      <TableHead className="text-right font-semibold">Monto Crudo</TableHead>
                      <TableHead className="text-right font-semibold">Comisión</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.policy_number}</TableCell>
                        <TableCell>{item.insured_name || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.insurer_name || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(Math.abs(item.commission_raw))}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-[#8AAA19]">
                          {formatCurrency(item.broker_commission)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell colSpan={4} className="text-right">TOTAL:</TableCell>
                      <TableCell className="text-right font-mono text-[#8AAA19] text-lg">
                        {formatCurrency(report.total_amount)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Lista de Items - Mobile */}
              <div className="md:hidden space-y-3">
                {report.items.map((item) => (
                  <div key={item.id} className="bg-white border rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 mb-1">Póliza</p>
                        <p className="font-semibold text-sm text-[#010139]">{item.policy_number}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{item.insurer_name || '—'}</Badge>
                    </div>
                    {item.insured_name && (
                      <div>
                        <p className="text-xs text-gray-500">Cliente</p>
                        <p className="text-sm">{item.insured_name}</p>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <div>
                        <p className="text-xs text-gray-500">Monto Crudo</p>
                        <p className="text-sm font-mono">{formatCurrency(Math.abs(item.commission_raw))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">Comisión</p>
                        <p className="text-sm font-mono font-semibold text-[#8AAA19]">
                          {formatCurrency(item.broker_commission)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Total en Mobile */}
                <div className="bg-gray-100 border-2 border-[#8AAA19] rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">TOTAL:</span>
                    <span className="font-mono font-bold text-[#8AAA19] text-lg">
                      {formatCurrency(report.total_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Modal de Aprobación */}
      <Dialog open={!!reviewingReport} onOpenChange={() => setReviewingReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#010139] flex items-center gap-2">
              <FaCheckCircle className="text-green-500" />
              Aprobar Reporte de Ajuste
            </DialogTitle>
            <DialogDescription>
              Define cómo y cuándo se pagará este reporte
            </DialogDescription>
          </DialogHeader>

          {reviewingReport && (
            <div className="space-y-6">
              {/* Resumen */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-semibold">Broker:</span> {reviewingReport.broker_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <span className="font-semibold">Items:</span> {reviewingReport.items.length}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Total:</span>{' '}
                  <span className="font-mono font-bold text-[#8AAA19] text-lg">
                    {formatCurrency(reviewingReport.total_amount)}
                  </span>
                </p>
              </div>

              {/* Modalidad de Pago */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Modalidad de Pago</Label>
                <RadioGroup value={paymentMode} onValueChange={(v: any) => setPaymentMode(v)}>
                  <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <RadioGroupItem value="next_fortnight" id="next_fortnight" />
                    <Label htmlFor="next_fortnight" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <FaCalendarAlt className="text-blue-500" />
                        <span className="font-semibold">Sumar en Siguiente Quincena</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Se agregará automáticamente al cierre de la próxima quincena y aparecerá en el historial
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <RadioGroupItem value="immediate" id="immediate" />
                    <Label htmlFor="immediate" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <FaDollarSign className="text-green-500" />
                        <span className="font-semibold">Pagar Ya (Inmediato)</span>
                      </div>
                      <p className="text-sm text-gray-600">
                        Se marca como pagado inmediatamente. Solo aparecerá en "Ajustes Pagados"
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Notas Admin */}
              <div className="space-y-2">
                <Label htmlFor="admin-notes">Notas de Administración (opcional)</Label>
                <Textarea
                  id="admin-notes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Agrega comentarios internos sobre este ajuste..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setReviewingReport(null)}
                  variant="outline"
                  disabled={processing}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={processing}
                  className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold shadow-lg"
                >
                  <FaCheckCircle className="mr-2" />
                  {processing ? 'Aprobando...' : 'Aprobar y Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Rechazo */}
      <Dialog open={!!rejectingReport} onOpenChange={() => setRejectingReport(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-red-600 flex items-center gap-2">
              <FaTimesCircle />
              Rechazar Reporte de Ajuste
            </DialogTitle>
            <DialogDescription>
              Proporciona una razón para el rechazo
            </DialogDescription>
          </DialogHeader>

          {rejectingReport && (
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-red-900">
                  <span className="font-semibold">Broker:</span> {rejectingReport.broker_name}
                </p>
                <p className="text-sm text-red-900">
                  <span className="font-semibold">Total:</span> {formatCurrency(rejectingReport.total_amount)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reject-reason">Razón del Rechazo *</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explica por qué se rechaza este reporte..."
                  rows={4}
                  className="resize-none"
                  required
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button
                  onClick={() => setRejectingReport(null)}
                  variant="outline"
                  disabled={processing}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleReject}
                  disabled={processing || !rejectReason.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold"
                >
                  <FaTimesCircle className="mr-2" />
                  {processing ? 'Rechazando...' : 'Confirmar Rechazo'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
