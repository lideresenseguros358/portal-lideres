/**
 * Payment Adapter — Abstraction Layer
 * ====================================
 * Provides a unified interface for payment processing that can be swapped
 * between mock (development) and real (PagueloFacil) implementations.
 *
 * ARCHITECTURE:
 * - PaymentAdapter interface defines the contract.
 * - MockPaymentAdapter implements it for development/testing.
 * - PagueloFacilAdapter (future) will implement it for production.
 * - getPaymentAdapter() factory returns the correct implementation based on env.
 *
 * USAGE:
 *   const adapter = getPaymentAdapter();
 *   const result = await adapter.tokenize({ ... });
 *   if (result.success) { // use result.token }
 *
 * PCI COMPLIANCE:
 * - In production, tokenize() should call PagueloFacil's client-side SDK directly.
 * - Raw card data (PAN, CVV) must NEVER be sent to our backend.
 * - The adapter runs client-side only.
 */

// ─── Interfaces ─────────────────────────────────────────────

export interface TokenizeParams {
  cardNumber: string;
  cardName: string;
  bankName: string;
  expiry: string; // MM/YY
  cvv: string;
  amount: number;
  currency?: string;
}

export interface TokenizeResult {
  success: boolean;
  token?: string;
  last4?: string;
  brand?: 'Visa' | 'Mastercard';
  error?: string;
}

export interface ProcessPaymentParams {
  token: string;
  amount: number;
  currency?: string;
  policyNumber?: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
  idempotencyKey?: string;
}

export interface ProcessPaymentResult {
  success: boolean;
  transactionId?: string;
  status?: 'approved' | 'declined' | 'pending' | 'error';
  message?: string;
  error?: string;
  receiptUrl?: string;
}

export interface RefundParams {
  transactionId: string;
  amount?: number; // partial refund; omit for full
  reason?: string;
  idempotencyKey?: string;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  status?: 'refunded' | 'pending' | 'error';
  error?: string;
}

export interface PaymentAdapter {
  readonly provider: 'mock' | 'paguelofacil';
  tokenize(params: TokenizeParams): Promise<TokenizeResult>;
  processPayment(params: ProcessPaymentParams): Promise<ProcessPaymentResult>;
  refund(params: RefundParams): Promise<RefundResult>;
}

// ─── Mock Implementation (Development) ──────────────────────

class MockPaymentAdapter implements PaymentAdapter {
  readonly provider = 'mock' as const;

  async tokenize(params: TokenizeParams): Promise<TokenizeResult> {
    const cleanNumber = params.cardNumber.replace(/\s/g, '');
    const first = cleanNumber[0];

    // Validate brand
    if (first !== '4' && !/^5[1-5]/.test(cleanNumber)) {
      return { success: false, error: 'Solo se aceptan tarjetas Visa y Mastercard.' };
    }

    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    return {
      success: true,
      token: `tok_dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      last4: cleanNumber.slice(-4),
      brand: first === '4' ? 'Visa' : 'Mastercard',
    };
  }

  async processPayment(params: ProcessPaymentParams): Promise<ProcessPaymentResult> {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1200));

    return {
      success: true,
      transactionId: `txn_dev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      status: 'approved',
      message: 'Pago simulado aprobado (desarrollo)',
    };
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    await new Promise(r => setTimeout(r, 600));

    return {
      success: true,
      refundId: `ref_dev_${Date.now()}`,
      status: 'refunded',
    };
  }
}

// ─── PagueloFacil Implementation (Future) ───────────────────

/**
 * TODO: Implement when PagueloFacil API documentation is received.
 *
 * class PagueloFacilAdapter implements PaymentAdapter {
 *   readonly provider = 'paguelofacil' as const;
 *
 *   constructor(private config: { apiKey: string; sandbox: boolean }) {}
 *
 *   async tokenize(params: TokenizeParams): Promise<TokenizeResult> {
 *     // Call PagueloFacil JS SDK to tokenize client-side
 *     // PAN/CVV never touch our servers
 *   }
 *
 *   async processPayment(params: ProcessPaymentParams): Promise<ProcessPaymentResult> {
 *     // Call our backend API route which calls PagueloFacil server-to-server
 *     // with the token (not raw card data)
 *   }
 *
 *   async refund(params: RefundParams): Promise<RefundResult> {
 *     // Call our backend API route for refunds
 *   }
 * }
 */

// ─── Factory ────────────────────────────────────────────────

let _instance: PaymentAdapter | null = null;

export function getPaymentAdapter(): PaymentAdapter {
  if (_instance) return _instance;

  // TODO: When PagueloFacil is ready, switch based on env var:
  // if (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER === 'paguelofacil') {
  //   _instance = new PagueloFacilAdapter({
  //     apiKey: process.env.NEXT_PUBLIC_PAGUELOFACIL_KEY!,
  //     sandbox: process.env.NODE_ENV !== 'production',
  //   });
  // } else {
  _instance = new MockPaymentAdapter();
  // }

  return _instance;
}

/**
 * Reset the singleton (useful for testing or hot-reloading config).
 */
export function resetPaymentAdapter(): void {
  _instance = null;
}
