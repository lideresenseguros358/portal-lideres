/**
 * CRON: Morosidad Auto-Emails
 *
 * Runs daily and reads from the official `delinquency` table filtered to
 * broker portal@lideresenseguros.com. Sends emails based on delinquency stage:
 *
 *   Stage 30 (bucket_1_30 > 0)    — "Aviso de morosidad" with insurer payment button
 *   Stage 60 (bucket_31_60 > 0)   — "Urgente: mora de 60 días" with insurer payment button
 *   Stage 90+ (bucket_61_90 > 0 or bucket_90_plus > 0) — "Cobertura en riesgo" notice
 *
 * Delinquency stage = worst non-zero bucket (right-to-left: 90+ > 61-90 > 31-60 > 1-30)
 * Total pending = sum of all non-zero buckets
 *
 * Tracking: delinquency.notes.morosidad_emails = { d30: "YYYY-MM-DD", d60: "...", d90: "..." }
 * (Uses ops_activity_log for audit; notes stored in delinquency row via update)
 *
 * Emails include insurer-specific payment link + auto-pay setup info.
 *
 * Protection: X-CRON-SECRET header or Vercel CRON_SECRET
 * Schedule: "0 9 * * *" (daily 4am Panama = 9am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendZeptoEmail } from '@/lib/email/zepto-api';
import { getInsurerPaymentInfo, buildInsurerPaymentBlock } from '@/lib/email/insurer-payment-links';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type DelinquencyStage = 'd30' | 'd60' | 'd90';

function getDelinquencyStage(row: any): DelinquencyStage | null {
  if ((row.bucket_61_90 ?? 0) > 0 || (row.bucket_90_plus ?? 0) > 0) return 'd90';
  if ((row.bucket_31_60 ?? 0) > 0) return 'd60';
  if ((row.bucket_1_30 ?? 0) > 0) return 'd30';
  return null;
}

function getTotalPending(row: any): number {
  return (row.bucket_1_30 ?? 0) + (row.bucket_31_60 ?? 0) + (row.bucket_61_90 ?? 0) + (row.bucket_90_plus ?? 0);
}

function getDaysRange(stage: DelinquencyStage): string {
  if (stage === 'd30') return '1–30 días';
  if (stage === 'd60') return '31–60 días';
  return '61+ días';
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'No cron secret configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  const isValid = authHeader === `Bearer ${cronSecret}` || xCronSecret === cronSecret;
  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const todayStr = new Date().toISOString().slice(0, 10);

  let sent = 0;
  let skipped = 0;
  let noEmail = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON MOROSIDAD-EMAILS] Running for date: ${todayStr}`);

    // Resolve broker_id for portal@lideresenseguros.com
    const { data: brokerRow, error: brokerErr } = await sb
      .from('brokers')
      .select('id')
      .eq('email', 'portal@lideresenseguros.com')
      .maybeSingle();

    if (brokerErr) throw new Error(`Broker lookup: ${brokerErr.message}`);

    // Fetch delinquency records for this broker with any non-zero bucket
    let query = sb
      .from('delinquency')
      .select('id, client_name, policy_number, insurer_id, broker_id, bucket_1_30, bucket_31_60, bucket_61_90, bucket_90_plus, current, total_debt, cutoff_date, notes')
      .or('bucket_1_30.gt.0,bucket_31_60.gt.0,bucket_61_90.gt.0,bucket_90_plus.gt.0');

    if (brokerRow) {
      query = query.eq('broker_id', brokerRow.id);
    }

    const { data: delinquencies, error: fetchErr } = await query;
    if (fetchErr) throw new Error(fetchErr.message);

    if (!delinquencies || delinquencies.length === 0) {
      console.log('[CRON MOROSIDAD-EMAILS] No delinquency records found');
      return NextResponse.json({ success: true, sent: 0, message: 'No delinquency records' });
    }

    console.log(`[CRON MOROSIDAD-EMAILS] Found ${delinquencies.length} delinquency records`);

    // Resolve insurer names
    const insurerIds = [...new Set(delinquencies.map((d: any) => d.insurer_id).filter(Boolean))];
    const insurerMap: Record<string, string> = {};
    if (insurerIds.length > 0) {
      const { data: insurers } = await sb.from('insurers').select('id, name').in('id', insurerIds);
      (insurers ?? []).forEach((i: any) => { insurerMap[i.id] = i.name; });
    }

    // Resolve client emails via policy_number → policies → clients
    const policyNumbers = delinquencies.map((d: any) => d.policy_number).filter(Boolean);
    const policyEmailMap: Record<string, string> = {};
    if (policyNumbers.length > 0) {
      const { data: policyRows } = await sb
        .from('policies')
        .select('policy_number, client_id')
        .in('policy_number', policyNumbers);

      const clientIds = [...new Set((policyRows ?? []).map((p: any) => p.client_id).filter(Boolean))];
      if (clientIds.length > 0) {
        const { data: clientRows } = await sb
          .from('clients')
          .select('id, email')
          .in('id', clientIds)
          .not('email', 'is', null);

        const clientEmailMap: Record<string, string> = {};
        (clientRows ?? []).forEach((c: any) => { if (c.email) clientEmailMap[c.id] = c.email; });

        (policyRows ?? []).forEach((p: any) => {
          if (p.policy_number && p.client_id && clientEmailMap[p.client_id]) {
            policyEmailMap[p.policy_number] = clientEmailMap[p.client_id]!;
          }
        });
      }
    }

    for (const row of delinquencies) {
      try {
        const stage = getDelinquencyStage(row);
        if (!stage) { skipped++; continue; }

        const notes: any = row.notes || {};
        const morosidadEmails: Record<string, string> = notes.morosidad_emails || {};

        if (morosidadEmails[stage]) { skipped++; continue; } // already sent for this stage

        const clientEmail = policyEmailMap[row.policy_number] || null;
        if (!clientEmail) { noEmail++; continue; }

        const insurerName = insurerMap[row.insurer_id] || row.insurer_id || 'su aseguradora';
        const insurerInfo = getInsurerPaymentInfo(insurerName);
        const paymentBlock = buildInsurerPaymentBlock(insurerInfo);
        const totalPending = getTotalPending(row);
        const fmtTotal = `$${Number(totalPending).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        const daysRange = getDaysRange(stage);

        const { subject, htmlBody } = buildMorosidadEmail({
          stage,
          clientName: row.client_name,
          nroPoliza: row.policy_number,
          insurerLabel: insurerInfo.label,
          totalPending: fmtTotal,
          daysRange,
          paymentBlock,
        });

        const result = await sendZeptoEmail({ to: clientEmail, subject, htmlBody, textBody: subject });

        if (result.success) {
          sent++;
          const updatedNotes = { ...notes, morosidad_emails: { ...morosidadEmails, [stage]: todayStr } };
          await sb.from('delinquency').update({ notes: updatedNotes }).eq('id', row.id);

          await sb.from('adm_cot_audit_log').insert({
            event_type: 'morosidad_auto_email',
            entity_type: 'delinquency',
            entity_id: row.id,
            detail: { stage, client_email: clientEmail, nro_poliza: row.policy_number, total_pending: totalPending },
          }).catch(() => {});

          console.log(`[CRON MOROSIDAD-EMAILS] ✅ ${stage} sent: ${row.policy_number} → ${clientEmail}`);
        } else {
          errors.push(`${row.policy_number} ${stage}: ${result.error}`);
        }
      } catch (rowErr: any) {
        errors.push(`${row.policy_number}: ${rowErr.message}`);
      }
    }

    console.log(`[CRON MOROSIDAD-EMAILS] Done: ${sent} sent, ${skipped} skipped, ${noEmail} no-email, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      timestamp: todayStr,
      sent,
      skipped,
      noEmail,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (error: any) {
    console.error('[CRON MOROSIDAD-EMAILS] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// Email HTML Builder
// ════════════════════════════════════════════

function buildMorosidadEmail(params: {
  stage: DelinquencyStage;
  clientName: string;
  nroPoliza: string;
  insurerLabel: string;
  totalPending: string;
  daysRange: string;
  paymentBlock: string;
}): { subject: string; htmlBody: string } {
  const { stage, clientName, nroPoliza, insurerLabel, totalPending, daysRange, paymentBlock } = params;

  const config: Record<DelinquencyStage, { headerBg: string; icon: string; title: string; bodyText: string; subject: string; urgencyBanner?: string }> = {
    d30: {
      headerBg: '#010139',
      icon: '💰',
      title: 'Aviso de Morosidad — Cuota Pendiente',
      subject: `Aviso de morosidad — Póliza ${nroPoliza}`,
      bodyText: `Le informamos que su póliza <strong>${nroPoliza}</strong> con <strong>${insurerLabel}</strong> presenta un saldo pendiente de <strong>${totalPending}</strong> con <strong>${daysRange}</strong> de atraso.<br/><br/>Le agradecemos realizar su pago directamente en el portal de la aseguradora para mantener su cobertura activa.`,
    },
    d60: {
      headerBg: '#d97706',
      icon: '⚠️',
      title: 'Urgente: Mora de 60 Días — Acción Requerida',
      subject: `⚠️ Urgente: mora de 60 días — Póliza ${nroPoliza}`,
      bodyText: `<strong style="color:#d97706;">AVISO IMPORTANTE:</strong> Su póliza <strong>${nroPoliza}</strong> con <strong>${insurerLabel}</strong> acumula <strong>${daysRange}</strong> de mora y un saldo pendiente de <strong>${totalPending}</strong>.<br/><br/>De no regularizar su situación a la brevedad posible, su cobertura podría verse comprometida. Le instamos a realizar el pago de inmediato.`,
      urgencyBanner: `<div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;"><strong style="color:#92400e;">⚠️ ${daysRange} de atraso — Cobertura en riesgo</strong></div>`,
    },
    d90: {
      headerBg: '#dc2626',
      icon: '🔴',
      title: 'Aviso Crítico: Mora Mayor a 60 Días',
      subject: `� Mora crítica: ${daysRange} — Póliza ${nroPoliza}`,
      bodyText: `<strong style="color:#dc2626;">AVISO CRÍTICO:</strong> Su póliza <strong>${nroPoliza}</strong> con <strong>${insurerLabel}</strong> presenta <strong>${daysRange}</strong> de mora con un saldo total de <strong>${totalPending}</strong>.<br/><br/><div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px;margin:12px 0;"><strong style="color:#dc2626;">Su cobertura podría estar SUSPENDIDA.</strong><br/><span style="color:#991b1b;font-size:13px;">Cualquier siniestro durante este período podría no tener cobertura.</span></div>Regularice su situación de inmediato comunicándose con la aseguradora.`,
      urgencyBanner: `<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:12px 16px;margin:16px 0;text-align:center;"><strong style="color:#991b1b;">🔴 MORA CRÍTICA — ${daysRange} sin pago — Saldo: ${totalPending}</strong></div>`,
    },
  };

  const c = config[stage];

  const htmlBody = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f0f2f5;">
<div style="max-width:620px;margin:24px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.10);">
<div style="background:${c.headerBg};color:white;padding:28px 24px;">
<h1 style="margin:0;font-size:20px;">${c.icon} ${c.title}</h1>
<p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Líderes en Seguros</p>
</div>
<div style="padding:24px;font-size:14px;line-height:1.7;color:#374151;">
<p>Estimado/a <strong>${clientName}</strong>,</p>
${c.urgencyBanner || ''}
<p>${c.bodyText}</p>
<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:45%;">Póliza</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${nroPoliza}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Aseguradora</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${insurerLabel}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Saldo Pendiente</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:#dc2626;font-weight:bold;font-size:16px;">${totalPending}</td></tr>
<tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Días de Atraso</td><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;color:${stage === 'd90' ? '#dc2626' : stage === 'd60' ? '#d97706' : '#374151'};">${daysRange}</td></tr>
</table>
${paymentBlock}
</div>
<div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
<p style="margin:0;">Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
<p style="margin:4px 0 0;">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750</p>
</div>
</div>
</body></html>`;

  return { subject: c.subject, htmlBody };
}
