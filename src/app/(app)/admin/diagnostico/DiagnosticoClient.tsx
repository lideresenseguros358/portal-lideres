'use client';

/**
 * DIAGNOSTICO CLIENT - Panel de Autodiagnóstico
 * ==============================================
 * Panel interno para master que permite:
 * - Verificar variables de entorno
 * - Probar conexión IMAP
 * - Enviar email de prueba SMTP
 * - Ejecutar test E2E completo
 * - Ver resultados de cron jobs
 * - Consultar historial de diagnósticos
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Settings,
  Mail,
  MailCheck,
  PlayCircle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Database,
} from 'lucide-react';

interface DiagnosticRun {
  id: string;
  test_type: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  test_email_subject: string | null;
  ticket: string | null;
  summary: string | null;
  steps: any;
  errors: any[];
}

interface DiagnosticoClientProps {
  diagnosticRuns: any[]; // DiagnosticRun[] - any por incompatibilidad temporal con DB types
  migrationNeeded?: boolean;
}

export default function DiagnosticoClient({ diagnosticRuns: initialRuns, migrationNeeded = false }: DiagnosticoClientProps) {
  const [diagnosticRuns, setDiagnosticRuns] = useState(initialRuns);
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<any>(null);
  const [applyingMigration, setApplyingMigration] = useState(false);
  const [showMigrationAlert, setShowMigrationAlert] = useState(migrationNeeded);

  const runTest = async (testType: string, endpoint: string, method: 'GET' | 'POST' = 'GET') => {
    setLoading(testType);
    setResults(null);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'x-cron-secret': process.env.NEXT_PUBLIC_CRON_SECRET || '',
        },
      });

      const data = await response.json();
      setResults(data);

      // Recargar historial después de E2E test
      if (testType === 'e2e' && response.ok) {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error: any) {
      setResults({
        success: false,
        error: error.message,
        summary: `❌ Error ejecutando test: ${error.message}`,
      });
    } finally {
      setLoading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <Clock className="w-5 h-5 text-blue-600 animate-pulse" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      success: 'default',
      failed: 'destructive',
      running: 'secondary',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🔬 Diagnóstico del Sistema</h1>
          <p className="text-gray-600 mt-2">
            Panel de autodiagnóstico del flujo IMAP → Vertex → CaseEngine → UI
          </p>
        </div>

        {/* Alerta: Migration necesaria */}
        {showMigrationAlert && (
          <Card className="border-2 border-red-500 bg-red-50">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                  <h3 className="text-lg font-semibold text-red-900">
                    ❌ Tabla diagnostic_runs NO existe
                  </h3>
                </div>
                <div className="text-red-800 space-y-2">
                  <p className="font-semibold">
                    La migration debe ejecutarse en Supabase Dashboard:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Ir a Supabase Dashboard → SQL Editor</li>
                    <li>Ejecutar: <code className="bg-red-100 px-2 py-1 rounded">supabase/migrations/20260123_diagnostic_runs.sql</code></li>
                    <li>Recargar esta página</li>
                  </ol>
                  <p className="text-xs mt-2">
                    Sin esta tabla, los tests E2E NO pueden guardar resultados.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tests rápidos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Test: Variables de entorno */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Variables de Entorno
              </CardTitle>
              <CardDescription>
                Verificar que todas las variables requeridas estén configuradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runTest('env', '/api/diagnostics/env')}
                disabled={loading === 'env'}
                className="w-full"
              >
                {loading === 'env' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 mr-2" />
                    Verificar ENV
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test: IMAP Connection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Conexión IMAP
              </CardTitle>
              <CardDescription>
                Probar conexión real a IMAP y listar últimos mensajes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runTest('imap', '/api/diagnostics/imap')}
                disabled={loading === 'imap'}
                className="w-full"
              >
                {loading === 'imap' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Test IMAP
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test: SMTP Send */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MailCheck className="w-5 h-5" />
                Envío SMTP
              </CardTitle>
              <CardDescription>
                Enviar email de prueba desde portal@ hacia tramites@
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runTest('smtp', '/api/diagnostics/smtp', 'POST')}
                disabled={loading === 'smtp'}
                className="w-full"
              >
                {loading === 'smtp' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <MailCheck className="w-4 h-4 mr-2" />
                    Test SMTP
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test: Cron Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Cron Jobs
              </CardTitle>
              <CardDescription>
                Verificar estado de todos los cron jobs configurados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runTest('cron', '/api/diagnostics/cron')}
                disabled={loading === 'cron'}
                className="w-full"
              >
                {loading === 'cron' ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Test Cron Jobs
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Test: E2E Completo */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="w-5 h-5 text-green-600" />
                Test E2E Completo
              </CardTitle>
              <CardDescription>
                Flujo completo: SMTP → IMAP → Vertex → CaseEngine → UI (60s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => runTest('e2e', '/api/diagnostics/e2e', 'POST')}
                disabled={loading === 'e2e'}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                {loading === 'e2e' ? (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                    Ejecutando test E2E (puede tardar 60s)...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-5 h-5 mr-2" />
                    Ejecutar Test E2E
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Resultados */}
        {results && (
          <Card className={`border-2 ${results.success ? 'border-green-600' : 'border-red-600'}`}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {results.success ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="font-semibold">{results.summary}</span>
                </div>

                {/* Detalles adicionales */}
                {results.results && (
                  <pre className="mt-4 p-4 bg-gray-50 rounded text-xs overflow-auto max-h-96">
                    {JSON.stringify(results, null, 2)}
                  </pre>
                )}

                {results.steps && (
                  <div className="mt-4 space-y-2">
                    <p className="font-semibold">Pasos ejecutados:</p>
                    {results.steps.map((step: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        {step.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span>
                          {step.name} ({step.duration}ms)
                        </span>
                        {step.error && (
                          <span className="text-red-600 text-xs">- {step.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historial de diagnósticos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Historial de Diagnósticos (Últimos 20)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diagnosticRuns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No hay diagnósticos ejecutados aún
              </p>
            ) : (
              <div className="space-y-2">
                {diagnosticRuns.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      {getStatusIcon(run.status)}
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {run.test_type.toUpperCase()}
                          {getStatusBadge(run.status)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(run.started_at).toLocaleString('es-PA')}
                        </div>
                        {run.ticket && (
                          <div className="text-sm text-green-600 font-medium mt-1">
                            Caso creado: {run.ticket}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">
                        {run.summary}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
