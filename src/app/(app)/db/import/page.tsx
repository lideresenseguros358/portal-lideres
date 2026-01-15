"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FaArrowLeft, FaDownload, FaUpload, FaCheckCircle, FaExclamationTriangle, FaFileAlt, FaEye, FaEyeSlash } from "react-icons/fa";
import Link from "next/link";
import Papa from "papaparse";
// import { actionImportClientsCSV } from "../actions"; // DEPRECADO - Usar ImportModal.tsx
import { toast } from "sonner";

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
          client_name: row.client_name?.trim(),
          national_id: row.national_id?.trim() || undefined,
          email: row.email?.trim() || undefined,
          phone: row.phone?.trim() || undefined,
          address: row.address?.trim() || undefined,
          policy_number: row.policy_number?.trim(),
          insurer_name: row.insurer_name?.trim(),
          ramo: row.ramo?.trim() || undefined,
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
    if (validRows.length === 0) return;
    
    toast.error('Función de importación deprecada', {
      description: 'Por favor use el botón "Importar CSV" desde la página de Base de Datos'
    });
    
    // DEPRECADO: Esta función usaba actionImportClientsCSV que ya no existe
    // El nuevo sistema de importación está en:
    // - src/components/db/ImportModal.tsx
    // - Accesible desde: /db -> click botón "Importar CSV"
    
    // setLoading(true);
    // try {
    //   const result = await actionImportClientsCSV(validRows);
    //   ...
    // } finally {
    //   setLoading(false);
    // }
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
              onClick={handleImport}
              disabled={validRows.length === 0 || loading}
              className="flex-1 px-6 py-3 bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Importando..." : `Importar ${validRows.length} Registros Válidos`}
            </button>
          </div>
        </div>
      )}

      {/* Import Results */}
      {importResult && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <FaCheckCircle className="text-green-600 text-6xl mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-[#010139] mb-2">Importación Completada</h3>
            <p className="text-lg text-gray-600">
              {importResult.processed} de {importResult.total} registros importados exitosamente
            </p>
          </div>

          {importResult.errors && importResult.errors.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6">
              <h4 className="text-lg font-bold text-amber-800 mb-4">
                Registros No Procesados ({importResult.errors.length})
              </h4>
              <ul className="space-y-2 text-sm text-amber-700">
                {importResult.errors.slice(0, 10).map((error: any, idx: number) => (
                  <li key={idx}>
                    <strong>{error.row || error.policy}:</strong> {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => router.push('/db')}
            className="w-full px-6 py-3 bg-[#010139] text-white rounded-lg hover:bg-[#8AAA19] transition-all transform hover:scale-105"
          >
            Ir a Base de Datos
          </button>
        </div>
      )}
    </div>
  );
}
