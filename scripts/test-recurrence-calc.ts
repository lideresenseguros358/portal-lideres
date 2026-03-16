/**
 * TEST: Recurrence Calculation Verification
 * 
 * Simulates createPaymentOnEmission logic for various real scenarios.
 * Run with: npx tsx scripts/test-recurrence-calc.ts
 */

// ═══════════════════════════════════════════════════════════════
// COPIED FROM create-payment-on-emission.ts (pure logic, no fetch)
// ═══════════════════════════════════════════════════════════════

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

function computeSLADueDate(baseDate: Date, slaBusinessDays: number = 15): string {
  const due = new Date(baseDate);
  due.setDate(due.getDate() + slaBusinessDays);
  return due.toISOString().slice(0, 10);
}

interface ScheduleItem {
  num: number;
  due_date: string;
  sla_due_date: string;
  status: 'PAGADO' | 'PENDIENTE';
  amount: number;
  payment_id: null;
}

function simulateRecurrence(params: {
  totalPremium: number;
  installments: number;
  startDate: Date;
  label: string;
  cobertura?: string;
}) {
  const { totalPremium, installments, startDate, label, cobertura } = params;

  console.log('\n' + '═'.repeat(80));
  console.log(`🧪 TEST: ${label}`);
  console.log(`   Prima total: $${totalPremium.toFixed(2)} | Cuotas: ${installments} | Fecha inicio: ${startDate.toISOString().slice(0, 10)}`);
  console.log('═'.repeat(80));

  if (installments <= 1) {
    console.log(`   → Pago de contado: $${totalPremium.toFixed(2)}`);
    console.log(`   ✅ SIN RECURRENCIA`);
    return;
  }

  // Rounding logic
  const baseAmount = Math.floor((totalPremium / installments) * 100) / 100;
  const lastAmount = Math.round((totalPremium - baseAmount * (installments - 1)) * 100) / 100;

  // Frequency
  const freq = computeFrequency(installments, cobertura);

  console.log(`   → Frecuencia: ${freq.label} (cada ${freq.months} mes(es))`);
  console.log(`   → Monto base por cuota: $${baseAmount.toFixed(2)}`);
  console.log(`   → Monto última cuota:   $${lastAmount.toFixed(2)}`);
  console.log(`   → Diferencia redondeo:   $${(lastAmount - baseAmount).toFixed(2)}`);

  // Verify total
  const computedTotal = baseAmount * (installments - 1) + lastAmount;
  const totalMatches = Math.abs(computedTotal - totalPremium) < 0.001;
  console.log(`   → Total computado: $${computedTotal.toFixed(2)} (${totalMatches ? '✅ MATCHES' : '❌ MISMATCH! Expected $' + totalPremium.toFixed(2)})`);

  // Verify all amounts have max 2 decimals
  const baseDecimals = (baseAmount.toString().split('.')[1] || '').length;
  const lastDecimals = (lastAmount.toString().split('.')[1] || '').length;
  if (baseDecimals > 2 || lastDecimals > 2) {
    console.log(`   ❌ DECIMAL ERROR: base has ${baseDecimals} decimals, last has ${lastDecimals} decimals`);
  } else {
    console.log(`   ✅ Decimals OK: base=${baseDecimals}, last=${lastDecimals}`);
  }

  // Build schedule
  const schedule: ScheduleItem[] = [];
  for (let i = 1; i <= installments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + (i - 1) * freq.months);
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

  // End date
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);

  // Next due date
  const nextDue = new Date(startDate);
  nextDue.setMonth(nextDue.getMonth() + freq.months);

  console.log('\n   📅 SCHEDULE:');
  console.log('   ┌─────┬────────────┬────────────┬────────────┬───────────┐');
  console.log('   │ #   │ Fecha Cobr │ SLA Vence  │ Estado     │ Monto     │');
  console.log('   ├─────┼────────────┼────────────┼────────────┼───────────┤');
  for (const s of schedule) {
    console.log(`   │ ${String(s.num).padStart(3)} │ ${s.due_date} │ ${s.sla_due_date} │ ${s.status.padEnd(10)} │ $${s.amount.toFixed(2).padStart(7)} │`);
  }
  console.log('   └─────┴────────────┴────────────┴────────────┴───────────┘');
  console.log(`   → next_due_date: ${nextDue.toISOString().slice(0, 10)}`);
  console.log(`   → end_date: ${endDate.toISOString().slice(0, 10)}`);

  // Verify last schedule date is within 12 months
  const lastScheduleDate = new Date(schedule[schedule.length - 1].due_date);
  const monthsSpan = (lastScheduleDate.getFullYear() - startDate.getFullYear()) * 12 + (lastScheduleDate.getMonth() - startDate.getMonth());
  console.log(`   → Span: ${monthsSpan} meses (${monthsSpan <= 12 ? '✅ dentro de 12 meses' : '⚠️ excede 12 meses'})`);

  // Verify PF minimum ($1.00)
  const belowMinimum = schedule.filter(s => s.amount < 1.00);
  if (belowMinimum.length > 0) {
    console.log(`   ❌ PF MINIMUM ERROR: ${belowMinimum.length} cuota(s) por debajo de $1.00`);
  } else {
    console.log(`   ✅ Todos los montos >= $1.00 (mínimo PF)`);
  }

  return { schedule, freq, baseAmount, lastAmount, computedTotal };
}

// ═══════════════════════════════════════════════════════════════
// TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════

const today = new Date('2026-03-14');

console.log('\n🔬 PRUEBAS DE CÁLCULO DE RECURRENCIAS - PagueloFacil');
console.log('Fecha de referencia: ' + today.toISOString().slice(0, 10));

// ── 1. DT FEDPA: $79.13 en 2 cuotas (mensual para DT) ──
simulateRecurrence({
  totalPremium: 79.13,
  installments: 2,
  startDate: today,
  label: 'DT FEDPA $79.13 — 2 cuotas (MENSUAL, no semestral)',
  cobertura: 'TERCEROS',
});

// ── 2. CC con redondeo: prima que no divide exactamente ──
simulateRecurrence({
  totalPremium: 523.47,
  installments: 10,
  startDate: today,
  label: 'CC $523.47 — 10 cuotas MENSUAL (con ajuste redondeo)',
});

// ── 3. CC 2 cuotas = semestral ──
simulateRecurrence({
  totalPremium: 850.00,
  installments: 2,
  startDate: today,
  label: 'CC $850.00 — 2 cuotas SEMESTRAL',
});

// ── 4. CC 3 cuotas = cuatrimestral ──
simulateRecurrence({
  totalPremium: 750.00,
  installments: 3,
  startDate: today,
  label: 'CC $750.00 — 3 cuotas CUATRIMESTRAL',
});

// ── 5. CC 4 cuotas = trimestral ──
simulateRecurrence({
  totalPremium: 1200.00,
  installments: 4,
  startDate: today,
  label: 'CC $1,200.00 — 4 cuotas TRIMESTRAL',
});

// ── 6. CC 5 cuotas = bimestral ──
simulateRecurrence({
  totalPremium: 999.99,
  installments: 5,
  startDate: today,
  label: 'CC $999.99 — 5 cuotas BIMESTRAL',
});

// ── 7. CC 6 cuotas = bimestral ──
simulateRecurrence({
  totalPremium: 600.00,
  installments: 6,
  startDate: today,
  label: 'CC $600.00 — 6 cuotas BIMESTRAL',
});

// ── 8. CC 7 cuotas = mensual ──
simulateRecurrence({
  totalPremium: 777.77,
  installments: 7,
  startDate: today,
  label: 'CC $777.77 — 7 cuotas MENSUAL',
});

// ── 9. CC 8 cuotas = mensual ──
simulateRecurrence({
  totalPremium: 1500.00,
  installments: 8,
  startDate: today,
  label: 'CC $1,500.00 — 8 cuotas MENSUAL',
});

// ── 10. CC 9 cuotas = mensual ──
simulateRecurrence({
  totalPremium: 450.33,
  installments: 9,
  startDate: today,
  label: 'CC $450.33 — 9 cuotas MENSUAL',
});

// ── 11. CC Contado ──
simulateRecurrence({
  totalPremium: 350.00,
  installments: 1,
  startDate: today,
  label: 'CC $350.00 — Contado (sin recurrencia)',
});

// ── 12. Edge case: prima muy pequeña en 10 cuotas ──
simulateRecurrence({
  totalPremium: 15.00,
  installments: 10,
  startDate: today,
  label: 'EDGE: $15.00 — 10 cuotas (cada una ~$1.50)',
});

// ── 13. Edge case: prima con centavos problemáticos ──
simulateRecurrence({
  totalPremium: 100.01,
  installments: 3,
  startDate: today,
  label: 'EDGE: $100.01 — 3 cuotas (centavos problemáticos)',
});

// ── 14. Edge case: prima exactamente divisible ──
simulateRecurrence({
  totalPremium: 120.00,
  installments: 10,
  startDate: today,
  label: 'EDGE: $120.00 — 10 cuotas (división exacta)',
});

// ── 15. DT otro monto ──
simulateRecurrence({
  totalPremium: 65.50,
  installments: 2,
  startDate: today,
  label: 'DT $65.50 — 2 cuotas (MENSUAL)',
  cobertura: 'TERCEROS',
});

// ══════════════════════════════════════════════════════
// SUMMARY: Frequency mapping table
// ══════════════════════════════════════════════════════
console.log('\n\n📊 TABLA DE FRECUENCIAS (CC - Cobertura Completa):');
console.log('┌────────────┬──────────────────┬────────────────┬───────────────────────┐');
console.log('│ Cuotas     │ Frecuencia       │ Cada N meses   │ Meses span total      │');
console.log('├────────────┼──────────────────┼────────────────┼───────────────────────┤');
for (let n = 1; n <= 10; n++) {
  const f = computeFrequency(n);
  const span = (n - 1) * f.months;
  console.log(`│ ${String(n).padStart(10)} │ ${f.label.padEnd(16)} │ ${String(f.months).padStart(14)} │ ${String(span).padStart(2)} meses (${span <= 12 ? 'OK' : 'EXCEDE'})${' '.repeat(12 - String(span).length)}│`);
}
console.log('└────────────┴──────────────────┴────────────────┴───────────────────────┘');

// Note about DT
console.log('\n✅ NOTA SOBRE DT (Daños a Terceros):');
console.log('   DT siempre es 2 cuotas = MENSUAL (hoy + 1 mes).');
console.log('   Se pasa cobertura="TERCEROS" a computeFrequency para forzar MENSUAL.');
console.log('   CC con 2 cuotas sigue usando SEMESTRAL (cada 6 meses).');
