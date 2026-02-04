'use client';

import { useState } from 'react';
import { FaTimes, FaFileExcel, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';
import { parseBankHistoryFile, validateBankFile } from '@/lib/checks/bankParser';
import type { BankTransferRow } from '@/lib/checks/bankParser';
import { actionImportBankHistoryXLSX, actionValidateReferences } from '@/app/(app)/checks/actions';

interface ImportBankHistoryModalNewProps {
  onClose: () => void;
  onSuccess: () => void;
}

type PreviewRow = BankTransferRow & {
  cleanedDescription: string;
  errors: string[];
  existsInDb: boolean;
};

const DESCRIPTION_PREFIXES = [
  'BANCA MOVIL TRANSFERENCIA DE ',
  'ACH - ',
  'BANCA EN LINEA TRANSFERENCIA A ',
  'ACH EXPRESS - '
];

const cleanDescription = (raw: string): string => {
  if (!raw) return '';
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const upper = normalized.toUpperCase();
  for (const prefix of DESCRIPTION_PREFIXES) {
    if (upper.startsWith(prefix)) {
      return normalized.substring(prefix.length).trim();
    }
  }
  return normalized;
};

export default function ImportBankHistoryModalNew({ onClose, onSuccess }: ImportBankHistoryModalNewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [hasBlockingIssues, setHasBlockingIssues] = useState(false);
  const [summary, setSummary] = useState<{ 
    duplicateRefsInFile: number; // Referencias únicas duplicadas en archivo
    duplicateRowsInFile: number; // Total de filas afectadas por duplicados en archivo
    duplicateRefsInDb: number;   // Referencias únicas que ya existen en BD
    duplicateRowsInDb: number;   // Total de filas que serán omitidas por existir en BD
  }>({
    duplicateRefsInFile: 0,
    duplicateRowsInFile: 0,
    duplicateRefsInDb: 0,
    duplicateRowsInDb: 0,
  });
  const [showPreview, setShowPreview] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file
    const validation = validateBankFile(selectedFile);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      console.log('[IMPORT] Parseando archivo para preview...');
      const transfers = await parseBankHistoryFile(selectedFile);
      console.log('[IMPORT] Transferencias parseadas:', transfers.length);
      console.log('[IMPORT] Primera transferencia:', transfers[0]);

      if (transfers.length === 0) {
        toast.warning('No se encontraron transferencias en el archivo');
        setFile(null);
        setPreview([]);
        setShowPreview(false);
        setHasBlockingIssues(false);
        setSummary({ duplicateRefsInFile: 0, duplicateRowsInFile: 0, duplicateRefsInDb: 0, duplicateRowsInDb: 0 });
        setLoading(false);
        return;
      }

      const analyzed = await analyzeTransfers(transfers);
      setPreview(analyzed);
      setShowPreview(true);
      console.log('[IMPORT] Preview seteado, showPreview:', true);
      toast.success(`${transfers.length} transferencias encontradas`);
    } catch (error: any) {
      console.error('[IMPORT] Error al parsear:', error);
      toast.error('Error al procesar archivo', { description: error.message });
      setPreview([]);
      setShowPreview(false);
      setHasBlockingIssues(false);
      setSummary({ duplicateRefsInFile: 0, duplicateRowsInFile: 0, duplicateRefsInDb: 0, duplicateRowsInDb: 0 });
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const analyzeTransfers = async (transfers: BankTransferRow[]): Promise<PreviewRow[]> => {
    const counts = transfers.reduce<Record<string, number>>((acc, item) => {
      const key = item.reference_number.trim();
      if (!acc[key]) acc[key] = 0;
      acc[key] += 1;
      return acc;
    }, {});

    // Referencias duplicadas en el archivo
    const duplicatedRefsInFile = Object.entries(counts)
      .filter(([ref, count]) => ref && count > 1)
      .map(([ref]) => ref);
    
    // Total de filas afectadas por duplicados en archivo (contar todas las ocurrencias de refs duplicadas)
    const totalDuplicateRowsInFile = duplicatedRefsInFile.reduce((total, ref) => total + (counts[ref] || 0), 0);

    let existingRefs = new Set<string>();
    try {
      const validation = await actionValidateReferences(
        transfers.map((t) => t.reference_number).filter((ref) => !!ref)
      );
      if (validation.ok && Array.isArray(validation.data)) {
        existingRefs = new Set(
          validation.data
            .filter((item: any) => item.exists)
            .map((item: any) => item.reference_number)
        );
      }
    } catch (error) {
      console.error('Error validando referencias con histórico:', error);
      toast.error('No se pudo validar referencias contra el histórico');
    }

    const rows: PreviewRow[] = transfers.map((transfer) => {
      const cleanedDescription = cleanDescription(transfer.description);
      const errors: string[] = [];

      const amount = Number(transfer.amount);
      const reference = transfer.reference_number.trim();
      const parsedDate = new Date(transfer.date);

      if (!reference) errors.push('Referencia vacía');
      if (!transfer.date || Number.isNaN(parsedDate.getTime())) errors.push('Fecha inválida');
      if (!Number.isFinite(amount) || amount <= 0) errors.push('Monto inválido');
      if (duplicatedRefsInFile.includes(reference)) errors.push('Referencia duplicada en archivo');
      if (existingRefs.has(reference)) errors.push('Referencia ya existe en histórico');

      return {
        ...transfer,
        amount,
        reference_number: reference,
        cleanedDescription,
        existsInDb: existingRefs.has(reference),
        errors,
      };
    });

    // Contar filas que serán omitidas por existir en BD
    const rowsExistingInDb = rows.filter(row => existingRefs.has(row.reference_number)).length;
    
    setSummary({ 
      duplicateRefsInFile: duplicatedRefsInFile.length,
      duplicateRowsInFile: totalDuplicateRowsInFile,
      duplicateRefsInDb: existingRefs.size,
      duplicateRowsInDb: rowsExistingInDb
    });
    setHasBlockingIssues(rows.some((row) => row.errors.length > 0));

    return rows;
  };

  const handleImport = async () => {
    if (!file) return;
    if (hasBlockingIssues || preview.length === 0) {
      toast.error('Corrige los errores antes de confirmar la importación');
      return;
    }

    setLoading(true);
    try {
      const sanitized = preview.map((row) => ({
        date: new Date(row.date),
        reference_number: row.reference_number,
        transaction_code: row.transaction_code,
        description: row.cleanedDescription,
        amount: row.amount,
      }));

      const importResult = await actionImportBankHistoryXLSX(sanitized);

      if (importResult.ok && importResult.data) {
        setResult(importResult.data);
        toast.success(importResult.data.message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      } else {
        console.error('Error en importación:', importResult.error);
        toast.error('Error al importar', { description: importResult.error });
      }
    } catch (error: any) {
      console.error('Error inesperado:', error);
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
        className="bg-white rounded-2xl max-w-4xl w-full my-8 shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold">Importar Historial de Banco</h2>
            <p className="text-white/80 text-sm mt-1">Archivo Excel del Banco General</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!showPreview && !result && (
            <>
              {/* Upload Zone */}
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-[#8AAA19] transition-all bg-gradient-to-br from-gray-50 to-white">
                <FaFileExcel className="text-[#010139] text-6xl mx-auto mb-4" />
                <label className="cursor-pointer">
                  <span className="text-lg font-medium text-gray-900 block mb-2">
                    {file ? file.name : 'Click para seleccionar archivo Excel'}
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
                  <li>• Descarga el estado de cuenta desde Banco General</li>
                  <li>• El sistema detecta automáticamente las columnas</li>
                  <li>• Los duplicados se omiten automáticamente (se mantienen registros antiguos)</li>
                  <li>• Solo se importan transferencias recibidas (Crédito)</li>
                </ul>
              </div>
            </>
          )}

          {showPreview && !result && (
            <>
              {/* Preview */}
              <div className="mb-6">
                <div className="flex flex-col gap-3 mb-4">
                  <h3 className="text-lg font-bold text-[#010139]">Vista Previa - Primeras 10 transferencias</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="font-semibold text-yellow-800 mb-1">⚠️ Duplicados en archivo</div>
                      <div className="text-yellow-700">
                        {summary.duplicateRefsInFile > 0 ? (
                          <>
                            <strong>{summary.duplicateRowsInFile}</strong> fila{summary.duplicateRowsInFile !== 1 ? 's' : ''} con 
                            <strong> {summary.duplicateRefsInFile}</strong> referencia{summary.duplicateRefsInFile !== 1 ? 's' : ''} repetida{summary.duplicateRefsInFile !== 1 ? 's' : ''}
                          </>
                        ) : (
                          'Sin duplicados en archivo'
                        )}
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="font-semibold text-blue-800 mb-1">ℹ️ Ya existen en histórico</div>
                      <div className="text-blue-700">
                        {summary.duplicateRefsInDb > 0 ? (
                          <>
                            <strong>{summary.duplicateRowsInDb}</strong> fila{summary.duplicateRowsInDb !== 1 ? 's' : ''} con 
                            <strong> {summary.duplicateRefsInDb}</strong> referencia{summary.duplicateRefsInDb !== 1 ? 's' : ''} existente{summary.duplicateRefsInDb !== 1 ? 's' : ''}
                          </>
                        ) : (
                          'Todas son transferencias nuevas'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {hasBlockingIssues && (
                  <div className="mb-4 p-4 rounded-lg border-l-4 border-red-500 bg-red-50 text-sm">
                    <div className="font-bold text-red-800 mb-2">❌ No se puede importar</div>
                    <div className="text-red-700">
                      {summary.duplicateRefsInFile > 0 && (
                        <div className="mb-2">
                          • <strong>{summary.duplicateRowsInFile}</strong> fila{summary.duplicateRowsInFile !== 1 ? 's tienen' : ' tiene'} referencias duplicadas en el archivo. 
                          Solo debe haber una fila por cada número de referencia.
                        </div>
                      )}
                      {summary.duplicateRefsInDb > 0 && (
                        <div>
                          • <strong>{summary.duplicateRowsInDb}</strong> fila{summary.duplicateRowsInDb !== 1 ? 's' : ''} ya existe{summary.duplicateRowsInDb !== 1 ? 'n' : ''} en el histórico. 
                          Estas transferencias ya fueron importadas previamente.
                        </div>
                      )}
                      {preview.some(r => r.errors.some(e => !e.includes('duplicad') && !e.includes('existe'))) && (
                        <div className="mt-2">
                          • Hay filas con datos inválidos (fechas, montos o referencias vacías).
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-left">Referencia</th>
                        <th className="px-4 py-2 text-left">Descripción</th>
                        <th className="px-4 py-2 text-right">Monto</th>
                        <th className="px-4 py-2 text-left">Observaciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((row, idx) => (
                        <tr
                          key={idx}
                          className={`border-t ${row.errors.length > 0 ? 'bg-red-50 border-red-200' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-2">{new Date(row.date).toLocaleDateString('es-PA')}</td>
                          <td className="px-4 py-2 font-mono">{row.reference_number}</td>
                          <td className="px-4 py-2 text-xs">
                            <div className="font-medium text-gray-800">{row.cleanedDescription || row.description}</div>
                            {row.cleanedDescription !== row.description && row.description && (
                              <div className="text-[11px] text-gray-500">Original: {row.description}</div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-bold text-[#8AAA19]">
                            ${row.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-xs">
                            {row.errors.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-[#8AAA19]">
                                <FaCheckCircle /> Sin observaciones
                              </span>
                            ) : (
                              <ul className="list-disc list-inside space-y-1 text-red-600">
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
              disabled={loading || hasBlockingIssues || preview.length === 0}
              className="px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
            >
              {hasBlockingIssues
                ? 'Existen errores'
                : loading
                  ? 'Importando...'
                  : 'Confirmar Importación'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
