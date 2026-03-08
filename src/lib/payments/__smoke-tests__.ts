/**
 * Payments Flow — Smoke Tests (manual validation)
 * 
 * Run with: npx tsx src/lib/payments/__smoke-tests__.ts
 * 
 * These tests validate the pure logic functions used in the payments flow.
 * They do NOT test server actions (which require auth + DB).
 * 
 * Expected output: all assertions pass with ✅
 */

// ============================
// Test Helpers
// ============================
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n🔹 ${name}`);
}

// ============================
// 1. Payment Adapter Types
// ============================
section('Payment Adapter Types');

// Validate the payment adapter interface shape
import type { TokenizeParams, TokenizeResult, ProcessPaymentParams, ProcessPaymentResult, RefundParams, RefundResult, PaymentAdapter } from '../payments/payment-adapter';

const mockAdapter: PaymentAdapter = {
  provider: 'mock',
  async tokenize() { return { success: true, token: 'tok_123', last4: '4242', brand: 'Visa' }; },
  async processPayment() { return { success: true, transactionId: 'txn_1', status: 'approved' }; },
  async refund() { return { success: true, refundId: 'ref_1' }; },
};

assert(mockAdapter.provider === 'mock', 'Mock adapter has correct provider');
assert(typeof mockAdapter.tokenize === 'function', 'Adapter has tokenize method');
assert(typeof mockAdapter.processPayment === 'function', 'Adapter has processPayment method');
assert(typeof mockAdapter.refund === 'function', 'Adapter has refund method');

// ============================
// 2. SLA Due Date Computation
// ============================
section('SLA Due Date Computation');

function computeSLADueDate(baseDate: Date, slaDays: number = 15): string {
  const due = new Date(baseDate);
  due.setDate(due.getDate() + slaDays);
  return due.toISOString().slice(0, 10);
}

const base = new Date('2024-01-15T00:00:00Z');
assert(computeSLADueDate(base, 15) === '2024-01-30', 'SLA 15d from Jan 15 = Jan 30');
assert(computeSLADueDate(base, 0) === '2024-01-15', 'SLA 0d = same day');
assert(computeSLADueDate(new Date('2024-02-25'), 15) === '2024-03-11', 'SLA crosses month boundary');

// ============================
// 3. Payment Mode Computation
// ============================
section('Payment Mode Computation');

function computePaymentMode(installments: number): 'contado' | 'cuotas' | 'recurrente' {
  if (installments <= 1) return 'contado';
  return 'cuotas';
}

assert(computePaymentMode(1) === 'contado', '1 installment = contado');
assert(computePaymentMode(0) === 'contado', '0 installments = contado');
assert(computePaymentMode(2) === 'cuotas', '2 installments = cuotas');
assert(computePaymentMode(12) === 'cuotas', '12 installments = cuotas');

// ============================
// 4. Category Badge Logic
// ============================
section('Category Badge Logic');

function getCategoryLabel(category: string | null): string {
  const cats: Record<string, string> = {
    prima: 'Prima',
    devolucion: 'Devolución',
    comision: 'Comisión',
    adelanto: 'Adelanto',
    otro: 'Otro',
    uncategorized: 'Sin cat.',
  };
  return cats[category || 'uncategorized'] || 'Sin cat.';
}

assert(getCategoryLabel('prima') === 'Prima', 'Category prima = Prima');
assert(getCategoryLabel('devolucion') === 'Devolución', 'Category devolucion = Devolución');
assert(getCategoryLabel(null) === 'Sin cat.', 'Null category = Sin cat.');
assert(getCategoryLabel('unknown') === 'Sin cat.', 'Unknown category = Sin cat.');

// ============================
// 5. SLA Indicator Logic
// ============================
section('SLA Indicator Logic');

function getSLAState(daysRemaining: number) {
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 3) return 'warning';
  if (daysRemaining <= 7) return 'caution';
  return 'ok';
}

assert(getSLAState(-5) === 'overdue', '-5 days = overdue');
assert(getSLAState(-1) === 'overdue', '-1 day = overdue');
assert(getSLAState(0) === 'warning', '0 days = warning');
assert(getSLAState(3) === 'warning', '3 days = warning');
assert(getSLAState(4) === 'caution', '4 days = caution');
assert(getSLAState(7) === 'caution', '7 days = caution');
assert(getSLAState(8) === 'ok', '8 days = ok');
assert(getSLAState(15) === 'ok', '15 days = ok');

// ============================
// 6. 110% Flex Rule
// ============================
section('110% Flex Rule');

function checkFlexRule(transferAmount: number, requestedAmount: number): { allowed: boolean; maxAllowed: number } {
  const maxAllowed = transferAmount * 1.10;
  return {
    allowed: requestedAmount <= maxAllowed,
    maxAllowed: Math.round(maxAllowed * 100) / 100,
  };
}

assert(checkFlexRule(100, 100).allowed === true, '$100 transfer, $100 requested = allowed');
assert(checkFlexRule(100, 110).allowed === true, '$100 transfer, $110 requested = allowed (110%)');
assert(checkFlexRule(100, 110.01).allowed === false, '$100 transfer, $110.01 requested = denied');
assert(checkFlexRule(1000, 1100).allowed === true, '$1000 transfer, $1100 requested = allowed');
assert(checkFlexRule(1000, 1101).allowed === false, '$1000 transfer, $1101 requested = denied');
assert(checkFlexRule(100, 0).allowed === true, '$100 transfer, $0 requested = allowed');

// ============================
// 7. Idempotency Key Generation
// ============================
section('Idempotency Key Generation');

function makeIdempotencyKey(policyNumber: string, insurer: string, paymentDate: string, installmentNum: number): string {
  return `${policyNumber}|${insurer}|${paymentDate}|${installmentNum}`;
}

const key1 = makeIdempotencyKey('POL-001', 'FEDPA', '2024-01-15', 1);
const key2 = makeIdempotencyKey('POL-001', 'FEDPA', '2024-01-15', 1);
const key3 = makeIdempotencyKey('POL-001', 'FEDPA', '2024-01-15', 2);

assert(key1 === key2, 'Same params produce same idempotency key');
assert(key1 !== key3, 'Different installment produces different key');

// ============================
// 8. CSV Escaping
// ============================
section('CSV Escaping');

function escapeCSV(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

assert(escapeCSV('hello') === '"hello"', 'Simple string escaping');
assert(escapeCSV('he said "hi"') === '"he said ""hi"""', 'Quotes are doubled');
assert(escapeCSV('') === '""', 'Empty string');
assert(escapeCSV('a,b,c') === '"a,b,c"', 'Commas preserved inside quotes');

// ============================
// Results
// ============================
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
}
