'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaCheckCircle, FaExclamationTriangle, FaFileDownload, FaEdit, FaTrash } from 'react-icons/fa';
import { actionGetPendingPaymentsNew, actionMarkPaymentsAsPaidNew, actionDeletePendingPayment, actionSyncPendingPaymentsWithAdvances } from '@/app/(app)/checks/actions';
import { supabaseClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import UnpaidReferenceModal from './UnpaidReferenceModal';
import EditPaymentModal from './EditPaymentModal';

interface PendingPaymentsTabProps {
  onOpenWizard: () => void;
  onPaymentPaid?: () => void;
  refreshTrigger?: number;
}

export default function PendingPaymentsTab({ onOpenWizard, onPaymentPaid, refreshTrigger }: PendingPaymentsTabProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupByReference, setGroupByReference] = useState(true);
  const [showUnpaidModal, setShowUnpaidModal] = useState<{
    payment: { client_name: string; amount: number };
    references: string[];
    action: 'paid' | 'pdf';
  } | null>(null);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);

  const loadPayments = useCallback(async () => {
    console.log('🔄 [PendingPaymentsTab] Iniciando carga de pagos...');
    setLoading(true);
    try {
      const result = await actionGetPendingPaymentsNew({ status: 'pending' });
      console.log('📦 [PendingPaymentsTab] Resultado de la consulta:', result);
      
      if (result.ok) {
        const paymentsData = result.data || [];
        console.log(`📊 [PendingPaymentsTab] Pagos cargados: ${paymentsData.length} pagos pendientes`);
        console.log(`💰 [PendingPaymentsTab] Total a pagar: $${paymentsData.reduce((sum, p) => sum + Number(p.amount_to_pay || 0), 0).toFixed(2)}`);
        console.log(`💵 [PendingPaymentsTab] Total recibido: $${paymentsData.reduce((sum, p) => sum + Number(p.total_received || 0), 0).toFixed(2)}`);
        
        // Force state update with new array reference
        setPayments([...paymentsData]);
        console.log('✅ [PendingPaymentsTab] Estado actualizado con nuevos pagos');
      } else {
        console.error('❌ [PendingPaymentsTab] Error al cargar pagos:', result.error);
        toast.error('Error al cargar pagos');
      }
    } catch (error: any) {
      console.error('❌ [PendingPaymentsTab] Excepción al cargar pagos:', error);
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
      console.log('🏁 [PendingPaymentsTab] Carga completada');
    }
  }, []); // No dependencies needed as we only use setters and actions

  useEffect(() => {
    // Sincronización automática silenciosa en segundo plano
    const autoSync = async () => {
      try {
        await actionSyncPendingPaymentsWithAdvances();
      } catch (error) {
        // Silencioso - no mostrar error al usuario
      }
    };
    
    // Ejecutar sincronización y luego cargar pagos
    autoSync().then(() => loadPayments());
  }, [refreshTrigger, loadPayments]);

  const toggleSelect = (id: string) => {
    const payment = payments.find((p) => p.id === id);
    if (payment) {
      const state = getPaymentState(payment);
      if (state.blocked) {
        toast.error('Este pago está bloqueado hasta conciliar la referencia bancaria.');
        return;
      }
    }

    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const selectable = payments.filter((p) => !getPaymentState(p).blocked).map((p) => p.id);
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable));
    }
  };

  // Agrupar pagos por referencia para mostrar remanente real
  const groupPaymentsByReference = () => {
    const groups: { [refNumber: string]: {
      reference_number: string;
      bank_amount: number;
      total_pending: number;
      remaining: number;
      payments: any[];
    }} = {};

    payments.forEach(payment => {
      payment.payment_references?.forEach((ref: any) => {
        const refNum = ref.reference_number;
        if (!groups[refNum]) {
          groups[refNum] = {
            reference_number: refNum,
            bank_amount: parseFloat(ref.amount || '0'),
            total_pending: 0,
            remaining: parseFloat(ref.amount || '0'),
            payments: []
          };
        }
        
        // Solo contar el amount_to_use de este pago para esta referencia
        const amountToUse = parseFloat(ref.amount_to_use || payment.amount_to_pay || '0');
        groups[refNum].total_pending += amountToUse;
        groups[refNum].payments.push({ ...payment, ref_amount_to_use: amountToUse });
      });
    });

    // Calcular remanente real
    Object.keys(groups).forEach(refNum => {
      const group = groups[refNum];
      if (group) {
        group.remaining = group.bank_amount - group.total_pending;
      }
    });

    return groups;
  };

  const groupedPayments = groupPaymentsByReference();

  const handleMarkAsPaid = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (loading) return; // Prevenir doble click

    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un pago');
      return;
    }

    const selectedPayments = payments.filter(p => selectedIds.has(p.id));
    const invalidPayments = selectedPayments.filter((p) => {
      const state = getPaymentState(p);
      return state.blocked;
    });

    if (invalidPayments.length > 0) {
      // Obtener referencias no conciliadas
      const firstInvalid = invalidPayments[0];
      const unconciliated = (firstInvalid.payment_references || [])
        .filter((ref: any) => !ref.exists_in_bank)
        .map((ref: any) => ref.reference_number);
      
      // Mostrar modal en lugar de toast
      setShowUnpaidModal({
        payment: {
          client_name: firstInvalid.client_name,
          amount: firstInvalid.amount
        },
        references: unconciliated,
        action: 'paid'
      });
      return;
    }

    if (!confirm(`¿Marcar ${selectedIds.size} pago(s) como pagado(s)?`)) return;

    setLoading(true);
    try {
      const result = await actionMarkPaymentsAsPaidNew(Array.from(selectedIds));
      
      if (result.ok) {
        toast.success('✅ ' + result.message);
        setSelectedIds(new Set());
        
        // Recargar inmediatamente los pagos para actualizar contadores
        await loadPayments();
        
        // Notificar al padre para refrescar ambas pestañas (historial y pendientes)
        if (onPaymentPaid) {
          onPaymentPaid();
        }
      } else {
        toast.error('Error al marcar pagos', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (selectedIds.size === 0) {
      toast.error('Selecciona al menos un pago');
      return;
    }

    const selectedPayments = payments.filter(p => selectedIds.has(p.id));
    
    // Verificar si hay pagos no conciliados
    const invalidPayments = selectedPayments.filter((p) => {
      const state = getPaymentState(p);
      return state.blocked;
    });
    
    if (invalidPayments.length > 0) {
      // Obtener referencias no conciliadas
      const firstInvalid = invalidPayments[0];
      const unconciliated = (firstInvalid.payment_references || [])
        .filter((ref: any) => !ref.exists_in_bank)
        .map((ref: any) => ref.reference_number);
      
      // Mostrar modal en lugar de toast
      setShowUnpaidModal({
        payment: {
          client_name: firstInvalid.client_name,
          amount: firstInvalid.amount
        },
        references: unconciliated,
        action: 'pdf'
      });
      return;
    }
    
    // Obtener datos de corredores si hay pagos con broker_id
    const brokerIds = new Set<string>();
    selectedPayments.forEach(p => {
      try {
        if (typeof p.notes === 'string') {
          const parsed = JSON.parse(p.notes);
          if (parsed.broker_id) {
            brokerIds.add(parsed.broker_id);
          }
        }
      } catch {}
    });
    
    let brokersMap = new Map();
    if (brokerIds.size > 0) {
      try {
        const { data: brokersData } = await supabaseClient()
          .from('brokers')
          .select('id, name, bank_account_no, bank_name, account_type')
          .in('id', Array.from(brokerIds));
        
        if (brokersData) {
          brokersData.forEach((b: any) => {
            brokersMap.set(b.id, {
              name: b.name,
              account_no: b.bank_account_no || '',
              bank_name: b.bank_name || '',
              account_type: b.account_type || ''
            });
          });
        }
      } catch (error) {
        console.error('Error loading brokers:', error);
      }
    }
    
    // Crear HTML para imprimir - compatible con mobile
    let printWindow: Window | null = null;
    
    try {
      // Intentar abrir ventana nueva
      printWindow = window.open('', '_blank');
      
      if (!printWindow) {
        // Si falla, usar misma ventana en mobile
        toast.warning('Abriendo en esta ventana...');
        printWindow = window;
      }
    } catch (error) {
      console.error('Error opening print window:', error);
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    // Helper para extraer metadata del pago
    const getPaymentMetadata = (payment: any) => {
      try {
        if (typeof payment.notes === 'string') {
          return JSON.parse(payment.notes);
        }
        return {};
      } catch {
        return {};
      }
    };
    
    // Helper para extraer notas limpias
    const getPaymentNotes = (payment: any) => {
      const metadata = getPaymentMetadata(payment);
      return metadata.notes || '';
    };

    // Agrupar pagos por categoría
    const groupedPayments = {
      byInsurer: {} as { [key: string]: any[] },
      devolutions: [] as any[],
      others: [] as any[]
    };

    selectedPayments.forEach(payment => {
      if (payment.purpose === 'devolucion') {
        groupedPayments.devolutions.push(payment);
      } else if (payment.purpose === 'otro') {
        groupedPayments.others.push(payment);
      } else {
        // Agrupar por aseguradora
        const insurer = payment.insurer_name || 'Sin Aseguradora';
        if (!groupedPayments.byInsurer[insurer]) {
          groupedPayments.byInsurer[insurer] = [];
        }
        groupedPayments.byInsurer[insurer].push(payment);
      }
    });

    // Detectar si hay datos en columnas específicas
    const hasNotes = selectedPayments.some(p => {
      const meta = getPaymentMetadata(p);
      return meta.notes || getPaymentNotes(p);
    });

    const hasReferences = selectedPayments.some(p => p.payment_references?.length > 0);
    
    const hasBankInfo = selectedPayments.some(p => {
      if (p.purpose !== 'devolucion') return false;
      const meta = getPaymentMetadata(p);
      return meta.devolucion_tipo;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Pagos Pendientes - ${new Date().toLocaleDateString('es-PA')}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 30px;
            color: #333;
            font-size: 14px;
          }
          .header {
            position: relative;
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 3px solid #010139;
            padding-bottom: 20px;
            padding-top: 10px;
          }
          .header .logo {
            position: absolute;
            top: 10px;
            left: 0;
            width: 90px;
            height: auto;
          }
          .header h1 {
            color: #010139;
            margin: 0;
            font-size: 28px;
          }
          .header p {
            color: #666;
            margin: 8px 0;
            font-size: 14px;
          }
          .group-title {
            background: #010139;
            color: white;
            padding: 12px 15px;
            margin-top: 25px;
            margin-bottom: 10px;
            font-size: 16px;
            font-weight: bold;
            border-radius: 5px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          th {
            background: #8AAA19;
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-size: 14px;
            font-weight: bold;
          }
          td {
            padding: 12px 10px;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
            vertical-align: top;
          }
          tr:nth-child(even) {
            background: #f9f9f9;
          }
          .amount {
            font-weight: bold;
            color: #8AAA19;
            text-align: right;
            white-space: nowrap;
            font-size: 16px;
          }
          .notes {
            font-size: 12px;
            color: #666;
            font-style: italic;
            line-height: 1.5;
          }
          .bank-info {
            font-size: 12px;
            color: #010139;
            line-height: 1.6;
          }
          .bank-info strong {
            color: #8AAA19;
          }
          .total {
            margin-top: 20px;
            text-align: right;
            font-size: 18px;
            font-weight: bold;
          }
          .total strong {
            color: #010139;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #999;
            font-size: 12px;
          }
          .label {
            color: #8AAA19;
            font-weight: bold;
            font-size: 12px;
          }
          @media print {
            body { margin: 15px; }
            .group-title { page-break-after: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="/logo.png" alt="Logo" class="logo" />
          <h1>PAGOS PENDIENTES</h1>
          <p>Portal Líderes en Seguros</p>
          <p>Fecha de generación: ${new Date().toLocaleDateString('es-PA', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</p>
        </div>

        ${Object.keys(groupedPayments.byInsurer).length > 0 ? Object.keys(groupedPayments.byInsurer).map(insurer => `
          <div class="group-title">📄 ${insurer}</div>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Póliza</th>
                ${hasReferences ? '<th>Referencias</th>' : ''}
                ${hasNotes ? '<th>Notas</th>' : ''}
                <th style="text-align: right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${(groupedPayments.byInsurer[insurer] || []).map(payment => {
                const notes = getPaymentNotes(payment);
                return `
                <tr>
                  <td><strong>${payment.client_name}</strong></td>
                  <td>${payment.policy_number || '—'}</td>
                  ${hasReferences ? `<td style="font-family: monospace; font-size: 12px;">${payment.payment_references?.map((ref: any) => ref.reference_number).join('<br>') || '—'}</td>` : ''}
                  ${hasNotes ? `<td class="notes">${notes || '—'}</td>` : ''}
                  <td class="amount">$${parseFloat(payment.amount_to_pay).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        `).join('') : ''}

        ${groupedPayments.devolutions.length > 0 ? `
          <div class="group-title">💰 DEVOLUCIONES</div>
          <table>
            <thead>
              <tr>
                <th>Cliente/Corredor</th>
                ${hasReferences ? '<th>Referencias</th>' : ''}
                <th>Datos Bancarios</th>
                ${hasNotes ? '<th>Notas</th>' : ''}
                <th style="text-align: right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${groupedPayments.devolutions.map(payment => {
                const metadata = getPaymentMetadata(payment);
                const notes = getPaymentNotes(payment);
                let bankInfo = '—';
                
                if (metadata.devolucion_tipo === 'cliente') {
                  const clientName = metadata.client_name || payment.client_name;
                  const bankName = metadata.banco_nombre || '-';
                  const accountType = metadata.tipo_cuenta || '-';
                  const accountNumber = metadata.cuenta_banco || '-';
                  bankInfo = `<strong>Cliente:</strong> ${clientName}<br><strong>Banco:</strong> ${bankName}<br><strong>Tipo:</strong> ${accountType}<br><strong>Cuenta:</strong> ${accountNumber}`;
                } else if (metadata.devolucion_tipo === 'corredor' && metadata.broker_id) {
                  const broker = brokersMap.get(metadata.broker_id);
                  const brokerName = broker?.name || '-';
                  const accountNo = broker?.account_no || '-';
                  const bankName = broker?.bank_name || '-';
                  const accountType = broker?.account_type || '-';
                  bankInfo = `<strong>Corredor:</strong> ${brokerName}<br><strong>Cuenta:</strong> ${accountNo}<br><strong>Banco:</strong> ${bankName}<br><strong>Tipo:</strong> ${accountType}`;
                }
                
                return `
                <tr>
                  <td><strong>${payment.client_name}</strong></td>
                  ${hasReferences ? `<td style="font-family: monospace; font-size: 12px;">${payment.payment_references?.map((ref: any) => ref.reference_number).join('<br>') || '—'}</td>` : ''}
                  <td class="bank-info">${bankInfo}</td>
                  ${hasNotes ? `<td class="notes">${notes || '—'}</td>` : ''}
                  <td class="amount">$${parseFloat(payment.amount_to_pay).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        ` : ''}

        ${groupedPayments.others.length > 0 ? `
          <div class="group-title">📝 OTROS</div>
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                ${hasReferences ? '<th>Referencias</th>' : ''}
                ${hasNotes ? '<th>Notas</th>' : ''}
                <th style="text-align: right">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${groupedPayments.others.map(payment => {
                const notes = getPaymentNotes(payment);
                return `
                <tr>
                  <td><strong>${payment.client_name}</strong></td>
                  ${hasReferences ? `<td style="font-family: monospace; font-size: 12px;">${payment.payment_references?.map((ref: any) => ref.reference_number).join('<br>') || '—'}</td>` : ''}
                  ${hasNotes ? `<td class="notes">${notes || '—'}</td>` : ''}
                  <td class="amount">$${parseFloat(payment.amount_to_pay).toFixed(2)}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        ` : ''}

        <div class="total">
          <strong>TOTAL A PAGAR: $${selectedPayments.reduce((sum, p) => 
            sum + parseFloat(p.amount_to_pay), 0
          ).toFixed(2)}</strong>
        </div>

        <div class="footer">
          <p><strong>Documento generado el ${new Date().toLocaleString('es-PA')}</strong></p>
          <p>Portal Líderes en Seguros - Sistema de Gestión de Pagos</p>
          <p style="margin-top: 10px; color: #666;">
            <strong>IMPORTANTE:</strong> Verificar datos bancarios antes de procesar los pagos
          </p>
        </div>
      </body>
      </html>
    `;

    if (printWindow && printWindow !== window) {
      // Ventana nueva (PC/Desktop)
      printWindow.document.write(html);
      printWindow.document.close();
      toast.success('Documento preparado para imprimir/guardar como PDF');
    } else if (printWindow === window) {
      // Misma ventana (Mobile fallback)
      const originalContent = document.body.innerHTML;
      document.body.innerHTML = html;
      
      // Esperar que cargue y auto-imprimir
      setTimeout(() => {
        window.print();
        // Restaurar contenido después de imprimir
        setTimeout(() => {
          document.body.innerHTML = originalContent;
          window.location.reload(); // Recargar para restaurar eventos
        }, 100);
      }, 500);
      
      toast.success('Preparando documento...');
    }
  };

  const handleEdit = (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (payment) {
      setEditingPayment(payment);
    }
  };

  const handleDelete = async (paymentId: string) => {
    const payment = payments.find(p => p.id === paymentId);
    if (!payment) return;

    if (!confirm(`¿Eliminar el pago pendiente de "${payment.client_name}"?\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    setLoading(true);
    try {
      const result = await actionDeletePendingPayment(paymentId);
      
      if (result.ok) {
        toast.success('✅ ' + result.message);
        
        // Recargar inmediatamente los pagos para actualizar contadores
        await loadPayments();
        
        // Notificar al padre para refrescar historial también
        if (onPaymentPaid) {
          onPaymentPaid();
        }
      } else {
        toast.error('Error al eliminar pago', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error al eliminar pago', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#010139]">Pagos Pendientes</h2>
          <p className="text-gray-600 text-sm">
            Gestiona los pagos registrados que están pendientes de ser conciliados y pagados
          </p>
        </div>
        <button
          onClick={onOpenWizard}
          className="px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all font-semibold flex items-center gap-2"
        >
          <FaPlus />
          Nuevo Pago
        </button>
      </div>

      {/* Resumen */}
      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-amber-500">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Pagos Pendientes</h3>
            <p className="text-3xl font-bold text-[#010139]">{payments.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-[#8AAA19]">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total a Pagar</h3>
            <p className="text-3xl font-bold text-[#8AAA19] font-mono">
              ${payments.reduce((sum, p) => sum + Number(p.amount_to_pay || 0), 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">Total Recibido</h3>
            <p className="text-3xl font-bold text-blue-600 font-mono">
              ${payments.reduce((sum, p) => sum + Number(p.total_received || 0), 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Acciones */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#010139]">
              Listado de Pagos ({payments.length})
            </h3>
            <p className="text-sm text-gray-600">
              Los pagos procesados se ven en el historial del banco
            </p>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDownloadPDF(e);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium touch-manipulation"
              >
                <FaFileDownload />
                <span className="hidden sm:inline">Descargar PDF</span>
                <span className="sm:hidden">PDF</span>
                <span>({selectedIds.size})</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!loading) {
                    handleMarkAsPaid(e);
                  }
                }}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaCheckCircle />
                <span className="hidden sm:inline">Marcar como Pagados</span>
                <span className="sm:hidden">Pagar</span>
                <span>({selectedIds.size})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid de Pagos */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="font-medium">Cargando pagos...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <div className="mb-4">
            <FaCheckCircle className="w-16 h-16 mx-auto text-gray-300" />
          </div>
          <p className="text-lg font-semibold mb-2">No hay pagos pendientes</p>
          <p className="text-sm mb-4">Todos los pagos han sido procesados</p>
          <button
            onClick={onOpenWizard}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium"
          >
            <FaPlus />
            Crear Nuevo Pago
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.length > 0 && (
            <div className="flex items-center justify-between px-4 mb-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.size === payments.length && payments.length > 0}
                  onChange={selectAll}
                  className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                />
                <span className="text-sm font-medium text-gray-700">Seleccionar todos</span>
              </div>
              <button
                onClick={() => setGroupByReference(!groupByReference)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                {groupByReference ? '📊 Agrupado por Referencia' : '📄 Lista Simple'}
              </button>
            </div>
          )}

          {groupByReference ? (
            <div className="space-y-4">
              {Object.values(groupedPayments).map((group) => (
                <div key={group.reference_number} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-gray-300">
                    <div>
                      <h3 className="font-bold text-lg text-[#010139]">Ref: {group.reference_number}</h3>
                      <p className="text-sm text-gray-600">Total en Banco: ${group.bank_amount.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Pendientes: ${group.total_pending.toFixed(2)}</div>
                      <div className={`text-lg font-bold ${
                        group.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        Remanente: ${group.remaining.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    {group.payments.map((payment) => {
            const paymentState = getPaymentState(payment);
            return (
              <div
                key={payment.id}
                className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all ${
                  selectedIds.has(payment.id)
                    ? 'border-[#8AAA19] shadow-xl'
                    : 'border-gray-100 hover:border-gray-300'
                }`}
              >
                {/* Header con checkbox y acciones */}
                <div className="flex items-start gap-3 mb-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(payment.id)}
                    onChange={() => toggleSelect(payment.id)}
                    className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] mt-1 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    {/* Layout móvil: Vertical */}
                    <div className="md:hidden space-y-3">
                      {/* Nombre y datos del cliente */}
                      <div>
                        <h3 className="font-bold text-base text-[#010139] break-words leading-tight">{payment.client_name}</h3>
                        {payment.policy_number && (
                          <p className="text-xs text-gray-600 break-words mt-1">Póliza: {payment.policy_number}</p>
                        )}
                        {payment.insurer_name && (
                          <p className="text-xs text-gray-600 break-words">{payment.insurer_name}</p>
                        )}
                      </div>
                      {/* Monto y acciones en una fila */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xl font-bold text-[#8AAA19]">
                            ${parseFloat(payment.amount_to_pay).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">A pagar</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(payment.id);
                            }}
                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar pago"
                          >
                            <FaEdit size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(payment.id);
                            }}
                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar pago"
                          >
                            <FaTrash size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {/* Layout desktop: Horizontal */}
                    <div className="hidden md:flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-[#010139] break-words">{payment.client_name}</h3>
                        {payment.policy_number && (
                          <p className="text-sm text-gray-600 break-words">Póliza: {payment.policy_number}</p>
                        )}
                        {payment.insurer_name && (
                          <p className="text-sm text-gray-600 break-words">{payment.insurer_name}</p>
                        )}
                      </div>
                      <div className="flex items-start gap-4 flex-shrink-0">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[#8AAA19] whitespace-nowrap">
                            ${parseFloat(payment.amount_to_pay).toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">A pagar</div>
                        </div>
                        <div className="flex gap-2 items-start">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(payment.id);
                            }}
                            className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                            title="Editar pago"
                          >
                            <FaEdit size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(payment.id);
                            }}
                            className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                            title="Eliminar pago"
                          >
                            <FaTrash size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Referencias */}
                <div className="space-y-2 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700">Referencias:</h4>
                  {payment.payment_references?.map((ref: any) => {
                    const isDescuentoCorredor = isDescuentoACorredor(payment);
                    const isValid = isDescuentoCorredor ? payment.can_be_paid : ref.exists_in_bank;
                    
                    const refClass = isValid
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200';

                    return (
                      <div
                        key={ref.id}
                        className={`flex items-center justify-between p-2 rounded-lg ${refClass}`}
                      >
                        <div className="flex items-center gap-2">
                          {isValid ? (
                            <FaCheckCircle className="text-green-600" />
                          ) : (
                            <FaExclamationTriangle className="text-red-600" />
                          )}
                          <span className="text-sm font-mono font-semibold">{ref.reference_number}</span>
                        </div>
                        <span className="text-sm font-semibold">
                          ${Number(ref.amount).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <div>
                    <StatusBadge payment={payment} />
                    {payment.metadata?.advance_id && (
                      <span className="ml-2 px-2 py-0.5 bg-[#8AAA19]/10 text-[#8AAA19] border border-[#8AAA19]/40 rounded-full text-xs font-semibold">
                        Adelanto externo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(payment.created_at).toLocaleDateString('es-PA')}
                  </div>
                </div>

                {/* Total recibido */}
                {payment.total_received > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total recibido:</span>
                      <span className="font-semibold">${parseFloat(payment.total_received).toFixed(2)}</span>
                    </div>
                    {payment.total_received > payment.amount_to_pay && (
                      <div className="flex justify-between text-sm text-amber-600 mt-1">
                        <span>Remanente:</span>
                        <span className="font-semibold">
                          ${(parseFloat(payment.total_received) - parseFloat(payment.amount_to_pay)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {payments.map((payment) => {
                const paymentState = getPaymentState(payment);
                return (
                  <div
                    key={payment.id}
                    className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all ${
                      selectedIds.has(payment.id)
                        ? 'border-[#8AAA19] shadow-xl'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    {/* Contenido del pago */}
                    <div className="flex items-start gap-3 mb-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(payment.id)}
                        onChange={() => toggleSelect(payment.id)}
                        className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19] mt-1 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        {/* Layout móvil: Vertical */}
                        <div className="md:hidden space-y-3">
                          <div>
                            <h3 className="font-bold text-base text-[#010139] break-words leading-tight">{payment.client_name}</h3>
                            {payment.policy_number && (
                              <p className="text-xs text-gray-600 break-words mt-1">Póliza: {payment.policy_number}</p>
                            )}
                            {payment.insurer_name && (
                              <p className="text-xs text-gray-600 break-words">{payment.insurer_name}</p>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xl font-bold text-[#8AAA19]">
                                ${parseFloat(payment.amount_to_pay).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">A pagar</div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(payment.id);
                                }}
                                className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar pago"
                              >
                                <FaEdit size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(payment.id);
                                }}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Eliminar pago"
                              >
                                <FaTrash size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* Layout desktop: Horizontal */}
                        <div className="hidden md:flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg text-[#010139] break-words">{payment.client_name}</h3>
                            {payment.policy_number && (
                              <p className="text-sm text-gray-600 break-words">Póliza: {payment.policy_number}</p>
                            )}
                            {payment.insurer_name && (
                              <p className="text-sm text-gray-600 break-words">{payment.insurer_name}</p>
                            )}
                          </div>
                          <div className="flex items-start gap-4 flex-shrink-0">
                            <div className="text-right">
                              <div className="text-2xl font-bold text-[#8AAA19] whitespace-nowrap">
                                ${parseFloat(payment.amount_to_pay).toFixed(2)}
                              </div>
                              <div className="text-xs text-gray-500">A pagar</div>
                            </div>
                            <div className="flex gap-2 items-start">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(payment.id);
                                }}
                                className="p-2.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex-shrink-0"
                                title="Editar pago"
                              >
                                <FaEdit size={16} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(payment.id);
                                }}
                                className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                title="Eliminar pago"
                              >
                                <FaTrash size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Referencias */}
                    <div className="space-y-2 mb-4">
                      <h4 className="text-sm font-semibold text-gray-700">Referencias:</h4>
                      {payment.payment_references?.map((ref: any) => {
                        const isDescuentoCorredor = isDescuentoACorredor(payment);
                        const isValid = isDescuentoCorredor ? payment.can_be_paid : ref.exists_in_bank;
                        
                        return (
                          <div
                            key={ref.id}
                            className={`flex items-center justify-between p-2 rounded-lg ${
                              isValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isValid ? (
                                <FaCheckCircle className="text-green-600" />
                              ) : (
                                <FaExclamationTriangle className="text-red-600" />
                              )}
                              <span className="text-sm font-mono font-semibold">{ref.reference_number}</span>
                            </div>
                            <span className="text-sm font-semibold">
                              ${Number(ref.amount).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center justify-between">
                      <StatusBadge payment={payment} />
                      <div className="text-xs text-gray-500">
                        {new Date(payment.created_at).toLocaleDateString('es-PA')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de referencias no conciliadas */}
      {showUnpaidModal && (
        <UnpaidReferenceModal
          payment={showUnpaidModal.payment}
          references={showUnpaidModal.references}
          action={showUnpaidModal.action}
          onClose={() => setShowUnpaidModal(null)}
        />
      )}

      {/* Modal de edición */}
      {editingPayment && (
        <EditPaymentModal
          payment={editingPayment}
          onClose={() => setEditingPayment(null)}
          onSuccess={() => {
            setEditingPayment(null);
            loadPayments();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({ payment }: { payment: any }) {
  const state = getPaymentState(payment);
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border-2 ${state.badgeClass}`}>
      {state.label}
    </span>
  );
}

// Helper para detectar descuentos a corredor
function isDescuentoACorredor(payment: any): boolean {
  try {
    if (payment.notes) {
      let metadata: any = null;
      if (typeof payment.notes === 'object' && payment.notes !== null) {
        metadata = payment.notes;
      } else if (typeof payment.notes === 'string') {
        metadata = JSON.parse(payment.notes);
      }
      
      if (metadata) {
        const hasAutoFlag = metadata.is_auto_advance === true;
        const hasAdvanceIdDirect = !!metadata.advance_id;
        const hasAdvanceIdInNotes = metadata.notes && typeof metadata.notes === 'string' && 
                                   metadata.notes.includes('Adelanto ID:');
        return hasAutoFlag || hasAdvanceIdDirect || hasAdvanceIdInNotes;
      }
    }
  } catch (e) {
    // Si no se puede parsear, no es descuento a corredor
  }
  return false;
}

function getPaymentState(payment: any) {
  const now = new Date();
  const created = new Date(payment.created_at);
  const daysDiff = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  const total = Number(payment.amount_to_pay ?? payment.amount ?? 0);
  const applied = Number(payment.total_received ?? 0);
  const remaining = Math.max(total - applied, 0);

  const isDescuentoCorredor = isDescuentoACorredor(payment);
  
  const hasErrors = !isDescuentoCorredor && payment.payment_references?.some((ref: any) => !ref.exists_in_bank);
  if (hasErrors || !payment.can_be_paid) {
    return {
      key: 'blocked',
      label: isDescuentoCorredor ? 'Adelanto pendiente' : 'Referencia no conciliada',
      badgeClass: 'bg-red-100 text-red-800 border-red-300',
      blocked: true,
    } as const;
  }

  if (payment.defer_until && new Date(payment.defer_until) > now) {
    return {
      key: 'deferred',
      label: 'Aplazado',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
      blocked: true,
    } as const;
  }

  if (remaining <= 0) {
    return {
      key: 'conciled',
      label: 'Conciliado',
      badgeClass: 'bg-green-100 text-green-800 border-green-300',
      blocked: false,
    } as const;
  }

  if (daysDiff > 30) {
    return {
      key: 'overdue',
      label: 'Vencido (+30d)',
      badgeClass: 'bg-red-100 text-red-800 border-red-300',
      blocked: true,
    } as const;
  }

  if (daysDiff > 15) {
    return {
      key: 'aged',
      label: 'Sin clasificar 15-30d',
      badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      blocked: false,
    } as const;
  }

  return {
    key: 'pending',
    label: 'Pendiente por conciliar',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-300',
    blocked: false,
  } as const;
}
