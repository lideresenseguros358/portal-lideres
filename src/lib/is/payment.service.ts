/**
 * Servicio de procesamiento de pagos con tarjeta
 * Internacional de Seguros (IS)
 * 
 * ⚠️ PLACEHOLDER - Conectar cuando se obtenga la API de pagos real
 */

import { ISEnvironment, IS_CONFIG } from './config';

// ============================================
// INTERFACES - Adaptar según documentación real
// ============================================

export interface PaymentCardData {
  cardNumber: string;
  cardName: string;
  bankName: string;
  expiry: string; // MM/YY
  cvv: string;
}

export interface TokenizeRequest {
  cardData: PaymentCardData;
  amount: number;
  currency?: string;
}

export interface TokenizeResponse {
  success: boolean;
  token?: string;
  last4?: string;
  brand?: 'visa' | 'mastercard';
  error?: string;
}

export interface ProcessPaymentRequest {
  paymentToken: string;
  amount: number;
  currency?: string;
  policyNumber?: string;
  customerData?: {
    name: string;
    email: string;
    nationalId: string;
  };
}

export interface ProcessPaymentResponse {
  success: boolean;
  transactionId?: string;
  status?: 'approved' | 'declined' | 'pending';
  message?: string;
  error?: string;
}

// ============================================
// ENDPOINTS - Actualizar cuando se tengan las APIs
// ============================================

const PAYMENT_ENDPOINTS = {
  // TODO: Obtener endpoints reales de INTERNACIONAL
  TOKENIZE: '/api/payment/tokenize', // Placeholder
  PROCESS: '/api/payment/process',   // Placeholder
  VERIFY: '/api/payment/verify',     // Placeholder
} as const;

// ============================================
// TOKENIZAR TARJETA
// ============================================

/**
 * Tokenizar datos de tarjeta de crédito
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 * Por ahora genera token simulado
 */
export async function tokenizarTarjeta(
  cardData: PaymentCardData,
  amount: number,
  env: ISEnvironment = 'development'
): Promise<TokenizeResponse> {
  console.log('[IS Payment] Tokenizando tarjeta...', {
    last4: cardData.cardNumber.slice(-4),
    amount,
  });
  
  // TODO: Descomentar cuando se tenga el endpoint real
  /*
  const config = IS_CONFIG[env];
  const url = `${config.baseUrl}${PAYMENT_ENDPOINTS.TOKENIZE}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({
        card_number: cardData.cardNumber.replace(/\s/g, ''),
        card_name: cardData.cardName,
        bank_name: cardData.bankName,
        expiry_month: cardData.expiry.split('/')[0],
        expiry_year: cardData.expiry.split('/')[1],
        cvv: cardData.cvv,
        amount,
        currency: 'USD',
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.message || 'Error al tokenizar tarjeta',
      };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      token: data.token,
      last4: data.last4 || cardData.cardNumber.slice(-4),
      brand: data.brand || 'visa',
    };
  } catch (error: any) {
    console.error('[IS Payment] Error tokenizando:', error);
    return {
      success: false,
      error: error.message,
    };
  }
  */
  
  // SIMULACIÓN TEMPORAL
  console.warn('[IS Payment] ⚠️ USANDO TOKEN SIMULADO - Conectar API real');
  
  // Detectar marca
  const firstDigit = cardData.cardNumber.replace(/\s/g, '')[0];
  const brand = firstDigit === '4' ? 'visa' : 'mastercard';
  
  return {
    success: true,
    token: `tok_sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    last4: cardData.cardNumber.replace(/\s/g, '').slice(-4),
    brand,
  };
}

// ============================================
// PROCESAR PAGO
// ============================================

/**
 * Procesar pago con token de tarjeta
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 */
export async function procesarPago(
  paymentToken: string,
  amount: number,
  policyNumber: string,
  env: ISEnvironment = 'development'
): Promise<ProcessPaymentResponse> {
  console.log('[IS Payment] Procesando pago...', {
    token: paymentToken.substring(0, 20) + '...',
    amount,
    policyNumber,
  });
  
  // TODO: Descomentar cuando se tenga el endpoint real
  /*
  const config = IS_CONFIG[env];
  const url = `${config.baseUrl}${PAYMENT_ENDPOINTS.PROCESS}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({
        payment_token: paymentToken,
        amount,
        currency: 'USD',
        policy_number: policyNumber,
        description: `Póliza ${policyNumber}`,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        status: 'declined',
        error: errorData.message || 'Error al procesar pago',
      };
    }
    
    const data = await response.json();
    
    return {
      success: true,
      transactionId: data.transaction_id,
      status: data.status,
      message: data.message,
    };
  } catch (error: any) {
    console.error('[IS Payment] Error procesando pago:', error);
    return {
      success: false,
      status: 'declined',
      error: error.message,
    };
  }
  */
  
  // SIMULACIÓN TEMPORAL
  console.warn('[IS Payment] ⚠️ USANDO PAGO SIMULADO - Conectar API real');
  
  // Simular aprobación (90% de éxito)
  const isApproved = Math.random() > 0.1;
  
  if (!isApproved) {
    return {
      success: false,
      status: 'declined',
      error: 'Tarjeta rechazada por el banco emisor',
    };
  }
  
  return {
    success: true,
    transactionId: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'approved',
    message: 'Pago procesado exitosamente',
  };
}

// ============================================
// VERIFICAR ESTADO DE PAGO
// ============================================

/**
 * Verificar estado de un pago
 * 
 * ⚠️ TODO: Conectar con API real cuando esté disponible
 */
export async function verificarPago(
  transactionId: string,
  env: ISEnvironment = 'development'
): Promise<{ success: boolean; status?: string; error?: string }> {
  console.log('[IS Payment] Verificando pago...', transactionId);
  
  // TODO: Implementar cuando se tenga el endpoint
  console.warn('[IS Payment] ⚠️ Verificación no implementada - Conectar API real');
  
  return {
    success: true,
    status: 'approved',
  };
}

// ============================================
// HELPER: Integración con CreditCardInput
// ============================================

/**
 * Procesar pago completo desde CreditCardInput
 * 
 * Ejemplo de uso:
 * ```typescript
 * const result = await procesarPagoCompleto({
 *   cardData: {
 *     cardNumber: '4111 1111 1111 1111',
 *     cardName: 'JOHN DOE',
 *     bankName: 'Banco General',
 *     expiry: '12/25',
 *     cvv: '123'
 *   },
 *   amount: 450,
 *   policyNumber: 'POL-INC-123',
 * });
 * ```
 */
export async function procesarPagoCompleto(params: {
  cardData: PaymentCardData;
  amount: number;
  policyNumber: string;
  env?: ISEnvironment;
}): Promise<{
  success: boolean;
  transactionId?: string;
  token?: string;
  error?: string;
}> {
  const { cardData, amount, policyNumber, env = 'development' } = params;
  
  // 1. Tokenizar tarjeta
  const tokenResult = await tokenizarTarjeta(cardData, amount, env);
  
  if (!tokenResult.success || !tokenResult.token) {
    return {
      success: false,
      error: tokenResult.error || 'Error al tokenizar tarjeta',
    };
  }
  
  // 2. Procesar pago
  const paymentResult = await procesarPago(
    tokenResult.token,
    amount,
    policyNumber,
    env
  );
  
  if (!paymentResult.success) {
    return {
      success: false,
      error: paymentResult.error || 'Error al procesar pago',
    };
  }
  
  return {
    success: true,
    transactionId: paymentResult.transactionId,
    token: tokenResult.token,
  };
}
