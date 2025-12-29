'use client';

import { useState, useEffect, useCallback } from 'react';
import { FaUpload, FaUniversity, FaPlus, FaTrash, FaFileAlt } from 'react-icons/fa';
import { actionUploadImport } from '@/app/(app)/commissions/actions';
import { actionGetAvailableForImport, actionAutoAssignInsurerToTransfer, actionAutoAssignInsurerToGroup, actionMarkTransferAsOkTemporary } from '@/app/(app)/commissions/banco-actions';
import { useRouter } from 'next/navigation';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

interface Props {
  insurers: { id: string; name: string }[];
  draftFortnightId: string;
  onImport: () => void; // Callback to refresh data
}

export default function ImportForm({ insurers, draftFortnightId, onImport }: Props) {
  const router = useRouter();
  const { dialogState, closeDialog, alert: showAlert, success } = useConfirmDialog();
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isLifeInsurance, setIsLifeInsurance] = useState(false);
  const [availableOptions, setAvailableOptions] = useState<Array<{type: 'transfer' | 'group', id: string, name: string, amount: number, insurerName?: string, hasInsurer: boolean, cutoffOrigin?: string, status?: string, date?: string, transferType?: string}>>([]);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  // Sistema de múltiples reportes
  const [pendingReports, setPendingReports] = useState<Array<{
    file: File;
    insurerId: string;
    insurerName: string;
    isLife: boolean;
    amount: string;
  }>>([]);

  // Función centralizada para cargar opciones bancarias
  const loadBankOptions = useCallback(async () => {
    setLoadingOptions(true);
    const options: Array<{type: 'transfer' | 'group', id: string, name: string, amount: number, insurerName?: string, hasInsurer: boolean, cutoffOrigin?: string, status?: string, date?: string, transferType?: string}> = [];
    
    try {
      const result = await actionGetAvailableForImport();
      
      if (result.ok && result.data) {
        // Transferencias individuales - ordenadas por fecha
        (result.data.transfers || []).forEach((t: any) => {
          const cutoffInfo = t.bank_cutoffs 
            ? `Corte ${new Date(t.bank_cutoffs.start_date).toLocaleDateString('es-PA')} - ${new Date(t.bank_cutoffs.end_date).toLocaleDateString('es-PA')}`
            : 'Sin corte';
          
          // Limpiar descripción: quitar "ACH -" o "ACH-"
          let cleanDescription = t.description_raw || 'Sin descripción';
          cleanDescription = cleanDescription.replace(/^ACH\s*-\s*/i, '').trim();
          
          // Tipo de transferencia para mostrar
          const typeLabel = t.transfer_type === 'REPORTE' ? '📋' : 
                           t.transfer_type === 'BONO' ? '🎁' : 
                           t.transfer_type === 'OTRO' ? '📄' : '⏳';
          
          // LÓGICA: Si tiene aseguradora -> mostrar nombre aseguradora, si no -> mostrar descripción
          const displayName = t.insurer_assigned_id && t.insurers?.name 
            ? `${typeLabel} ${t.insurers.name}` 
            : `${typeLabel} ${cleanDescription.substring(0, 45)}`;
          
          options.push({
            type: 'transfer',
            id: t.id,
            name: displayName,
            amount: t.amount,
            insurerName: t.insurers?.name,
            hasInsurer: !!t.insurer_assigned_id,
            cutoffOrigin: cutoffInfo,
            status: t.status,
            date: t.date,
            transferType: t.transfer_type
          });
        });
        
        // Grupos - Ya vienen ordenados alfabéticamente del backend
        (result.data.groups || []).forEach((g: any) => {
          options.push({
            type: 'group',
            id: g.id,
            name: `📦 ${g.name}`,
            amount: g.total_amount || 0,
            insurerName: g.insurers?.name,
            hasInsurer: !!g.insurer_id,
            status: g.status
          });
        });
      }
      
      setAvailableOptions(options);
    } catch (error) {
      console.error('[IMPORT FORM] Error cargando opciones bancarias:', error);
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  // Cargar transferencias y grupos de Banco al montar
  useEffect(() => {
    loadBankOptions();
  }, [loadBankOptions]);

  // Agregar reporte al batch (sin importar todavía)
  const handleAddReport = () => {
    if (!file) {
      showAlert('Por favor seleccione un archivo', 'Falta archivo');
      return;
    }
    if (!selectedInsurer) {
      showAlert('Por favor seleccione una aseguradora', 'Falta aseguradora');
      return;
    }
    
    const insurerName = selectedInsurer === 'ASSA_CODIGOS' 
      ? 'Códigos ASSA'
      : insurers.find(i => i.id === selectedInsurer)?.name || 'Desconocido';
    
    setPendingReports(prev => [...prev, {
      file,
      insurerId: selectedInsurer,
      insurerName,
      isLife: isLifeInsurance,
      amount: totalAmount || '0'
    }]);
    
    // Limpiar campos para agregar otro reporte
    setFile(null);
    setSelectedInsurer('');
    setIsLifeInsurance(false);
    // NO limpiar totalAmount ni selectedOption (se mantienen para toda la operación)
  };

  // Remover reporte del batch
  const handleRemoveReport = (index: number) => {
    setPendingReports(prev => prev.filter((_, i) => i !== index));
  };

  // Importar todos los reportes del batch
  const handleImportAll = async () => {
    if (pendingReports.length === 0) {
      await showAlert('No hay reportes agregados para importar', 'Sin reportes');
      return;
    }
    
    if (!draftFortnightId) {
      await showAlert('Error: No hay quincena en borrador', 'Error');
      return;
    }

    // Validación especial: Monto 0 sin transferencia = Reporte negativo para oficina
    const amountValue = parseFloat(totalAmount) || 0;
    if (amountValue === 0 && !selectedOption) {
      const confirmed = await new Promise<boolean>((resolve) => {
        const dialog = document.createElement('div');
        dialog.innerHTML = `
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full m-4">
              <div class="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-6 py-4 rounded-t-2xl">
                <h3 class="text-lg font-bold">⚠️ Confirmar Reportes en Negativo</h3>
              </div>
              <div class="p-6">
                <div class="flex justify-center mb-4">
                  <svg class="text-orange-500 w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <div class="text-center mb-6">
                  <p class="text-gray-700 text-base mb-3">
                    El <strong>Total es $0.00</strong> y no hay transferencia bancaria vinculada.
                  </p>
                  <p class="text-gray-700 text-base mb-3">
                    Esto significa que los <strong>${pendingReports.length} reportes</strong> se registrarán como <strong class="text-red-600">NEGATIVOS para la oficina</strong>.
                  </p>
                  <p class="text-sm text-gray-600">
                    ¿Está seguro de que desea continuar?
                  </p>
                </div>
                <div class="flex gap-3 justify-center">
                  <button id="cancel-batch-negative-btn" class="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors border border-gray-300">
                    Cancelar
                  </button>
                  <button id="confirm-batch-negative-btn" class="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg">
                    Sí, Continuar
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(dialog);
        
        const confirmBtn = dialog.querySelector('#confirm-batch-negative-btn');
        const cancelBtn = dialog.querySelector('#cancel-batch-negative-btn');
        
        confirmBtn?.addEventListener('click', () => {
          document.body.removeChild(dialog);
          resolve(true);
        });
        
        cancelBtn?.addEventListener('click', () => {
          document.body.removeChild(dialog);
          resolve(false);
        });
      });

      if (!confirmed) {
        return; // Usuario canceló la importación
      }
    }

    setUploading(true);
    
    try {
      console.log(`=== BATCH IMPORT: ${pendingReports.length} reportes ===`);
      
      // Procesar cada reporte secuencialmente
      let allSuccess = true;
      const results = [];
      
      for (let i = 0; i < pendingReports.length; i++) {
        const report = pendingReports[i];
        if (!report) continue;
        
        console.log(`Procesando reporte ${i + 1}/${pendingReports.length}: ${report.insurerName}`);
        
        const formData = new FormData();
        formData.append('file', report.file);
        formData.append('insurer_id', report.insurerId);
        formData.append('total_amount', report.amount || totalAmount);
        formData.append('fortnight_id', draftFortnightId);
        formData.append('is_life_insurance', String(report.isLife));
        
        // Solo vincular transferencia/grupo en el ÚLTIMO reporte
        if (i === pendingReports.length - 1 && selectedOption) {
          const option = availableOptions.find(o => o.id === selectedOption);
          if (option) {
            // Auto-asignar aseguradora si no tiene
            if (!option.hasInsurer && report.insurerId) {
              console.log('[BATCH] Auto-asignando aseguradora a', option.type, selectedOption);
              if (option.type === 'group') {
                await actionAutoAssignInsurerToGroup(option.id, report.insurerId);
              } else {
                await actionAutoAssignInsurerToTransfer(option.id, report.insurerId);
              }
            }
            
            // Vincular
            if (option.type === 'group') {
              formData.append('bank_group_ids', JSON.stringify([option.id]));
            } else {
              formData.append('bank_transfer_id', option.id);
            }
          }
        }
        
        // Get invert_negatives setting
        const invertNegatives = localStorage.getItem(`invert_negatives_${report.insurerId}`) === 'true';
        formData.append('invert_negatives', String(invertNegatives));
        
        const result = await actionUploadImport(formData);
        results.push(result);
        
        if (!result.ok) {
          allSuccess = false;
          console.error(`Error en reporte ${i + 1}:`, result.error);
          await showAlert(`Error en reporte ${i + 1} (${report.insurerName}): ${result.error}`, 'Error parcial', 'error');
          break;
        }
      }
      
      if (allSuccess) {
        await success(`✅ ${pendingReports.length} reportes importados exitosamente`, 'Importación Batch Completa');
        // Limpiar todo
        setPendingReports([]);
        setFile(null);
        setSelectedInsurer('');
        setTotalAmount('');
        setIsLifeInsurance(false);
        setSelectedOption('');
        
        // Recargar opciones bancarias (usa función centralizada)
        await loadBankOptions();
        
        onImport();
      }
    } catch (err) {
      console.error('Batch import error:', err);
      await showAlert(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`, 'Error', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si hay reportes pendientes, ejecutar import batch
    if (pendingReports.length > 0) {
      await handleImportAll();
      return;
    }
    
    console.log('=== IMPORT FORM SUBMIT (SINGLE) ===');
    console.log('File:', file?.name);
    console.log('Insurer:', selectedInsurer);
    console.log('Amount:', totalAmount);
    console.log('Fortnight ID:', draftFortnightId);
    
    if (!file) {
      await showAlert('Por favor seleccione un archivo', 'Falta archivo');
      return;
    }
    if (!selectedInsurer) {
      await showAlert('Por favor seleccione una aseguradora', 'Falta aseguradora');
      return;
    }
    if (!draftFortnightId) {
      await showAlert('Error: No hay quincena en borrador', 'Error');
      console.error('Missing draftFortnightId');
      return;
    }

    // Validación especial: Monto 0 sin transferencia = Reporte negativo para oficina
    const amountValue = parseFloat(totalAmount) || 0;
    if (amountValue === 0 && !selectedOption) {
      const confirmed = await new Promise<boolean>((resolve) => {
        const dialog = document.createElement('div');
        dialog.innerHTML = `
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full m-4">
              <div class="bg-gradient-to-r from-[#010139] to-[#020270] text-white px-6 py-4 rounded-t-2xl">
                <h3 class="text-lg font-bold">⚠️ Confirmar Reporte en Negativo</h3>
              </div>
              <div class="p-6">
                <div class="flex justify-center mb-4">
                  <svg class="text-orange-500 w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <div class="text-center mb-6">
                  <p class="text-gray-700 text-base mb-3">
                    El <strong>Total del Reporte es $0.00</strong> y no hay transferencia bancaria vinculada.
                  </p>
                  <p class="text-gray-700 text-base mb-3">
                    Esto significa que el reporte se registrará como <strong class="text-red-600">NEGATIVO para la oficina</strong>.
                  </p>
                  <p class="text-sm text-gray-600">
                    ¿Está seguro de que desea continuar?
                  </p>
                </div>
                <div class="flex gap-3 justify-center">
                  <button id="cancel-negative-btn" class="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-colors border border-gray-300">
                    Cancelar
                  </button>
                  <button id="confirm-negative-btn" class="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-all shadow-md hover:shadow-lg">
                    Sí, Continuar
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
        document.body.appendChild(dialog);
        
        const confirmBtn = dialog.querySelector('#confirm-negative-btn');
        const cancelBtn = dialog.querySelector('#cancel-negative-btn');
        
        confirmBtn?.addEventListener('click', () => {
          document.body.removeChild(dialog);
          resolve(true);
        });
        
        cancelBtn?.addEventListener('click', () => {
          document.body.removeChild(dialog);
          resolve(false);
        });
      });

      if (!confirmed) {
        return; // Usuario canceló la importación
      }
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('insurer_id', selectedInsurer);
    formData.append('total_amount', totalAmount);
    formData.append('fortnight_id', draftFortnightId);
    formData.append('is_life_insurance', String(isLifeInsurance));
    // Enviar transfer/grupo seleccionado si existe
    if (selectedOption) {
      const option = availableOptions.find(o => o.id === selectedOption);
      if (option) {
        if (option.type === 'group') {
          formData.append('bank_group_ids', JSON.stringify([option.id]));
        } else {
          formData.append('bank_transfer_id', option.id);
        }
      }
    }
    
    // Get invert_negatives setting from localStorage
    const invertNegatives = localStorage.getItem(`invert_negatives_${selectedInsurer}`) === 'true';
    formData.append('invert_negatives', String(invertNegatives));

    try {
      // Verificar si la transferencia está PENDIENTE y confirmar cambio a OK
      if (selectedOption) {
        const option = availableOptions.find(o => o.id === selectedOption);
        if (option && option.status === 'PENDIENTE' && option.type === 'transfer') {
          const confirmed = await new Promise<boolean>((resolve) => {
            const dialog = document.createElement('div');
            dialog.innerHTML = `
              <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div class="bg-white p-6 rounded-lg shadow-xl max-w-md">
                  <h3 class="text-lg font-bold text-[#010139] mb-3">⚠️ Transferencia Pendiente</h3>
                  <p class="text-sm text-gray-700 mb-2">
                    La transferencia seleccionada está en estado <strong>PENDIENTE</strong>.
                  </p>
                  <p class="text-sm text-gray-700 mb-4">
                    ¿Desea marcarla como <strong>REPORTADO</strong> temporalmente para esta quincena?
                  </p>
                  <p class="text-xs text-blue-600 mb-4">
                    💡 El cambio será temporal hasta que se confirme el pago de la quincena.
                  </p>
                  <div class="flex gap-3">
                    <button id="cancel-btn" class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">
                      Cancelar
                    </button>
                    <button id="confirm-btn" class="flex-1 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139]">
                      Sí, Marcar como REPORTADO
                    </button>
                  </div>
                </div>
              </div>
            `;
            document.body.appendChild(dialog);
            
            const confirmBtn = dialog.querySelector('#confirm-btn');
            const cancelBtn = dialog.querySelector('#cancel-btn');
            
            confirmBtn?.addEventListener('click', () => {
              document.body.removeChild(dialog);
              resolve(true);
            });
            
            cancelBtn?.addEventListener('click', () => {
              document.body.removeChild(dialog);
              resolve(false);
            });
          });
          
          if (!confirmed) {
            setUploading(false);
            return;
          }
          
          // Marcar como OK temporalmente
          const markResult = await actionMarkTransferAsOkTemporary(option.id, draftFortnightId);
          if (!markResult.ok) {
            await showAlert('Error al marcar transferencia como OK', 'Error');
            setUploading(false);
            return;
          }
        }
      }
      
      // Auto-asignar aseguradora a transferencia/grupo si no tiene asignada
      if (selectedOption && selectedInsurer) {
        const option = availableOptions.find(o => o.id === selectedOption);
        if (option && !option.hasInsurer) {
          console.log('[IMPORT] Auto-asignando aseguradora a', option.type, selectedOption);
          
          if (option.type === 'group') {
            await actionAutoAssignInsurerToGroup(option.id, selectedInsurer);
          } else {
            await actionAutoAssignInsurerToTransfer(option.id, selectedInsurer);
          }
        }
      }

      const result = await actionUploadImport(formData);
      
      if (result.ok) {
        await success('Importación exitosa', 'Éxito');
        setFile(null);
        setSelectedInsurer('');
        setTotalAmount('');
        setIsLifeInsurance(false);
        setSelectedOption('');
        // Recargar opciones disponibles (usa función centralizada)
        await loadBankOptions();
        onImport();
      } else {
        console.error('Import error:', result.error);
        await showAlert(`Error: ${result.error}`, 'Error en importación', 'error');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      await showAlert(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`, 'Error', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="import-form-container">
      <h3 className="section-title">1. Importar Reportes</h3>
      <form onSubmit={handleFileUpload} className="form-content">
        {/* BANCO: Selector de Transfer/Grupo - PRIMERO */}
        <div className="field">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <FaUniversity className="text-blue-600" />
            Vincular con Transferencia Bancaria (Opcional)
          </label>
          
          {loadingOptions ? (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-700">⏳ Cargando transferencias y grupos de Banco...</p>
            </div>
          ) : availableOptions.length === 0 ? (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 font-medium mb-2">
                ⚠️ No hay transferencias ni grupos disponibles
              </p>
              <p className="text-xs text-amber-700">
                Todas las transferencias están PAGADAS o importa un nuevo corte bancario desde BANCO
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                💡 <strong>Tip:</strong> Selecciona una transferencia o grupo para autocompletar el monto. 
                {selectedInsurer && ' Si la transferencia no tiene aseguradora, se asignará automáticamente al importar.'}
              </p>
              <select
                value={selectedOption}
                onChange={(e) => {
                  setSelectedOption(e.target.value);
                  const option = availableOptions.find(o => o.id === e.target.value);
                  if (option) {
                    // Auto-completar monto
                    setTotalAmount(option.amount.toFixed(2));
                    
                    // Auto-rellenar aseguradora si la transferencia/grupo ya tiene una asignada
                    if (option.hasInsurer && option.insurerName) {
                      const insurer = insurers.find(ins => ins.name === option.insurerName);
                      if (insurer) {
                        setSelectedInsurer(insurer.id);
                        console.log('[IMPORT] Auto-rellenando aseguradora:', insurer.name);
                      }
                    }
                  } else {
                    // Si deselecciona, limpiar
                    setTotalAmount('');
                  }
                }}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-all text-sm"
              >
                <option value="">🔹 Sin vincular (ingresar monto manualmente)</option>
                {availableOptions.filter(o => o.type === 'group').length > 0 && (
                  <optgroup label="📦 Grupos de Transferencias">
                    {availableOptions.filter(o => o.type === 'group').map(option => (
                      <option key={option.id} value={option.id}>
                        {option.name} - ${option.amount.toFixed(2)}
                        {option.status === 'PENDIENTE' ? ' ⏳' : option.status === 'EN_PROCESO' ? ' 🔄' : ''}
                        {option.hasInsurer ? ` [${option.insurerName}]` : ' [Sin aseguradora]'}
                      </option>
                    ))}
                  </optgroup>
                )}
                {availableOptions.filter(o => o.type === 'transfer').length > 0 && (() => {
                  // Agrupar transferencias por RANGO DE FECHA DEL CORTE (cutoffOrigin)
                  const transfersByCutoff = new Map<string, typeof availableOptions>();
                  availableOptions.filter(o => o.type === 'transfer').forEach(t => {
                    const cutoffKey = t.cutoffOrigin || 'Sin corte';
                    if (!transfersByCutoff.has(cutoffKey)) {
                      transfersByCutoff.set(cutoffKey, []);
                    }
                    transfersByCutoff.get(cutoffKey)!.push(t);
                  });
                  
                  // Ordenar cortes (más recientes primero)
                  const sortedCutoffs = Array.from(transfersByCutoff.keys()).sort((a, b) => {
                    if (a === 'Sin corte') return 1;
                    if (b === 'Sin corte') return -1;
                    // Comparar por fecha de inicio del corte
                    const dateA = a.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
                    const dateB = b.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
                    if (dateA && dateB) {
                      return new Date(dateB[0]).getTime() - new Date(dateA[0]).getTime();
                    }
                    return 0;
                  });
                  
                  return sortedCutoffs.map(cutoffLabel => (
                    <optgroup key={cutoffLabel} label={`📅 ${cutoffLabel}`}>
                      {transfersByCutoff.get(cutoffLabel)!.map(option => (
                        <option key={option.id} value={option.id}>
                          {option.name} - ${option.amount.toFixed(2)}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </select>
              {selectedOption && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-xs text-green-800">
                    ✅ <strong>Vinculado:</strong> El monto se ha autocompletado desde Banco
                    {selectedInsurer && !availableOptions.find(o => o.id === selectedOption)?.hasInsurer && (
                      <span className="block mt-1">
                        🔄 Al importar, se asignará automáticamente a <strong>{insurers.find(i => i.id === selectedInsurer)?.name}</strong>
                      </span>
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ASEGURADORA - Después de transferencia */}
        <div className="field">
          <label htmlFor="insurer">Aseguradora / Tipo de Reporte</label>
          <select
            id="insurer"
            value={selectedInsurer}
            onChange={(e) => setSelectedInsurer(e.target.value)}
            required
          >
            <option value="">Seleccionar...</option>
            <optgroup label="📋 Aseguradoras">
              {insurers.map((ins) => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </optgroup>
            <optgroup label="🔢 Reportes Especiales">
              <option value="ASSA_CODIGOS">Códigos ASSA (PJ750-xxx)</option>
            </optgroup>
          </select>
          {selectedOption && availableOptions.find(o => o.id === selectedOption)?.hasInsurer && (
            <p className="text-xs text-green-700 mt-2 bg-green-50 border border-green-200 rounded p-2">
              ✅ Auto-rellenado desde la transferencia bancaria
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor="totalAmount">Monto Total del Reporte</label>
          <input
            id="totalAmount"
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00 (opcional si vinculas transferencia)"
            step="0.01"
            min="0"
          />
          <p className="help-text mt-1">
            Puedes dejar en 0.00 si es un reporte con descuentos que no requiere transferencia
          </p>
        </div>

        {/* Show checkbox only for ASSA or ASSA_CODIGOS - UI mejorada */}
        {(insurers.find(i => i.id === selectedInsurer)?.name === 'ASSA' || selectedInsurer === 'ASSA_CODIGOS') && (
          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="flex items-center h-6">
                <input
                  type="checkbox"
                  checked={isLifeInsurance}
                  onChange={(e) => setIsLifeInsurance(e.target.checked)}
                  className="w-5 h-5 text-purple-600 bg-white border-2 border-purple-300 rounded focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 cursor-pointer"
                />
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-purple-900 block group-hover:text-purple-700 transition-colors">
                  ❤️ Este es un reporte de Vida
                </span>
                <span className="text-xs text-purple-600 block mt-1">
                  Marca esta opción si el reporte corresponde a PJ750 o PJ750-6 (Seguros de Vida)
                </span>
              </div>
            </label>
          </div>
        )}

        <div className="dropzone" onClick={() => document.getElementById('file-upload')?.click()}>
          <FaUpload className="dropzone-icon" />
          <p className="dropzone-label">
            {file ? file.name : 'Click para seleccionar archivo (CSV, Excel, PDF, Imagen)'}
          </p>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              console.log('File selected:', selectedFile?.name);
              setFile(selectedFile || null);
            }}
            style={{ display: 'none' }}
          />
        </div>

        {/* Botones de Agregar y Importar */}
        <div className="flex gap-3">
          {/* Botón + para agregar reporte al batch */}
          <button
            type="button"
            onClick={handleAddReport}
            disabled={!file || !selectedInsurer}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-semibold shadow-md"
          >
            <FaPlus size={16} />
            Agregar Reporte
          </button>
          
          {/* Botón Importar */}
          <button 
            type="submit" 
            disabled={uploading || (pendingReports.length === 0 && (!file || !selectedInsurer))} 
            className="flex-1 btn-primary"
          >
            {uploading ? 'Importando...' : pendingReports.length > 0 ? `Importar ${pendingReports.length} Reporte${pendingReports.length > 1 ? 's' : ''}` : 'Importar Archivo'}
          </button>
        </div>

        {/* Lista de reportes pendientes */}
        {pendingReports.length > 0 && (
          <div className="mt-4 bg-white border-2 border-blue-300 rounded-lg p-4">
            <h4 className="text-sm font-bold text-[#010139] mb-3 flex items-center gap-2">
              <FaFileAlt className="text-blue-600" />
              Reportes en cola ({pendingReports.length})
              {selectedOption && (
                <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                  📦 Vinculados a transferencia
                </span>
              )}
            </h4>
            <div className="space-y-2">
              {pendingReports.map((report, index) => (
                <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-800">{report.insurerName}</p>
                    <p className="text-xs text-gray-600">{report.file.name}</p>
                    {report.isLife && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                        ❤️ Vida
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveReport(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Eliminar del batch"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3 bg-blue-50 p-2 rounded border border-blue-200">
              💡 <strong>Tip:</strong> Al importar, todos estos reportes se procesarán en secuencia. La transferencia se marcará como usada solo después del último reporte.
            </p>
          </div>
        )}
      </form>

      <style>{`
        .import-form-container {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 24px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 16px;
        }
        .form-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .grid-fields {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        
        .checkbox-field {
          margin: 1rem 0;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        
        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .checkbox-label span {
          font-size: 14px;
          color: #4B5563;
        }
        .field label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #344054;
        }
        .field select, .field input {
          width: 100%;
          padding: 10px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
        }
        .dropzone {
          border: 2px dashed #d0d5dd;
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .dropzone:hover {
          border-color: #010139;
        }
        .dropzone-icon {
          color: #8aaa19;
          font-size: 24px;
          margin-bottom: 12px;
        }
        .dropzone-label {
          color: #475467;
          font-weight: 500;
        }
        .btn-primary {
          padding: 12px 24px;
          background: #010139;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary:hover {
          background: #8aaa19;
        }
        .btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        .groups-list {
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          padding: 12px;
          max-height: 200px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .group-checkbox {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .group-checkbox:hover {
          background: #f3f4f6;
        }
        .group-checkbox input[type="checkbox"] {
          width: 18px;
          height: 18px;
        }
        .group-name {
          flex: 1;
          font-size: 14px;
          color: #374151;
        }
        .group-amount {
          font-size: 14px;
          font-weight: 600;
          color: #8aaa19;
        }
        .help-text {
          margin-top: 8px;
          font-size: 12px;
          color: #6b7280;
        }
      `}</style>
      
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
