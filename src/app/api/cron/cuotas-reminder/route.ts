/**
 * CRON: Cuotas Reminder Emails
 *
 * Runs daily to send two types of installment reminder emails
 * for active recurrences (insurer-direct payment model):
 *
 *   1. 10-day advance notice  — sent when next_due_date is exactly 10 days away
 *   2. Day-0 notice           — sent on the day of the installment (next_due_date = today)
 *
 * Both emails include:
 *   - Insurer-specific payment button
 *   - Auto-pay setup info
 *   - "Si ya realizó su pago, ignore este correo" on day-0
 *
 * Tracking: notes.cuota_emails = { pre10_<num>: "YYYY-MM-DD", day0_<num>: "YYYY-MM-DD" }
 * stored on adm_cot_recurrences.
 *
 * Protection: X-CRON-SECRET or CRON_SECRET
 * Schedule: "0 10 * * *" (5am Panama = 10am UTC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendZeptoEmail } from '@/lib/email/zepto-api';
import { getInsurerPaymentInfo, buildInsurerPaymentBlock } from '@/lib/email/insurer-payment-links';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDateES(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-PA', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

/** Compute safe due dates for each installment number and month, handling Feb/short months */
function safeDueDate(baseDay: number, targetYear: number, targetMonth: number): string {
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate(); // targetMonth is 1-based
  const day = Math.min(baseDay, daysInMonth);
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.ADM_COT_CRON_SECRET || process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'No cron secret configured' }, { status: 500 });

  const authHeader = request.headers.get('authorization');
  const xCronSecret = request.headers.get('x-cron-secret');
  if (authHeader !== `Bearer ${cronSecret}` && xCronSecret !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = createClient(supabaseUrl, supabaseServiceKey);
  const todayStr = new Date().toISOString().slice(0, 10);
  const in10DaysStr = addDays(todayStr, 10);

  let sent = 0;
  let skipped = 0;
  let noEmail = 0;
  const errors: string[] = [];

  try {
    console.log(`[CRON CUOTAS-REMINDER] Running for date: ${todayStr}, looking ahead to: ${in10DaysStr}`);

    // Find ACTIVA recurrences whose next_due_date is today OR exactly 10 days out
    const { data: recurrences, error: fetchErr } = await sb
      .from('adm_cot_recurrences')
      .select('*')
      .eq('status', 'ACTIVA')
      .in('next_due_date', [todayStr, in10DaysStr]);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!recurrences || recurrences.length === 0) {
      console.log('[CRON CUOTAS-REMINDER] No recurrences due today or in 10 days');
      return NextResponse.json({ success: true, timestamp: todayStr, sent: 0, message: 'No due recurrences' });
    }

    console.log(`[CRON CUOTAS-REMINDER] Found ${recurrences.length} recurrences to process`);

    // Build email map: cedula → email
    const cedulas = [...new Set(recurrences.map((r: any) => r.cedula).filter(Boolean))];
    const emailMap: Record<string, string> = {};
    if (cedulas.length > 0) {
      const { data: clientRows } = await sb
        .from('clients')
        .select('national_id, email, name')
        .in('national_id', cedulas)
        .not('email', 'is', null);
      (clientRows ?? []).forEach((c: any) => {
        if (c.email && c.national_id) emailMap[c.national_id] = c.email;
      });
    }

    for (const rec of recurrences) {
      try {
        const schedule: any[] = Array.isArray(rec.schedule) ? rec.schedule : [];
        const nextInstallment = schedule.find((s: any) => s.status === 'PENDIENTE');
        if (!nextInstallment) { skipped++; continue; }

        const installmentNum: number = nextInstallment.num;
        const dueDate: string = rec.next_due_date;
        const isDay0 = dueDate === todayStr;
        const isPre10 = dueDate === in10DaysStr;

        if (!isDay0 && !isPre10) { skipped++; continue; }

        const emailKey = isDay0 ? `day0_${installmentNum}` : `pre10_${installmentNum}`;
        const notes: any = rec.notes || {};
        const cuotaEmails: Record<string, string> = notes.cuota_emails || {};

        if (cuotaEmails[emailKey]) { skipped++; continue; } // already sent

        const cedula = rec.cedula || '';
        const clientEmail = emailMap[cedula] || null;
        if (!clientEmail) { noEmail++; continue; }

        const insurerInfo = getInsurerPaymentInfo(rec.insurer || '');
        const paymentBlock = buildInsurerPaymentBlock(insurerInfo);
        const fmtDue = fmtDateES(dueDate);
        const fmtAmount = `$${Number(rec.installment_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
        const totalInstallments: number = rec.total_installments || schedule.length;

        let subject: string;
        let htmlBody: string;

        if (isPre10) {
          subject = `Recordatorio: su cuota #${installmentNum} vence el ${fmtDue} — Póliza ${rec.nro_poliza}`;
          htmlBody = buildReminderEmail({
            type: 'pre10',
            clientName: rec.client_name,
            nroPoliza: rec.nro_poliza,
            insurer: insurerInfo.label,
            installmentNum,
            totalInstallments,
            dueDate: fmtDue,
            amount: fmtAmount,
            paymentBlock,
          });
        } else {
          subject = `Hoy vence su cuota #${installmentNum} — Póliza ${rec.nro_poliza}`;
          htmlBody = buildReminderEmail({
            type: 'day0',
            clientName: rec.client_name,
            nroPoliza: rec.nro_poliza,
            insurer: insurerInfo.label,
            installmentNum,
            totalInstallments,
            dueDate: fmtDue,
            amount: fmtAmount,
            paymentBlock,
          });
        }

        const result = await sendZeptoEmail({ to: clientEmail, subject, htmlBody, textBody: subject });

        if (result.success) {
          sent++;
          const updatedCuotaEmails = { ...cuotaEmails, [emailKey]: todayStr };
          const updatedNotes = { ...notes, cuota_emails: updatedCuotaEmails };
          await sb.from('adm_cot_recurrences').update({ notes: updatedNotes }).eq('id', rec.id);

          await sb.from('adm_cot_audit_log').insert({
            event_type: 'morosidad_auto_email',
            entity_type: 'recurrence',
            entity_id: rec.id,
            detail: {
              email_key: emailKey,
              client_email: clientEmail,
              nro_poliza: rec.nro_poliza,
              installment_num: installmentNum,
              due_date: dueDate,
            },
          });
          console.log(`[CRON CUOTAS-REMINDER] ✅ ${emailKey} sent: ${rec.nro_poliza} → ${clientEmail}`);
        } else {
          errors.push(`${rec.nro_poliza} ${emailKey}: ${result.error}`);
        }
      } catch (recErr: any) {
        errors.push(`Rec ${rec.id}: ${recErr.message}`);
      }
    }

    console.log(`[CRON CUOTAS-REMINDER] Done: ${sent} sent, ${skipped} skipped, ${noEmail} no-email, ${errors.length} errors`);

    return NextResponse.json({
      success: true,
      timestamp: todayStr,
      sent,
      skipped,
      noEmail,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
    });
  } catch (error: any) {
    console.error('[CRON CUOTAS-REMINDER] Fatal error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ════════════════════════════════════════════
// Email HTML Builder
// ════════════════════════════════════════════

function buildReminderEmail(params: {
  type: 'pre10' | 'day0';
  clientName: string;
  nroPoliza: string;
  insurer: string;
  installmentNum: number;
  totalInstallments: number;
  dueDate: string;
  amount: string;
  paymentBlock: string;
}): string {
  const { type, clientName, nroPoliza, insurer, installmentNum, totalInstallments, dueDate, amount, paymentBlock } = params;

  const isPre10 = type === 'pre10';
  const headerBg = isPre10 ? '#010139' : '#d97706';
  const icon = isPre10 ? '📅' : '⏰';
  const headerTitle = isPre10
    ? `Recordatorio de Pago — Cuota #${installmentNum}`
    : `Hoy Vence su Cuota #${installmentNum}`;

  const bodyText = isPre10
    ? `Le informamos que en <strong>10 días</strong> (el <strong>${dueDate}</strong>) vence su cuota <strong>#${installmentNum} de ${totalInstallments}</strong> por <strong>${amount}</strong> de la póliza <strong>${nroPoliza}</strong> con <strong>${insurer}</strong>.<br/><br/>Le recordamos que el pago debe realizarse <strong>directamente en el portal de la aseguradora</strong>. Por favor realice su pago con anticipación para mantener su cobertura activa.`
    : `Le recordamos que <strong>hoy vence</strong> su cuota <strong>#${installmentNum} de ${totalInstallments}</strong> por <strong>${amount}</strong> de la póliza <strong>${nroPoliza}</strong> con <strong>${insurer}</strong>.<br/><br/>Si aún no ha realizado su pago, le invitamos a hacerlo hoy para mantener su cobertura activa. <strong>Si ya realizó su pago, por favor ignore este correo.</strong>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="font-family:Arial,sans-serif;margin:0;padding:0;background:#f0f2f5;">
<div style="max-width:600px;margin:24px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.10);">

  <div style="background:${headerBg};color:white;padding:28px 24px;">
    <h1 style="margin:0;font-size:20px;">${icon} ${headerTitle}</h1>
    <p style="margin:6px 0 0;font-size:13px;opacity:0.85;">Líderes en Seguros</p>
  </div>

  <div style="padding:24px;font-size:14px;line-height:1.7;color:#374151;">
    <p>Estimado/a <strong>${clientName}</strong>,</p>
    <p>${bodyText}</p>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;">
      <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;width:45%;">Póliza</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${nroPoliza}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Aseguradora</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">${insurer}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Cuota</td><td style="padding:10px 14px;border:1px solid #e5e7eb;">#${installmentNum} de ${totalInstallments}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Monto</td><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;font-size:16px;color:#010139;">${amount}</td></tr>
      <tr><td style="padding:10px 14px;border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;">Fecha de Vencimiento</td><td style="padding:10px 14px;border:1px solid #e5e7eb;color:${isPre10 ? '#374151' : '#d97706'};font-weight:bold;">${dueDate}</td></tr>
    </table>

    ${paymentBlock}
  </div>

  <div style="padding:16px 24px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;text-align:center;">
    <p style="margin:0;">Líderes en Seguros, S.A. | portal.lideresenseguros.com</p>
    <p style="margin:4px 0 0;">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750</p>
  </div>
</div>
</body></html>`;
}
