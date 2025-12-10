'use client';

import { useState, useTransition } from 'react';
import { FaVial, FaCheckCircle, FaTimesCircle, FaTable } from 'react-icons/fa';
import { actionPreviewMapping } from '@/app/(app)/insurers/actions';

interface TestsTabProps {
  insurerId: string;
}

export default function TestsTab({ insurerId }: TestsTabProps) {
  const [testFile, setTestFile] = useState<File | null>(null);
  const [target, setTarget] = useState('COMMISSIONS');
  const [testResult, setTestResult] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const handleTest = () => {
    if (!testFile) return;
    startTransition(async () => {
      try {
        // Leer el archivo como ArrayBuffer para soportar .xls y .xlsx
        const arrayBuffer = await testFile.arrayBuffer();
        const result = await actionPreviewMapping({
          insurerId,
          targetField: target,
          fileBuffer: arrayBuffer,
          fileName: testFile.name,
        });
        setTestResult(result);
      } catch (error) {
        setTestResult({
          ok: false,
          error: error instanceof Error ? error.message : 'Error al procesar el archivo'
        });
      }
    });
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Pruebas de Mapeo</h2>
      <p className="mb-4">Sube un archivo de ejemplo para verificar que las reglas de mapeo funcionan correctamente.</p>

      <div className="test-form">
        <select value={target} onChange={e => setTarget(e.target.value)}>
          <option value="COMMISSIONS">Comisiones</option>
          <option value="DELINQUENCY">Morosidad</option>
        </select>
        <input 
          type="file" 
          accept=".csv,.xlsx,.xls"
          onChange={(e) => setTestFile(e.target.files?.[0] || null)}
        />
        <button onClick={handleTest} className="btn-primary" disabled={isPending || !testFile}>
          <FaVial /> {isPending ? 'Probando...' : 'Probar Mapeo'}
        </button>
      </div>

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
                  <p><strong>Error:</strong> {testResult.data?.error}</p>
                  {testResult.data?.originalHeaders && (
                    <div className="mt-3">
                      <p className="font-semibold">Columnas detectadas:</p>
                      <ul className="column-list">
                        {testResult.data.originalHeaders.map((h: string, i: number) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
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
        }
        .error-details {
          background: white;
          padding: 16px;
          border-radius: 8px;
          border: 1px solid #fecaca;
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
