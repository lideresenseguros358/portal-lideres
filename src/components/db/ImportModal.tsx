"use client";

import { useState, useEffect } from "react";
import { FaTimes, FaDownload, FaUpload, FaExclamationTriangle } from "react-icons/fa";
import Papa from "papaparse";

interface ImportModalProps {
  onClose: () => void;
}

interface ImportError {
  row: number;
  message: string;
}

interface ImportResult {
  success: number;
  errors: ImportError[];
}

export default function ImportModal({ onClose }: ImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [insurers, setInsurers] = useState<string[]>([]);

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
    // Redirigir a la plantilla pública actualizada
    window.open('/plantilla_clientes.csv', '_blank');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith(".csv")) {
      alert("Por favor seleccione un archivo CSV");
      return;
    }
    
    setFile(selectedFile);
    
    // Parse preview
    const text = await selectedFile.text();
    const parsed = await parseCSV(text);
    setPreview(parsed.slice(0, 5));
    setStep("preview");
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/db/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      
      setResult(data);
      setStep("result");
    } catch (error) {
      alert("Error al importar: " + (error instanceof Error ? error.message : "Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  const parseCSV = (text: string): Promise<Record<string, string>[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results: Papa.ParseResult<Record<string, string>>) => resolve(results.data),
        error: reject,
      });
    });
  };

  return (
    <div 
      className="standard-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div 
        className="standard-modal-container max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="standard-modal-header">
          <div>
            <h2 className="standard-modal-title">Importar Datos</h2>
            <p className="standard-modal-subtitle">Subir archivo CSV con información de clientes</p>
          </div>
          <button onClick={onClose} className="standard-modal-close" disabled={loading} type="button">
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="standard-modal-content">
          {step === "upload" && (
            <div className="space-y-6">
              {/* Instructions */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl p-5 space-y-3">
                <h3 className="font-bold text-blue-900 text-base mb-2">📋 Cómo Importar Clientes</h3>
                
                {/* Paso 1 */}
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-semibold text-blue-900 text-sm mb-1.5">1️⃣ Descarga la Plantilla</p>
                  <p className="text-xs text-gray-700">Haz clic en "Descargar plantilla CSV" abajo. El archivo tiene todas las columnas que necesitas llenar.</p>
                </div>

                {/* Paso 2 */}
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-semibold text-blue-900 text-sm mb-1.5">2️⃣ Llena Todos los Datos</p>
                  <p className="text-xs text-gray-700 mb-2">Debes completar TODA la información de cada cliente y póliza:</p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="bg-blue-50 p-2 rounded text-xs">
                      <p className="font-semibold text-blue-900 mb-1">Del Cliente:</p>
                      <ul className="space-y-0.5 text-gray-700">
                        <li>✓ Nombre</li>
                        <li>✓ Cédula/RUC</li>
                        <li>✓ Email</li>
                        <li>✓ Teléfono</li>
                        <li>✓ Fecha nacimiento</li>
                      </ul>
                    </div>
                    <div className="bg-green-50 p-2 rounded text-xs">
                      <p className="font-semibold text-green-900 mb-1">De la Póliza:</p>
                      <ul className="space-y-0.5 text-gray-700">
                        <li>✓ Número póliza</li>
                        <li>✓ Aseguradora</li>
                        <li>✓ Tipo (AUTO, VIDA...)</li>
                        <li>✓ Fechas inicio/renovación</li>
                        <li>✓ Estado (ACTIVA...)</li>
                        <li>✓ Email del corredor</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-300 rounded p-2">
                    <p className="text-xs text-amber-900">
                      <strong>⚠️ Importante:</strong> Solo "notas" es opcional. Si falta cédula, email, teléfono o fecha de nacimiento, el cliente queda como PRELIMINAR.
                    </p>
                  </div>
                </div>

                {/* Paso 3 - Aseguradoras */}
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-semibold text-blue-900 text-sm mb-1.5">3️⃣ Nombres de Aseguradoras</p>
                  <p className="text-xs text-gray-700 mb-2">Copia EXACTAMENTE uno de estos nombres:</p>
                  {insurers.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs max-h-28 overflow-y-auto border border-gray-200 rounded p-2 bg-gray-50">
                      {insurers.map((insurer, idx) => (
                        <div key={idx} className="text-gray-800 font-medium">• {insurer}</div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Cargando...</p>
                  )}
                </div>

                {/* Paso 4 - Formatos */}
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="font-semibold text-blue-900 text-sm mb-1.5">4️⃣ Formatos Importantes</p>
                  <ul className="space-y-1 text-xs text-gray-700">
                    <li><strong>Fechas:</strong> Año-Mes-Día (ejemplo: 2024-01-15)</li>
                    <li><strong>Pólizas:</strong> Cada número debe ser único</li>
                    <li><strong>Varias pólizas:</strong> Usa la misma cédula en varias filas, se agrupan solas</li>
                  </ul>
                </div>
              </div>

              {/* Download Template */}
              <div className="text-center">
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                >
                  <FaDownload />
                  Descargar plantilla CSV
                </button>
              </div>

              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
                <div className="text-center">
                  <FaUpload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Haga clic para seleccionar archivo CSV
                    </span>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === "preview" && preview.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-800">Vista previa (primeras 5 filas)</h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {preview[0] && Object.keys(preview[0]).map((header) => (
                        <th
                          key={header}
                          className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row)
                          .filter(([k]) => k !== "_rowNumber")
                          .map(([, value], i) => (
                            <td key={i} className="px-3 py-2 text-sm text-gray-900">
                              {String(value) || "-"}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep("upload")}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Volver
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Importando..." : "Importar"}
                </button>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold">
                  ✓ {result.success} registros importados exitosamente
                </p>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="text-red-800 font-semibold mb-2">
                    <FaExclamationTriangle className="inline mr-2" />
                    {result.errors.length} errores encontrados
                  </h4>
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.errors.map((error, idx) => (
                      <li key={idx}>
                        Fila {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
