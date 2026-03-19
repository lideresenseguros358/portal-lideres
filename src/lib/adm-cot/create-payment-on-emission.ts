/**
 * ADM COT — Auto-create pending payment + recurrence on emission
 * 
 * Called client-side after emission success (fire-and-forget).
 * Creates:
 *   1. A pending payment (PAY_TO_INSURER) for the first installment
 *   2. A recurrence record if installments > 1
 * 
 * Enhanced: passes payment_mode, due_date, installment metadata
 * for SLA tracking and installment grouping.
 */

function computePaymentMode(installments: number): 'contado' | 'cuotas' | 'recurrente' {
  if (installments <= 1) return 'contado';
  return 'cuotas';
}

function computeSLADueDate(baseDate: Date, slaBusinessDays: number = 15): string {
  const due = new Date(baseDate);
  due.setDate(due.getDate() + slaBusinessDays);
  return due.toISOString().slice(0, 10);
}

/**
 * Compute recurrence frequency based on installment count.
 *
 * DB constraint only allows: MENSUAL, SEMESTRAL.
 * We map the client's chosen installments to the closest valid frequency:
 *   1 cuota  → CONTADO (no recurrence)
 *   2 cuotas → SEMESTRAL (every 6 months)
 *   3-12     → MENSUAL  (monthly — PF cron charges on schedule dates)
 *
 * Note: The actual charge dates are determined by the schedule array,
 * so even if frequency is MENSUAL, a 4-cuota plan will have charges
 * every 3 months (schedule controls the real dates).
 */
function computeFrequency(installments: number, _cobertura?: string): { label: string; months: number } {
  if (installments <= 1) return { label: 'CONTADO', months: 12 };
  if (installments === 2) return { label: 'SEMESTRAL', months: 6 };
  // For 3+ installments: MENSUAL label but actual interval from schedule
  return { label: 'MENSUAL', months: Math.max(1, Math.floor(12 / installments)) };
}

export async function createPaymentOnEmission(params: {
  insurer: string;
  policyNumber: string;
  insuredName: string;
  cedula?: string;
  totalPremium: number;
  installments: number;
  ramo?: string;
  cobertura?: string; // 'TERCEROS' | 'DT' | 'COMPLETA' | 'CC' — affects frequency calc
  // PagueloFacil data (when PF confirmed the first charge)
  pfCodOper?: string;
  pfRecCodOper?: string;
  pfCardType?: string;
  pfCardDisplay?: string;
  // Insurer payment plan metadata — when insurer plan differs from client plan
  // e.g. FEDPA DT: insurer sees "mensual 10 pagos" but client pays in 2 cuotas via PF
  insurerPaymentPlan?: {
    insurerCuotas: number;      // what the insurer sees (e.g. 10 for FEDPA monthly)
    insurerFrequency: string;   // e.g. 'MENSUAL'
    clientCuotas: number;       // what the client actually pays (e.g. 2, 3, 4)
    mismatch: boolean;          // true when insurer plan != client plan
  };
}) {
  try {
    const {
      insurer, policyNumber, insuredName, cedula, totalPremium, installments, ramo,
      cobertura, pfCodOper, pfRecCodOper, pfCardType, pfCardDisplay,
    } = params;
    // Rounding: base amount truncated to 2 decimals, last installment absorbs remainder
    const baseAmount = Math.floor((totalPremium / installments) * 100) / 100;
    const lastAmount = Math.round((totalPremium - baseAmount * (installments - 1)) * 100) / 100;
    const installmentAmount = baseAmount; // used for recurrence record (base per-installment)
    const today = new Date().toISOString().slice(0, 10);
    const paymentMode = computePaymentMode(installments);

    // If PagueloFacil confirmed the charge, mark as CONFIRMADO_PF immediately
    const firstPaymentStatus = pfCodOper ? 'CONFIRMADO_PF' : 'PENDIENTE';

    // 1. Create first payment (CONFIRMADO_PF if PF approved, else PENDIENTE)
    await fetch('/api/adm-cot/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_pending',
        data: {
          insurer,
          policy_number: policyNumber,
          insured_name: insuredName,
          cedula: cedula || null,
          amount_due: baseAmount,
          payment_date: today,
          type: 'PAY_TO_INSURER',
          ramo: ramo || 'AUTO',
          installment_num: 1,
          total_installments: installments,
          payment_mode: paymentMode,
          due_date: computeSLADueDate(new Date()),
          source: 'EMISSION',
          // PagueloFacil metadata
          status_override: firstPaymentStatus,
          pf_cod_oper: pfCodOper || null,
          pf_card_type: pfCardType || null,
          pf_card_display: pfCardDisplay || null,
        },
      }),
    });

    // 2. Create recurrence if installments > 1
    if (installments > 1) {
      const startDate = new Date();
      const freq = computeFrequency(installments, cobertura);
      const frequency = freq.label;
      const freqMonths = freq.months;

      // Build schedule: first installment already created, last absorbs rounding diff
      const schedule = [];
      for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1) * freqMonths);
        const amt = i === installments ? lastAmount : baseAmount;
        schedule.push({
          num: i,
          due_date: dueDate.toISOString().slice(0, 10),
          sla_due_date: computeSLADueDate(dueDate),
          status: i === 1 ? 'PAGADO' : 'PENDIENTE',
          amount: amt,
          payment_id: null,
        });
      }

      // End date = max 1 year from start
      const endDate = new Date(startDate);
      endDate.setFullYear(endDate.getFullYear() + 1);

      // Next due date = 2nd installment
      const nextDue = new Date(startDate);
      nextDue.setMonth(nextDue.getMonth() + freqMonths);

      await fetch('/api/adm-cot/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_recurrence',
          data: {
            nro_poliza: policyNumber,
            client_name: insuredName,
            cedula: cedula || null,
            insurer,
            total_installments: installments,
            frequency,
            installment_amount: installmentAmount,
            start_date: today,
            end_date: endDate.toISOString().slice(0, 10),
            next_due_date: nextDue.toISOString().slice(0, 10),
            schedule,
            pf_cod_oper: pfCodOper || null,
            pf_rec_cod_oper: pfRecCodOper || null,
          },
        }),
      });
    }
  } catch (err) {
    console.warn('[ADM-COT] Payment creation failed (non-blocking):', err);
  }
}
