'use client';

import { useState, useEffect } from 'react';
import { FaUpload, FaCog, FaCheckCircle } from 'react-icons/fa';
import { actionGetActiveInsurers, actionImportDelinquency } from '@/app/(app)/delinquency/actions';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function ImportTab() {
  const [insurers, setInsurers] = useState<any[]>([]);
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadInsurers();
    // Set default cutoff date to today
    const today = new Date().toISOString().split('T')[0];
    setCutoffDate(today || '');
  }, []);

  const loadInsurers = async () => {
    const result = await actionGetActiveInsurers();
    if (result.ok) {
      setInsurers(result.data || []);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseExcelFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          if (!sheetName) {
            reject(new Error('No se encontró ninguna hoja en el archivo'));
            return;
          }
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            reject(new Error('No se pudo leer la hoja del archivo'));
            return;
          }
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  };

  const parseCSVFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          if (lines.length === 0 || !lines[0]) {
            reject(new Error('Archivo CSV vacío'));
            return;
          }
          const headers = lines[0].split(',').map(h => h.trim());
          const data = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
              const values = line.split(',');
              const obj: any = {};
              headers.forEach((header, index) => {
                obj[header] = values[index]?.trim() || '';
              });
              return obj;
            });
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleImport = async () => {
    if (!selectedInsurer) {
      toast.error('Selecciona una aseguradora');
      return;
    }

    if (!file) {
      toast.error('Selecciona un archivo');
      return;
    }

    if (!cutoffDate) {
      toast.error('Ingresa la fecha de corte');
      return;
    }

    setUploading(true);

    try {
      let parsedData: any[] = [];

      // Parse file based on extension
      const ext = file.name.split('.').pop()?.toLowerCase();
      
      if (ext === 'xlsx' || ext === 'xls') {
        parsedData = await parseExcelFile(file);
      } else if (ext === 'csv') {
        parsedData = await parseCSVFile(file);
      } else if (ext === 'pdf' || ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
        toast.error('Los archivos PDF e imágenes requieren configuración OCR adicional');
        setUploading(false);
        return;
      } else {
        toast.error('Formato de archivo no soportado');
        setUploading(false);
        return;
      }

      if (parsedData.length === 0) {
        toast.error('No se encontraron datos en el archivo');
        setUploading(false);
        return;
      }

      // Map parsed data to expected format
      // TODO: Get mapping from insurer configuration
      const records = parsedData.map((row: any) => ({
        policy_number: row['policy_number'] || row['N° Póliza'] || row['Poliza'] || '',
        client_name: row['client_name'] || row['Cliente'] || row['Nombre'] || '',
        due_soon: Number(row['due_soon'] || row['Por Vencer'] || 0),
        current: Number(row['current'] || row['Corriente'] || 0),
        bucket_1_30: Number(row['bucket_1_30'] || row['1-30'] || row['1_30'] || 0),
        bucket_31_60: Number(row['bucket_31_60'] || row['31-60'] || row['31_60'] || 0),
        bucket_61_90: Number(row['bucket_61_90'] || row['61-90'] || row['61_90'] || 0),
        bucket_90_plus: Number(row['bucket_90_plus'] || row['+90'] || row['90_plus'] || 0),
      })).filter(r => r.policy_number); // Filter out rows without policy number

      if (records.length === 0) {
        toast.error('No se encontraron registros válidos. Verifica el mapeo de columnas en Aseguradoras');
        setUploading(false);
        return;
      }

      // Import to database
      const result = await actionImportDelinquency({
        insurerId: selectedInsurer,
        cutoffDate,
        records,
      });

      if (result.ok) {
        toast.success(result.message || 'Import realizado correctamente sin errores');
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        toast.error(result.error || 'Error al importar datos');
      }
    } catch (error: any) {
      toast.error('Error al procesar el archivo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border-2 border-gray-100">
        <h3 className="text-xl font-bold text-[#010139] mb-6 flex items-center gap-2">
          <FaUpload />
          Importar Reporte de Morosidad
        </h3>

        <div className="space-y-4">
          {/* Insurer Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Aseguradora <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedInsurer}
              onChange={(e) => setSelectedInsurer(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            >
              <option value="">Selecciona una aseguradora</option>
              {insurers.map((ins) => (
                <option key={ins.id} value={ins.id}>
                  {ins.name}
                </option>
              ))}
            </select>
          </div>

          {/* Cutoff Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha de Corte <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={cutoffDate}
              onChange={(e) => setCutoffDate(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Archivo <span className="text-red-500">*</span>
            </label>
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none transition-colors"
            />
            <p className="text-xs text-gray-500 mt-2">
              Formatos soportados: .xlsx, .csv, .xls, .pdf, .jpg, .png
            </p>
          </div>

          {file && (
            <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Archivo seleccionado:</strong> {file.name}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Tamaño: {(file.size / 1024).toFixed(2)} KB
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <button
              onClick={handleImport}
              disabled={uploading || !selectedInsurer || !file || !cutoffDate}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl hover:shadow-lg transition-all transform hover:scale-105 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {uploading ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <FaCheckCircle />
                  <span>Importar Datos</span>
                </>
              )}
            </button>

            <button
              onClick={() => window.location.href = '/insurers'}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-xl hover:bg-gray-700 transition-all font-medium"
            >
              <FaCog />
              <span>Configurar Mapeo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl shadow-lg p-4 md:p-6 border-2 border-blue-300">
        <h4 className="font-bold text-[#010139] mb-3 flex items-center gap-2">
          📋 Instrucciones
        </h4>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-[#8AAA19] font-bold">1.</span>
            <span>Selecciona la aseguradora correspondiente al reporte</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#8AAA19] font-bold">2.</span>
            <span>Ingresa la fecha de corte del reporte</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#8AAA19] font-bold">3.</span>
            <span>Sube el archivo en formato Excel (.xlsx, .xls) o CSV</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#8AAA19] font-bold">4.</span>
            <span>Si el archivo no se procesa correctamente, verifica el mapeo en Configuración de Aseguradoras</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#8AAA19] font-bold">5.</span>
            <span>Los datos importados reemplazarán los registros existentes para las mismas pólizas</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
