/**
 * Integración de Sistema de Pagos para FEDPA
 * Soporte para Páguelo Fácil y otros proveedores
 */

export type PaymentProvider = 'paguelofacil' | 'yappy' | 'nequi' | 'manual';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'ach' | 'cash' | 'transfer';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// ============================================
// INTERFACES DE PAGO
// ============================================

export interface PaymentRequest {
  // Información de la póliza
  polizaId?: string;
  cotizacionId: string;
  numeroPoliza?: string;
  
  // Montos
  primaNeta: number;
  impuestos: number;
  recargos: number;
  total: number;
  
  // Cliente
  clienteNombre: string;
  clienteEmail: string;
  clienteTelefono: string;
  clienteIdentificacion: string;
  
  // Método de pago
  proveedor: PaymentProvider;
  metodoPago: PaymentMethod;
  
  // Cuotas (si aplica)
  cuotas?: number;
  montoCuota?: number;
  
  // Metadata
  descripcion: string;
  referencia?: string;
}

export interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string; // URL para redirección si es necesario
  status: PaymentStatus;
  message?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface PaymentVerification {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  paidAt?: string;
  receiptUrl?: string;
  authorizationCode?: string;
}

// ============================================
// PÁGUELO FÁCIL
// ============================================

export interface PagueloFacilConfig {
  merchantId: string;
  apiKey: string;
  apiSecret: string;
  environment: 'sandbox' | 'production';
  webhookUrl?: string;
}

/**
 * Iniciar pago con Páguelo Fácil
 */
export async function iniciarPagoPagueloFacil(
  request: PaymentRequest,
  config: PagueloFacilConfig
): Promise<PaymentResponse> {
  try {
    console.log('[Páguelo Fácil] Iniciando pago...', {
      total: request.total,
      cliente: request.clienteNombre,
    });
    
    // TODO: Implementar integración real con API de Páguelo Fácil
    // Documentación: https://www.paguelofacil.com/docs
    
    const baseUrl = config.environment === 'production'
      ? 'https://api.paguelofacil.com'
      : 'https://sandbox.paguelofacil.com';
    
    const payload = {
      merchant_id: config.merchantId,
      amount: request.total,
      currency: 'PAB', // Balboa panameño
      description: request.descripcion,
      customer: {
        name: request.clienteNombre,
        email: request.clienteEmail,
        phone: request.clienteTelefono,
        identification: request.clienteIdentificacion,
      },
      payment_method: mapPaymentMethod(request.metodoPago),
      installments: request.cuotas || 1,
      reference: request.referencia || request.cotizacionId,
      callback_url: config.webhookUrl,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/payments/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/payments/cancel`,
    };
    
    // Simular respuesta (reemplazar con llamada real)
    const mockResponse: PaymentResponse = {
      success: true,
      transactionId: `PF-${Date.now()}`,
      paymentUrl: `${baseUrl}/checkout/${Date.now()}`,
      status: 'pending',
      message: 'Pago iniciado correctamente',
    };
    
    console.log('[Páguelo Fácil] Pago iniciado:', mockResponse.transactionId);
    return mockResponse;
    
  } catch (error: any) {
    console.error('[Páguelo Fácil] Error:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || 'Error al procesar pago',
    };
  }
}

/**
 * Verificar estado de pago en Páguelo Fácil
 */
export async function verificarPagoPagueloFacil(
  transactionId: string,
  config: PagueloFacilConfig
): Promise<PaymentVerification> {
  try {
    console.log('[Páguelo Fácil] Verificando pago:', transactionId);
    
    // TODO: Implementar verificación real
    const baseUrl = config.environment === 'production'
      ? 'https://api.paguelofacil.com'
      : 'https://sandbox.paguelofacil.com';
    
    // Simular respuesta (reemplazar con llamada real)
    const mockVerification: PaymentVerification = {
      transactionId,
      status: 'completed',
      amount: 0,
      paidAt: new Date().toISOString(),
      authorizationCode: `AUTH-${Date.now()}`,
    };
    
    return mockVerification;
    
  } catch (error: any) {
    console.error('[Páguelo Fácil] Error verificando:', error);
    throw error;
  }
}

// ============================================
// YAPPY
// ============================================

export interface YappyConfig {
  merchantId: string;
  secretKey: string;
  environment: 'sandbox' | 'production';
}

/**
 * Iniciar pago con Yappy
 */
export async function iniciarPagoYappy(
  request: PaymentRequest,
  config: YappyConfig
): Promise<PaymentResponse> {
  try {
    console.log('[Yappy] Iniciando pago...', {
      total: request.total,
      cliente: request.clienteNombre,
    });
    
    // TODO: Implementar integración real con API de Yappy
    // Documentación: https://yappy.com.pa/developers
    
    const mockResponse: PaymentResponse = {
      success: true,
      transactionId: `YAP-${Date.now()}`,
      paymentUrl: `yappy://pay?amount=${request.total}&merchant=${config.merchantId}`,
      status: 'pending',
      message: 'Pago iniciado con Yappy',
    };
    
    return mockResponse;
    
  } catch (error: any) {
    console.error('[Yappy] Error:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || 'Error al procesar pago con Yappy',
    };
  }
}

// ============================================
// PAGO MANUAL
// ============================================

/**
 * Registrar pago manual (efectivo, transferencia, etc.)
 */
export async function registrarPagoManual(
  request: PaymentRequest,
  comprobante?: {
    tipo: 'efectivo' | 'transferencia' | 'cheque';
    numeroComprobante?: string;
    banco?: string;
    fecha: string;
    notas?: string;
  }
): Promise<PaymentResponse> {
  try {
    console.log('[Pago Manual] Registrando pago...', {
      total: request.total,
      tipo: comprobante?.tipo,
    });
    
    // Generar ID de transacción manual
    const transactionId = `MANUAL-${Date.now()}`;
    
    // TODO: Guardar en base de datos
    // await guardarPagoManual(request, comprobante, transactionId);
    
    return {
      success: true,
      transactionId,
      status: 'completed',
      message: 'Pago manual registrado correctamente',
      metadata: {
        comprobante,
      },
    };
    
  } catch (error: any) {
    console.error('[Pago Manual] Error:', error);
    return {
      success: false,
      status: 'failed',
      error: error.message || 'Error al registrar pago manual',
    };
  }
}

// ============================================
// FUNCIONES AUXILIARES
// ============================================

/**
 * Mapear método de pago a formato del proveedor
 */
function mapPaymentMethod(method: PaymentMethod): string {
  const mapping: Record<PaymentMethod, string> = {
    credit_card: 'credit_card',
    debit_card: 'debit_card',
    ach: 'ach',
    cash: 'cash',
    transfer: 'bank_transfer',
  };
  return mapping[method] || 'credit_card';
}

/**
 * Calcular cuotas disponibles según monto
 */
export function calcularCuotasDisponibles(monto: number): number[] {
  const cuotas: number[] = [1]; // Siempre disponible pago de contado
  
  if (monto >= 200) cuotas.push(2);
  if (monto >= 300) cuotas.push(3);
  if (monto >= 500) cuotas.push(6);
  if (monto >= 1000) cuotas.push(12);
  
  return cuotas;
}

/**
 * Calcular monto de cuota con interés
 */
export function calcularMontoCuota(
  montoTotal: number,
  numeroCuotas: number,
  tasaInteresMensual: number = 0.02 // 2% por defecto
): number {
  if (numeroCuotas === 1) return montoTotal;
  
  // Fórmula de cuota con interés compuesto
  const tasaMensual = tasaInteresMensual;
  const cuota = montoTotal * (tasaMensual * Math.pow(1 + tasaMensual, numeroCuotas)) / 
                (Math.pow(1 + tasaMensual, numeroCuotas) - 1);
  
  return Math.round(cuota * 100) / 100; // Redondear a 2 decimales
}

/**
 * Validar datos de tarjeta (básico)
 */
export function validarDatosTarjeta(datos: {
  numero: string;
  cvv: string;
  mesExpiracion: string;
  anoExpiracion: string;
}): { valido: boolean; errores: string[] } {
  const errores: string[] = [];
  
  // Validar número de tarjeta (Luhn algorithm)
  if (!validarNumeroTarjeta(datos.numero)) {
    errores.push('Número de tarjeta inválido');
  }
  
  // Validar CVV
  if (!/^\d{3,4}$/.test(datos.cvv)) {
    errores.push('CVV inválido (debe ser 3 o 4 dígitos)');
  }
  
  // Validar expiración
  const mes = parseInt(datos.mesExpiracion);
  const ano = parseInt(datos.anoExpiracion);
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anoActual = hoy.getFullYear();
  
  if (mes < 1 || mes > 12) {
    errores.push('Mes de expiración inválido');
  }
  
  if (ano < anoActual || (ano === anoActual && mes < mesActual)) {
    errores.push('Tarjeta expirada');
  }
  
  return {
    valido: errores.length === 0,
    errores,
  };
}

/**
 * Algoritmo de Luhn para validar número de tarjeta
 */
function validarNumeroTarjeta(numero: string): boolean {
  const digits = numero.replace(/\D/g, '');
  
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  
  let sum = 0;
  let isEven = false;
  
  for (let i = digits.length - 1; i >= 0; i--) {
    const char = digits.charAt(i);
    let digit = parseInt(char, 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
}

/**
 * Obtener tipo de tarjeta por número
 */
export function obtenerTipoTarjeta(numero: string): string {
  const digits = numero.replace(/\D/g, '');
  
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'American Express';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  
  return 'Desconocida';
}

// ============================================
// WEBHOOK HANDLER
// ============================================

/**
 * Procesar webhook de proveedor de pago
 */
export async function procesarWebhookPago(
  proveedor: PaymentProvider,
  payload: any,
  signature?: string
): Promise<{
  success: boolean;
  transactionId?: string;
  status?: PaymentStatus;
  message?: string;
}> {
  try {
    console.log('[Webhook] Procesando notificación de pago:', proveedor);
    
    // TODO: Validar firma del webhook
    // TODO: Procesar según proveedor
    // TODO: Actualizar estado en base de datos
    // TODO: Notificar al usuario
    
    switch (proveedor) {
      case 'paguelofacil':
        return procesarWebhookPagueloFacil(payload, signature);
      
      case 'yappy':
        return procesarWebhookYappy(payload, signature);
      
      default:
        return {
          success: false,
          message: 'Proveedor no soportado',
        };
    }
    
  } catch (error: any) {
    console.error('[Webhook] Error procesando:', error);
    return {
      success: false,
      message: error.message,
    };
  }
}

function procesarWebhookPagueloFacil(payload: any, signature?: string): any {
  // TODO: Implementar procesamiento específico de Páguelo Fácil
  // TODO: Validar signature si está presente
  console.log('[Webhook PF] Signature:', signature || 'no signature');
  return {
    success: true,
    transactionId: payload.transaction_id,
    status: payload.status,
  };
}

function procesarWebhookYappy(payload: any, signature?: string): any {
  // TODO: Implementar procesamiento específico de Yappy
  // TODO: Validar signature si está presente
  console.log('[Webhook Yappy] Signature:', signature || 'no signature');
  return {
    success: true,
    transactionId: payload.transaction_id,
    status: payload.status,
  };
}
