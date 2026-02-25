/**
 * ADM COT — Auto-create pending payment + recurrence on emission
 * 
 * Called client-side after emission success (fire-and-forget).
 * Creates:
 *   1. A pending payment (PAY_TO_INSURER) for the first installment
 *   2. A recurrence record if installments > 1
 */

export async function createPaymentOnEmission(params: {
  insurer: string;
  policyNumber: string;
  insuredName: string;
  cedula?: string;
  totalPremium: number;
  installments: number;
  ramo?: string;
}) {
  try {
    const { insurer, policyNumber, insuredName, cedula, totalPremium, installments, ramo } = params;
    const installmentAmount = Math.round((totalPremium / installments) * 100) / 100;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Create first pending payment
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
          amount_due: installmentAmount,
          payment_date: today,
          type: 'PAY_TO_INSURER',
          ramo: ramo || 'AUTO',
          installment_num: 1,
          source: 'EMISSION',
        },
      }),
    });

    // 2. Create recurrence if installments > 1
    if (installments > 1) {
      const startDate = new Date();
      const frequency = installments <= 2 ? 'SEMESTRAL' : 'MENSUAL';
      const freqMonths = frequency === 'MENSUAL' ? 1 : 6;

      // Build schedule: first installment already created, start from 2
      const schedule = [];
      for (let i = 1; i <= installments; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + (i - 1) * freqMonths);
        schedule.push({
          num: i,
          due_date: dueDate.toISOString().slice(0, 10),
          status: i === 1 ? 'PAGADO' : 'PENDIENTE',
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
          },
        }),
      });
    }
  } catch (err) {
    console.warn('[ADM-COT] Payment creation failed (non-blocking):', err);
  }
}
