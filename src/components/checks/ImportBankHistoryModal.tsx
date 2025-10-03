'use client';

import { useState } from 'react';
import { FaTimes, FaFileExcel, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';
import { toast } from 'sonner';
import { parseBankHistoryFile, validateBankFile } from '@/lib/checks/bankParser';
import { actionImportBankHistoryXLSX } from '@/app/(app)/checks/actions';

interface ImportBankHistoryModalNewProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportBankHistoryModalNew({ onClose, onSuccess }: ImportBankHistoryModalNewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
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
        setLoading(false);
        return;
      }
      
      setPreview(transfers.slice(0, 10)); // Show first 10
      setShowPreview(true);
      console.log('[IMPORT] Preview seteado, showPreview:', true);
      toast.success(`${transfers.length} transferencias encontradas`);
    } catch (error: any) {
      console.error('[IMPORT] Error al parsear:', error);
      toast.error('Error al procesar archivo', { description: error.message });
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    try {
      console.log('Parseando archivo...');
      const transfers = await parseBankHistoryFile(file);
      console.log('Transferencias parseadas:', transfers.length);
      
      if (transfers.length === 0) {
        toast.error('No se encontraron transferencias válidas en el archivo');
        setLoading(false);
        return;
      }
      
      console.log('Llamando a action importar...');
      const importResult = await actionImportBankHistoryXLSX(
        transfers.map((t) => ({
          ...t,
          date: new Date(t.date),
        }))
      );
      console.log('Resultado:', importResult);

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Importar Historial de Banco</h2>
            <p className="text-white/80 text-sm mt-1">Archivo Excel del Banco General</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition">
            <FaTimes size={24} />
          </button>
        </div>

        <div className="p-8">
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
                <h3 className="text-lg font-bold text-[#010139] mb-4">Vista Previa - Primeras 10 transferencias</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-left">Referencia</th>
                        <th className="px-4 py-2 text-left">Descripción</th>
                        <th className="px-4 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((t, idx) => (
                        <tr key={idx} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2">{new Date(t.date).toLocaleDateString('es-PA')}</td>
                          <td className="px-4 py-2 font-mono">{t.reference_number}</td>
                          <td className="px-4 py-2 text-xs">{t.description}</td>
                          <td className="px-4 py-2 text-right font-bold text-[#8AAA19]">
                            ${t.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setShowPreview(false);
                    setFile(null);
                    setPreview([]);
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50"
                >
                  {loading ? 'Importando...' : 'Confirmar Importación'}
                </button>
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
      </div>
    </div>
  );
}
