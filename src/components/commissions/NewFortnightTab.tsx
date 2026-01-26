'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { actionDeleteImport, actionRecalculateFortnight, actionDeleteDraft, actionPayFortnight, actionExportBankCsv, actionToggleNotify } from '@/app/(app)/commissions/actions';
import ImportForm from './ImportForm';
import ImportedReportsList from './ImportedReportsList';
import BrokerTotals from './BrokerTotals';
import CreateFortnightManager from './CreateFortnightManager';
import AdvancesModal from './AdvancesModal';
import { QueuedAdjustmentsPreview } from './QueuedAdjustmentsPreview';
import DraftUnidentifiedTable from './DraftUnidentifiedTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { FaPlusCircle, FaCalculator, FaChevronDown, FaChevronRight, FaMoneyBillWave, FaDollarSign, FaExclamationCircle, FaExclamationTriangle, FaFileDownload, FaTrash, FaChartPie, FaCheckCircle, FaFileImport, FaUsers, FaCircle, FaCheck, FaMoneyCheckAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const months = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const formatFortnightPeriod = (startDate: string, endDate: string): string => {
  const endParts = endDate.split('-');
  const startParts = startDate.split('-');
  
  const startDay = parseInt(startParts[2] || '1');
  const endDay = parseInt(endParts[2] || '1');
  const month = months[parseInt(endParts[1] || '1') - 1];
  const year = parseInt(endParts[0] || '2024');
  
  return `del ${startDay} al ${endDay} de ${month} ${year}`;
};

// Simplified types for this component's state
interface FortnightRow { id: string; period_start: string; period_end: string; notify_brokers: boolean; }
interface InsurerRow { id: string; name: string; }
interface BrokerRow { id: string; name: string; }
interface CommImportWithDetails { id: string; insurer_name: string; total_amount: number; created_at: string; items_count: number; }

interface Props {
  role: string;
  brokerId: string | null;
  draftFortnight: FortnightRow | null;
  insurers: InsurerRow[];
  brokers: BrokerRow[];
  onFortnightCreated: (fortnight: FortnightRow) => void;
}

export default function NewFortnightTab({ role, brokerId, draftFortnight: initialDraft, insurers, brokers, onFortnightCreated }: Props) {
  const { dialogState, closeDialog, confirm } = useConfirmDialog();
  const [draftFortnight, setDraftFortnight] = useState(initialDraft);
  const [importedReports, setImportedReports] = useState<CommImportWithDetails[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<{ id: string; name: string } | null>(null);
  const [recalculationKey, setRecalculationKey] = useState(0);
  const [notifyBrokers, setNotifyBrokers] = useState(initialDraft?.notify_brokers ?? false);
  const [isTogglingNotify, setIsTogglingNotify] = useState(false);

  const forceRecalculate = () => setRecalculationKey(prev => prev + 1);

  // Sync with parent when initialDraft changes
  useEffect(() => {
    console.log('Draft fortnight changed:', initialDraft);
    setDraftFortnight(initialDraft);
    setNotifyBrokers(initialDraft?.notify_brokers ?? false);
  }, [initialDraft]);

  const loadImportedReports = useCallback(async () => {
    if (!draftFortnight) {
      setImportedReports([]);
      return;
    }
    console.log('Loading imported reports for fortnight:', draftFortnight.id);
    
    // Get imports for this fortnight with total_amount
    const { data: imports, error: importsError } = await supabaseClient()
      .from('comm_imports')
      .select(`
        id,
        created_at,
        total_amount,
        is_life_insurance,
        insurers (
          name
        )
      `)
      .eq('period_label', draftFortnight.id);

    if (importsError) {
      console.error('Error loading imports:', importsError);
      toast.error('Error al cargar reportes importados');
      setImportedReports([]);
      return;
    }

    if (!imports || imports.length === 0) {
      setImportedReports([]);
      return;
    }

    // Obtener broker_id de LISSA (contacto@lideresenseguros.com)
    const { data: lissaBroker } = await supabaseClient()
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    const lissaBrokerId = lissaBroker?.id || null;

    // Get items count and commission totals for each import
    const reportsWithDetails = await Promise.all(
      imports.map(async (imp: any) => {
        const { data: items } = await supabaseClient()
          .from('comm_items')
          .select('id, gross_amount, broker_id, policy_number, insured_name')
          .eq('import_id', imp.id);
        
        console.log(`[${imp.insurers?.name}] Import ${imp.id}:`);
        console.log(`  📦 Total items en comm_items: ${items?.length || 0}`);
        console.log(`  💰 Total Reporte (total_amount): $${imp.total_amount}`);
        
        // DEBUG: Detectar duplicados por policy_number
        const policyCount = new Map<string, number>();
        (items || []).forEach(item => {
          const count = policyCount.get(item.policy_number) || 0;
          policyCount.set(item.policy_number, count + 1);
        });
        const duplicates = Array.from(policyCount.entries()).filter(([_, count]) => count > 1);
        if (duplicates.length > 0) {
          console.log(`  🚨 DUPLICADOS en comm_items para import ${imp.id}:`);
          duplicates.forEach(([policy, count]) => {
            console.log(`    - Póliza ${policy}: ${count} veces`);
            const dupeItems = (items || []).filter(i => i.policy_number === policy);
            dupeItems.forEach(di => {
              console.log(`      → ID: ${di.id}, Broker: ${di.broker_id}, Monto: $${di.gross_amount}, Cliente: ${di.insured_name}`);
            });
          });
        }
        
        // Calculate broker commissions (items with broker_id assigned, EXCLUIR LISSA)
        const brokerCommissions = (items || [])
          .filter(item => item.broker_id !== null && item.broker_id !== lissaBrokerId)
          .reduce((sum, item) => sum + (Number(item.gross_amount) || 0), 0);
        
        console.log(`  💵 Suma broker_commissions: $${brokerCommissions.toFixed(2)}`);
        console.log(`  🏢 Diferencia (Oficina): $${(imp.total_amount - brokerCommissions).toFixed(2)}`);
        
        // Detectar si es un reporte de Códigos ASSA (cuando todos los items tienen códigos PJ750-xxx)
        const isAssaCodigos = (items || []).length > 0 && (items || []).every(item => 
          item.policy_number?.startsWith('PJ750-') || item.policy_number === 'PJ750'
        );
        
        const reportData = {
          id: imp.id,
          insurer_name: imp.insurers?.name || 'Desconocido',
          total_amount: imp.total_amount || 0,
          items_count: items?.length || 0,
          broker_commissions: brokerCommissions,
          created_at: imp.created_at,
          is_assa_codigos: isAssaCodigos,
          is_life_insurance: imp.is_life_insurance || false,
        };
        
        console.log(`[${reportData.insurer_name}] is_life_insurance desde BD:`, imp.is_life_insurance, '| en objeto:', reportData.is_life_insurance);
        
        return reportData;

      })
    );

    setImportedReports(reportsWithDetails.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    console.log('Loaded reports:', reportsWithDetails.length);
  }, [draftFortnight]);

  // Load reports when draftFortnight changes
  useEffect(() => {
    loadImportedReports();
  }, [loadImportedReports]);

  const handleDeleteImport = async (importId: string) => {
    const confirmed = await confirm('¿Está seguro de que desea eliminar esta importación? Todos sus items asociados serán borrados.', 'Confirmar eliminación');
    if (!confirmed) return;
    
    try {
      console.log('Eliminando reporte:', importId);
      const result = await actionDeleteImport(importId);
      console.log('Resultado eliminación:', result);
      
      if (result.ok) {
        toast.success('Importación eliminada.');
        // Recargar TODOS los datos para actualizar contadores en tiempo real
        await Promise.all([
          loadImportedReports(),
          loadBrokerTotals(),
          loadRamosTotals()
        ]);
        forceRecalculate();
      } else {
        toast.error('Error al eliminar importación', { description: result.error });
      }
    } catch (err) {
      console.error('Error deleting import:', err);
      toast.error('Error inesperado al eliminar');
    }
  };

  const handleManageAdvances = (brokerId: string) => {
    const broker = brokers.find(b => b.id === brokerId);
    if (broker) {
      setSelectedBroker({ id: broker.id, name: broker.name || 'N/A' });
      setIsModalOpen(true);
    }
  };

  // State for payment actions - must be before any conditional returns
  const [isGeneratingCSV, setIsGeneratingCSV] = useState(false);
  const [isClosingFortnight, setIsClosingFortnight] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  
  // State para totales de brokers
  const [brokerCommissionsTotal, setBrokerCommissionsTotal] = useState(0);
  const [totalNetToPay, setTotalNetToPay] = useState(0);
  const [brokerTotalsData, setBrokerTotalsData] = useState<Array<{
    broker_id: string;
    gross_amount: number;
    discount_amount: number;
    net_amount: number;
    is_retained: boolean;
  }>>([]);
  
  // State para totales por ramo
  const [ramosTotals, setRamosTotals] = useState({ vida: 0, generales: 0 });

  // Cargar totales por ramo
  const loadRamosTotals = useCallback(async () => {
    if (!draftFortnight) {
      setRamosTotals({ vida: 0, generales: 0 });
      return;
    }
    
    try {
      // Obtener imports actuales (solo los que existen)
      const { data: imports, error: importsError } = await supabaseClient()
        .from('comm_imports')
        .select('id, total_amount, is_life_insurance')
        .eq('period_label', draftFortnight.id);
      
      if (importsError) {
        console.error('Error loading imports:', importsError);
        return;
      }
      
      let vida = 0;
      let generales = 0;
      
      
      // Para cada import, calcular ganancia de oficina
      for (const imp of imports || []) {
        // Obtener comisiones desde comm_items directamente (más confiable)
        const { data: items } = await supabaseClient()
          .from('comm_items')
          .select('gross_amount')
          .eq('import_id', imp.id)
          .not('broker_id', 'is', null);
        
        const totalComisionesBrokers = (items || []).reduce((sum, item) => {
          return sum + (Number(item.gross_amount) || 0);
        }, 0);
        
        const totalReporte = Number(imp.total_amount) || 0;
        const gananciaOficina = totalReporte - totalComisionesBrokers;
        
        
        // Clasificar según is_life_insurance
        if (imp.is_life_insurance) {
          vida += gananciaOficina;
        } else {
          generales += gananciaOficina;
        }
      }
      
      setRamosTotals({ vida, generales });
    } catch (error) {
      console.error('Error calculating ramos totals:', error);
    }
  }, [draftFortnight]);

  // SIMPLIFICADO: Calcular totales directo desde comm_items (fuente única de verdad)
  const loadBrokerTotals = useCallback(async () => {
    if (!draftFortnight) {
      setBrokerCommissionsTotal(0);
      setBrokerTotalsData([]);
      return;
    }
    
    // 0. Obtener broker_id de LISSA
    const { data: lissaBroker } = await supabaseClient()
      .from('brokers')
      .select('id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    const lissaBrokerId = lissaBroker?.id || null;
    
    // 1. Obtener imports de esta quincena
    const { data: imports } = await supabaseClient()
      .from('comm_imports')
      .select('id')
      .eq('period_label', draftFortnight.id);
    
    if (!imports || imports.length === 0) {
      setBrokerCommissionsTotal(0);
      setBrokerTotalsData([]);
      return;
    }
    
    const importIds = imports.map(i => i.id);
    
    // 2. Obtener comm_items de estos imports
    const { data: items } = await supabaseClient()
      .from('comm_items')
      .select('broker_id, gross_amount')
      .in('import_id', importIds)
      .not('broker_id', 'is', null);
    
    if (!items || items.length === 0) {
      setBrokerCommissionsTotal(0);
      setBrokerTotalsData([]);
      return;
    }
    
    // 3. Agrupar por broker (EXCLUIR LISSA)
    const brokerGroups = items.reduce((acc, item) => {
      const brokerId = item.broker_id!;
      
      // Excluir LISSA
      if (brokerId === lissaBrokerId) {
        return acc;
      }
      
      if (!acc[brokerId]) {
        acc[brokerId] = 0;
      }
      acc[brokerId] += Number(item.gross_amount) || 0; // CRÍTICO: NO usar Math.abs() para respetar negativos
      return acc;
    }, {} as Record<string, number>);
    
    // 3.5. Obtener estado de retención desde fortnight_broker_totals
    const { data: retentionData } = await supabaseClient()
      .from('fortnight_broker_totals')
      .select('broker_id, is_retained')
      .eq('fortnight_id', draftFortnight.id);
    
    const retentionMap = (retentionData || []).reduce((acc, item) => {
      acc[item.broker_id] = item.is_retained || false;
      return acc;
    }, {} as Record<string, boolean>);
    
    // 4. Crear totalsData SIN adelantos (solo se aplican al PAGAR la quincena)
    const totalsData = Object.keys(brokerGroups).map(brokerId => {
      const gross = brokerGroups[brokerId] || 0;
      return {
        broker_id: brokerId,
        gross_amount: gross,
        discount_amount: 0, // Sin descuentos en borrador
        net_amount: gross, // Neto = Bruto en borrador
        is_retained: retentionMap[brokerId] || false // Usar estado real de BD
      };
    });
    
    // 5. Calcular total de comisiones
    const total = totalsData.reduce((sum, t) => sum + t.gross_amount, 0);
    setBrokerCommissionsTotal(total);
    setBrokerTotalsData(totalsData);
  }, [draftFortnight]);

  // Calculate office total - usar useMemo para que se recalcule automáticamente
  const officeTotal = useMemo(() => {
    const totalImported = importedReports.reduce((sum, r) => sum + r.total_amount, 0);
    const brokerCommissions = brokerCommissionsTotal;
    return {
      totalImported,
      brokerCommissions,
      officeProfit: totalImported - brokerCommissions,
      percentage: totalImported > 0 ? ((totalImported - brokerCommissions) / totalImported * 100) : 0
    };
  }, [importedReports, brokerCommissionsTotal]);

  useEffect(() => {
    if (draftFortnight) {
      loadImportedReports();
      loadBrokerTotals();
      loadRamosTotals();
    }
  }, [draftFortnight, loadImportedReports, loadBrokerTotals, loadRamosTotals]);

  // Auto-refresh: Recargar datos cada 4 segundos para mantener todo actualizado en tiempo real
  // Sin flickering: solo actualiza state sin forzar re-render completo
  useEffect(() => {
    if (!draftFortnight) return;

    const refreshData = async () => {
      // Solo refrescar si no hay modales abiertos o acciones en progreso
      if (isModalOpen || isGeneratingCSV || isClosingFortnight || isDiscarding || isTogglingNotify) {
        return;
      }

      // Refrescar datos silenciosamente (sin logs para evitar spam en consola)
      await Promise.all([
        loadImportedReports(),
        loadBrokerTotals(),
        loadRamosTotals(),
      ]);
      
      // Forzar recalculación de BrokerTotals sin hacer ruido
      setRecalculationKey(prev => prev + 1);
    };

    // Luego ejecutar cada 4 segundos
    const intervalId = setInterval(refreshData, 4000);

    // Limpiar al desmontar o cuando cambie draftFortnight
    return () => clearInterval(intervalId);
  }, [draftFortnight, isModalOpen, isGeneratingCSV, isClosingFortnight, isDiscarding, isTogglingNotify, loadImportedReports, loadBrokerTotals, loadRamosTotals]);

  const handleToggleNotify = async () => {
    if (!draftFortnight) return;

    const nextValue = !notifyBrokers;
    setIsTogglingNotify(true);
    try {
      const result = await actionToggleNotify(draftFortnight.id, nextValue);

      if (result.ok) {
        setNotifyBrokers(nextValue);
        setDraftFortnight(prev => (prev ? { ...prev, notify_brokers: nextValue } : prev));
        toast.success(nextValue ? 'Notificaciones para corredores activadas.' : 'Notificaciones para corredores desactivadas.');
      } else {
        toast.error('No se pudo actualizar la preferencia de notificación.', { description: (result as any).error || 'Error desconocido' });
      }
    } catch (error) {
      toast.error('Error inesperado al actualizar notificaciones.');
      console.error('handleToggleNotify error:', error);
    } finally {
      setIsTogglingNotify(false);
    }
  };

  const handleGenerateCSV = async () => {
    if (!draftFortnight) return; // Safety check
    
    setIsGeneratingCSV(true);
    try {
      // TODO: Implement actionGenerateBankCSV when backend is ready
      // For now, showing a demo CSV generation
      const csvContent = `Nombre,Cuenta,Monto\nDemo Broker,123456789,1000.00`;
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `banco_general_${draftFortnight.id}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('CSV generado exitosamente (Demo)');
    } catch (err) {
      toast.error('Error inesperado al generar CSV');
    } finally {
      setIsGeneratingCSV(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (!draftFortnight) return;
    
    setIsDiscarding(true);
    try {
      console.log('Descartando borrador:', draftFortnight.id);
      
      const result = await actionDeleteDraft(draftFortnight.id);
      if (!result.ok) {
        toast.error('Error al descartar el borrador', { description: (result as any).error });
        return;
      }
      
      toast.success('Borrador eliminado exitosamente');
      setDraftFortnight(null);
      onFortnightCreated(null as any); // Reload
    } catch (error) {
      console.error('Error discarding draft:', error);
      toast.error('Error inesperado al descartar');
    } finally {
      setIsDiscarding(false);
      setShowDiscardConfirm(false);
    }
  };

  const handleExportACH = async () => {
    if (!draftFortnight) {
      toast.error('No hay quincena en borrador');
      return;
    }
    
    setIsGeneratingCSV(true);
    console.log('=== INICIO DESCARGA TXT ===');
    console.log('Quincena ID:', draftFortnight.id);
    
    try {
      const result: any = await actionExportBankCsv(draftFortnight.id);
      
      console.log('Resultado de actionExportBankCsv:', {
        ok: result.ok,
        hasContent: !!(result.bankACH),
        contentLength: result.bankACH?.length || 0,
        validCount: result.achValidCount,
        errors: result.achErrors?.length || 0,
        error: result.error
      });
      
      if (!result.ok) {
        console.error('ERROR en actionExportBankCsv:', result.error);
        toast.error(result.error || 'Error al generar archivo TXT');
        setIsGeneratingCSV(false);
        return;
      }
      
      const content = result.bankACH || '';
      const errors = result.achErrors || [];
      const validCount = result.achValidCount || 0;
      const totalAmount = result.achTotalAmount || 0;
      
      if (!content || content.trim().length === 0) {
        console.warn('Contenido vacío generado');
        toast.warning('No hay pagos para generar. Verifica que haya brokers con monto neto > 0 y no retenidos.');
        setIsGeneratingCSV(false);
        return;
      }
      
      // Método alternativo de descarga usando data URL
      console.log('Generando descarga con', content.length, 'caracteres');
      const fecha = new Date().toISOString().split('T')[0]?.replace(/-/g, '') || 'sin_fecha';
      const fileName = `PAGOS_COMISIONES_${fecha}.txt`;
      
      // Crear elemento de descarga
      const element = document.createElement('a');
      const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = fileName;
      element.style.display = 'none';
      
      // Agregar al DOM, hacer click y remover
      document.body.appendChild(element);
      console.log('Ejecutando descarga...');
      element.click();
      
      // Limpiar después de un delay
      setTimeout(() => {
        document.body.removeChild(element);
        URL.revokeObjectURL(element.href);
        console.log('Descarga completada y limpieza realizada');
      }, 100);
      
      // Mostrar mensaje de éxito
      if (errors.length > 0) {
        toast.warning(`Archivo TXT generado con ${validCount} pago(s). ${errors.length} broker(s) excluidos.`, {
          duration: 5000
        });
      } else {
        toast.success(`✅ TXT descargado: ${validCount} pago(s) por $${totalAmount.toFixed(2)}`, {
          duration: 4000
        });
      }
      
      console.log('=== FIN DESCARGA TXT ===');
      
    } catch (err) {
      console.error('ERROR CRÍTICO en handleExportACH:', err);
      toast.error('Error inesperado al generar archivo TXT');
    } finally {
      setIsGeneratingCSV(false);
    }
  };

  const handleCloseFortnight = async () => {
    if (!draftFortnight) return; // Safety check
    
    setIsClosingFortnight(true);
    try {
      console.log('Cerrando quincena:', draftFortnight.id);
      
      const result = await actionPayFortnight(draftFortnight.id);
      
      console.log('Result from actionPayFortnight:', result);
      
      if (result.ok) {
        toast.success('Quincena cerrada exitosamente');
        setDraftFortnight(null);
        onFortnightCreated(null as any);
        console.log('✓ Quincena cerrada');
      } else {
        toast.error((result as any).error || 'Error al cerrar quincena');
      }
    } catch (err) {
      console.error('Error closing fortnight:', err);
      toast.error('Error inesperado al cerrar quincena');
    } finally {
      setIsClosingFortnight(false);
      setShowCloseConfirm(false);
    }
  };

  // Early return if no draft fortnight
  if (!draftFortnight) {
    return <CreateFortnightManager onFortnightCreated={onFortnightCreated} />;
  }

  const pieData = [
    { name: 'Comisiones Corredores', value: officeTotal.brokerCommissions, color: '#8AAA19' },
    { name: 'Ganancia Oficina', value: officeTotal.officeProfit, color: '#010139' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner con período y estado */}
      <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white rounded-xl shadow-lg p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs sm:text-sm uppercase tracking-wider bg-white/20 px-3 py-1 rounded-full font-semibold">
                Quincena en Borrador
              </span>
            </div>
            <p className="text-gray-200 font-medium">
              {formatFortnightPeriod(draftFortnight.period_start, draftFortnight.period_end)}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleToggleNotify}
                disabled={isTogglingNotify}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  notifyBrokers 
                    ? 'bg-[#8AAA19] text-white shadow-md' 
                    : 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {notifyBrokers ? <FaCheck size={12} /> : null}
                {isTogglingNotify ? 'Guardando...' : notifyBrokers ? 'Notificaciones ON' : 'Notificaciones OFF'}
              </button>
              <p className="text-xs text-gray-300">
                {notifyBrokers ? 'Se enviarán correos al cerrar' : 'No se enviarán notificaciones'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bar - Acciones principales */}
      <div className="sticky top-[60px] sm:top-[72px] z-[100] bg-gradient-to-r from-blue-50 to-white border-2 border-[#8AAA19] rounded-lg p-3 sm:p-4 shadow-lg mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          {/* Info de total neto */}
          <div className="flex-1">
            <p className="font-bold text-[#010139] text-base sm:text-lg">
              Total Neto a Pagar
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-bold text-2xl text-[#8AAA19]">
                ${totalNetToPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </p>
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            {/* Descartar - Solo icono en mobile */}
            <button
              onClick={() => setShowDiscardConfirm(true)}
              disabled={isDiscarding}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-white text-red-600 border-2 border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 transition font-medium text-sm shadow-sm"
              title="Descartar"
            >
              <FaTrash size={14} />
              <span className="hidden sm:inline">
                {isDiscarding ? 'Eliminando...' : 'Descartar'}
              </span>
            </button>
            
            {/* Descargar TXT - Solo icono en mobile */}
            <button
              onClick={handleExportACH}
              disabled={isGeneratingCSV || !draftFortnight}
              className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-[#010139] text-white border-2 border-[#010139] rounded-lg hover:bg-[#020270] hover:border-[#020270] transition font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Descargar TXT"
            >
              <FaFileDownload size={14} />
              <span className="hidden sm:inline">
                {isGeneratingCSV ? 'Generando...' : 'Descargar TXT'}
              </span>
            </button>
            
            {/* Pagar - Siempre con texto */}
            <button
              onClick={() => setShowCloseConfirm(true)}
              disabled={isClosingFortnight || importedReports.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white border-2 border-green-600 rounded-lg hover:bg-green-700 hover:border-green-700 transition font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaCheckCircle size={14} />
              {isClosingFortnight ? 'Procesando...' : 'Pagar'}
            </button>
          </div>
        </div>
      </div>

      {/* ... */}
      {/* Ajustes en Cola para esta Quincena */}
      <QueuedAdjustmentsPreview />

      {/* Sin Identificar - Zona de Trabajo */}
      <DraftUnidentifiedTable 
        fortnightId={draftFortnight.id}
        brokers={brokers}
        recalculationKey={recalculationKey}
        onUpdate={() => {
          loadBrokerTotals();
          forceRecalculate();
        }}
      />

      {/* Section 1: Import Reports */}
      <Card className="bg-white shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
          <CardTitle className="text-[#010139] flex items-center gap-2">
            <FaFileImport />
            1. Importar Reportes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ImportForm 
              insurers={insurers}
              draftFortnightId={draftFortnight.id}
              onImport={() => {
                loadImportedReports();
                loadBrokerTotals();
                forceRecalculate();
              }}
            />
            <ImportedReportsList 
              reports={importedReports} 
              onDelete={handleDeleteImport} 
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Office Total Visualization */}
      <Card className="bg-white shadow-lg overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
          <CardTitle className="text-[#010139] flex items-center gap-2">
            <FaChartPie />
            2. Total Oficina
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-600 mb-3">Distribución de Comisiones</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Total Importado</p>
                <p className="text-2xl font-bold text-[#010139]">
                  ${officeTotal.totalImported.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Comisiones Corredores</p>
                <p className="text-2xl font-bold text-[#8AAA19]">
                  ${officeTotal.brokerCommissions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-[#010139]/10 rounded-lg">
                <p className="text-sm text-gray-600">Ganancia Oficina</p>
                <p className="text-2xl font-bold text-[#010139]">
                  ${officeTotal.officeProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {officeTotal.percentage.toFixed(1)}% del total
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Totales por Tipo */}
      <Card className="bg-white shadow-lg overflow-hidden">
        <CardHeader>
          <CardTitle className="text-[#010139]">3. Totales por Tipo de Seguro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-l-4 border-blue-500">
              <p className="text-sm text-blue-700 font-semibold mb-2">VIDA</p>
              <p className="text-3xl font-bold text-blue-900">
                ${ramosTotals.vida.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-blue-600 mt-1">Seguros de vida</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-l-4 border-green-500">
              <p className="text-sm text-green-700 font-semibold mb-2">RAMOS GENERALES</p>
              <p className="text-3xl font-bold text-green-900">
                ${ramosTotals.generales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600 mt-1">Otros seguros (auto, hogar, etc.)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Corredores y Adelantos */}
      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139]">4. Comisiones por Corredor</CardTitle>
        </CardHeader>
        <CardContent>
          <BrokerTotals 
            draftFortnightId={draftFortnight.id}
            fortnightLabel={formatFortnightPeriod(draftFortnight.period_start, draftFortnight.period_end)}
            totalImported={officeTotal.totalImported}
            brokerTotals={brokerTotalsData}
            onManageAdvances={(brokerId: string) => {
              setSelectedBroker({ id: brokerId, name: 'Corredor' });
              setIsModalOpen(true);
            }}
            onRetentionChange={() => {
              loadBrokerTotals();
              forceRecalculate();
            }}
            onTotalNetChange={setTotalNetToPay}
            recalculationKey={recalculationKey}
          />
        </CardContent>
      </Card>

      {/* Modals */}
      {isModalOpen && selectedBroker && draftFortnight && (
        <AdvancesModal 
          isOpen={isModalOpen}
          brokerId={selectedBroker.id}
          brokerName={selectedBroker.name}
          fortnightId={draftFortnight.id}
          onClose={() => setIsModalOpen(false)}
          onSuccess={forceRecalculate}
        />
      )}
      
      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="z-[150]">
          <DialogHeader>
            <DialogTitle className="text-[#010139]">Confirmar Cierre de Quincena</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea cerrar esta quincena? Esta acción es irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <p className="text-sm text-gray-600">
              • La quincena se marcará como pagada
            </p>
            <p className="text-sm text-gray-600">
              • Se enviarán notificaciones a los corredores
            </p>
            <p className="text-sm text-gray-600">
              • No podrá realizar más cambios
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCloseConfirm(false)}
              disabled={isClosingFortnight}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCloseFortnight}
              disabled={isClosingFortnight}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isClosingFortnight ? 'Cerrando...' : 'Confirmar y Cerrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Discard Draft Confirmation Dialog */}
      <Dialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">¿Descartar Borrador?</DialogTitle>
            <DialogDescription>
              Esta acción eliminará todo el progreso de esta quincena. No podrás recuperar los datos importados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowDiscardConfirm(false)}
              disabled={isDiscarding}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscardDraft}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDiscarding}
            >
              {isDiscarding ? 'Eliminando...' : 'Sí, Descartar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
      />
    </div>
  );
}
