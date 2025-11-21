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
import { formatCurrency as formatMoney, groupClaimsByBroker } from '@/lib/commissions/adjustments-utils';
import { generateAdjustmentsACH, getAdjustmentsACHFilename, downloadAdjustmentsACH } from '@/lib/commissions/adjustments-ach';

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

  // Generar ACH
  const handleGenerateACH = async () => {
    if (approvedClaims.length === 0) {
      toast.error('No hay ajustes aprobados para generar archivo ACH');
      return;
    }

    setProcessing(true);
    try {
      const result = await actionGetAdjustmentsCSVData(approvedClaims);

      if (result.ok && result.data) {
        // Convertir datos a formato esperado por generateAdjustmentsACH
        const claimsReports = result.data.map((row: any) => ({
          broker_id: row.broker_id || '',
          broker_name: row.nombre || '',
          broker_email: row.correo || '',
          total_raw_amount: 0,
          total_broker_amount: parseFloat(row.monto || '0'),
          item_count: 1,
          status: 'approved',
          items: [{
            brokers: {
              id: row.broker_id || '',
              name: row.nombre || '',
              bank_route: row.ruta || '',
              bank_account_no: row.cuenta || '',
              tipo_cuenta: row.tipo || '',
              nombre_completo: row.nombre || '',
              profiles: { full_name: row.nombre || '', email: row.correo || '' }
            }
          }]
        }));

        const achResult = generateAdjustmentsACH(claimsReports as any);
        
        if (achResult.errors.length > 0) {
          const errorList = achResult.errors.map(e => `${e.brokerName}: ${e.errors.join(', ')}`).join('\n');
          toast.error(`Faltan datos bancarios en ${achResult.errors.length} broker(s). No se incluirán en el archivo:\n${errorList}`, { duration: 8000 });
        }
        
        if (achResult.validCount > 0) {
          const filename = getAdjustmentsACHFilename();
          downloadAdjustmentsACH(achResult.content, filename);
          toast.success(`Archivo ACH generado con ${achResult.validCount} registro(s) - Total: $${achResult.totalAmount.toFixed(2)}`);
        } else {
          toast.error('No se pudo generar el archivo ACH. Verifica los datos bancarios de los brokers.');
        }
      } else {
        toast.error(result.error || 'Error al obtener datos para archivo ACH');
      }
    } catch (error) {
      console.error('Error generating ACH:', error);
      toast.error('Error inesperado al generar archivo ACH');
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
      {/* Header Section */}
      <div className="bg-white rounded-lg p-4 border-l-4 border-[#010139] shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-semibold text-[#010139] mb-2">Ajustes Identificados</h2>
            <p className="text-sm text-gray-600">
              {groupedReports.length} {groupedReports.length === 1 ? 'reporte pendiente' : 'reportes pendientes'} de aprobación
            </p>
          </div>
        </div>
      </div>

      {/* Instrucciones */}
      <Card className="bg-blue-50 border-l-4 border-blue-500 shadow-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <FaMoneyBillWave className="text-blue-600" />
            Flujo de Aprobación y Pago
          </h3>
          <ol className="text-sm text-gray-700 space-y-2 list-decimal list-inside">
            <li>Selecciona los reportes de corredores que deseas aprobar</li>
            <li>Click en "Aceptar Seleccionados" y elige "Pagar Ya" o "Próxima Quincena"</li>
            <li><strong>Si elegiste "Pagar Ya":</strong> Descarga el archivo ACH (Banco General)</li>
            <li>Realiza las transferencias en Banca en Línea Comercial</li>
            <li>Click en "Confirmar Pagado" - Esto registrará los clientes en preliminar de BD</li>
            <li>Los brokers recibirán notificación para completar información de clientes</li>
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
                      className="bg-gradient-to-r from-[#8AAA19] to-[#7a9617] text-white hover:from-[#7a9617] hover:to-[#6b8514] border-0 shadow-md font-semibold"
                    >
                      <FaCheckCircle className="mr-2" size={14} />
                      Aceptar Seleccionados
                      <FaChevronDown className="ml-2" size={12} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-white border border-gray-200 shadow-lg">
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
                  Descarga el archivo ACH (formato oficial) y luego confirma el pago
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGenerateACH}
                  disabled={processing}
                  className="bg-gradient-to-r from-[#010139] to-[#020270] text-white hover:from-[#020270] hover:to-[#010139] border-0 shadow-md font-semibold"
                  title="Exportar ajustes en formato ACH Banco General"
                >
                  <FaFileDownload className="mr-2" />
                  Descargar ACH
                </Button>
                <Button
                  onClick={handleConfirmPaid}
                  disabled={processing}
                  className="bg-gradient-to-r from-green-600 to-green-700 text-white hover:from-green-700 hover:to-green-800 border-0 shadow-md font-semibold"
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
