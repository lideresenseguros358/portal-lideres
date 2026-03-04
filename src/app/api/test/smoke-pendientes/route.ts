/**
 * SMOKE TEST — Pendientes (Cases) E2E Pipeline
 * ==============================================
 * Sends realistic test emails from portal@ → tramites@ via Zepto,
 * then triggers IMAP ingestion and verifies Vertex classification + case creation.
 *
 * Test scenarios:
 *   1. Vida ASSA — Emisión nueva póliza (ticket exception: ASSA Vida Regular)
 *   2. Ramos Generales — Reclamo incendio FEDPA
 *   3. Auto Internacional — Modificación de póliza
 *   4. Salud ASSA — Reembolso médico (ticket exception: ASSA Salud)
 *   5. Vida General — Cancelación BMI
 *   6. Hogar — Cotización MAPFRE
 *
 * Each email simulates a master writing on behalf of a corredor/client,
 * including broker details in the body as required by the system.
 *
 * GET /api/test/smoke-pendientes
 * GET /api/test/smoke-pendientes?phase=send        (only send emails)
 * GET /api/test/smoke-pendientes?phase=ingest       (only run IMAP ingestion)
 * GET /api/test/smoke-pendientes?phase=verify       (only check DB for results)
 * GET /api/test/smoke-pendientes?phase=all          (default: send → ingest → verify)
 * GET /api/test/smoke-pendientes?dry_run=true       (log what would be sent, no actual sends)
 *
 * Auth: Authorization: Bearer <CRON_SECRET>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { emailService } from '@/lib/email/emailService';
import { checkImapEnvStatusTramites } from '@/lib/email/zohoImapConfigTramites';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ════════════════════════════════════════════
// TEST SCENARIOS
// ════════════════════════════════════════════

interface SmokeScenario {
  id: string;
  label: string;
  expectedCaseType: string;
  expectedRamo: string;
  expectedAseguradora: string;
  subject: string;
  body: string;
}

const TRAMITES_EMAIL = 'tramites@lideresenseguros.com';

function buildScenarios(timestamp: string): SmokeScenario[] {
  const tag = `[SMOKE-${timestamp}]`;
  return [
    {
      id: 'vida-assa-emision',
      label: 'Vida ASSA — Emisión nueva póliza',
      expectedCaseType: 'emision',
      expectedRamo: 'vida',
      expectedAseguradora: 'ASSA',
      subject: `${tag} Solicitud de emisión póliza vida individual — ASSA Compañía de Seguros`,
      body: `Estimados,

Solicito la emisión de una póliza de Vida Individual con ASSA Compañía de Seguros para el siguiente cliente:

Corredor: María Fernández — corredor código CF-1042
Email corredor: maria.fernandez@corredorespty.com

Cliente: Juan Carlos Rodríguez Pérez
Cédula: 8-842-1567
Fecha de nacimiento: 15/03/1985
Email: jcrodriguez@gmail.com
Teléfono: 6745-8923

Plan: Vida Regular Individual
Suma asegurada: B/. 50,000.00
Beneficiario: Ana María Rodríguez (esposa) — 100%

Adjunto formulario de solicitud y copia de cédula.

Saludos,
Master Operaciones — Líderes en Seguros`,
    },
    {
      id: 'generales-reclamo-incendio',
      label: 'Ramos Generales — Reclamo incendio FEDPA',
      expectedCaseType: 'reclamo',
      expectedRamo: 'incendio',
      expectedAseguradora: 'FEDPA',
      subject: `${tag} Reclamo siniestro incendio — Póliza INC-2024-0892 FEDPA`,
      body: `Buenas tardes,

Reporto un reclamo de siniestro de incendio para la siguiente póliza:

Corredor responsable: Carlos Mendoza
Email corredor: cmendoza@lideresenseguros.com

Aseguradora: FEDPA Seguros
Póliza número: INC-2024-0892
Ramo: Incendio y Líneas Aliadas

Cliente: Corporación Industrial del Istmo, S.A.
RUC: 1548-234-189234
Representante legal: Roberto Jiménez
Email: rjimenez@corinsa.com.pa
Teléfono: 264-8900

Descripción del siniestro:
El día 28 de febrero de 2026, se produjo un incendio en la bodega principal ubicada en 
Parque Industrial Costa del Este, causando daños estimados en B/. 85,000.00 a mercancía 
almacenada y estructura.

Se adjunta informe preliminar de bomberos y fotografías del siniestro.

Atentamente,
Equipo de Trámites — Líderes en Seguros`,
    },
    {
      id: 'auto-is-modificacion',
      label: 'Auto Internacional — Modificación de póliza',
      expectedCaseType: 'modificacion',
      expectedRamo: 'auto',
      expectedAseguradora: 'Internacional',
      subject: `${tag} Solicitud cambio de vehículo — Póliza AUTO 1-30-45678 Internacional de Seguros`,
      body: `Estimados,

Solicito la modificación de la siguiente póliza de auto:

Corredor: Yo mismo soy el corredor, Pedro Alvarez — código PA-2089
Email: palvarez@lideresenseguros.com

Aseguradora: Internacional de Seguros
Póliza: 1-30-45678
Ramo: Automóvil

Cliente / Asegurado: Pedro Alvarez
Cédula: 4-789-2345
Email: palvarez.personal@gmail.com

Cambio solicitado:
- Retirar vehículo actual: Toyota Corolla 2022, placa AB1234
- Agregar nuevo vehículo: Hyundai Tucson 2025, placa CD5678
  VIN: 5NMSG4AG2RH123456
  Color: Gris
  Motor: G4KJ-2025-789

Mantener mismas coberturas y suma asegurada.

Gracias,
Pedro Alvarez
Corredor Asociado — Líderes en Seguros`,
    },
    {
      id: 'salud-assa-reembolso',
      label: 'Salud ASSA — Reembolso médico',
      expectedCaseType: 'reclamo',
      expectedRamo: 'salud',
      expectedAseguradora: 'ASSA',
      subject: `${tag} Solicitud reembolso gastos médicos — ASSA Salud póliza SAL-2024-3456`,
      body: `Buenas,

Presento solicitud de reembolso de gastos médicos:

Corredor: Lucía Castillo — código LC-3012
Email corredor: lcastillo@segurospty.com

Aseguradora: ASSA Compañía de Seguros
Póliza: SAL-2024-3456
Producto: ASSA Salud — Plan Premium

Asegurado: Gabriela Torres Vega
Cédula: 2-345-6789
Email: gtorres@hotmail.com

Detalle del reembolso:
- Consulta médica Dr. Martínez (cardiólogo): B/. 150.00
- Laboratorio clínico — perfil lipídico: B/. 85.00
- Electrocardiograma: B/. 120.00
- Medicamentos (receta adjunta): B/. 67.50
Total reclamado: B/. 422.50

Fecha de atención: 25 de febrero de 2026
Centro médico: Hospital Nacional, Panamá

Adjunto facturas, recetas y formulario de reembolso.

Saludos,
Master Lucía Castillo — Líderes en Seguros`,
    },
    {
      id: 'vida-cancelacion-bmi',
      label: 'Vida General — Cancelación BMI',
      expectedCaseType: 'cancelacion',
      expectedRamo: 'vida',
      expectedAseguradora: 'BMI',
      subject: `${tag} Solicitud de cancelación póliza vida — BMI VID-2023-7890`,
      body: `Estimados,

Solicito la cancelación de la siguiente póliza:

Corredor: Ana Sofía Ríos — código AR-1578
Email corredor: arios@lideresenseguros.com

Aseguradora: BMI (British American Insurance)
Póliza: VID-2023-7890
Ramo: Vida Individual

Asegurado: Miguel Ángel Herrera
Cédula: 9-234-5678
Email: maherrera@outlook.com
Teléfono: 6234-5678

Motivo de cancelación: El cliente no desea continuar con el seguro por razones económicas.
Solicita cancelación efectiva al final del período vigente (31 de marzo de 2026).

Favor confirmar si aplica devolución proporcional de prima.

Atentamente,
Equipo de Operaciones — Líderes en Seguros`,
    },
    {
      id: 'hogar-cotizacion-mapfre',
      label: 'Hogar — Cotización MAPFRE',
      expectedCaseType: 'cotizacion',
      expectedRamo: 'hogar',
      expectedAseguradora: 'MAPFRE',
      subject: `${tag} Cotización seguro de hogar — MAPFRE Panamá`,
      body: `Buenos días,

Solicito cotización de seguro de hogar con MAPFRE para el siguiente cliente:

Corredor: Roberto Gómez — código RG-0845
Email corredor: rgomez@lideresenseguros.com

Cliente: Familia Gómez Ruiz
Cédula del titular: 6-123-4567
Email: rgomez.familia@gmail.com
Teléfono: 6890-1234

Datos del inmueble:
- Dirección: Calle 50, Edificio Torre del Mar, Apto 12B, Panamá
- Tipo: Apartamento
- Área: 120 m²
- Año de construcción: 2018
- Valor estimado: B/. 180,000.00
- Contenido estimado: B/. 35,000.00

Coberturas solicitadas:
- Incendio y rayo
- Terremoto
- Inundación
- Robo
- Responsabilidad civil
- Daños por agua

Favor incluir opciones con y sin deducible.

Gracias,
Roberto Gómez
Corredor — Líderes en Seguros`,
    },
  ];
}

// ════════════════════════════════════════════
// RESULT TYPES
// ════════════════════════════════════════════

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'warn';
  duration_ms: number;
  detail?: string;
  error?: string;
}

// ════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const phase = searchParams.get('phase') || 'all';
  const dryRun = searchParams.get('dry_run') === 'true';

  // Auth check
  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const cronSecret = process.env.CRON_SECRET;
  const provided = authHeader?.replace('Bearer ', '') || xCronSecret;
  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized. Pass Authorization: Bearer <CRON_SECRET>' }, { status: 401 });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const scenarios = buildScenarios(timestamp);
  const results: TestResult[] = [];
  const supabase = getSupabaseAdmin();
  const startTotal = Date.now();

  // ════════════════════════════════════════════
  // PHASE 1: SEND TEST EMAILS via Zepto
  // ════════════════════════════════════════════
  if (phase === 'all' || phase === 'send') {
    // Check Zepto config
    const envStatus = emailService.getEnvStatus();
    results.push({
      name: 'Zepto Env Config',
      status: envStatus.configured ? 'pass' : 'fail',
      duration_ms: 0,
      detail: `provider=${envStatus.provider} sender=${envStatus.sender} hasKey=${envStatus.hasApiKey}`,
    });

    if (!envStatus.configured) {
      results.push({
        name: 'Send Phase',
        status: 'fail',
        duration_ms: 0,
        error: 'Zepto not configured — cannot send test emails',
      });
    } else {
      for (const sc of scenarios) {
        const t0 = Date.now();
        if (dryRun) {
          results.push({
            name: `Send: ${sc.label}`,
            status: 'skip',
            duration_ms: 0,
            detail: `[DRY RUN] Would send to ${TRAMITES_EMAIL}: "${sc.subject}"`,
          });
          continue;
        }

        try {
          const sendResult = await emailService.send({
            to: TRAMITES_EMAIL,
            subject: sc.subject,
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333;">
  <p>${sc.body.replace(/\n/g, '<br/>')}</p>
  <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;"/>
  <p style="font-size:11px;color:#999;">
    [SMOKE TEST — ID: ${sc.id} — ${timestamp}]<br/>
    Expected: case_type=${sc.expectedCaseType} ramo=${sc.expectedRamo} aseg=${sc.expectedAseguradora}
  </p>
</div>`,
            text: `${sc.body}\n\n---\n[SMOKE TEST — ID: ${sc.id} — ${timestamp}]\nExpected: case_type=${sc.expectedCaseType} ramo=${sc.expectedRamo} aseg=${sc.expectedAseguradora}`,
          });

          results.push({
            name: `Send: ${sc.label}`,
            status: sendResult.success ? 'pass' : 'fail',
            duration_ms: Date.now() - t0,
            detail: sendResult.success
              ? `messageId=${sendResult.messageId}`
              : undefined,
            error: sendResult.error || undefined,
          });

          // Small delay between sends to avoid rate limiting
          if (sendResult.success) {
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch (err: any) {
          results.push({
            name: `Send: ${sc.label}`,
            status: 'fail',
            duration_ms: Date.now() - t0,
            error: err.message,
          });
        }
      }
    }
  }

  // ════════════════════════════════════════════
  // PHASE 2: TRIGGER IMAP INGESTION
  // ════════════════════════════════════════════
  if (phase === 'all' || phase === 'ingest') {
    // If we just sent emails, wait a few seconds for delivery
    if (phase === 'all') {
      results.push({
        name: 'Delivery Wait',
        status: 'pass',
        duration_ms: 8000,
        detail: 'Waiting 8s for email delivery before IMAP fetch...',
      });
      await new Promise((r) => setTimeout(r, 8000));
    }

    // Check IMAP tramites env
    const imapStatus = checkImapEnvStatusTramites();
    results.push({
      name: 'IMAP Tramites Env Config',
      status: imapStatus.configured ? 'pass' : 'fail',
      duration_ms: 0,
      detail: `configured=${imapStatus.configured} hasUser=${imapStatus.hasUser} hasPass=${imapStatus.hasPass} host=${imapStatus.host}:${imapStatus.port}`,
    });

    // Check feature flag
    const featureEnabled = process.env.FEATURE_ENABLE_IMAP === 'true';
    results.push({
      name: 'Feature Flag: FEATURE_ENABLE_IMAP',
      status: featureEnabled ? 'pass' : 'fail',
      duration_ms: 0,
      detail: `FEATURE_ENABLE_IMAP=${process.env.FEATURE_ENABLE_IMAP || '(not set)'}`,
      error: !featureEnabled ? 'FEATURE_ENABLE_IMAP must be "true" in Vercel env vars for ingestion to work' : undefined,
    });

    if (!imapStatus.configured || !featureEnabled) {
      results.push({
        name: 'IMAP Ingestion',
        status: 'fail',
        duration_ms: 0,
        error: !imapStatus.configured
          ? 'IMAP tramites not configured — set ZOHO_IMAP_USER_TRAMITES and ZOHO_IMAP_PASS_TRAMITES'
          : 'FEATURE_ENABLE_IMAP not set to true',
      });
    } else if (dryRun) {
      results.push({
        name: 'IMAP Ingestion',
        status: 'skip',
        duration_ms: 0,
        detail: '[DRY RUN] Would run IMAP ingestion cycle',
      });
    } else {
      const t1 = Date.now();
      try {
        const { runIngestionCycle } = await import('@/lib/imap/imapIngestor');
        const ingResult = await runIngestionCycle();

        results.push({
          name: 'IMAP Ingestion Cycle',
          status: ingResult.success ? 'pass' : 'warn',
          duration_ms: Date.now() - t1,
          detail: `processed=${ingResult.messagesProcessed} created=${ingResult.casesCreated} linked=${ingResult.casesLinked} errors=${ingResult.errors.length}`,
          error: ingResult.errors.length > 0
            ? ingResult.errors.map((e) => `${e.messageId}: ${e.error}`).join('; ')
            : undefined,
        });
      } catch (err: any) {
        results.push({
          name: 'IMAP Ingestion Cycle',
          status: 'fail',
          duration_ms: Date.now() - t1,
          error: err.message,
        });
      }
    }
  }

  // ════════════════════════════════════════════
  // PHASE 3: VERIFY — Check DB for created cases
  // ════════════════════════════════════════════
  if (phase === 'all' || phase === 'verify') {
    const t2 = Date.now();

    // 3a. Check inbound_emails for our smoke test messages
    try {
      const smokeTag = `SMOKE-${timestamp}`;
      // @ts-ignore
      const { data: inboundEmails, error: inbErr } = await supabase
        .from('inbound_emails')
        .select('id, message_id, from_email, subject, processed_status, processed_at, created_at')
        .ilike('subject', `%${smokeTag}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (inbErr) {
        results.push({
          name: 'Verify: inbound_emails lookup',
          status: 'fail',
          duration_ms: Date.now() - t2,
          error: inbErr.message,
        });
      } else {
        const found = inboundEmails?.length || 0;
        results.push({
          name: 'Verify: inbound_emails found',
          status: found >= scenarios.length ? 'pass' : found > 0 ? 'warn' : 'fail',
          duration_ms: Date.now() - t2,
          detail: `Found ${found}/${scenarios.length} smoke test emails in inbound_emails. Statuses: ${
            inboundEmails?.map((e: any) => `${e.processed_status}`).join(', ') || 'none'
          }`,
        });

        // 3b. For each found email, check if it was linked to a case
        const linkedEmails = inboundEmails?.filter((e: any) => e.processed_status === 'linked') || [];
        results.push({
          name: 'Verify: emails linked to cases',
          status: linkedEmails.length >= scenarios.length ? 'pass' : linkedEmails.length > 0 ? 'warn' : 'fail',
          duration_ms: 0,
          detail: `${linkedEmails.length}/${found} emails linked to cases`,
        });
      }
    } catch (err: any) {
      results.push({
        name: 'Verify: inbound_emails',
        status: 'fail',
        duration_ms: Date.now() - t2,
        error: err.message,
      });
    }

    // 3c. Check ops_cases created recently with our smoke tag
    const t3 = Date.now();
    try {
      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // last 30 min
      // @ts-ignore
      const { data: recentCases, error: caseErr } = await supabase
        .from('ops_cases')
        .select('id, ticket, case_type, status, category, ramo, client_name, insurer_name, created_at, source')
        .gte('created_at', recentCutoff)
        .eq('source', 'email')
        .order('created_at', { ascending: false })
        .limit(20);

      if (caseErr) {
        results.push({
          name: 'Verify: ops_cases lookup',
          status: 'fail',
          duration_ms: Date.now() - t3,
          error: caseErr.message,
        });
      } else {
        const casesFound = recentCases?.length || 0;
        results.push({
          name: 'Verify: recent ops_cases (last 30min)',
          status: casesFound > 0 ? 'pass' : 'warn',
          duration_ms: Date.now() - t3,
          detail: `Found ${casesFound} recent email-sourced cases. Breakdown:\n${
            recentCases?.map((c: any) =>
              `  ${c.ticket} | type=${c.case_type} ramo=${c.ramo || '—'} status=${c.status} insurer=${c.insurer_name || '—'} client=${c.client_name || '—'}`
            ).join('\n') || '  (none)'
          }`,
        });
      }
    } catch (err: any) {
      results.push({
        name: 'Verify: ops_cases',
        status: 'fail',
        duration_ms: Date.now() - t3,
        error: err.message,
      });
    }

    // 3d. Check AI classifications
    const t4 = Date.now();
    try {
      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
      const { data: aiClasses, error: aiErr } = await supabase
        .from('pend_ai_classifications' as any)
        .select('id, case_id, case_type, ramo, aseguradora, confidence, suggested_status, status_confidence, created_at')
        .gte('created_at', recentCutoff)
        .order('created_at', { ascending: false })
        .limit(20);

      if (aiErr) {
        results.push({
          name: 'Verify: AI classifications',
          status: 'warn',
          duration_ms: Date.now() - t4,
          detail: 'pend_ai_classifications table may not exist yet',
          error: aiErr.message,
        });
      } else {
        const aiFound = aiClasses?.length || 0;
        results.push({
          name: 'Verify: AI classifications (last 30min)',
          status: aiFound > 0 ? 'pass' : 'warn',
          duration_ms: Date.now() - t4,
          detail: `Found ${aiFound} AI classifications:\n${
            aiClasses?.map((a: any) =>
              `  case=${a.case_id?.slice(0, 8) || '—'} type=${a.case_type} ramo=${a.ramo} aseg=${a.aseguradora} conf=${a.confidence} status=${a.suggested_status}(${a.status_confidence})`
            ).join('\n') || '  (none)'
          }`,
        });
      }
    } catch (err: any) {
      results.push({
        name: 'Verify: AI classifications',
        status: 'warn',
        duration_ms: Date.now() - t4,
        error: err.message,
      });
    }

    // 3e. Check IMAP debug logs for this run
    const t5 = Date.now();
    try {
      const recentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      // @ts-ignore - tabla nueva, database.types.ts pendiente de actualizar
      const { data: debugLogs, error: debugErr } = await supabase
        .from('imap_debug_log' as any)
        .select('id, stage, status, message, created_at')
        .gte('created_at', recentCutoff)
        .order('created_at', { ascending: false })
        .limit(30);

      if (debugErr) {
        results.push({
          name: 'Verify: IMAP debug logs',
          status: 'warn',
          duration_ms: Date.now() - t5,
          error: debugErr.message,
        });
      } else {
        const logCount = debugLogs?.length || 0;
        const errorLogs = debugLogs?.filter((l: any) => l.status === 'error') || [];
        results.push({
          name: 'Verify: IMAP debug logs (last 30min)',
          status: errorLogs.length > 0 ? 'warn' : logCount > 0 ? 'pass' : 'warn',
          duration_ms: Date.now() - t5,
          detail: `${logCount} log entries, ${errorLogs.length} errors. Stages: ${
            [...new Set(debugLogs?.map((l: any) => l.stage) || [])].join(', ') || 'none'
          }`,
          error: errorLogs.length > 0
            ? errorLogs.map((l: any) => `[${l.stage}] ${l.message}`).join('; ')
            : undefined,
        });
      }
    } catch (err: any) {
      results.push({
        name: 'Verify: IMAP debug logs',
        status: 'warn',
        duration_ms: Date.now() - t5,
        error: err.message,
      });
    }
  }

  // ════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════
  const totalDuration = Date.now() - startTotal;
  const passed = results.filter((r) => r.status === 'pass').length;
  const failed = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  const skipped = results.filter((r) => r.status === 'skip').length;

  return NextResponse.json({
    success: failed === 0,
    timestamp: new Date().toISOString(),
    smokeTag: `SMOKE-${timestamp}`,
    phase,
    dryRun,
    duration_ms: totalDuration,
    summary: {
      total: results.length,
      passed,
      failed,
      warnings: warns,
      skipped,
    },
    scenarios: scenarios.map((s) => ({
      id: s.id,
      label: s.label,
      expectedCaseType: s.expectedCaseType,
      expectedRamo: s.expectedRamo,
      expectedAseguradora: s.expectedAseguradora,
    })),
    results,
    env_check: {
      FEATURE_ENABLE_IMAP: process.env.FEATURE_ENABLE_IMAP || '(not set)',
      ZOHO_IMAP_USER_TRAMITES: process.env.ZOHO_IMAP_USER_TRAMITES ? '✓ set' : '✗ missing',
      ZOHO_IMAP_PASS_TRAMITES: process.env.ZOHO_IMAP_PASS_TRAMITES ? '✓ set' : '✗ missing',
      ZEPTO_API_KEY: process.env.ZEPTO_API_KEY ? '✓ set' : '✗ missing',
      ZEPTO_SENDER: process.env.ZEPTO_SENDER || '(not set)',
      FEATURE_ENABLE_VERTEX: process.env.FEATURE_ENABLE_VERTEX || '(not set)',
      GOOGLE_VERTEX_PROJECT: process.env.GOOGLE_VERTEX_PROJECT ? '✓ set' : '✗ missing',
    },
  });
}
