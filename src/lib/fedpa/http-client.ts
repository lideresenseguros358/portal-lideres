/**
 * Cliente HTTP para FEDPA con retry y manejo de errores
 */

import { FEDPA_CONFIG, FedpaEnvironment, RETRY_CONFIG } from './config';
import type { ApiResponse } from './types';

// ============================================
// HELPER: Delay para retry
// ============================================

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// HELPER: Verificar si debe reintentar
// ============================================

function shouldRetry(status: number, attempt: number): boolean {
  if (attempt >= RETRY_CONFIG.maxRetries) return false;
  return RETRY_CONFIG.retryableStatusCodes.includes(status);
}

// ============================================
// HTTP CLIENT BASE
// ============================================

export class FedpaHttpClient {
  private baseUrl: string;
  private environment: FedpaEnvironment;
  private token?: string;

  constructor(baseUrl: string, environment: FedpaEnvironment = 'PROD') {
    this.baseUrl = baseUrl;
    this.environment = environment;
  }

  setToken(token: string) {
    this.token = token;
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit,
    attempt = 0
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(url, options);

      // Si es 401, no reintentar (token inválido)
      if (response.status === 401) {
        return {
          success: false,
          error: 'Token inválido o expirado',
        };
      }

      // Verificar si debe reintentar
      if (!response.ok && shouldRetry(response.status, attempt)) {
        const delayMs = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
        console.log(`[FEDPA] Retry ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${delayMs}ms`);
        await delay(delayMs);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      // Parsear respuesta
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || `HTTP ${response.status}`,
          data,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      console.error('[FEDPA] HTTP Error:', error);

      // Reintentar en caso de error de red
      if (attempt < RETRY_CONFIG.maxRetries) {
        const delayMs = RETRY_CONFIG.initialDelayMs * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
        await delay(delayMs);
        return this.fetchWithRetry(url, options, attempt + 1);
      }

      return {
        success: false,
        error: error.message || 'Error de red',
      };
    }
  }

  // ============================================
  // GET
  // ============================================

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const options: RequestInit = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
    };

    return this.fetchWithRetry<T>(url.toString(), options);
  }

  // ============================================
  // POST
  // ============================================

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
      },
      body: body ? JSON.stringify(body) : undefined,
    };

    return this.fetchWithRetry<T>(url, options);
  }

  // ============================================
  // POST Multipart (para archivos)
  // ============================================

  async postMultipart<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const options: RequestInit = {
      method: 'POST',
      headers: {
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        // NO incluir Content-Type: multipart/form-data
        // El navegador lo establece automáticamente con el boundary
      },
      body: formData,
    };

    return this.fetchWithRetry<T>(url, options);
  }
}

// ============================================
// FACTORY: Crear cliente según API
// ============================================

export function createFedpaClient(
  api: 'emisorPlan' | 'emisorExterno',
  env: FedpaEnvironment = 'PROD'
): FedpaHttpClient {
  const config = FEDPA_CONFIG[env];
  const baseUrl = api === 'emisorPlan' ? config.emisorPlanUrl : config.emisorExternoUrl;
  return new FedpaHttpClient(baseUrl, env);
}
