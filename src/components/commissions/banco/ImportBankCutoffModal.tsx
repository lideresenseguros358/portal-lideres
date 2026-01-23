'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaFileExcel, FaCheckCircle, FaCalendar, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';
import { parseBankCommFile, validateBankCommFile, normalizeDescription } from '@/lib/banco/bancoParser';
import type { BankTransferCommRow } from '@/lib/banco/bancoParser';
import { actionImportBankCutoff } from '@/app/(app)/commissions/banco-actions';

interface ImportBankCutoffModalProps {
  onClose: () => void;
  onSuccess: () => void;
  lastCutoffInfo: any;
  existingCutoffs: any[]; // Para validar duplicados
}

type PreviewRow = BankTransferCommRow & {
  normalizedDescription: string;
  errors: string[];
};

const QUINCENAS = ['PRIMERA', 'SEGUNDA'] as const;
const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
] as const;

const getCurrentYear = () => new Date().getFullYear();
const getYearOptions = () => {
  const currentYear = getCurrentYear();
  return [currentYear - 1, currentYear, currentYear + 1];
};

export default function ImportBankCutoffModal({ onClose, onSuccess, lastCutoffInfo, existingCutoffs }: ImportBankCutoffModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  // Fechas del corte
  const [startDate, setStartDate] = useState(lastCutoffInfo?.suggestedStart || '');
  const [endDate, setEndDate] = useState(lastCutoffInfo?.suggestedEnd || '');
  
  // Componentes de la nota estandarizada
  const [quincena, setQuincena] = useState<typeof QUINCENAS[number]>('PRIMERA');
  const [mes, setMes] = useState<typeof MESES[number]>('ENERO');
  const [año, setAño] = useState<number>(getCurrentYear());
  
  // Estado de validación
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [notes, setNotes] = useState('');

  // Actualizar notes cuando cambian los selectores
  useEffect(() => {
    const generatedNotes = `${quincena} DE ${mes} ${año}`;
    setNotes(generatedNotes);
    
    // Validar si ya existe
    const duplicate = existingCutoffs.some(cutoff => 
      cutoff.notes?.toUpperCase() === generatedNotes.toUpperCase()
    );
    setIsDuplicate(duplicate);
  }, [quincena, mes, año, existingCutoffs]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = validateBankCommFile(selectedFile);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      const transfers = await parseBankCommFile(selectedFile);

      if (transfers.length === 0) {
        toast.warning('No se encontraron transferencias válidas en el archivo');
        setFile(null);
        setPreview([]);
        setShowPreview(false);
        setLoading(false);
        return;
      }

      // Analizar transferencias
      const analyzed: PreviewRow[] = transfers.map(transfer => {
        const normalizedDescription = normalizeDescription(transfer.description);
        const errors: string[] = [];

        if (!transfer.reference_number) errors.push('Sin referencia');
        if (!transfer.date) errors.push('Sin fecha');
        if (transfer.credit <= 0) errors.push('Monto inválido');

        return {
          ...transfer,
          normalizedDescription,
          errors,
        };
      });

      setPreview(analyzed);
      setShowPreview(true);
      toast.success(`${transfers.length} transferencias encontradas`);
    } catch (error: any) {
      toast.error('Error al procesar archivo', { description: error.message });
      setPreview([]);
      setShowPreview(false);
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !startDate || !endDate) {
      toast.error('Completa todos los campos requeridos');
      return;
    }
    
    if (isDuplicate) {
      toast.error('Este corte ya fue ingresado anteriormente');
      return;
    }

    if (preview.length === 0) {
      toast.error('No hay transferencias para importar');
      return;
    }

    const hasErrors = preview.some(p => p.errors.length > 0);
    if (hasErrors) {
      toast.error('Corrige los errores antes de importar');
      return;
    }

    setLoading(true);

    try {
      const result = await actionImportBankCutoff(startDate, endDate, notes, preview);

      if (result.ok && result.data) {
        setResult(result.data);
        toast.success(`Corte importado: ${result.data.imported} nuevas, ${result.data.skipped} duplicados`);
        
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        toast.error('Error al importar', { description: result.error });
      }
    } catch (error: any) {
      toast.error('Error inesperado', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-5xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Importar Corte Bancario</h2>
            <p className="text-white/80 text-sm mt-1">Extracto del Banco General para comisiones</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!showPreview && !result && (
            <>
              {/* Fechas del corte */}
              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="w-full max-w-full overflow-hidden">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaCalendar className="inline mr-2" />
                    Fecha Inicio *
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full max-w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19] text-sm sm:text-base"
                    style={{ WebkitAppearance: 'none' }}
                    required
                  />
                </div>

                <div className="w-full max-w-full overflow-hidden">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FaCalendar className="inline mr-2" />
                    Fecha Fin *
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full max-w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19] text-sm sm:text-base"
                    style={{ WebkitAppearance: 'none' }}
                    required
                  />
                </div>
              </div>

              {/* Selector de Quincena Estandarizado */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  📝 Identificador del Corte *
                </label>
                <p className="text-xs text-gray-600 mb-3">
                  Selecciona la quincena, mes y año para generar automáticamente el identificador
                </p>
                
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Quincena</label>
                    <select
                      value={quincena}
                      onChange={(e) => setQuincena(e.target.value as typeof QUINCENAS[number])}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19] text-sm font-medium"
                    >
                      {QUINCENAS.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Mes</label>
                    <select
                      value={mes}
                      onChange={(e) => setMes(e.target.value as typeof MESES[number])}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19] text-sm font-medium"
                    >
                      {MESES.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Año</label>
                    <select
                      value={año}
                      onChange={(e) => setAño(Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-[#8AAA19] text-sm font-medium"
                    >
                      {getYearOptions().map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Preview del identificador */}
                <div className={`mt-3 p-3 rounded-lg border-2 ${
                  isDuplicate 
                    ? 'bg-red-50 border-red-300' 
                    : 'bg-blue-50 border-blue-300'
                }`}>
                  <p className="text-xs text-gray-600 mb-1">Identificador generado:</p>
                  <p className={`font-bold text-sm ${
                    isDuplicate ? 'text-red-700' : 'text-blue-900'
                  }`}>
                    {notes}
                  </p>
                  {isDuplicate && (
                    <div className="flex items-start gap-2 mt-2 text-red-700">
                      <FaExclamationTriangle className="text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-xs font-semibold">
                        Este corte ya fue ingresado, por favor ingrese uno distinto
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Zone */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-[#8AAA19] transition-all bg-gradient-to-br from-gray-50 to-white">
                <FaFileExcel className="text-[#010139] text-6xl mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-lg font-medium text-gray-900 block mb-2">
                    {file ? file.name : 'Click para seleccionar extracto bancario'}
                  </span>
                  <span className="text-sm text-gray-500">
                    {loading ? 'Procesando...' : 'Formato: .xlsx, .xls o .csv'}
                  </span>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={loading}
                  />
                </label>
              </div>

              {/* Instructions */}
              <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <h3 className="font-bold text-blue-900 mb-2">📌 Instrucciones</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Define el rango de fechas del corte (día cerrado, no incluye "hoy")</li>
                  <li>• El sistema extrae: Fecha, Referencia 1, Descripción, Crédito</li>
                  <li>• Filas con Crédito = 0.00 se ignoran automáticamente</li>
                  <li>• Transferencias de LIDERES EN SEGUROS se filtran</li>
                  <li>• Referencias duplicadas se omiten (prioriza registros antiguos)</li>
                </ul>
              </div>
            </>
          )}

          {showPreview && !result && (
            <>
              {/* Preview */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-[#010139] mb-4">
                  Vista Previa - Primeras 10 transferencias
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-left">Referencia</th>
                        <th className="px-4 py-2 text-left">Descripción</th>
                        <th className="px-4 py-2 text-right">Crédito</th>
                        <th className="px-4 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((row, idx) => (
                        <tr
                          key={idx}
                          className={`border-t ${row.errors.length > 0 ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-2">{new Date(row.date).toLocaleDateString('es-PA')}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.reference_number}</td>
                          <td className="px-4 py-2 text-xs">
                            <div className="font-medium text-gray-800">{row.normalizedDescription}</div>
                            {row.normalizedDescription !== row.description && (
                              <div className="text-[11px] text-gray-500">RAW: {row.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-[#8AAA19]">
                            ${row.credit.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {row.errors.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[#8AAA19]">
                                <FaCheckCircle /> OK
                              </span>
                            ) : (
                              <ul className="list-disc list-inside text-red-600">
                                {row.errors.map((error, i) => (
                                  <li key={i}>{error}</li>
                                ))}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  <p>Total de transferencias: <strong>{preview.length}</strong></p>
                  {preview.length > 10 && <p className="text-gray-500">Mostrando primeras 10 de {preview.length}</p>}
                </div>
              </div>
            </>
          )}

          {result && (
            <div className="text-center py-8">
              <FaCheckCircle className="text-green-600 text-6xl mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-[#010139] mb-4">Importación Completada</h3>
              <div className="bg-gray-50 rounded-xl p-6 max-w-md mx-auto">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-gray-600">Nuevas transferencias:</span>
                  <span className="font-bold text-green-600 text-xl">{result.imported}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Duplicados omitidos:</span>
                  <span className="font-bold text-gray-600 text-xl">{result.skipped}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-4">Cerrando automáticamente...</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {showPreview && !result && (
          <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between rounded-b-2xl flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-6 py-2 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            
            <button
              type="button"
              onClick={handleImport}
              disabled={loading || preview.some(p => p.errors.length > 0)}
              className="px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
            >
              {loading ? 'Importando...' : `Confirmar Importación (${preview.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
