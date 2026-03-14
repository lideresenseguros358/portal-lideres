'use client';

import { useState } from 'react';
import EmissionLoadingModal from '@/components/cotizadores/EmissionLoadingModal';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  response?: any;
  error?: string;
}

const TEST_CASES = [
  {
    name: '✅ DT - Visa (aprobada)',
    body: {
      amount: 25.0,
      description: 'Test DT Visa - Regional',
      concept: 'Prima contado - Daños a Terceros',
      cardNumber: '4059310181757001',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Juan Prueba Visa',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: true,
  },
  {
    name: '✅ DT - Mastercard (aprobada)',
    body: {
      amount: 30.5,
      description: 'Test DT Mastercard - Regional',
      concept: 'Prima contado - Daños a Terceros',
      cardNumber: '5517747952039692',
      expMonth: '06',
      expYear: '29',
      cvv: '456',
      cardholderName: 'Maria Prueba MC',
      cardType: 'MASTERCARD',
      email: 'maria@test.com',
      phone: '60005678',
    },
    expectSuccess: true,
  },
  {
    name: '✅ CC - Visa (aprobada)',
    body: {
      amount: 150.0,
      description: 'Test CC Visa - Regional',
      concept: 'Prima contado - Cobertura Completa',
      cardNumber: '4916012776136988',
      expMonth: '03',
      expYear: '28',
      cvv: '789',
      cardholderName: 'Carlos Test Visa',
      cardType: 'VISA',
      email: 'carlos@test.com',
      phone: '60009999',
    },
    expectSuccess: true,
  },
  {
    name: '✅ CC - Mastercard (aprobada)',
    body: {
      amount: 200.75,
      description: 'Test CC Mastercard - Regional',
      concept: 'Prima contado - Cobertura Completa',
      cardNumber: '5451819737278230',
      expMonth: '09',
      expYear: '31',
      cvv: '321',
      cardholderName: 'Ana Test MC',
      cardType: 'MASTERCARD',
      email: 'ana@test.com',
      phone: '60007777',
    },
    expectSuccess: true,
  },
  {
    name: '❌ Tarjeta inválida (número inventado)',
    body: {
      amount: 25.0,
      description: 'Error Test',
      concept: 'Test',
      cardNumber: '1234567890123456',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
  {
    name: '❌ Monto cero',
    body: {
      amount: 0,
      description: 'Error Test',
      concept: 'Test',
      cardNumber: '4059310181757001',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
  {
    name: '❌ Monto negativo',
    body: {
      amount: -10,
      description: 'Error Test',
      concept: 'Test',
      cardNumber: '4059310181757001',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
  {
    name: '❌ Sin número de tarjeta',
    body: {
      amount: 25,
      description: 'Error Test',
      concept: 'Test',
      cardNumber: '',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
  {
    name: '❌ Sin descripción ni concepto',
    body: {
      amount: 25,
      description: '',
      concept: '',
      cardNumber: '4059310181757001',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
  {
    name: '❌ Tarjeta corta (6 dígitos)',
    body: {
      amount: 25,
      description: 'Error Test',
      concept: 'Test',
      cardNumber: '411111',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
  {
    name: '❌ Body vacío (sin campos)',
    body: {},
    expectSuccess: false,
  },
  {
    name: '❌ Monto bajo mínimo ($0.50)',
    body: {
      amount: 0.5,
      description: 'Error Test',
      concept: 'Test',
      cardNumber: '4059310181757001',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Test Error',
      cardType: 'VISA',
      email: 'test@test.com',
      phone: '60001234',
    },
    expectSuccess: false,
  },
];

// ═══ RECURRENT PAYMENT TEST SCENARIOS ═══
interface RecurrentTestCase {
  name: string;
  description: string;
  chargeBody: Record<string, any>;
  totalInstallments: number;
  installmentAmount: number;
  recurrentConcept: string;
}

const RECURRENT_TESTS: RecurrentTestCase[] = [
  {
    name: '🔄 DT FEDPA - 2 cuotas $79.13 (Visa)',
    description: 'Cobrar cuota 1 inmediato + registrar recurrencia cuota 2',
    chargeBody: {
      amount: 79.13,
      description: 'Póliza DT - FEDPA Seguros - Pedro Test',
      concept: 'Prima cuota 1/2 - Daños a Terceros',
      cardNumber: '4059310181757001',
      expMonth: '12',
      expYear: '30',
      cvv: '123',
      cardholderName: 'Pedro Test Visa',
      cardType: 'VISA',
      email: 'pedro@test.com',
      phone: '60001234',
    },
    totalInstallments: 2,
    installmentAmount: 79.13,
    recurrentConcept: 'Prima cuota recurrente - Daños a Terceros',
  },
  {
    name: '🔄 CC Regional - 10 cuotas $56.99 (MC)',
    description: '$569.89 total / 10 cuotas = $56.99/cuota',
    chargeBody: {
      amount: 56.99,
      description: 'Póliza CC - Regional Seguros - Ana Test',
      concept: 'Prima cuota 1/10 - Cobertura Completa',
      cardNumber: '5517747952039692',
      expMonth: '06',
      expYear: '29',
      cvv: '456',
      cardholderName: 'Ana Test MC',
      cardType: 'MASTERCARD',
      email: 'ana@test.com',
      phone: '60007777',
    },
    totalInstallments: 10,
    installmentAmount: 56.99,
    recurrentConcept: 'Prima cuota recurrente - Cobertura Completa',
  },
  {
    name: '🔄 CC Regional - 6 cuotas $94.98 (Visa)',
    description: '$569.89 total / 6 cuotas = $94.98/cuota',
    chargeBody: {
      amount: 94.98,
      description: 'Póliza CC - Regional Seguros - Luis Test',
      concept: 'Prima cuota 1/6 - Cobertura Completa',
      cardNumber: '4916012776136988',
      expMonth: '03',
      expYear: '28',
      cvv: '789',
      cardholderName: 'Luis Test Visa',
      cardType: 'VISA',
      email: 'luis@test.com',
      phone: '60008888',
    },
    totalInstallments: 6,
    installmentAmount: 94.98,
    recurrentConcept: 'Prima cuota recurrente - Cobertura Completa',
  },
  {
    name: '🔄 CC Regional - 2 cuotas $284.95 (MC)',
    description: '$569.89 total / 2 cuotas = $284.95/cuota',
    chargeBody: {
      amount: 284.95,
      description: 'Póliza CC - Regional Seguros - Carmen Test',
      concept: 'Prima cuota 1/2 - Cobertura Completa',
      cardNumber: '5451819737278230',
      expMonth: '09',
      expYear: '31',
      cvv: '321',
      cardholderName: 'Carmen Test MC',
      cardType: 'MASTERCARD',
      email: 'carmen@test.com',
      phone: '60005555',
    },
    totalInstallments: 2,
    installmentAmount: 284.95,
    recurrentConcept: 'Prima cuota recurrente - Cobertura Completa',
  },
];

interface RecurrentResult {
  name: string;
  description: string;
  status: 'pending' | 'running' | 'pass' | 'fail';
  chargeResponse?: any;
  recurrentResponse?: any;
  error?: string;
}

export default function TestPagueloFacilPage() {
  const [results, setResults] = useState<TestResult[]>(
    TEST_CASES.map((tc) => ({ name: tc.name, status: 'pending' as const }))
  );
  const [recResults, setRecResults] = useState<RecurrentResult[]>(
    RECURRENT_TESTS.map((tc) => ({ name: tc.name, description: tc.description, status: 'pending' as const }))
  );
  const [running, setRunning] = useState(false);
  const [runningRec, setRunningRec] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalProgress, setModalProgress] = useState(0);
  const [modalStep, setModalStep] = useState('');

  const runAllTests = async () => {
    setRunning(true);
    const newResults: TestResult[] = [];

    for (let i = 0; i < TEST_CASES.length; i++) {
      const tc = TEST_CASES[i]!;
      setResults((prev) => {
        const updated = [...prev];
        updated[i] = { name: tc.name, status: 'running' };
        return updated;
      });

      try {
        const res = await fetch('/api/paguelofacil/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tc.body),
        });
        const data = await res.json();

        const passed =
          (tc.expectSuccess && data.success) ||
          (!tc.expectSuccess && !data.success);

        const result: TestResult = {
          name: tc.name,
          status: passed ? 'pass' : 'fail',
          response: data,
        };
        newResults.push(result);
        setResults((prev) => {
          const updated = [...prev];
          updated[i] = result;
          return updated;
        });
      } catch (err: any) {
        const result: TestResult = {
          name: tc.name,
          status: tc.expectSuccess ? 'fail' : 'pass',
          error: err.message,
        };
        newResults.push(result);
        setResults((prev) => {
          const updated = [...prev];
          updated[i] = result;
          return updated;
        });
      }

      // Small delay between tests
      await new Promise((r) => setTimeout(r, 500));
    }

    setRunning(false);
  };

  // ═══ Run Recurrent Payment Tests ═══
  const runRecurrentTests = async () => {
    setRunningRec(true);

    for (let i = 0; i < RECURRENT_TESTS.length; i++) {
      const tc = RECURRENT_TESTS[i]!;
      setRecResults((prev) => {
        const updated = [...prev];
        updated[i] = { name: tc.name, description: tc.description, status: 'running' };
        return updated;
      });

      try {
        // Step 1: Charge first installment
        const chargeRes = await fetch('/api/paguelofacil/charge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tc.chargeBody),
        });
        const chargeData = await chargeRes.json();

        if (!chargeData.success) {
          setRecResults((prev) => {
            const updated = [...prev];
            updated[i] = {
              name: tc.name,
              description: tc.description,
              status: 'fail',
              chargeResponse: chargeData,
              error: `Cobro inicial falló: ${chargeData.error}`,
            };
            return updated;
          });
          continue;
        }

        // Step 2: Register recurrence using codOper
        const recRes = await fetch('/api/paguelofacil/recurrent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            codOper: chargeData.codOper,
            amount: tc.installmentAmount,
            description: tc.chargeBody.description,
            concept: tc.recurrentConcept,
            email: tc.chargeBody.email,
            phone: tc.chargeBody.phone,
            totalInstallments: tc.totalInstallments,
          }),
        });
        const recData = await recRes.json();

        const passed = chargeData.success && recData.success;
        setRecResults((prev) => {
          const updated = [...prev];
          updated[i] = {
            name: tc.name,
            description: tc.description,
            status: passed ? 'pass' : 'fail',
            chargeResponse: chargeData,
            recurrentResponse: recData,
            error: !passed ? (recData.error || 'Recurrencia no registrada') : undefined,
          };
          return updated;
        });
      } catch (err: any) {
        setRecResults((prev) => {
          const updated = [...prev];
          updated[i] = {
            name: tc.name,
            description: tc.description,
            status: 'fail',
            error: err.message,
          };
          return updated;
        });
      }

      await new Promise((r) => setTimeout(r, 800));
    }

    setRunningRec(false);
  };

  const showErrorInModal = (errorMsg: string) => {
    setModalError(null);
    setModalProgress(2);
    setModalStep('Procesando pago con tarjeta...');
    setShowModal(true);

    // Simulate the flow: show processing then error
    setTimeout(() => {
      setModalError(errorMsg);
    }, 1000);
  };

  const errorTests = results.filter(
    (r) => r.status === 'pass' && r.response && !r.response.success
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-[#010139] mb-2">
          🧪 Test PagueloFacil Charge API
        </h1>
        <p className="text-gray-600 mb-6">
          Pruebas E2E del endpoint /api/paguelofacil/charge con tarjetas sandbox
        </p>

        <div className="flex gap-4 mb-6">
          <button
            onClick={runAllTests}
            disabled={running}
            className={`px-6 py-3 rounded-xl font-bold text-white transition-all ${
              running
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#8AAA19] hover:bg-[#6d8814]'
            }`}
          >
            {running ? '⏳ Ejecutando...' : '▶️ Ejecutar Todas las Pruebas'}
          </button>
        </div>

        {/* Test Results Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          <table className="w-full">
            <thead className="bg-[#010139] text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm">#</th>
                <th className="px-4 py-3 text-left text-sm">Test</th>
                <th className="px-4 py-3 text-left text-sm">Estado</th>
                <th className="px-4 py-3 text-left text-sm">Respuesta</th>
                <th className="px-4 py-3 text-left text-sm">Acción</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b ${
                    r.status === 'pass'
                      ? 'bg-green-50'
                      : r.status === 'fail'
                      ? 'bg-red-50'
                      : r.status === 'running'
                      ? 'bg-yellow-50'
                      : ''
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {r.status === 'pending' && (
                      <span className="text-gray-400">⏸ Pendiente</span>
                    )}
                    {r.status === 'running' && (
                      <span className="text-yellow-600 animate-pulse">
                        ⏳ Ejecutando...
                      </span>
                    )}
                    {r.status === 'pass' && (
                      <span className="text-green-600 font-bold">
                        ✅ PASÓ
                      </span>
                    )}
                    {r.status === 'fail' && (
                      <span className="text-red-600 font-bold">
                        ❌ FALLÓ
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono max-w-xs truncate">
                    {r.response && (
                      <span
                        className={
                          r.response.success
                            ? 'text-green-700'
                            : 'text-red-700'
                        }
                      >
                        {r.response.success
                          ? `${r.response.codOper} | $${r.response.totalPay} | ${r.response.cardType}`
                          : r.response.error}
                      </span>
                    )}
                    {r.error && (
                      <span className="text-red-700">{r.error}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.response && !r.response.success && (
                      <button
                        onClick={() => showErrorInModal(r.response.error)}
                        className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded-lg font-medium"
                      >
                        Ver en Modal
                      </button>
                    )}
                    {r.response && r.response.success && (
                      <button
                        onClick={() => {
                          setModalError(null);
                          setModalProgress(0);
                          setModalStep('Procesando pago con tarjeta...');
                          setShowModal(true);
                          let p = 0;
                          const interval = setInterval(() => {
                            p += 20;
                            setModalProgress(p);
                            if (p >= 100) {
                              clearInterval(interval);
                              setModalStep('¡Pago aprobado!');
                            } else if (p >= 60) {
                              setModalStep('Emitiendo póliza...');
                            } else if (p >= 30) {
                              setModalStep(
                                `Pago aprobado: $${r.response.totalPay} USD`
                              );
                            }
                          }, 600);
                        }}
                        className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded-lg font-medium"
                      >
                        Ver en Modal
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ═══ RECURRENT PAYMENT TESTS ═══ */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[#010139] mb-2 mt-8">
            🔄 Pruebas de Pagos Recurrentes (Cuotas)
          </h2>
          <p className="text-gray-600 mb-4 text-sm">
            Cada test cobra la primera cuota con AuthCapture y luego registra la recurrencia con el codOper obtenido.
          </p>

          <button
            onClick={runRecurrentTests}
            disabled={runningRec}
            className={`px-6 py-3 rounded-xl font-bold text-white transition-all mb-4 ${
              runningRec
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {runningRec ? '⏳ Ejecutando Recurrentes...' : '▶️ Ejecutar Pruebas de Cuotas'}
          </button>

          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-blue-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm">#</th>
                  <th className="px-4 py-3 text-left text-sm">Test</th>
                  <th className="px-4 py-3 text-left text-sm">Estado</th>
                  <th className="px-4 py-3 text-left text-sm">Cobro Cuota 1</th>
                  <th className="px-4 py-3 text-left text-sm">Recurrencia</th>
                </tr>
              </thead>
              <tbody>
                {recResults.map((r, i) => (
                  <tr
                    key={i}
                    className={`border-b ${
                      r.status === 'pass'
                        ? 'bg-green-50'
                        : r.status === 'fail'
                        ? 'bg-red-50'
                        : r.status === 'running'
                        ? 'bg-yellow-50'
                        : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-gray-500">{r.description}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {r.status === 'pending' && <span className="text-gray-400">⏸ Pendiente</span>}
                      {r.status === 'running' && <span className="text-yellow-600 animate-pulse">⏳ Ejecutando...</span>}
                      {r.status === 'pass' && <span className="text-green-600 font-bold">✅ PASÓ</span>}
                      {r.status === 'fail' && <span className="text-red-600 font-bold">❌ FALLÓ</span>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {r.chargeResponse && (
                        <span className={r.chargeResponse.success ? 'text-green-700' : 'text-red-700'}>
                          {r.chargeResponse.success
                            ? `${r.chargeResponse.codOper} | $${r.chargeResponse.totalPay} | ${r.chargeResponse.cardType}`
                            : r.chargeResponse.error}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">
                      {r.recurrentResponse && (
                        <span className={r.recurrentResponse.success ? 'text-blue-700' : 'text-red-700'}>
                          {r.recurrentResponse.success
                            ? `${r.recurrentResponse.codOper} | $${r.recurrentResponse.totalPay} | ${RECURRENT_TESTS[i]!.totalInstallments - 1} cuota(s) restante(s)`
                            : r.recurrentResponse.error}
                        </span>
                      )}
                      {r.error && !r.recurrentResponse && (
                        <span className="text-red-700">{r.error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        {!running && results.some((r) => r.status !== 'pending') && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              📊 Resumen
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-green-600">
                  {results.filter((r) => r.status === 'pass').length}
                </div>
                <div className="text-sm text-green-700">Pasaron</div>
              </div>
              <div className="bg-red-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-red-600">
                  {results.filter((r) => r.status === 'fail').length}
                </div>
                <div className="text-sm text-red-700">Fallaron</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">
                  {results.length}
                </div>
                <div className="text-sm text-blue-700">Total</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Modal Preview Section */}
        {errorTests.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-[#010139] mb-4">
              🔴 Errores — Click para ver en Modal de Emisión
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {errorTests.map((r, i) => (
                <button
                  key={i}
                  onClick={() => showErrorInModal(r.response.error)}
                  className="p-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-xl text-left transition-all"
                >
                  <div className="text-sm font-bold text-red-800 mb-1">
                    {r.name}
                  </div>
                  <div className="text-xs text-red-600">{r.response.error}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Emission Loading Modal */}
      <EmissionLoadingModal
        isOpen={showModal}
        progress={modalProgress}
        currentStep={modalStep}
        error={modalError}
        onClose={() => {
          setShowModal(false);
          setModalError(null);
        }}
        onComplete={() => {
          setShowModal(false);
        }}
      />
    </div>
  );
}
