'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabaseClient } from '@/lib/supabase/client';
import { actionDeleteImport, actionRecalculateFortnight, actionDeleteDraft, actionPayFortnight, actionExportBankCsv, actionToggleNotify } from '@/app/(app)/commissions/actions';
import ImportForm from './ImportForm';
import ImportedReportsList from './ImportedReportsList';
import BrokerTotals from './BrokerTotals';
import CreateFortnightManager from './CreateFortnightManager';
import AdvancesModal from './AdvancesModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { FaPlusCircle, FaCalculator, FaChevronDown, FaChevronRight, FaMoneyBillWave, FaDollarSign, FaExclamationCircle, FaExclamationTriangle, FaFileDownload, FaTrash, FaChartPie, FaCheckCircle, FaFileImport, FaUsers } from 'react-icons/fa';
import { toast } from 'sonner';

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

    // Get items count for each import
    const reportsWithDetails = await Promise.all(
      imports.map(async (imp: any) => {
        const { data: items } = await supabaseClient()
          .from('comm_items')
          .select('id')
          .eq('import_id', imp.id);
        
        return {
          id: imp.id,
          insurer_name: imp.insurers?.name || 'Desconocido',
          total_amount: imp.total_amount || 0, // Use total_amount from database
          items_count: items?.length || 0,
          created_at: imp.created_at,
        };
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
    if (!confirm('¿Está seguro de que desea eliminar esta importación? Todos sus items asociados serán borrados.')) return;
    
    try {
      console.log('Eliminando reporte:', importId);
      const result = await actionDeleteImport(importId);
      console.log('Resultado eliminación:', result);
      
      if (result.ok) {
        toast.success('Importación eliminada.');
        await loadImportedReports();
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
  
  // Calculate office total
  const officeTotal = useCallback(() => {
    const totalImported = importedReports.reduce((sum, r) => sum + r.total_amount, 0);
    // Here we would also add ASSA codes total
    // const assaCodesTotal = ... 
    // For now, just using imported total
    const brokerCommissions = 0; // This should come from BrokerTotals data
    return {
      totalImported,
      brokerCommissions,
      officeProfit: totalImported - brokerCommissions,
      percentage: totalImported > 0 ? ((totalImported - brokerCommissions) / totalImported * 100) : 0
    };
  }, [importedReports]);

  useEffect(() => {
    if (draftFortnight) {
      loadImportedReports();
    }
  }, [draftFortnight, loadImportedReports]);

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
        toast.error('No se pudo actualizar la preferencia de notificación.', { description: result.error });
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
      
      if (result.ok) {
        toast.success('Borrador descartado exitosamente');
        setDraftFortnight(null);
        onFortnightCreated(null as any);
      } else {
        toast.error(result.error || 'Error al descartar el borrador');
      }
    } catch (err) {
      console.error('Error discarding draft:', err);
      toast.error('Error al descartar el borrador');
    } finally {
      setIsDiscarding(false);
      setShowDiscardConfirm(false);
    }
  };

  const handleExportCsv = async () => {
    if (!draftFortnight) return;
    
    setIsGeneratingCSV(true);
    try {
      const result = await actionExportBankCsv(draftFortnight.id);
      
      if (result.ok && result.data?.csvContent) {
        const blob = new Blob([result.data.csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `banco_quincena_${draftFortnight.id}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success('CSV generado exitosamente');
      } else {
        toast.error(result.error || 'Error al generar CSV');
      }
    } catch (err) {
      console.error('Error exporting CSV:', err);
      toast.error('Error inesperado al generar CSV');
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
      
      if (result.ok) {
        // Download CSV automatically
        if (result.data?.csvContent) {
          const blob = new Blob([result.data.csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `quincena_${draftFortnight.id}.csv`;
          link.click();
        }
        
        toast.success('Quincena cerrada y marcada como pagada');
        setDraftFortnight(null);
        onFortnightCreated(null as any);
        console.log('✓ Quincena cerrada');
      } else {
        toast.error(result.error || 'Error al cerrar quincena');
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

  const office = officeTotal();
  const pieData = [
    { name: 'Comisiones Corredores', value: office.brokerCommissions, color: '#8AAA19' },
    { name: 'Ganancia Oficina', value: office.officeProfit, color: '#010139' },
  ];

  return (
    <div className="space-y-6">
      {/* Draft Actions Bar */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <FaExclamationCircle className="text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            Borrador de quincena {formatFortnightPeriod(draftFortnight.period_start, draftFortnight.period_end)}
          </span>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex items-center gap-3">
            <Button
              variant={notifyBrokers ? 'default' : 'outline'}
              size="sm"
              disabled={isTogglingNotify}
              onClick={handleToggleNotify}
              className={notifyBrokers ? 'bg-[#010139] hover:bg-[#010139]/90 text-white' : ''}
            >
              {isTogglingNotify ? 'Guardando…' : notifyBrokers ? 'Notificar corredores: ON' : 'Notificar corredores: OFF'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDiscardConfirm(true)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <FaTrash className="mr-2" size={12} />
              Descartar Borrador
            </Button>
          </div>
          <p className="text-xs text-gray-500 md:text-right">
            * Al activar notificaciones, se enviarán correos electrónicos a los corredores cuando se cierre la quincena.
          </p>
        </div>
      </div>

      {/* Section 1: Import Reports */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139]">1. Importar Reportes</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ImportForm 
            insurers={insurers}
            draftFortnightId={draftFortnight.id}
            onImport={() => {
              loadImportedReports();
              forceRecalculate();
            }}
          />
          <ImportedReportsList 
            reports={importedReports} 
            onDelete={handleDeleteImport} 
          />
        </CardContent>
      </Card>

      {/* Section 2: Office Total Visualization */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139] flex items-center gap-2">
            <FaChartPie />
            2. Total Oficina
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  ${office.totalImported.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">Comisiones Corredores</p>
                <p className="text-2xl font-bold text-[#8AAA19]">
                  ${office.brokerCommissions.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-4 bg-[#010139]/10 rounded-lg">
                <p className="text-sm text-gray-600">Ganancia Oficina</p>
                <p className="text-2xl font-bold text-[#010139]">
                  ${office.officeProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {office.percentage.toFixed(1)}% del total
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Totales por Tipo */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139]">3. Totales por Tipo de Seguro</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-l-4 border-blue-500">
              <p className="text-sm text-blue-700 font-semibold mb-2">VIDA</p>
              <p className="text-3xl font-bold text-blue-900">
                $0.00
              </p>
              <p className="text-xs text-blue-600 mt-1">Seguros de vida</p>
            </div>
            <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border-l-4 border-green-500">
              <p className="text-sm text-green-700 font-semibold mb-2">RAMOS GENERALES</p>
              <p className="text-3xl font-bold text-green-900">
                ${office.totalImported.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600 mt-1">Otros seguros</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Corredores y Adelantos */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139]">4. Comisiones por Corredor</CardTitle>
        </CardHeader>
        <CardContent>
          <BrokerTotals 
            draftFortnightId={draftFortnight.id} 
            onManageAdvances={(brokerId: string) => {
              setSelectedBroker({ id: brokerId, name: 'Corredor' });
              setIsModalOpen(true);
            }}
          />
        </CardContent>
      </Card>

      {/* Section 5: Generación de Pagos */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-[#010139]">5. Generar Archivo Banco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Descarga el archivo CSV para cargar las transferencias en Banco General.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleExportCsv}
                disabled={isGeneratingCSV}
                className="bg-[#8AAA19] hover:bg-[#6d8814] text-white"
              >
                <FaFileDownload className="mr-2" />
                {isGeneratingCSV ? 'Generando...' : 'Descargar CSV Banco General'}
              </Button>
              <Button
                onClick={() => setShowCloseConfirm(true)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <FaCheckCircle className="mr-2" />
                Marcar como Pagado
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              * Al marcar como pagado, la quincena se cerrará y se enviarán notificaciones a los corredores.
            </p>
          </div>
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
        <DialogContent>
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
              Esta acción eliminará permanentemente el borrador de quincena actual y todos los reportes importados.
              <br /><br />
              <strong className="text-red-600">Esta acción no se puede deshacer.</strong>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
              disabled={isDiscarding}
            >
              {isDiscarding ? 'Descartando...' : 'Descartar Borrador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
