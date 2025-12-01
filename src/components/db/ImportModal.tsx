"use client";

import { useState } from "react";
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

  const downloadTemplate = () => {
    const template = `name,national_id,email,phone,policy_number,ramo,insurer_id,start_date,renewal_date,status
"Juan Pérez","8-111-2222","juan@example.com","+507 6000-0000","POL-001","AUTO","1","2024-01-01","2025-01-01","ACTIVA"
"María González","","maria@example.com","","POL-002","VIDA","1","2024-02-01","2025-02-01","ACTIVA"
"Pedro Martínez","","","","POL-003","","1","","2025-03-15","ACTIVA"`;
    
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla_clientes.csv";
    link.click();
    URL.revokeObjectURL(url);
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Instrucciones</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• El archivo debe estar en formato CSV</li>
                  <li>• <strong>Columnas OBLIGATORIAS:</strong> name (nombre), policy_number (número de póliza), insurer_id (ID aseguradora), renewal_date (fecha renovación)</li>
                  <li>• <strong>Columnas OPCIONALES:</strong> national_id (cédula), email, phone, ramo, start_date, status</li>
                  <li>• La cédula (national_id) NO es obligatoria - puede dejarse vacía</li>
                  <li>• La fecha de renovación (renewal_date) SÍ es obligatoria para todas las pólizas</li>
                  <li>• Use campos vacíos (no la palabra &quot;NULL&quot;) para valores opcionales</li>
                  <li>• Los números de póliza deben ser únicos</li>
                </ul>
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
