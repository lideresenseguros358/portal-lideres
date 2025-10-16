'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FaCheckCircle,
  FaTimesCircle,
  FaFileDownload,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaChevronDown,
} from 'react-icons/fa';
import { toast } from 'sonner';
import { ClaimsReportCard } from './ClaimsReportCard';
import {
  actionGetClaimsReports,
  actionApproveClaimsReports,
  actionRejectClaimsReports,
  actionGetAdjustmentsCSVData,
  actionConfirmAdjustmentsPaid,
} from '@/app/(app)/commissions/actions';
import { formatCurrency as formatMoney, groupClaimsByBroker, convertToCSV, downloadCSV } from '@/lib/commissions/adjustments-utils';

export function MasterClaimsView() {
  const [claims, setClaims] = useState<any[]>([]);
  const [selectedBrokers, setSelectedBrokers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [approvedClaims, setApprovedClaims] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await actionGetClaimsReports('pending');
      if (result.ok) {
        setClaims(result.data || []);
      }
    } catch (error) {
      console.error('Error loading claims:', error);
      toast.error('Error al cargar reportes');
    }
    setLoading(false);
  };

  // Agrupar claims por broker
  const groupedReports = useMemo(() => {
    const grouped = new Map<string, any[]>();
    
    claims.forEach((claim) => {
      const brokerId = claim.broker_id;
      if (!grouped.has(brokerId)) {
        grouped.set(brokerId, []);
      }
      grouped.get(brokerId)!.push(claim);
    });

    return Array.from(grouped.entries()).map(([brokerId, items]) => {
      const broker = items[0]?.brokers;
      return {
        brokerId,
        brokerName: broker?.name || 'Broker Desconocido',
        brokerEmail: broker?.profiles?.email || '',
        items,
      };
    });
  }, [claims]);

  // Calcular totales de selección
  const selectionTotals = useMemo(() => {
    const selectedClaims = claims.filter(c => selectedBrokers.has(c.broker_id));
    
    const totalRaw = selectedClaims.reduce((sum, claim) => {
      const amount = claim.comm_items?.gross_amount || 0;
      return sum + Math.abs(amount);
    }, 0);

    const totalBroker = selectedClaims.reduce((sum, claim) => {
      const amount = claim.comm_items?.gross_amount || 0;
      const percent = claim.brokers?.percent_default || 0;
      return sum + (Math.abs(amount) * (percent / 100));
    }, 0);

    return {
      count: selectedClaims.length,
      brokers: selectedBrokers.size,
      totalRaw,
      totalBroker,
    };
  }, [selectedBrokers, claims]);

  // Toggle broker selection
  const toggleBroker = (brokerId: string) => {
    setSelectedBrokers(prev => {
      const next = new Set(prev);
      if (next.has(brokerId)) {
        next.delete(brokerId);
      } else {
        next.add(brokerId);
      }
      return next;
    });
  };

  // Aprobar reportes
  const handleApprove = async (paymentType: 'now' | 'next_fortnight') => {
    if (selectedBrokers.size === 0) {
      toast.error('Selecciona al menos un reporte');
      return;
    }

    setProcessing(true);
    try {
      const claimIds = claims
        .filter(c => selectedBrokers.has(c.broker_id))
        .map(c => c.id);

      const result = await actionApproveClaimsReports(claimIds, paymentType);

      if (result.ok) {
        toast.success(result.message || 'Reportes aprobados');
        
        if (paymentType === 'now') {
          // Guardar IDs para mostrar botón de CSV
          setApprovedClaims(claimIds);
          toast.info('Ahora puedes generar el CSV bancario');
        } else {
          toast.info('Los ajustes se incluirán en la siguiente quincena');
        }

        setSelectedBrokers(new Set());
        await loadData();
      } else {
        toast.error(result.error || 'Error al aprobar');
      }
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('Error al aprobar reportes');
    } finally {
      setProcessing(false);
    }
  };

  // Rechazar reportes
  const handleReject = async () => {
    if (selectedBrokers.size === 0) {
      toast.error('Selecciona al menos un reporte');
      return;
    }

    // TODO: Agregar modal para razón de rechazo
    const reason = prompt('Razón del rechazo (opcional):');

    setProcessing(true);
    try {
      const claimIds = claims
        .filter(c => selectedBrokers.has(c.broker_id))
        .map(c => c.id);

      const result = await actionRejectClaimsReports(claimIds, reason || undefined);

      if (result.ok) {
        toast.success(result.message || 'Reportes rechazados');
        setSelectedBrokers(new Set());
        await loadData();
      } else {
        toast.error(result.error || 'Error al rechazar');
      }
    } catch (error) {
      console.error('Error rejecting:', error);
      toast.error('Error al rechazar reportes');
    } finally {
      setProcessing(false);
    }
  };

  // Generar CSV
  const handleGenerateCSV = async () => {
    if (approvedClaims.length === 0) {
      toast.error('No hay ajustes aprobados para generar CSV');
      return;
    }

    setProcessing(true);
    try {
      const result = await actionGetAdjustmentsCSVData(approvedClaims);

      if (result.ok && result.data) {
        const headers = ['NOMBRE', 'TIPO', 'CEDULA', 'BANCO', 'CUENTA', 'MONTO', 'CORREO', 'DESCRIPCION'];
        const rows = result.data.map((row: any) => [
          row.nombre,
          row.tipo,
          row.cedula,
          row.banco,
          row.cuenta,
          row.monto,
          row.correo,
          row.descripcion,
        ]);

        const csv = convertToCSV(headers, rows);
        const filename = `ajustes_${new Date().toISOString().split('T')[0]}.csv`;
        downloadCSV(csv, filename);

        toast.success('CSV generado exitosamente');
      } else {
        toast.error(result.error || 'Error al generar CSV');
      }
    } catch (error) {
      console.error('Error generating CSV:', error);
      toast.error('Error al generar CSV');
    } finally {
      setProcessing(false);
    }
  };

  // Confirmar pago
  const handleConfirmPaid = async () => {
    if (approvedClaims.length === 0) {
      toast.error('No hay ajustes para confirmar como pagados');
      return;
    }

    if (!confirm('¿Confirmas que ya realizaste el pago de estos ajustes en el banco?')) {
      return;
    }

    setProcessing(true);
    try {
      const result = await actionConfirmAdjustmentsPaid(approvedClaims);

      if (result.ok) {
        toast.success(result.message || 'Ajustes confirmados como pagados');
        setApprovedClaims([]);
        await loadData();
      } else {
        toast.error(result.error || 'Error al confirmar pago');
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Error al confirmar pago');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instrucciones */}
      <Card className="bg-gradient-to-r from-blue-50 to-white border-l-4 border-[#010139]">
        <CardContent className="p-4">
          <h3 className="font-bold text-[#010139] mb-2">📋 Flujo de Ajustes Reportados</h3>
          <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
            <li>Selecciona los reportes de corredores que marcaron como "Mío"</li>
            <li>Haz clic en "Aceptar Seleccionados" y elige "Pagar Ya"</li>
            <li>Descarga el CSV bancario con el botón verde que aparecerá</li>
            <li>Carga el CSV en el banco y realiza las transferencias</li>
            <li>Regresa y haz clic en "Confirmar Pagado"</li>
          </ol>
        </CardContent>
      </Card>

      {/* Panel de Acciones */}
      {selectedBrokers.size > 0 && (
        <Card className="shadow-lg border-2 border-[#010139] bg-gradient-to-r from-blue-50 to-white">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <div className="flex-1">
                <h3 className="font-bold text-[#010139] mb-2">
                  Reportes Seleccionados: {selectionTotals.brokers} broker(s) • {selectionTotals.count} item(s)
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-600">Total Crudo</p>
                    <p className="font-mono font-semibold text-gray-700">
                      {formatMoney(selectionTotals.totalRaw)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total Comisión</p>
                    <p className="font-mono font-bold text-[#8AAA19] text-lg">
                      {formatMoney(selectionTotals.totalBroker)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      disabled={processing}
                      className="bg-[#8AAA19] hover:bg-[#010139] text-white"
                    >
                      <FaCheckCircle className="mr-2" size={14} />
                      Aceptar Seleccionados
                      <FaChevronDown className="ml-2" size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleApprove('now')}>
                      <FaMoneyBillWave className="mr-2" />
                      Pagar Ya
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleApprove('next_fortnight')}>
                      <FaCalendarAlt className="mr-2" />
                      Pagar en Siguiente Quincena
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  onClick={handleReject}
                  disabled={processing}
                  variant="destructive"
                >
                  <FaTimesCircle className="mr-2" size={14} />
                  Rechazar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Botones de CSV y Pago */}
      {approvedClaims.length > 0 && (
        <Card className="shadow-lg border-2 border-green-500 bg-gradient-to-r from-green-50 to-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-green-800 mb-1">
                  Ajustes Aprobados para Pagar Ya
                </h3>
                <p className="text-sm text-green-700">
                  Descarga el CSV bancario y luego confirma el pago
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateCSV}
                  disabled={processing}
                  className="bg-[#010139] hover:bg-[#8AAA19] text-white"
                >
                  <FaFileDownload className="mr-2" />
                  Descargar CSV
                </Button>
                <Button
                  onClick={handleConfirmPaid}
                  disabled={processing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <FaCheckCircle className="mr-2" />
                  Confirmar Pagado
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de Reportes */}
      {groupedReports.length === 0 ? (
        <Card className="shadow-lg">
          <CardContent className="p-12 text-center">
            <FaCheckCircle className="text-6xl text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No hay reportes pendientes
            </h3>
            <p className="text-sm text-gray-500">
              Los reportes de ajustes de los brokers aparecerán aquí
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedReports.map((report) => (
            <ClaimsReportCard
              key={report.brokerId}
              brokerId={report.brokerId}
              brokerName={report.brokerName}
              brokerEmail={report.brokerEmail}
              items={report.items}
              isSelected={selectedBrokers.has(report.brokerId)}
              onToggle={toggleBroker}
            />
          ))}
        </div>
      )}
    </div>
  );
}
