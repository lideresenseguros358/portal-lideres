'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { FaPlus, FaCheckCircle, FaExclamationTriangle, FaFileDownload, FaEdit, FaTrash, FaSearch, FaTimes } from 'react-icons/fa';
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

const STORAGE_KEY = 'pendingPaymentsSelectedIds';

export default function PendingPaymentsTab({ onOpenWizard, onPaymentPaid, refreshTrigger }: PendingPaymentsTabProps) {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Inicializar selectedIds desde localStorage
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const ids = JSON.parse(stored);
          return new Set(ids);
        }
      } catch (error) {
        console.error('Error loading selected IDs from localStorage:', error);
      }
    }
    return new Set();
  });
  
  const [groupByReference, setGroupByReference] = useState(true);
  const [showUnpaidModal, setShowUnpaidModal] = useState<{
    payment: { client_name: string; amount: number };
    references: string[];
    action: 'paid' | 'pdf';
  } | null>(null);
  const [editingPayment, setEditingPayment] = useState<any | null>(null);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const result = await actionGetPendingPaymentsNew({ status: 'pending' });
      
      if (result.ok) {
        const paymentsData = result.data || [];
        
        // Filtrar pagos huérfanos (sin referencias y sin metadata especial)
        const validPayments = paymentsData.filter((p: any) => {
          // Permitir pagos con referencias
          if (p.payment_references && p.payment_references.length > 0) return true;
          
          // Permitir descuentos a corredor (tienen metadata en notes)
          if (p.notes) {
            try {
              const metadata = typeof p.notes === 'string' ? JSON.parse(p.notes) : p.notes;
              if (metadata?.is_auto_advance || metadata?.advance_id) return true;
            } catch (e) {}
          }
          
          // Rechazar pagos sin referencias y sin metadata
          console.warn('Pago huérfano detectado y filtrado:', p.client_name, p.id);
          return false;
        });
        
        // Enriquecer referencias con información de bank_transfers
        const supabase = supabaseClient();
        const allReferenceNumbers = new Set<string>();
        
        validPayments.forEach((payment: any) => {
          payment.payment_references?.forEach((ref: any) => {
            if (ref.reference_number && ref.exists_in_bank) {
              allReferenceNumbers.add(ref.reference_number);
            }
          });
        });
        
        // Obtener información de bank_transfers
        const transfersMap = new Map<string, any>();
        if (allReferenceNumbers.size > 0) {
          const { data: transfers } = await supabase
            .from('bank_transfers')
            .select('reference_number, amount, used_amount, remaining_amount')
            .in('reference_number', Array.from(allReferenceNumbers));
          
          transfers?.forEach(transfer => {
            transfersMap.set(transfer.reference_number, transfer);
          });
        }
        
        // Enriquecer payment_references con remaining_amount
        validPayments.forEach((payment: any) => {
          payment.payment_references?.forEach((ref: any) => {
            const transfer = transfersMap.get(ref.reference_number);
            if (transfer) {
              ref.bank_remaining_amount = transfer.remaining_amount ?? 
                Math.max((transfer.amount || 0) - (transfer.used_amount || 0), 0);
            }
          });
        });
        
        setPayments(validPayments);
        
        // Limpiar selección de IDs que ya no existen
        setSelectedIds(prevSelected => {
          const validIds = new Set<string>();
          const paymentIds = new Set(validPayments.map((p: any) => p.id));
          
          prevSelected.forEach(id => {
            if (paymentIds.has(id)) {
              validIds.add(id);
            }
          });
          
          // Si cambió algo, retornar nuevo Set
          if (validIds.size !== prevSelected.size) {
            return validIds;
          }
          return prevSelected;
        });
      } else {
        console.error('Error al cargar pagos:', result.error);
        toast.error('Error al cargar pagos');
      }
    } catch (error: any) {
      console.error('Error inesperado al cargar pagos:', error);
      toast.error('Error inesperado');
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies needed as we only use setters and actions

  // Cargar brokers
  useEffect(() => {
    const loadBrokers = async () => {
      try {
        const supabase = supabaseClient();
        const { data, error } = await supabase
          .from('brokers')
          .select('id, name')
          .eq('active', true)
          .order('name');
        
        if (!error && data) {
          setBrokers(data);
        }
      } catch (error) {
        console.error('Error loading brokers:', error);
      }
    };
    
    loadBrokers();
  }, []);

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

  // Guardar selectedIds en localStorage cada vez que cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (selectedIds.size > 0) {
          const idsArray = Array.from(selectedIds);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(idsArray));
        } else {
          // Si no hay selección, limpiar localStorage
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        console.error('Error saving selected IDs to localStorage:', error);
      }
    }
  }, [selectedIds]);

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

  // Helper para extraer batch_id del notes
  const getBatchId = (payment: any): string | null => {
    try {
      if (!payment.notes) return null;
      const metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes;
      return metadata?.batch_id || null;
    } catch {
      return null;
    }
  };

  // Agrupar pagos por batch_id o por referencia
  const groupPaymentsByReference = () => {
    const groups: { [key: string]: {
      reference_number: string;
      bank_amount: number;
      total_pending: number;
      remaining: number;
      payments: any[];
      allAreDescuentoCorredor: boolean;
      isBatch: boolean; // Indica si es un grupo de batch (múltiples divisiones)
      isMultiRef?: boolean; // Indica si es un pago con múltiples referencias
    }} = {};

    // Primero, agrupar por batch_id si existe
    const batchGroups = new Map<string, any[]>();
    const nonBatchPayments: any[] = [];

    payments.forEach(payment => {
      const batchId = getBatchId(payment);
      if (batchId) {
        if (!batchGroups.has(batchId)) {
          batchGroups.set(batchId, []);
        }
        batchGroups.get(batchId)!.push(payment);
      } else {
        nonBatchPayments.push(payment);
      }
    });

    // Procesar grupos de batch
    batchGroups.forEach((batchPayments, batchId) => {
      // Verificar si todos son descuentos a corredor
      let allDescuento = true;
      batchPayments.forEach(payment => {
        if (!isDescuentoACorredor(payment)) {
          allDescuento = false;
        }
      });

      // Si es un batch de descuentos a corredor, NO agrupar - mostrar cada uno por separado
      if (allDescuento) {
        batchPayments.forEach((payment) => {
          const refs = payment.payment_references || [];
          const refNum = refs[0]?.reference_number || `ADELANTO-${payment.id}`;
          const amount = parseFloat(payment.amount_to_pay || '0');
          
          // Crear grupo individual para cada adelanto usando payment.id único
          groups[`ADELANTO-${payment.id}`] = {
            reference_number: refNum,
            bank_amount: amount,
            total_pending: 0, // No se cuenta en pending porque es descuento
            remaining: 0,
            payments: [payment],
            allAreDescuentoCorredor: true,
            isBatch: true // Mantener flag de batch para la UI
          };
        });
      } else {
        // Lógica original para batches normales (NO descuento a corredor)
        const batchRefsMap = new Map<string, { amount: number; remaining: number }>();
        let totalBatchAmount = 0;

        batchPayments.forEach(payment => {
          totalBatchAmount += parseFloat(payment.amount_to_pay || '0');
          payment.payment_references?.forEach((ref: any) => {
            const refNum = ref.reference_number;
            const amount = parseFloat(ref.amount || '0');
            // Obtener remaining disponible real
            const remaining = ref.bank_remaining_amount !== undefined && ref.bank_remaining_amount !== null
              ? parseFloat(String(ref.bank_remaining_amount))
              : amount;
            
            if (!batchRefsMap.has(refNum)) {
              batchRefsMap.set(refNum, { amount, remaining });
            }
          });
        });

        const totalBankAmount = Array.from(batchRefsMap.values()).reduce((sum, item) => sum + item.amount, 0);
        const totalBankRemaining = Array.from(batchRefsMap.values()).reduce((sum, item) => sum + item.remaining, 0);
        const allRefsLabel = Array.from(batchRefsMap.keys()).join(' + ');
        
        groups[`BATCH-${batchId}`] = {
          reference_number: allRefsLabel,
          bank_amount: totalBankAmount,
          total_pending: totalBatchAmount,
          remaining: totalBankRemaining - totalBatchAmount, // Disponible - Pendiente
          payments: batchPayments,
          allAreDescuentoCorredor: false,
          isBatch: true
        };
      }
    });

    // Procesar pagos sin batch
    nonBatchPayments.forEach(payment => {
      const refs = payment.payment_references || [];
      
      // Si el pago tiene múltiples referencias, tratarlo como un grupo especial
      if (refs.length > 1) {
        // Calcular totales de todas las referencias
        const refsMap = new Map<string, { amount: number; remaining: number }>();
        refs.forEach((ref: any) => {
          const refNum = ref.reference_number;
          const amount = parseFloat(ref.amount || '0');
          // Obtener remaining disponible real
          const remaining = ref.bank_remaining_amount !== undefined && ref.bank_remaining_amount !== null
            ? parseFloat(String(ref.bank_remaining_amount))
            : amount;
          
          if (!refsMap.has(refNum)) {
            refsMap.set(refNum, { amount, remaining });
          }
        });
        
        const totalBankAmount = Array.from(refsMap.values()).reduce((sum, item) => sum + item.amount, 0);
        const totalBankRemaining = Array.from(refsMap.values()).reduce((sum, item) => sum + item.remaining, 0);
        const allRefsLabel = Array.from(refsMap.keys()).join(' + ');
        const isDescuento = isDescuentoACorredor(payment);
        const paymentAmount = parseFloat(payment.amount_to_pay || '0');
        
        // Crear grupo único para este pago con múltiples referencias
        const groupKey = `MULTI-${payment.id}`;
        groups[groupKey] = {
          reference_number: allRefsLabel,
          bank_amount: totalBankAmount,
          total_pending: isDescuento ? 0 : paymentAmount,
          remaining: totalBankRemaining - paymentAmount, // Disponible - Pendiente
          payments: [payment],
          allAreDescuentoCorredor: isDescuento,
          isBatch: false,
          isMultiRef: true // Flag para identificar pagos con múltiples referencias
        };
      } else {
        // Lógica original para pagos con una sola referencia
        refs.forEach((ref: any) => {
          const refNum = ref.reference_number;
          if (!groups[refNum]) {
            // Usar bank_remaining_amount si está disponible, sino calcular desde amount
            const bankRemaining = ref.bank_remaining_amount !== undefined && ref.bank_remaining_amount !== null
              ? parseFloat(String(ref.bank_remaining_amount))
              : parseFloat(ref.amount || '0');
            
            groups[refNum] = {
              reference_number: refNum,
              bank_amount: parseFloat(ref.amount || '0'),
              total_pending: 0,
              remaining: bankRemaining, // Usar el remaining real del banco
              payments: [],
              allAreDescuentoCorredor: true,
              isBatch: false
            };
          }
          
          const isDescuento = isDescuentoACorredor(payment);
          if (!isDescuento) {
            groups[refNum].allAreDescuentoCorredor = false;
          }
          
          const amountToUse = parseFloat(ref.amount_to_use || payment.amount_to_pay || '0');
          if (!isDescuento) {
            groups[refNum].total_pending += amountToUse;
          }
          groups[refNum].payments.push({ ...payment, ref_amount_to_use: amountToUse });
        });
      }
    });

    // Calcular remanente final solo para grupos simples
    // (batch y multi-ref ya tienen su remaining calculado)
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      if (group && !group.isBatch && !group.isMultiRef) {
        // Fórmula: Disponible en banco - Pendiente = Remanente
        group.remaining = group.remaining - group.total_pending;
      }
    });

    return groups;
  };

  // Función de ordenamiento - memoizada
  const sortPayments = useCallback((paymentsToSort: any[]) => {
    return [...paymentsToSort].sort((a, b) => {
      const stateA = getPaymentState(a);
      const stateB = getPaymentState(b);
      
      // Determinar prioridad de ordenamiento
      // 1 = Conciliado (no bloqueado, no other_bank)
      // 2 = Otro banco/depósito (other_bank)
      // 3 = Bloqueado/No conciliado
      const getPriority = (state: any) => {
        if (state.key === 'other_bank') return 2;
        if (state.blocked) return 3;
        return 1;
      };
      
      const priorityA = getPriority(stateA);
      const priorityB = getPriority(stateB);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // 2. Ordenar por fecha: más antiguo primero
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateA - dateB;
    });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groupedPayments = useMemo(() => groupPaymentsByReference(), [payments]);
  
  // Ordenar pagos en cada grupo
  const sortedGroupedPayments = useMemo(() => {
    const sorted: any = {};
    Object.keys(groupedPayments).forEach(key => {
      const group = groupedPayments[key];
      if (group) {
        sorted[key] = {
          ...group,
          // No ordenar pagos dentro de batch (mantener orden de divisiones)
          payments: group.isBatch ? group.payments : sortPayments(group.payments)
        };
      }
    });
    return sorted;
  }, [groupedPayments, sortPayments]);
  
  // Ordenar pagos para vista simple
  const sortedPayments = useMemo(() => {
    return sortPayments(payments);
  }, [payments, sortPayments]);

  // Filtrar pagos por búsqueda
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments;
    
    const search = searchTerm.toLowerCase();
    return payments.filter((payment) => {
      // Buscar en nombre del cliente
      if (payment.client_name?.toLowerCase().includes(search)) return true;
      
      // Buscar en número de póliza
      if (payment.policy_number?.toLowerCase().includes(search)) return true;
      
      // Buscar en aseguradora
      if (payment.insurer_name?.toLowerCase().includes(search)) return true;
      
      // Buscar en monto
      if (payment.amount_to_pay?.toString().includes(search)) return true;
      
      // Buscar en referencias bancarias
      if (payment.payment_references?.some((ref: any) => 
        ref.reference_number?.toLowerCase().includes(search)
      )) return true;
      
      // Buscar en metadata/notas
      try {
        const metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes;
        if (metadata?.notes?.toLowerCase().includes(search)) return true;
        
        // Buscar en broker (si es descuento a corredor)
        if (metadata?.broker_id) {
          const broker = brokers.find(b => b.id === metadata.broker_id);
          if (broker?.name?.toLowerCase().includes(search)) return true;
        }
        
        // Buscar en tipo de devolución
        if (metadata?.devolucion_tipo?.toLowerCase().includes(search)) return true;
        if (metadata?.client_name?.toLowerCase().includes(search)) return true;
        if (metadata?.banco_nombre?.toLowerCase().includes(search)) return true;
      } catch (e) {
        // Ignorar errores de parseo
      }
      
      // Buscar en propósito
      if (payment.purpose?.toLowerCase().includes(search)) return true;
      
      return false;
    });
  }, [payments, searchTerm, brokers]);

  // Aplicar filtros a sortedPayments y sortedGroupedPayments
  const displayPayments = useMemo(() => {
    const filtered = filteredPayments;
    if (groupByReference) {
      // Re-agrupar los pagos filtrados
      const groups: { [key: string]: any } = {};
      const batchGroups = new Map<string, any[]>();
      const nonBatchPayments: any[] = [];

      filtered.forEach(payment => {
        const batchId = getBatchId(payment);
        if (batchId) {
          if (!batchGroups.has(batchId)) {
            batchGroups.set(batchId, []);
          }
          batchGroups.get(batchId)!.push(payment);
        } else {
          nonBatchPayments.push(payment);
        }
      });

      // Procesar grupos de batch
      batchGroups.forEach((batchPayments, batchId) => {
        let allDescuento = true;
        batchPayments.forEach(payment => {
          if (!isDescuentoACorredor(payment)) {
            allDescuento = false;
          }
        });

        if (allDescuento) {
          batchPayments.forEach((payment) => {
            const refs = payment.payment_references || [];
            const refNum = refs[0]?.reference_number || `ADELANTO-${payment.id}`;
            const amount = parseFloat(payment.amount_to_pay || '0');
            
            groups[`ADELANTO-${payment.id}`] = {
              reference_number: refNum,
              bank_amount: amount,
              total_pending: 0,
              remaining: 0,
              payments: [payment],
              allAreDescuentoCorredor: true,
              isBatch: true
            };
          });
        } else {
          const batchRefsMap = new Map<string, { amount: number; remaining: number }>();
          let totalBatchAmount = 0;

          batchPayments.forEach(payment => {
            totalBatchAmount += parseFloat(payment.amount_to_pay || '0');
            payment.payment_references?.forEach((ref: any) => {
              const refNum = ref.reference_number;
              const amount = parseFloat(ref.amount || '0');
              const remaining = ref.bank_remaining_amount !== undefined && ref.bank_remaining_amount !== null
                ? parseFloat(String(ref.bank_remaining_amount))
                : amount;
              
              if (!batchRefsMap.has(refNum)) {
                batchRefsMap.set(refNum, { amount, remaining });
              }
            });
          });

          const totalBankAmount = Array.from(batchRefsMap.values()).reduce((sum, item) => sum + item.amount, 0);
          const totalBankRemaining = Array.from(batchRefsMap.values()).reduce((sum, item) => sum + item.remaining, 0);
          const allRefsLabel = Array.from(batchRefsMap.keys()).join(' + ');
          
          groups[`BATCH-${batchId}`] = {
            reference_number: allRefsLabel,
            bank_amount: totalBankAmount,
            total_pending: totalBatchAmount,
            remaining: totalBankRemaining - totalBatchAmount,
            payments: batchPayments,
            allAreDescuentoCorredor: false,
            isBatch: true
          };
        }
      });

      // Procesar pagos sin batch
      nonBatchPayments.forEach(payment => {
        const refs = payment.payment_references || [];
        
        if (refs.length > 1) {
          const refsMap = new Map<string, { amount: number; remaining: number }>();
          refs.forEach((ref: any) => {
            const refNum = ref.reference_number;
            const amount = parseFloat(ref.amount || '0');
            const remaining = ref.bank_remaining_amount !== undefined && ref.bank_remaining_amount !== null
              ? parseFloat(String(ref.bank_remaining_amount))
              : amount;
            
            if (!refsMap.has(refNum)) {
              refsMap.set(refNum, { amount, remaining });
            }
          });
          
          const totalBankAmount = Array.from(refsMap.values()).reduce((sum, item) => sum + item.amount, 0);
          const totalBankRemaining = Array.from(refsMap.values()).reduce((sum, item) => sum + item.remaining, 0);
          const allRefsLabel = Array.from(refsMap.keys()).join(' + ');
          const isDescuento = isDescuentoACorredor(payment);
          const paymentAmount = parseFloat(payment.amount_to_pay || '0');
          
          const groupKey = `MULTI-${payment.id}`;
          groups[groupKey] = {
            reference_number: allRefsLabel,
            bank_amount: totalBankAmount,
            total_pending: isDescuento ? 0 : paymentAmount,
            remaining: totalBankRemaining - paymentAmount,
            payments: [payment],
            allAreDescuentoCorredor: isDescuento,
            isBatch: false,
            isMultiRef: true
          };
        } else {
          refs.forEach((ref: any) => {
            const refNum = ref.reference_number;
            if (!groups[refNum]) {
              const bankRemaining = ref.bank_remaining_amount !== undefined && ref.bank_remaining_amount !== null
                ? parseFloat(String(ref.bank_remaining_amount))
                : parseFloat(ref.amount || '0');
              
              groups[refNum] = {
                reference_number: refNum,
                bank_amount: parseFloat(ref.amount || '0'),
                total_pending: 0,
                remaining: bankRemaining,
                payments: [],
                allAreDescuentoCorredor: true,
                isBatch: false
              };
            }
            
            const isDescuento = isDescuentoACorredor(payment);
            if (!isDescuento) {
              groups[refNum].allAreDescuentoCorredor = false;
            }
            
            const amountToUse = parseFloat(ref.amount_to_use || payment.amount_to_pay || '0');
            if (!isDescuento) {
              groups[refNum].total_pending += amountToUse;
            }
            groups[refNum].payments.push({ ...payment, ref_amount_to_use: amountToUse });
          });
        }
      });

      Object.keys(groups).forEach(key => {
        const group = groups[key];
        if (group && !group.isBatch && !group.isMultiRef) {
          // Fórmula: Disponible - Pendiente = Remanente
          group.remaining = group.remaining - group.total_pending;
        }
      });

      return { grouped: groups, simple: sortPayments(filtered) };
    }
    return { grouped: {}, simple: sortPayments(filtered) };
  }, [filteredPayments, groupByReference, sortPayments]);

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
        
        // Notificar al padre para refrescar ambas pestañas (historial y pendientes)
        // El useEffect (líneas 91-103) se encargará de recargar los pagos automáticamente
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

      {/* Sticky Bar - Acciones cuando hay selecciones */}
      {selectedIds.size > 0 && (
        <div className="sticky top-[60px] sm:top-[72px] z-[100] bg-gradient-to-r from-blue-50 to-white border-2 border-[#8AAA19] rounded-lg p-3 sm:p-4 shadow-lg">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            {/* Info de selección */}
            <div className="flex-1">
              <p className="font-bold text-[#010139] text-base sm:text-lg">
                {selectedIds.size} pago(s) seleccionado(s)
              </p>
              <p className="text-sm text-gray-600">
                Total: <span className="font-semibold text-[#8AAA19]">
                  ${Array.from(selectedIds).reduce((sum, id) => {
                    const payment = payments.find(p => p.id === id);
                    return sum + (payment ? Number(payment.amount_to_pay || 0) : 0);
                  }, 0).toFixed(2)}
                </span>
              </p>
            </div>
            
            {/* Buscador */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar pagos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 outline-none text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition font-medium text-sm shadow-sm"
                title="Deseleccionar todos los pagos"
              >
                <FaCheckCircle className="text-gray-400" />
                <span className="hidden sm:inline">Deseleccionar</span>
                <span className="sm:hidden">✓</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDownloadPDF(e);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium text-sm shadow-md"
              >
                <FaFileDownload />
                <span className="hidden sm:inline">Descargar PDF</span>
                <span className="sm:hidden">PDF</span>
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
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:from-[#6d8814] hover:to-[#5a7010] transition font-medium text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaCheckCircle />
                <span className="hidden sm:inline">Marcar Pagados</span>
                <span className="sm:hidden">Pagar</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
              ${(() => {
                // Deduplicar referencias para no sumar la misma transferencia múltiples veces
                const uniqueReferences = new Map<string, number>();
                let totalDescuentosCorredor = 0;
                
                payments.forEach(p => {
                  const esDescuento = isDescuentoACorredor(p);
                  
                  if (esDescuento) {
                    // Para descuentos a corredor, solo sumar si está conciliado (adelanto pagado)
                    if (p.can_be_paid) {
                      totalDescuentosCorredor += Number(p.amount_to_pay || 0);
                    }
                  } else {
                    // Para pagos normales, solo sumar referencias conciliadas
                    p.payment_references?.forEach((ref: any) => {
                      const refNum = ref.reference_number;
                      const amount = Number(ref.amount || 0);
                      // Solo sumar si está conciliada (exists_in_bank)
                      if (!uniqueReferences.has(refNum) && amount > 0 && ref.exists_in_bank) {
                        uniqueReferences.set(refNum, amount);
                      }
                    });
                  }
                });
                
                const totalReferencias = Array.from(uniqueReferences.values()).reduce((sum, amount) => sum + amount, 0);
                const total = totalReferencias + totalDescuentosCorredor;
                return total.toFixed(2);
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Info y controles */}
      <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[#010139]">
              Listado de Pagos ({filteredPayments.length}{searchTerm ? ` de ${payments.length}` : ''})
            </h3>
            <p className="text-sm text-gray-600">
              {searchTerm ? `Filtrando por: "${searchTerm}"` : 'Los pagos procesados se ven en el historial del banco'}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Pagos */}
      {loading ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <div className="animate-spin w-8 h-8 border-4 border-[#010139] border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="font-medium">Cargando pagos...</p>
        </div>
      ) : filteredPayments.length === 0 && searchTerm ? (
        <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-lg">
          <div className="mb-4">
            <FaSearch className="w-16 h-16 mx-auto text-gray-300" />
          </div>
          <p className="text-lg font-semibold mb-2">No se encontraron pagos</p>
          <p className="text-sm mb-4">No hay pagos que coincidan con "{searchTerm}"</p>
          <button
            onClick={() => setSearchTerm('')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            <FaTimes />
            Limpiar búsqueda
          </button>
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
          {/* Controles: Buscador, Checkbox y Toggle de Vista */}
          <div className="bg-white rounded-xl shadow-md border-2 border-gray-100 p-4">
            {/* Mobile: Buscador arriba (full width) */}
            <div className="mb-3 lg:hidden">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Buscar pagos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 outline-none text-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <FaTimes size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Layout responsive: columna en mobile, fila en desktop */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
              {/* Checkbox Seleccionar Todos */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredPayments.length && filteredPayments.length > 0}
                  onChange={selectAll}
                  className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                />
                <span className="text-sm font-medium text-gray-700">
                  Seleccionar todos{searchTerm ? ' (filtrados)' : ''}
                </span>
              </div>

              {/* Buscador - Desktop (centro) */}
              <div className="hidden lg:block flex-1 max-w-md">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar pagos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-10 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 outline-none text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FaTimes size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Botón de agrupación */}
              <button
                onClick={() => setGroupByReference(!groupByReference)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 flex-shrink-0"
              >
                {groupByReference ? '📊 Agrupado' : '📄 Lista Simple'}
              </button>
            </div>

            {/* Indicador de resultados de búsqueda */}
            {searchTerm && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-600">
                  {filteredPayments.length === 0 ? (
                    <span className="text-red-600 font-semibold">
                      ❌ No se encontraron pagos que coincidan con "{searchTerm}"
                    </span>
                  ) : (
                    <span>
                      ✓ Mostrando <span className="font-semibold text-[#8AAA19]">{filteredPayments.length}</span> de {payments.length} pagos
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {groupByReference ? (
            <div className="space-y-4">
              {Object.entries(displayPayments.grouped)
                .sort(([keyA, groupA]: [string, any], [keyB, groupB]: [string, any]) => {
                  // Ordenar grupos por el estado del primer pago
                  if (groupA.payments.length === 0) return 1;
                  if (groupB.payments.length === 0) return -1;
                  
                  const firstPaymentA = groupA.payments[0];
                  const firstPaymentB = groupB.payments[0];
                  
                  const stateA = getPaymentState(firstPaymentA);
                  const stateB = getPaymentState(firstPaymentB);
                  
                  const blockedA = stateA.blocked ? 1 : 0;
                  const blockedB = stateB.blocked ? 1 : 0;
                  
                  if (blockedA !== blockedB) return blockedA - blockedB;
                  
                  // Si tienen el mismo estado, ordenar por fecha
                  const dateA = new Date(firstPaymentA.created_at).getTime();
                  const dateB = new Date(firstPaymentB.created_at).getTime();
                  return dateA - dateB;
                })
                .map(([groupKey, group]: [string, any]) => (
                <div key={groupKey} className="bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                  <div className="flex items-center justify-between mb-3 pb-3 border-b-2 border-gray-300">
                    <div className="flex-1">
                      {group.isBatch && !group.allAreDescuentoCorredor ? (
                        <>
                          <h3 className="font-bold text-lg text-[#010139] flex items-center gap-2">
                            🔗 Pago dividido en {group.payments.length} partes
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Referencias: {group.reference_number}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Total en Banco: ${group.bank_amount.toFixed(2)}
                          </p>
                        </>
                      ) : group.isBatch && group.allAreDescuentoCorredor ? (
                        <>
                          <h3 className="font-bold text-lg text-[#010139]">Ref: {group.reference_number}</h3>
                          <p className="text-sm text-[#010139] font-medium mt-1">💰 Adelanto a corredor</p>
                          <p className="text-xs text-gray-600 mt-1">
                            Monto: ${group.bank_amount.toFixed(2)}
                          </p>
                        </>
                      ) : group.isMultiRef ? (
                        <>
                          <h3 className="font-bold text-lg text-[#010139]">
                            📎 Pago con múltiples referencias
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Referencias: {group.reference_number}
                          </p>
                          {!group.allAreDescuentoCorredor && (
                            <p className="text-xs text-gray-500 mt-1">
                              Total en Banco: ${group.bank_amount.toFixed(2)}
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <h3 className="font-bold text-lg text-[#010139]">Ref: {group.reference_number}</h3>
                          {!group.allAreDescuentoCorredor && (
                            <p className="text-sm text-gray-600">Total en Banco: ${group.bank_amount.toFixed(2)}</p>
                          )}
                          {group.allAreDescuentoCorredor && (
                            <p className="text-sm text-[#010139] font-medium">💰 Descuentos a corredor</p>
                          )}
                        </>
                      )}
                    </div>
                    {!group.allAreDescuentoCorredor && (
                      <div className="text-right flex-shrink-0">
                        {(group.isBatch || group.isMultiRef) ? (
                          <div>
                            <div className="text-sm text-gray-600">Total a Pagar:</div>
                            <div className="text-xl font-bold text-[#010139]">
                              ${group.total_pending.toFixed(2)}
                            </div>
                            <div className={`text-sm font-semibold mt-1 ${
                              group.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              Remanente: ${group.remaining.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-600">Pendientes: ${group.total_pending.toFixed(2)}</div>
                            <div className={`text-lg font-bold ${
                              group.remaining >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              Remanente: ${group.remaining.toFixed(2)}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    {group.payments.map((payment: any, paymentIndex: number) => {
            const paymentState = getPaymentState(payment);
            return (
              <div
                key={payment.id}
                className={`bg-white rounded-xl shadow-lg p-6 border-2 transition-all ${
                  selectedIds.has(payment.id)
                    ? 'border-[#8AAA19] shadow-xl'
                    : 'border-gray-100 hover:border-gray-300'
                } ${group.isBatch ? 'border-l-4 border-l-[#010139]' : ''}`}
              >
                {/* Indicador de división para batches normales (no descuento a corredor) */}
                {group.isBatch && !group.allAreDescuentoCorredor && (
                  <div className="mb-3 pb-3 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-white p-3 rounded-lg -mx-3">
                    <span className="text-xs font-bold text-[#010139] bg-white px-3 py-1.5 rounded-lg shadow-sm border border-gray-200">
                      🔸 División {paymentIndex + 1} de {group.payments.length}
                    </span>
                  </div>
                )}
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

                {/* Notas del pago */}
                {(() => {
                  try {
                    const metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : (payment.notes || {});
                    const displayNotes = metadata?.notes;
                    
                    if (displayNotes && displayNotes.trim()) {
                      return (
                        <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                          <p className="text-xs font-semibold text-blue-900 mb-1">📝 Notas:</p>
                          <p className="text-sm text-blue-800">{displayNotes}</p>
                        </div>
                      );
                    }
                  } catch (e) {
                    return null;
                  }
                  return null;
                })()}

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

                {/* Status badge y etiquetas especiales */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge payment={payment} />

                    {/* Etiqueta de motivo del pago */}
                    {(() => {
                      // Parsear metadata
                      const metadata = typeof payment.notes === 'string' 
                        ? JSON.parse(payment.notes) 
                        : payment.notes;
                      
                      // Si es descuento a corredor
                      if (isDescuentoACorredor(payment)) {
                        const brokerId = metadata?.broker_id;
                        const broker = brokers.find(b => b.id === brokerId);
                        const brokerName = broker?.name;
                        
                        return (
                          <span className="px-2 py-0.5 bg-[#010139]/5 text-[#010139] border border-[#010139]/30 rounded-full text-[11px] font-semibold">
                            💰 Descuento a corredor{brokerName ? ` – ${brokerName}` : ''}
                          </span>
                        );
                      }
                      
                      // Si es devolución
                      if (payment.purpose === 'devolucion' && metadata?.devolucion_tipo) {
                        if (metadata.devolucion_tipo === 'cliente') {
                          const clientName = metadata.client_name || payment.client_name;
                          return (
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-300 rounded-full text-[11px] font-semibold">
                              💸 Devolución a Cliente: {clientName}
                            </span>
                          );
                        } else if (metadata.devolucion_tipo === 'corredor' && metadata.broker_id) {
                          const broker = brokers.find(b => b.id === metadata.broker_id);
                          const brokerName = broker?.name || 'Corredor';
                          return (
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-300 rounded-full text-[11px] font-semibold">
                              💸 Devolución a Corredor: {brokerName}
                            </span>
                          );
                        }
                      }
                      
                      // Si es pago a póliza
                      if (payment.purpose === 'poliza' && payment.policy_number) {
                        return (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-300 rounded-full text-[11px] font-semibold">
                            📄 Pago a Póliza: {payment.policy_number}
                          </span>
                        );
                      }
                      
                      // Si es otro tipo
                      if (payment.purpose === 'otro') {
                        return (
                          <span className="px-2 py-0.5 bg-gray-50 text-gray-700 border border-gray-300 rounded-full text-[11px] font-semibold">
                            📝 Otro
                          </span>
                        );
                      }
                      
                      return null;
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(payment.created_at).toLocaleDateString('es-PA')}
                  </div>
                </div>

                {/* Total recibido - NO mostrar en vista agrupada (el remanente se muestra en el header del grupo) */}
              </div>
            );
            })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {displayPayments.simple.map((payment) => {
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

                    {/* Notas del pago */}
                    {(() => {
                      try {
                        const metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : (payment.notes || {});
                        const displayNotes = metadata?.notes;
                        
                        if (displayNotes && displayNotes.trim()) {
                          return (
                            <div className="mb-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                              <p className="text-xs font-semibold text-blue-900 mb-1">📝 Notas:</p>
                              <p className="text-sm text-blue-800">{displayNotes}</p>
                            </div>
                          );
                        }
                      } catch (e) {
                        return null;
                      }
                      return null;
                    })()}

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
  
  // Detectar si es otro banco/depósito
  let isOtherBank = false;
  try {
    const metadata = typeof payment.notes === 'string' ? JSON.parse(payment.notes) : payment.notes;
    isOtherBank = metadata?.is_other_bank === true;
  } catch (e) {
    // Si no se puede parsear, no es otro banco
  }
  
  // Si es otro banco, mostrar estado amarillo especial
  if (isOtherBank) {
    return {
      key: 'other_bank',
      label: 'Actualizar referencia para conciliar',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      blocked: false,
    } as const;
  }
  
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
