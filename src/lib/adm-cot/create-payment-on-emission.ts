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
 * CC (Cobertura Completa): spread over 12 months → 12/installments = months between payments
 * DT (Daños a Terceros): always MENSUAL (2 cuotas = hoy + 1 mes)
 *
 * Mapping (CC):
 *   2 cuotas → 6 meses (SEMESTRAL)
 *   3 cuotas → 4 meses (CUATRIMESTRAL)
 *   4 cuotas → 3 meses (TRIMESTRAL)
 *   5-6 cuotas → 2 meses (BIMESTRAL)
 *   7-10 cuotas → 1 mes (MENSUAL)
 */
function computeFrequency(installments: number, cobertura?: string): { label: string; months: number } {
  if (installments <= 1) return { label: 'CONTADO', months: 12 };

  // DT: always monthly (2 cuotas = hoy + 1 mes)
  if (cobertura === 'TERCEROS' || cobertura === 'DT') {
    return { label: 'MENSUAL', months: 1 };
  }

  // CC: distribute across 12-month policy period
  const months = Math.floor(12 / installments);
  if (months >= 6) return { label: 'SEMESTRAL', months: 6 };
  if (months >= 4) return { label: 'CUATRIMESTRAL', months: 4 };
  if (months >= 3) return { label: 'TRIMESTRAL', months: 3 };
  if (months >= 2) return { label: 'BIMESTRAL', months: 2 };
  return { label: 'MENSUAL', months: 1 };
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
