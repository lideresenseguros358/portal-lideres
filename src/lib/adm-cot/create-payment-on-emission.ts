/**
 * ADM COT — Auto-create initial payment record on emission
 *
 * Called client-side after emission success (fire-and-forget).
 * Creates the first (and only) payment tracked via PagueloFacil.
 * Remaining installments are paid directly by the client with the insurer.
 * Morosidad is monitored via ops_morosidad_view in /operaciones/morosidad.
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

export async function createPaymentOnEmission(params: {
  insurer: string;
  policyNumber: string;
  insuredName: string;
  cedula?: string;
  totalPremium: number;
  installments: number;
  ramo?: string;
  cobertura?: string;
  // PagueloFacil data (when PF confirmed the first charge)
  pfCodOper?: string;
  pfRecCodOper?: string;  // kept for API compatibility, not used
  pfCardType?: string;
  pfCardDisplay?: string;
  // Insurer payment plan metadata
  insurerPaymentPlan?: {
    insurerCuotas: number;
    insurerFrequency: string;
    clientCuotas: number;
    mismatch: boolean;
  };
}) {
  try {
    const {
      insurer, policyNumber, insuredName, cedula, totalPremium, installments, ramo,
      pfCodOper, pfCardType, pfCardDisplay,
    } = params;
    const baseAmount = Math.floor((totalPremium / installments) * 100) / 100;
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

    // Recurrencia PF eliminada: solo se crea el pago inicial.
    // Las cuotas 2..N las maneja directamente la aseguradora.
    // Morosidad se monitorea desde ops_morosidad_view en /operaciones/morosidad.
  } catch (err) {
    console.warn('[ADM-COT] Payment creation failed (non-blocking):', err);
  }
}
