"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaDownload, FaUpload, FaCheckCircle, FaExclamationTriangle, FaFileAlt, FaEye, FaEyeSlash, FaInfoCircle, FaChevronDown, FaChevronUp } from "react-icons/fa";
import Link from "next/link";
import Papa from "papaparse";
// import { actionImportClientsCSV } from "../actions"; // DEPRECADO - Usar ImportModal.tsx
import { toast } from "sonner";
import { normalizeText } from '@/lib/utils/normalize-text';

interface ParsedRow {
  client_name: string;
  national_id?: string;
  email?: string;
  phone?: string;
  address?: string;
  policy_number: string;
  insurer_name: string;
  ramo?: string;
  start_date?: string;
  renewal_date?: string;
  status?: string;
  broker_email: string;
  percent_override?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  data: ParsedRow;
}

export default function ImportPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showCsvDuplicates, setShowCsvDuplicates] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [errorRows, setErrorRows] = useState<ValidationError[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [insurers, setInsurers] = useState<string[]>([]);
  const [showInsurers, setShowInsurers] = useState(false);

  // Cargar aseguradoras al montar el componente
  useEffect(() => {
    async function loadInsurers() {
      try {
        const response = await fetch('/api/insurers');
        const data = await response.json();
        if (data.success && data.insurers) {
          const names = data.insurers
            .filter((ins: any) => ins.is_active)
            .map((ins: any) => ins.name)
            .sort();
          setInsurers(names);
        }
      } catch (error) {
        console.error('Error cargando aseguradoras:', error);
      }
    }
    loadInsurers();
  }, []);

  const downloadTemplate = () => {
    window.open('/plantilla_clientes.csv', '_blank');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        validateRows(results.data as any[]);
        setLoading(false);
        setShowPreview(true);
      },
      error: (error) => {
        toast.error('Error al leer el archivo', { description: error.message });
        setLoading(false);
      }
    });
  };

  const validateRows = (rows: any[]) => {
    const valid: ParsedRow[] = [];
    const errors: ValidationError[] = [];

    rows.forEach((row, index) => {
      const rowErrors: string[] = [];
      
      if (!row.client_name || row.client_name.trim() === '') {
        rowErrors.push('Nombre de cliente obligatorio');
      }
      if (!row.policy_number || row.policy_number.trim() === '') {
        rowErrors.push('Número de póliza obligatorio');
      }
      if (!row.insurer_name || row.insurer_name.trim() === '') {
        rowErrors.push('Nombre de aseguradora obligatorio');
      }
      if (!row.broker_email || row.broker_email.trim() === '') {
        rowErrors.push('Email de broker obligatorio');
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: index + 2,
          field: 'multiple',
          message: rowErrors.join(', '),
          data: row
        });
      } else {
        valid.push({
          client_name: normalizeText(row.client_name?.trim() || ''),
          national_id: row.national_id?.trim() || undefined,
          email: row.email?.trim() || undefined,
          phone: row.phone?.trim() || undefined,
          address: normalizeText(row.address?.trim() || '') || undefined,
          policy_number: row.policy_number?.trim(),
          insurer_name: normalizeText(row.insurer_name?.trim() || ''),
          ramo: normalizeText(row.ramo?.trim() || '') || undefined,
          start_date: row.start_date?.trim() || undefined,
          renewal_date: row.renewal_date?.trim() || undefined,
          status: row.status?.trim() || 'active',
          broker_email: row.broker_email?.trim(),
          percent_override: row.percent_override?.trim() || undefined,
        });
      }
    });

    setValidRows(valid);
    setErrorRows(errors);
  };

  const handleImport = async () => {
    console.log('[IMPORT] handleImport iniciado');
    console.log('[IMPORT] validRows:', validRows.length);
    console.log('[IMPORT] file:', file);
    
    if (validRows.length === 0 || !file) {
      console.log('[IMPORT] Abortado: no hay filas válidas o no hay archivo');
      return;
    }
    
    setLoading(true);
    setImportProgress(0);
    
    const formData = new FormData();
    formData.append("file", file);
    
    // Polling para obtener progreso real del servidor
    const startTime = Date.now();
    const pollInterval = setInterval(() => {
      // Incrementar progreso gradualmente mientras esperamos
      setImportProgress((prev) => {
        if (prev >= 95) return 95; // No pasar del 95% hasta que termine
        return prev + 1;
      });
    }, 1000); // 1% por segundo hasta 95%
    
    try {
      console.log('[IMPORT] Enviando request a /api/db/import');
      const response = await fetch("/api/db/import", {
        method: "POST",
        body: formData,
      });
      console.log('[IMPORT] Response recibido:', response.status);
      
      // Limpiar intervalo cuando termina
      clearInterval(pollInterval);

      const data = await response.json();
      console.log('[IMPORT] Data:', data);
      console.log('[IMPORT] SUCCESS:', data.success);
      console.log('[IMPORT] ERRORS:', data.errors?.length || 0);
      console.log('[IMPORT] EXCLUDED:', data.excluded?.length || 0);
      console.log('[IMPORT] TOTAL GROUPS:', data.totalGroups);
      console.log('[IMPORT] PROCESSED:', data.processed);
      
      // DEBUG: Verificar duplicados
      if (data.errors && data.errors.length > 0) {
        const duplicates = data.errors.filter((e: any) => e.isDuplicate);
        const realErrors = data.errors.filter((e: any) => !e.isDuplicate);
        console.log('[IMPORT] DUPLICADOS:', duplicates.length);
        console.log('[IMPORT] ERRORES REALES:', realErrors.length);
        console.log('[IMPORT] PRIMEROS 5 ERRORES:');
        data.errors.slice(0, 5).forEach((error: any, idx: number) => {
          console.log(`  Error ${idx + 1}:`, error);
        });
      }
      
      // Siempre mostrar resultado (con o sin errores)
      setImportResult(data);
      setImportProgress(100);
      
      // Pequeño delay para que se vea el 100% antes del modal
      setTimeout(() => {
        setShowResultModal(true);
        setLoading(false);
        setImportProgress(0);
      }, 500);
      
      if (data.success && data.success > 0) {
        toast.success('Importación completada', {
          description: `${data.success} clientes importados`
        });
      } else {
        toast.error('Error en la importación', {
          description: data.error || 'No se pudieron importar registros'
        });
      }
    } catch (error) {
      clearInterval(pollInterval); // Limpiar intervalo en caso de error
      console.error('[IMPORT] Error al importar:', error);
      setLoading(false);
      setImportProgress(0);
      toast.error('Error al importar', {
        description: error instanceof Error ? error.message : 'Error desconocido'
      });
    } finally {
      // El loading se desactiva en el setTimeout después de mostrar el modal
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/db" 
          className="inline-flex items-center text-[#010139] hover:text-[#8aaa19] mb-4"
        >
          <FaArrowLeft className="mr-2" />
          Volver a Base de Datos
        </Link>
        
        <h1 className="text-3xl font-bold text-[#010139]">Importar Clientes y Pólizas</h1>
        <p className="text-gray-600 mt-2">
          Carga un archivo CSV para importar múltiples clientes y sus pólizas
        </p>
      </div>

      {/* Instructions */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-[#010139] rounded-xl p-6 mb-6 shadow-lg">
        <h2 className="font-bold text-[#010139] text-lg mb-4 flex items-center gap-2">
          <FaFileAlt className="text-xl" />
          📋 Instrucciones para Importar
        </h2>
        
        <div className="space-y-4">
          {/* Paso 1 */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="font-semibold text-[#010139] mb-2">1️⃣ Descarga la Plantilla</p>
            <p className="text-sm text-gray-700">Descarga el archivo CSV de ejemplo haciendo clic en el botón de abajo. Este archivo ya tiene las columnas correctas.</p>
          </div>

          {/* Paso 2 */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="font-semibold text-[#010139] mb-2">2️⃣ Completa TODOS los Datos</p>
            <p className="text-sm text-gray-700 mb-2">Debes llenar TODAS las columnas para cada cliente y póliza:</p>
            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
              <div className="bg-blue-50 p-2 rounded">
                <p className="font-semibold text-blue-900">📋 Datos del Cliente:</p>
                <ul className="mt-1 space-y-1 text-gray-700">
                  <li>• Nombre completo</li>
                  <li>• Cédula o RUC</li>
                  <li>• Email</li>
                  <li>• Teléfono</li>
                  <li>• Fecha de nacimiento</li>
                </ul>
              </div>
              <div className="bg-green-50 p-2 rounded">
                <p className="font-semibold text-green-900">🏢 Datos de la Póliza:</p>
                <ul className="mt-1 space-y-1 text-gray-700">
                  <li>• Número de póliza</li>
                  <li>• Aseguradora (nombre exacto)</li>
                  <li>• Tipo (AUTO, VIDA, etc.)</li>
                  <li>• Fecha de inicio</li>
                  <li>• Fecha de renovación</li>
                  <li>• Estado (ACTIVA, etc.)</li>
                  <li>• Email del corredor</li>
                </ul>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2 mt-2">
              <p className="text-xs text-amber-800">
                <span className="font-bold">⚠️ IMPORTANTE:</span> Solo la columna "notas" es opcional. Si falta algún dato del cliente (cédula, email, teléfono o fecha de nacimiento), el cliente quedará como PRELIMINAR.
              </p>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="font-semibold text-[#010139] mb-2">3️⃣ Usa el Formato Correcto</p>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Fechas:</strong> Formato YYYY-MM-DD (ejemplo: 2024-01-15)</span>
              </li>
              <li className="flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <div className="flex-1">
                    <span><strong>Aseguradora:</strong> Escribe el nombre EXACTO como aparece en el sistema</span>
                  </div>
                  <button
                    onClick={() => setShowInsurers(!showInsurers)}
                    className="flex items-center gap-1 text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    type="button"
                  >
                    {showInsurers ? (
                      <>
                        <FaEyeSlash className="text-xs" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <FaEye className="text-xs" />
                        Ver Lista
                      </>
                    )}
                  </button>
                </div>
                {showInsurers && (
                  <div className="ml-6 bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 mb-2">Aseguradoras Registradas:</p>
                    {insurers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs max-h-40 overflow-y-auto">
                        {insurers.map((insurer, idx) => (
                          <div key={idx} className="flex items-center gap-1 text-gray-800">
                            <span className="text-blue-600">▪</span>
                            <span className="font-medium">{insurer}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 italic">Cargando aseguradoras...</p>
                    )}
                  </div>
                )}
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">✓</span>
                <span><strong>Números de póliza:</strong> Deben ser únicos (no pueden repetirse)</span>
              </li>
            </ul>
          </div>

          {/* Paso 4 */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="font-semibold text-[#010139] mb-2">4️⃣ Múltiples Pólizas del Mismo Cliente</p>
            <p className="text-sm text-gray-700">Si un cliente tiene varias pólizas, puedes ponerlas en filas separadas con la misma cédula. El sistema las agrupará automáticamente.</p>
          </div>
        </div>
      </div>

      {/* Download Template */}
      <div className="flex gap-4 justify-center mb-8">
        <button
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#8AAA19] transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <FaDownload />
          Descargar Plantilla CSV
        </button>
      </div>

      {/* Upload Form */}
      {!showPreview && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 bg-gradient-to-br from-gray-50 to-white hover:border-[#8AAA19] transition-all">
            <div className="text-center">
              <FaUpload className="mx-auto h-16 w-16 text-[#010139] mb-4 animate-bounce" />
              
              <label className="cursor-pointer">
                <span className="mt-2 block text-lg font-medium text-gray-900">
                  {file ? file.name : "Haga clic para seleccionar archivo CSV"}
                </span>
                <span className="text-sm text-gray-500 block mt-2">
                  {loading ? "Procesando..." : "Formato: UTF-8, separado por comas"}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Preview */}
      {showPreview && !importResult && (
        <div className="space-y-6">
          <div className="flex gap-4 bg-white p-4 rounded-xl shadow-lg">
            <div className="flex-1 text-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
              <FaCheckCircle className="text-green-600 text-3xl mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
              <p className="text-sm text-green-600">Registros Válidos</p>
            </div>
            <div className="flex-1 text-center p-4 bg-red-50 rounded-lg border-2 border-red-200">
              <FaExclamationTriangle className="text-red-600 text-3xl mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-700">{errorRows.length}</p>
              <p className="text-sm text-red-600">Con Errores</p>
            </div>
          </div>

          {validRows.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold text-[#010139] mb-4">Vista Previa - Primeros 10 Registros Válidos</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Cliente</th>
                      <th className="px-4 py-2 text-left">Cédula</th>
                      <th className="px-4 py-2 text-left">Póliza</th>
                      <th className="px-4 py-2 text-left">Aseguradora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 10).map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">{row.client_name}</td>
                        <td className="px-4 py-2">{row.national_id || <span className="text-amber-600">Preliminar</span>}</td>
                        <td className="px-4 py-2 font-mono">{row.policy_number}</td>
                        <td className="px-4 py-2">{row.insurer_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {errorRows.length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6">
              <h3 className="text-lg font-bold text-red-800 mb-4">Registros con Errores</h3>
              <ul className="space-y-2 text-sm text-red-700">
                {errorRows.slice(0, 10).map((error, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <FaExclamationTriangle className="text-red-600 mt-1 flex-shrink-0" />
                    <span>
                      <strong>Fila {error.row}:</strong> {error.message}
                    </span>
                  </li>
                ))}
                {errorRows.length > 10 && (
                  <li className="italic text-red-600">...y {errorRows.length - 10} errores más</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => {
                setShowPreview(false);
                setFile(null);
                setValidRows([]);
                setErrorRows([]);
              }}
              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancelar
            </button>
            <button
              onClick={(e) => {
                console.log('[BUTTON] ======== CLICK EN BOTÓN IMPORTAR ========');
                console.log('[BUTTON] Evento:', e);
                console.log('[BUTTON] validRows.length:', validRows.length);
                console.log('[BUTTON] loading:', loading);
                console.log('[BUTTON] file:', file);
                console.log('[BUTTON] disabled:', validRows.length === 0 || loading);
                console.log('[BUTTON] Llamando handleImport...');
                handleImport();
                console.log('[BUTTON] handleImport llamado');
              }}
              disabled={validRows.length === 0 || loading}
              className="flex-1 px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Importando..." : `Importar ${validRows.length} Registros Válidos`}
            </button>
          </div>
        </div>
      )}

      {/* Loading Screen con Barra de Progreso */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8AAA19] mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-[#010139] mb-2">Importando Clientes...</h3>
              <p className="text-gray-600 mb-6">Por favor, tenga paciencia mientras procesamos los registros</p>
              
              {/* Barra de progreso */}
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
                <div 
                  className="bg-[#8AAA19] h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${importProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">{importProgress}%</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Resultados */}
      {showResultModal && importResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-8 space-y-6">
          {/* Resultado principal con contadores */}
          <div className="rounded-xl shadow-lg p-8 text-center bg-white border-2 border-[#8AAA19]">
            {importResult.success > 0 ? (
              <FaCheckCircle className="text-green-600 text-6xl mx-auto mb-4" />
            ) : (
              <FaExclamationTriangle className="text-red-600 text-6xl mx-auto mb-4" />
            )}
            <h3 className="text-2xl font-bold text-[#010139] mb-4">
              {importResult.success > 0 ? '✅ Importación Completada' : '⚠️ Importación con Errores'}
            </h3>
            
            {/* Contadores principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <p className="text-sm text-green-700 font-semibold">Pólizas Nuevas</p>
                <p className="text-3xl font-bold text-green-600">{importResult.success || 0}</p>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-700 font-semibold">Clientes Nuevos</p>
                <p className="text-3xl font-bold text-blue-600">{importResult.clientsCreated || 0}</p>
              </div>
              
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <p className="text-sm text-purple-700 font-semibold">Clientes Actualizados</p>
                <p className="text-3xl font-bold text-purple-600">{importResult.clientsUpdated || 0}</p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600">
              Total de clientes procesados: <strong>{(importResult.clientsCreated || 0) + (importResult.clientsUpdated || 0)}</strong>
            </p>
          </div>

          {/* Pólizas Duplicadas (separado de errores) */}
          {importResult.errors && importResult.errors.filter((e: any) => e.isDuplicate).length > 0 && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDuplicates(!showDuplicates)}
                className="w-full flex items-center justify-between p-4 hover:bg-blue-100 transition"
              >
                <div className="flex items-center gap-3">
                  <FaInfoCircle className="text-blue-600 text-xl" />
                  <h4 className="text-lg font-bold text-blue-800">
                    Pólizas ya Existentes ({importResult.errors.filter((e: any) => e.isDuplicate).length})
                  </h4>
                </div>
                {showDuplicates ? <FaChevronUp className="text-blue-600" /> : <FaChevronDown className="text-blue-600" />}
              </button>
              
              {showDuplicates && (
                <div className="p-4 pt-0 space-y-2 max-h-60 overflow-y-auto">
                  {importResult.errors.filter((e: any) => e.isDuplicate).map((error: any, idx: number) => (
                    <div key={idx} className="bg-white rounded p-3 border-l-4 border-blue-500 text-sm">
                      <p className="font-semibold text-blue-900">Fila {error.row}</p>
                      <p className="text-blue-700">{error.message}</p>
                      <p className="text-xs text-blue-600 mt-1">💡 Esta póliza ya está registrada en la base de datos</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Errores Reales */}
          {importResult.errors && importResult.errors.filter((e: any) => !e.isDuplicate).length > 0 && (
            <div className="bg-red-50 border-2 border-red-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowErrors(!showErrors)}
                className="w-full flex items-center justify-between p-4 hover:bg-red-100 transition"
              >
                <div className="flex items-center gap-3">
                  <FaExclamationTriangle className="text-red-600 text-xl" />
                  <h4 className="text-lg font-bold text-red-800">
                    Errores de Importación ({importResult.errors.filter((e: any) => !e.isDuplicate).length})
                  </h4>
                </div>
                {showErrors ? <FaChevronUp className="text-red-600" /> : <FaChevronDown className="text-red-600" />}
              </button>
              
              {showErrors && (
                <div className="p-4 pt-0 space-y-3 max-h-96 overflow-y-auto">
                  {importResult.errors.filter((e: any) => !e.isDuplicate).map((error: any, idx: number) => {
                    // Determinar el tipo de error y el tooltip de ayuda
                    let tooltipText = '';
                    let errorIcon = '❌';
                    
                    if (error.message?.includes('Broker no encontrado') || error.message?.includes('profile')) {
                      tooltipText = 'El email del broker no existe en el sistema. Verifica el email o crea el broker primero.';
                      errorIcon = '👤';
                    } else if (error.message?.includes('Aseguradora no encontrada')) {
                      tooltipText = 'La aseguradora no existe en el sistema. Verifica el nombre o créala en la sección de Aseguradoras.';
                      errorIcon = '🏢';
                    } else if (error.message?.includes('obligatorio')) {
                      tooltipText = 'Falta información requerida. Completa todos los campos obligatorios en el CSV.';
                      errorIcon = '📝';
                    } else if (error.message?.includes('Error creando póliza')) {
                      tooltipText = 'Error en la base de datos al crear la póliza. Verifica los datos y vuelve a intentar.';
                      errorIcon = '⚠️';
                    } else {
                      tooltipText = 'Error inesperado. Revisa los datos del CSV o contacta al administrador.';
                    }
                    
                    return (
                      <div key={idx} className="bg-white rounded-lg p-4 border-l-4 border-red-500 shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl flex-shrink-0">{errorIcon}</span>
                          <div className="flex-1">
                            <p className="font-semibold text-red-900 text-sm">
                              Fila {error.row || 'N/A'}
                            </p>
                            <p className="text-red-700 text-sm mt-1">{error.message}</p>
                            
                            {/* Tooltip de ayuda */}
                            <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-2">
                              <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-blue-800">
                                <strong>💡 Solución:</strong> {tooltipText}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Duplicados dentro del CSV */}
          {importResult.csvDuplicates && importResult.csvDuplicates.length > 0 && (
            <div className="bg-gray-50 border-2 border-gray-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowCsvDuplicates(!showCsvDuplicates)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <FaFileAlt className="text-gray-600 text-xl" />
                  <h4 className="text-lg font-bold text-gray-800">
                    Duplicados en el CSV ({importResult.csvDuplicates.length})
                  </h4>
                </div>
                {showCsvDuplicates ? <FaChevronUp className="text-gray-600" /> : <FaChevronDown className="text-gray-600" />}
              </button>
              
              {showCsvDuplicates && (
                <div className="p-4 pt-0 space-y-2 max-h-60 overflow-y-auto">
                  {importResult.csvDuplicates.map((duplicate: any, idx: number) => (
                    <div key={idx} className="bg-white rounded p-3 border-l-4 border-gray-500 text-sm">
                      <p className="font-semibold text-gray-900">Fila {duplicate.row}</p>
                      <p className="text-gray-700">{duplicate.message}</p>
                      <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-2">
                        <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-800">
                          <strong>💡 Información:</strong> Esta póliza aparece más de una vez en el archivo CSV. Solo se mantuvo una de ellas para evitar duplicados.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Registros excluidos (broker no encontrado) */}
          {importResult.excluded && importResult.excluded.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowExcluded(!showExcluded)}
                className="w-full flex items-center justify-between p-4 hover:bg-amber-100 transition"
              >
                <div className="flex items-center gap-3">
                  <FaExclamationTriangle className="text-amber-600 text-xl" />
                  <h4 className="text-lg font-bold text-amber-800">
                    Registros Excluidos - Broker No Encontrado ({importResult.excluded.length})
                  </h4>
                </div>
                {showExcluded ? <FaChevronUp className="text-amber-600" /> : <FaChevronDown className="text-amber-600" />}
              </button>
              
              {showExcluded && (
                <div className="p-4 pt-0 space-y-2 max-h-60 overflow-y-auto">
                  {importResult.excluded.map((excluded: any, idx: number) => (
                    <div key={idx} className="bg-white rounded p-3 border-l-4 border-amber-500 text-sm">
                      <p className="font-semibold text-amber-900">Fila {excluded.row}</p>
                      <p className="text-amber-700">{excluded.message}</p>
                      <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded p-2">
                        <FaInfoCircle className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-800">
                          <strong>💡 Solución:</strong> El broker con este email no existe. Crea el broker primero o verifica el email en el CSV.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

              {/* Botón Confirmar para cerrar modal y redirigir */}
              <button
                onClick={() => {
                  setRedirecting(true);
                  setShowResultModal(false);
                  setImportResult(null);
                  setShowPreview(false);
                  setFile(null);
                  setValidRows([]);
                  setErrorRows([]);
                  // Usar setTimeout 0 para que el loading se muestre antes de la redirección
                  setTimeout(() => {
                    router.push('/db');
                  }, 0);
                }}
                disabled={redirecting}
                className="w-full px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#8AAA19] transition-all transform hover:scale-105 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {redirecting ? 'Redirigiendo...' : '✓ Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading durante redirección */}
      {redirecting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#8AAA19]"></div>
              <p className="text-[#010139] font-semibold text-lg">Redirigiendo a Base de Datos...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
