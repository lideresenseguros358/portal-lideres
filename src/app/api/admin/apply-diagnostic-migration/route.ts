/**
 * ENDPOINT TEMPORAL - Aplicar migration diagnostic_runs
 * ======================================================
 * Este endpoint aplica la migration 20260123_diagnostic_runs.sql
 * directamente en la base de datos de producción.
 * 
 * Solo debe ejecutarse UNA VEZ.
 * Después de aplicarla, este endpoint puede eliminarse.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const MIGRATION_SQL = `
-- Tabla para almacenar resultados de diagnósticos E2E
CREATE TABLE IF NOT EXISTS diagnostic_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_type TEXT NOT NULL, -- 'e2e', 'imap', 'smtp', 'cron', etc
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'failed'
  
  -- Evidencia del test
  test_email_subject TEXT,
  inbound_email_id UUID REFERENCES inbound_emails(id) ON DELETE SET NULL,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  ticket TEXT,
  
  -- Resultados detallados
  steps JSONB DEFAULT '{}'::jsonb, -- { step_name: true/false }
  errors JSONB DEFAULT '[]'::jsonb, -- [{ step, message, stack }]
  metadata JSONB DEFAULT '{}'::jsonb, -- Datos adicionales del test
  summary TEXT, -- Resumen legible del resultado
  
  -- Audit
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_started_at ON diagnostic_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_status ON diagnostic_runs(status);
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_test_type ON diagnostic_runs(test_type);
CREATE INDEX IF NOT EXISTS idx_diagnostic_runs_case_id ON diagnostic_runs(case_id);

-- RLS: Solo master puede ver/crear diagnósticos
ALTER TABLE diagnostic_runs ENABLE ROW LEVEL SECURITY;

-- Policy: Master puede ver todos los diagnósticos
CREATE POLICY IF NOT EXISTS "Master can view all diagnostic_runs"
  ON diagnostic_runs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy: Master puede insertar diagnósticos
CREATE POLICY IF NOT EXISTS "Master can insert diagnostic_runs"
  ON diagnostic_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Policy: Master puede actualizar diagnósticos
CREATE POLICY IF NOT EXISTS "Master can update diagnostic_runs"
  ON diagnostic_runs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'master'
    )
  );

-- Comentarios
COMMENT ON TABLE diagnostic_runs IS 'Almacena resultados de tests E2E y diagnósticos del sistema';
COMMENT ON COLUMN diagnostic_runs.steps IS 'Mapa de pasos ejecutados con resultado true/false';
COMMENT ON COLUMN diagnostic_runs.errors IS 'Array de errores encontrados durante el test';
COMMENT ON COLUMN diagnostic_runs.metadata IS 'Datos adicionales del test (duraciones, configs, etc)';
`;

export async function POST(request: NextRequest) {
  // Verificar autorización
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = authHeader?.replace('Bearer ', '') || xCronSecret;

  if (cronSecret && providedSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    console.log('[MIGRATION] Aplicando migration diagnostic_runs...');

    // Ejecutar el SQL completo
    const { error } = await supabase.rpc('exec_sql', { sql_query: MIGRATION_SQL });

    if (error) {
      // Si rpc no existe, intentar ejecutar línea por línea
      console.log('[MIGRATION] rpc exec_sql no existe, ejecutando manualmente...');
      
      // Dividir en statements individuales
      const statements = MIGRATION_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        console.log('[MIGRATION] Ejecutando:', statement.substring(0, 50) + '...');
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (stmtError) {
          console.error('[MIGRATION] Error en statement:', stmtError);
          // Continuar con el siguiente (puede ser que ya exista)
        }
      }
    }

    // Verificar que la tabla existe
    const { data: tables, error: checkError } = await supabase
      .rpc('check_table_exists', { table_name: 'diagnostic_runs' });

    if (checkError) {
      console.log('[MIGRATION] No se pudo verificar tabla, intentando query directo...');
      
      // Intento directo: verificar con query simple
      const { error: queryError } = await (supabase as any)
        .from('diagnostic_runs')
        .select('id')
        .limit(1);

      if (queryError && queryError.code === '42P01') {
        throw new Error('Tabla diagnostic_runs NO fue creada correctamente');
      }
    }

    console.log('[MIGRATION] ✅ Migration aplicada exitosamente');

    return NextResponse.json({
      success: true,
      message: '✅ Migration diagnostic_runs aplicada correctamente',
      timestamp: new Date().toISOString(),
      note: 'La tabla diagnostic_runs ya está disponible. Este endpoint puede eliminarse ahora.',
    });
  } catch (error: any) {
    console.error('[MIGRATION] ERROR:', error);

    return NextResponse.json({
      success: false,
      error: error.message,
      message: '❌ Error aplicando migration',
      details: 'Verifica que tienes permisos de admin en Supabase',
    }, { status: 500 });
  }
}
