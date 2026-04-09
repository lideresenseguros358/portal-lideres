/**
 * PagueloFacil Configuration
 * ==========================
 * Configuración centralizada para la integración con PagueloFacil.
 * 
 * IMPORTANTE:
 * - PagueloFacil tiene credenciales separadas para sandbox y producción.
 * - NO confundir las credenciales de cada ambiente.
 * - El monto mínimo es $1.00 y la moneda permitida es USD.
 * - Las URLs de enlace de pago son de un solo uso.
 * - RETURN_URL debe ser codificada en Hexadecimal.
 * - PF_CF (custom fields) debe ser JSON codificado en Hexadecimal.
 */

export type PagueloFacilEnvironment = 'sandbox' | 'production';

export interface PagueloFacilConfig {
  /** CCLW: Código web suministrado por PagueloFacil que identifica al comercio */
  cclw: string;
  /** Full URL for the LinkDeamon.cfm endpoint (creates payment links) */
  linkUrl: string;
  /** Base URL for the admin/management API (query transactions) */
  adminBaseUrl: string;
  /** Base URL for the REST API (processTx, etc.) */
  apiBaseUrl: string;
  /** Access token for querying transactions */
  accessToken: string;
  /** Environment */
  environment: PagueloFacilEnvironment;
}

/**
 * Get PagueloFacil configuration from environment variables.
 * Uses PAGUELOFACIL_ENVIRONMENT to determine sandbox vs production.
 */
export function getPagueloFacilConfig(): PagueloFacilConfig {
  const env = (process.env.PAGUELOFACIL_ENVIRONMENT || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')) as PagueloFacilEnvironment;
  const isProduction = env === 'production';

  return {
    cclw: process.env.PAGUELOFACIL_CCLW || '',
    linkUrl: process.env.PAGUELOFACIL_LINK_URL || (
      isProduction
        ? 'https://secure.paguelofacil.com/LinkDeamon.cfm'
        : 'https://sandbox.paguelofacil.com/LinkDeamon.cfm'
    ),
    adminBaseUrl: process.env.PAGUELOFACIL_ADMIN_URL || (
      isProduction
        ? 'https://admin.paguelofacil.com'
        : 'https://sandbox.paguelofacil.com'
    ),
    apiBaseUrl: process.env.PAGUELOFACIL_API_URL || (
      isProduction
        ? 'https://api.pfserver.net'
        : 'https://api-sand.pfserver.net'
    ),
    accessToken: process.env.PAGUELOFACIL_API_TOKEN || '',
    environment: env,
  };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Encode a string to hexadecimal (required for RETURN_URL and PF_CF).
 */
export function toHex(str: string): string {
  return Buffer.from(str, 'utf-8').toString('hex');
}

/**
 * Decode a hexadecimal string back to UTF-8.
 */
export function fromHex(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf-8');
}

/**
 * Build hex-encoded PF_CF (custom fields) for the payment link.
 * PagueloFacil expects: [{"id":"key","nameOrLabel":"label","type":"hidden","value":"val"}]
 */
export function buildCustomFields(
  fields: Record<string, string>
): string {
  const arr = Object.entries(fields).map(([id, value]) => ({
    id,
    nameOrLabel: id,
    type: 'hidden',
    value,
  }));
  return toHex(JSON.stringify(arr));
}

/**
 * Build the full RETURN_URL with query parameters, hex-encoded.
 */
export function buildReturnUrl(
  baseOrigin: string,
  returnPath: string,
  params?: Record<string, string>
): string {
  const url = new URL(returnPath, baseOrigin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  return toHex(url.toString());
}

// ─── Types ──────────────────────────────────────────────────

/** Response from LinkDeamon.cfm when creating a payment link */
export interface PFCreateLinkResponse {
  headerStatus: {
    code: number;
    description: string;
  };
  serverTime: string;
  message: string;
  data: {
    url: string;
    code: string;
  } | null;
  success: boolean;
}

/** Parameters returned to RETURN_URL after user completes payment */
export interface PFReturnParams {
  TotalPagado: string;   // "0" if declined, amount if approved
  Fecha: string;         // dd/mm/yyyy
  Hora: string;          // HH:MM:SS
  Tipo: string;          // VISA, MC, CASH, CLAVE, NIQUI
  Oper: string;          // Operation code (codOper)
  Usuario: string;       // Cardholder name
  Email: string;         // Cardholder email
  Estado: string;        // "Aprobada" or "Denegada"
  Razon: string;         // Reason (only for declined)
  PARM_1?: string;       // Custom parameter returned as-is
}

/** Webhook payload sent by PagueloFacil */
export interface PFWebhookPayload {
  date: string;                     // yyyy-MM-ddTHH:mm:ss
  relatedTx: string;               // Related transaction (e.g. 3DS auth codOper)
  description: string;
  merchantDescriptor: string;
  type: string;                     // VISA / MC
  cardToken: string;
  userLogn: string;
  idUsr: string | number;           // PF internal user ID
  revisionLevel: string | null;
  totalPay: string;                 // e.g. "1356.25"
  binInfo: any;                     // JSON — fraud/BIN/geo info
  displayNum: string;               // Last digits of card
  returnUrl: string;
  requestPayAmount: number;          // Numeric — original requested amount
  email: string;
  isExternalUrl: boolean;
  authStatus: string;               // ISO auth code (e.g. "00" = approved)
  cardType: string;                 // VISA / MC
  userName: string;                 // Cardholder name
  idtx: string | number;           // PF internal transaction ID
  inRevision: boolean;
  isTxCampaign: boolean;
  name: string;                     // Cardholder name
  operationType: string;            // AUTH | CAPTURE | AUTH_CAPTURE | 3DS | RECURRENT | REVERSE | REVERSE_CAPTURE
  txDescriptor: string;
  revisionOptions: string | null;
  codOper: string;                  // Transaction reference code
  status: number;                   // 1 = approved, 0 = declined
  messageSys: string;               // Auth message from card brand
}

/** Transaction query response */
export interface PFTransactionRecord {
  codOper: string;
  totalPay: string;
  status: number;
  operationType: string;
  displayNum: string;
  cardType: string;
  userName: string;
  email: string;
  date: string;
  description: string;
}

/**
 * PagueloFacil Response Codes
 */
export const PF_RESPONSE_CODES: Record<number, string> = {
  100: 'User / Password Invalid',
  200: 'Success',
  300: 'There was an error',
  310: 'There was an error, processing credit card',
  400: 'Invalid request',
  410: 'Invalid Api Key',
  420: 'Invalid Api Version',
  430: 'Invalid KWP',
  500: 'Invalid Session',
  510: 'Session Expired',
  520: 'User not started session',
  530: 'Haven\'t privileges to access the service',
  540: 'The user is already logged in the application',
  550: 'Error saving data in the database',
  551: 'Error, Invalid Field',
  560: 'You do not have privileges to access this service or functionality',
  900: 'URL TimeOut Connection',
  910: 'Please check your connection internet',
  920: 'There was an Exception',
};
