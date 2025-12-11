'use client';

import { useState, useTransition } from 'react';
import { FaVial, FaCheckCircle, FaTimesCircle, FaTable, FaFileImage, FaFilePdf, FaMagic } from 'react-icons/fa';
import { actionPreviewMapping, actionProcessOCR } from '@/app/(app)/insurers/actions';

interface TestsTabProps {
  insurerId: string;
}

export default function TestsTab({ insurerId }: TestsTabProps) {
  const [testFile, setTestFile] = useState<File | null>(null);
  const [target, setTarget] = useState('COMMISSIONS');
  const [testResult, setTestResult] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>('');

  // Helper function to check if file requires OCR
  const requiresOCR = (fileName: string): boolean => {
    const extension = fileName.toLowerCase().split('.').pop();
    const ocrExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'pdf'];
    return ocrExtensions.includes(extension || '');
  };

  const handleTest = () => {
    if (!testFile) return;
    startTransition(async () => {
      try {
        // Leer el archivo como ArrayBuffer
        let arrayBuffer = await testFile.arrayBuffer();
        let fileName = testFile.name;
        
        // Verificar si el archivo requiere OCR (imagen o PDF)
        const needsOCR = requiresOCR(fileName);
        
        if (needsOCR) {
          setIsProcessingOCR(true);
          setOcrProgress('🔍 Procesando documento con OCR...');
          
          // Procesar con OCR
          const ocrResult = await actionProcessOCR(arrayBuffer, fileName);
          
          if (!ocrResult.ok) {
            setTestResult({
              ok: false,
              error: ocrResult.error || 'Error al procesar OCR'
            });
            setIsProcessingOCR(false);
            setOcrProgress('');
            return;
          }
          
          setOcrProgress('✅ OCR completado. Normalizando a XLSX...');
          
          // Usar el buffer XLSX normalizado del OCR
          arrayBuffer = ocrResult.data.xlsxBuffer!;
          fileName = testFile.name.replace(/\.[^.]+$/, '.xlsx'); // Cambiar extensión a .xlsx
          
          setOcrProgress('📊 Analizando estructura de datos...');
        }
        
        // Procesar con el parser normal
        const result = await actionPreviewMapping({
          insurerId,
          targetField: target,
          fileBuffer: arrayBuffer,
          fileName: fileName,
        });
        
        setTestResult(result);
        setIsProcessingOCR(false);
        setOcrProgress('');
        
      } catch (error) {
        setTestResult({
          ok: false,
          error: error instanceof Error ? error.message : 'Error al procesar el archivo'
        });
        setIsProcessingOCR(false);
        setOcrProgress('');
      }
    });
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Pruebas de Mapeo</h2>
      <p className="mb-4">Sube un archivo de ejemplo para verificar que las reglas de mapeo funcionan correctamente.</p>
      <div className="ocr-notice">
        <FaMagic className="icon" />
        <div>
          <strong>OCR Automático:</strong> Los archivos PDF e imágenes se procesan automáticamente con Google Cloud Vision para extraer y normalizar los datos a formato tabular.
        </div>
      </div>

      <div className="test-form">
        <select value={target} onChange={e => setTarget(e.target.value)}>
          <option value="COMMISSIONS">Comisiones</option>
          <option value="DELINQUENCY">Morosidad</option>
        </select>
        <input 
          type="file" 
          accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp,.tiff,.tif"
          onChange={(e) => setTestFile(e.target.files?.[0] || null)}
        />
        <button onClick={handleTest} className="btn-primary" disabled={isPending || !testFile}>
          <FaVial /> {isPending ? (isProcessingOCR ? 'Procesando OCR...' : 'Probando...') : 'Probar Mapeo'}
        </button>
      </div>

      {isProcessingOCR && ocrProgress && (
        <div className="ocr-progress">
          <div className="progress-spinner"></div>
          <span>{ocrProgress}</span>
        </div>
      )}

      {testResult && (
        <div className="test-result-container">
          {testResult.ok ? (
            <div className="test-result success">
              <div className="result-header">
                <FaCheckCircle className="icon" />
                <h3>✓ Mapeo Exitoso</h3>
              </div>
              
              {testResult.data?.success ? (
                <>
                  {/* Mapeo de Columnas */}
                  <div className="mapping-section">
                    <h4><FaTable /> Mapeo de Columnas</h4>
                    <div className="mapping-grid">
                      <div className="mapping-header">Columna Original</div>
                      <div className="mapping-header">→</div>
                      <div className="mapping-header">Campo Normalizado</div>
                      {testResult.data.originalHeaders?.map((original: string, idx: number) => (
                        <>
                          <div key={`orig-${idx}`} className="mapping-cell original">{original}</div>
                          <div key={`arrow-${idx}`} className="mapping-arrow">→</div>
                          <div key={`norm-${idx}`} className={`mapping-cell normalized ${
                            testResult.data.normalizedHeaders?.[idx] !== original ? 'mapped' : 'same'
                          }`}>
                            {testResult.data.normalizedHeaders?.[idx] || original}
                          </div>
                        </>
                      ))}
                    </div>
                  </div>

                  {/* Preview de Datos */}
                  {testResult.data.previewRows && testResult.data.previewRows.length > 0 && (
                    <div className="preview-section">
                      <h4><FaTable /> Preview de Datos (Primeras {testResult.data.previewRows.length} filas)</h4>
                      <div className="table-wrapper">
                        <table className="preview-table">
                          <thead>
                            <tr>
                              <th className="row-number">#</th>
                              {testResult.data.normalizedHeaders?.map((header: string, idx: number) => (
                                <th key={idx}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {testResult.data.previewRows.map((row: any, rowIdx: number) => (
                              <tr key={rowIdx}>
                                <td className="row-number">{rowIdx + 1}</td>
                                {testResult.data.normalizedHeaders?.map((header: string, colIdx: number) => (
                                  <td key={colIdx}>{row[header] ?? '-'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Estadísticas */}
                  <div className="stats-section">
                    <div className="stat-card">
                      <div className="stat-label">Total de Columnas</div>
                      <div className="stat-value">{testResult.data.originalHeaders?.length || 0}</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Columnas Mapeadas</div>
                      <div className="stat-value">
                        {testResult.data.originalHeaders?.filter((h: string, i: number) => 
                          testResult.data.normalizedHeaders?.[i] !== h
                        ).length || 0}
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-label">Filas de Preview</div>
                      <div className="stat-value">{testResult.data.previewRows?.length || 0}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="error-details">
                  <div className="error-header">
                    <FaTimesCircle className="icon" />
                    <h4>Error de Validación</h4>
                  </div>
                  <p className="error-message"><strong>Error:</strong> {testResult.data?.error}</p>
                  
                  {testResult.data?.missingFields && (
                    <div className="missing-fields-alert">
                      <strong>Campos faltantes:</strong> {testResult.data.missingFields.join(', ')}
                      <br />
                      <small>Configure los aliases en la pestaña "Mapeos" para mapear las columnas del archivo a estos campos.</small>
                    </div>
                  )}
                  
                  {testResult.data?.originalHeaders && testResult.data?.normalizedHeaders && (
                    <div className="mapping-debug">
                      <h5>🔍 Debug: Mapeo de Columnas</h5>
                      <div className="mapping-table-container">
                        <table className="mapping-comparison-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              <th>Columna Original (Excel)</th>
                              <th>→</th>
                              <th>Campo Mapeado</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {testResult.data.originalHeaders.map((original: string, i: number) => {
                              const normalized = testResult.data.normalizedHeaders[i];
                              const isMapped = original.toLowerCase() !== normalized.toLowerCase();
                              const isRequired = testResult.data?.missingFields?.includes(normalized);
                              
                              return (
                                <tr key={i} className={isRequired ? 'required-field' : ''}>
                                  <td>{i + 1}</td>
                                  <td className="original-column">{original}</td>
                                  <td className="arrow">{isMapped ? '✓' : '○'}</td>
                                  <td className="normalized-column">{normalized}</td>
                                  <td>
                                    {isMapped ? (
                                      <span className="badge mapped">Mapeado</span>
                                    ) : isRequired ? (
                                      <span className="badge required">❌ Requerido</span>
                                    ) : (
                                      <span className="badge unmapped">Sin mapeo</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="help-box">
                        <strong>💡 Cómo corregir:</strong>
                        <ol>
                          <li>Ve a la pestaña <strong>"Mapeos"</strong></li>
                          <li>Selecciona el tipo: <strong>{target === 'COMMISSIONS' ? 'Comisiones' : 'Morosidad'}</strong></li>
                          <li>Para cada campo faltante (marcado con ❌), crea o edita una regla</li>
                          <li>Agrega el nombre de la columna original como <strong>alias</strong></li>
                          <li>Vuelve a probar el archivo</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="test-result error">
              <div className="result-header">
                <FaTimesCircle className="icon" />
                <h3>✗ Error en Mapeo</h3>
              </div>
              <p className="error-message">{testResult.error}</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .test-form { 
          display: grid; 
          grid-template-columns: auto 1fr auto; 
          gap: 16px; 
          align-items: center; 
          margin-bottom: 24px; 
        }
        .test-form select, .test-form input { 
          padding: 10px; 
          border: 2px solid #ddd; 
          border-radius: 8px;
          font-size: 14px;
        }
        .test-form input[type="file"] {
          cursor: pointer;
        }
        .ocr-notice {
          display: flex;
          align-items: start;
          gap: 12px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
          line-height: 1.5;
        }
        .ocr-notice .icon {
          font-size: 20px;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .ocr-progress {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #f0f9ff;
          border: 2px solid #3b82f6;
          border-radius: 8px;
          margin-bottom: 16px;
          font-weight: 500;
          color: #1e40af;
        }
        .progress-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid #93c5fd;
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .btn-primary { 
          display: inline-flex; 
          align-items: center; 
          gap: 8px; 
          padding: 10px 20px; 
          border-radius: 8px; 
          font-weight: 600; 
          background: #010139; 
          color: white; 
          border: none; 
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-primary:hover:not(:disabled) { 
          background: #020270; 
          transform: translateY(-1px);
        }
        .btn-primary:disabled { 
          opacity: 0.5; 
          cursor: not-allowed;
        }
        
        .test-result-container {
          margin-top: 24px;
        }
        .test-result {
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .test-result.success { 
          background: #f0f9ff;
          border: 2px solid #3b82f6;
        }
        .test-result.error { 
          background: #fef2f2;
          border: 2px solid #ef4444;
        }
        .result-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 2px solid currentColor;
        }
        .result-header .icon {
          font-size: 24px;
        }
        .result-header h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0;
        }
        .test-result.success .result-header {
          color: #3b82f6;
        }
        .test-result.error .result-header {
          color: #ef4444;
        }
        
        .mapping-section, .preview-section {
          margin-bottom: 32px;
        }
        .mapping-section h4, .preview-section h4 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 16px;
        }
        
        .mapping-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 8px;
          background: white;
          padding: 16px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
        }
        .mapping-header {
          font-weight: 700;
          font-size: 13px;
          text-transform: uppercase;
          color: #64748b;
          padding: 8px;
          text-align: center;
        }
        .mapping-cell {
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          font-family: 'Courier New', monospace;
        }
        .mapping-cell.original {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
        }
        .mapping-cell.normalized.mapped {
          background: #dbeafe;
          border: 1px solid #3b82f6;
          font-weight: 600;
          color: #1e40af;
        }
        .mapping-cell.normalized.same {
          background: #f1f5f9;
          border: 1px solid #cbd5e1;
          color: #64748b;
        }
        .mapping-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #3b82f6;
          font-weight: 700;
          font-size: 18px;
        }
        
        .table-wrapper {
          overflow-x: auto;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          background: white;
        }
        .preview-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .preview-table thead {
          background: #1e293b;
          color: white;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .preview-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }
        .preview-table tbody tr {
          border-bottom: 1px solid #e2e8f0;
        }
        .preview-table tbody tr:hover {
          background: #f8fafc;
        }
        .preview-table td {
          padding: 12px 16px;
          color: #334155;
          white-space: nowrap;
        }
        .preview-table .row-number {
          background: #f1f5f9;
          font-weight: 700;
          color: #64748b;
          text-align: center;
          width: 50px;
        }
        
        .stats-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          border: 2px solid #e2e8f0;
          text-align: center;
        }
        .stat-label {
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .stat-value {
          font-size: 32px;
          font-weight: 800;
          color: #3b82f6;
        }
        
        .error-message {
          color: #dc2626;
          font-weight: 500;
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 16px;
        }
        .error-details {
          background: #fef2f2;
          padding: 24px;
          border-radius: 12px;
          border: 2px solid #fecaca;
        }
        .error-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          color: #991b1b;
        }
        .error-header .icon {
          font-size: 28px;
        }
        .error-header h4 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
        }
        
        .missing-fields-alert {
          background: #fee2e2;
          border: 2px solid #fca5a5;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
          color: #991b1b;
        }
        .missing-fields-alert small {
          display: block;
          margin-top: 8px;
          color: #7f1d1d;
          font-size: 13px;
        }
        
        .mapping-debug {
          background: white;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          margin-top: 24px;
        }
        .mapping-debug h5 {
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 20px 0;
        }
        
        .mapping-table-container {
          overflow-x: auto;
          border-radius: 8px;
          border: 2px solid #e5e7eb;
          margin-bottom: 20px;
        }
        .mapping-comparison-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .mapping-comparison-table thead {
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }
        .mapping-comparison-table th {
          padding: 12px 16px;
          text-align: left;
          font-weight: 700;
          color: #374151;
          font-size: 13px;
          text-transform: uppercase;
        }
        .mapping-comparison-table tbody tr {
          border-bottom: 1px solid #f3f4f6;
        }
        .mapping-comparison-table tbody tr:hover {
          background: #f9fafb;
        }
        .mapping-comparison-table tbody tr.required-field {
          background: #fef2f2;
        }
        .mapping-comparison-table tbody tr.required-field:hover {
          background: #fee2e2;
        }
        .mapping-comparison-table td {
          padding: 12px 16px;
          color: #1f2937;
        }
        .mapping-comparison-table .original-column {
          font-family: 'Courier New', monospace;
          background: #f9fafb;
          font-weight: 600;
        }
        .mapping-comparison-table .normalized-column {
          font-family: 'Courier New', monospace;
          font-weight: 600;
          color: #2563eb;
        }
        .mapping-comparison-table .arrow {
          text-align: center;
          font-size: 16px;
          color: #10b981;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .badge.mapped {
          background: #d1fae5;
          color: #065f46;
          border: 1px solid #6ee7b7;
        }
        .badge.unmapped {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }
        .badge.required {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fca5a5;
        }
        
        .help-box {
          background: #eff6ff;
          border: 2px solid #bfdbfe;
          border-radius: 8px;
          padding: 20px;
          color: #1e40af;
        }
        .help-box strong {
          display: block;
          font-size: 16px;
          margin-bottom: 12px;
          color: #1e3a8a;
        }
        .help-box ol {
          margin: 0;
          padding-left: 20px;
        }
        .help-box li {
          margin: 8px 0;
          line-height: 1.6;
        }
        
        .column-list {
          list-style: none;
          padding: 0;
          margin: 8px 0 0 0;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 8px;
        }
        .column-list li {
          background: #f1f5f9;
          padding: 8px 12px;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          border: 1px solid #e2e8f0;
        }
        
        @media (max-width: 768px) {
          .test-form {
            grid-template-columns: 1fr;
          }
          .mapping-grid {
            grid-template-columns: 1fr;
            gap: 4px;
          }
          .mapping-arrow {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
