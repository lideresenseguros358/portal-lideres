'use client';

import { useState, useTransition } from 'react';
import { FaVial } from 'react-icons/fa';
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
      const content = await testFile.text();
      const result = await actionPreviewMapping({
        insurerId,
        targetField: target,
        fileContent: content,
      });
      setTestResult(result);
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
          accept=".csv,.xlsx"
          onChange={(e) => setTestFile(e.target.files?.[0] || null)}
        />
        <button onClick={handleTest} className="btn-primary" disabled={isPending || !testFile}>
          <FaVial /> {isPending ? 'Probando...' : 'Probar Mapeo'}
        </button>
      </div>

      {testResult && (
        <div className={`test-result ${testResult.ok ? 'ok' : 'error'}`}>
          {testResult.ok ? (
            <div>
              <p className="font-bold">✓ Mapeo Exitoso</p>
              <pre>{JSON.stringify(testResult.data, null, 2)}</pre>
            </div>
          ) : (
            <div>
              <p className="font-bold">✗ Error en Mapeo</p>
              <p>{testResult.error}</p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .test-form { display: grid; grid-template-columns: auto 1fr auto; gap: 16px; align-items: center; margin-bottom: 24px; }
        .test-form select, .test-form input { padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
        .test-result { margin-top: 24px; padding: 16px; border-radius: 8px; }
        .test-result.ok { background: #e8f5e9; color: #2e7d32; }
        .test-result.error { background: #ffebee; color: #d32f2f; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; font-weight: 500; background: #010139; color: white; border: none; cursor: pointer; }
        .btn-primary:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
