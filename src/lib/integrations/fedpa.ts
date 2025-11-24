/**
 * FEDPA API Integration
 * 
 * Servicio para consultar la base de datos de FEDPA
 * y enriquecer la información de clientes y pólizas
 */

interface FEDPAPolicyData {
  policy_number: string;
  client_name: string;
  client_national_id?: string;
  client_email?: string;
  client_phone?: string;
  insurer_name?: string;
  policy_type?: string; // ramo
  start_date?: string;
  renewal_date?: string;
  expiration_date?: string;
  status?: 'ACTIVA' | 'CANCELADA' | 'VENCIDA';
  premium_amount?: number;
  coverage?: string;
  additional_data?: Record<string, any>;
}

interface FEDPAResponse {
  success: boolean;
  data?: FEDPAPolicyData;
  error?: string;
  message?: string;
}

class FEDPAService {
  private apiKey: string;
  private apiUrl: string;
  private demoMode: boolean;

  constructor() {
    this.apiKey = process.env.FEDPA_API_KEY || '';
    this.apiUrl = process.env.FEDPA_API_URL || 'https://api.fedpa.com.pa';
    this.demoMode = process.env.FEDPA_DEMO_MODE === 'true';

    if (!this.apiKey && !this.demoMode) {
      console.warn('[FEDPA] API Key no configurada. Configura FEDPA_API_KEY en .env.local');
    }

    if (this.demoMode) {
      console.log('[FEDPA] 🎭 MODO DEMO activado - Usando datos simulados');
    }
  }

  /**
   * Consultar información de una póliza por su número
   */
  async getPolicyByNumber(policyNumber: string): Promise<FEDPAResponse> {
    try {
      // Modo DEMO: Simular respuesta sin llamar a la API real
      if (this.demoMode) {
        console.log(`[FEDPA DEMO] Simulando consulta para: ${policyNumber}`);
        await this.sleep(100); // Simular latencia de red
        
        return {
          success: true,
          data: {
            policy_number: policyNumber,
            client_name: 'CLIENTE DEMO FEDPA',
            client_national_id: '8-123-4567',
            client_email: 'demo@fedpa.com',
            client_phone: '6123-4567',
            insurer_name: 'ASEGURADORA DEMO',
            policy_type: 'AUTO',
            start_date: '2024-01-01',
            renewal_date: '2025-01-01',
            status: 'ACTIVA',
            premium_amount: 1000,
            coverage: 'Cobertura completa',
          },
        };
      }

      if (!this.apiKey) {
        return {
          success: false,
          error: 'API Key de FEDPA no configurada',
        };
      }

      console.log(`[FEDPA] Consultando póliza: ${policyNumber}`);

      const response = await fetch(`${this.apiUrl}/v1/policies/${encodeURIComponent(policyNumber)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[FEDPA] Error HTTP ${response.status}:`, errorText);
        
        if (response.status === 404) {
          return {
            success: false,
            error: 'Póliza no encontrada en FEDPA',
            message: `La póliza ${policyNumber} no existe en la base de datos de FEDPA`,
          };
        }

        return {
          success: false,
          error: `Error HTTP ${response.status}`,
          message: errorText,
        };
      }

      const data = await response.json();
      
      console.log(`[FEDPA] Datos recibidos para ${policyNumber}:`, data);

      return {
        success: true,
        data: this.normalizeData(data),
      };
    } catch (error) {
      console.error('[FEDPA] Error en consulta:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Consultar múltiples pólizas (batch)
   */
  async getPoliciesBatch(policyNumbers: string[]): Promise<Map<string, FEDPAResponse>> {
    const results = new Map<string, FEDPAResponse>();

    // Procesar en lotes de 10 para no sobrecargar la API
    const batchSize = 10;
    for (let i = 0; i < policyNumbers.length; i += batchSize) {
      const batch = policyNumbers.slice(i, i + batchSize);
      
      const promises = batch.map(async (policyNumber) => {
        const result = await this.getPolicyByNumber(policyNumber);
        return { policyNumber, result };
      });

      const batchResults = await Promise.all(promises);
      
      for (const { policyNumber, result } of batchResults) {
        results.set(policyNumber, result);
      }

      // Pequeña pausa entre lotes para no saturar la API
      if (i + batchSize < policyNumbers.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Normalizar datos de FEDPA a nuestro formato
   */
  private normalizeData(rawData: any): FEDPAPolicyData {
    // Adaptar según el formato real que devuelva FEDPA
    // Este es un ejemplo genérico
    return {
      policy_number: rawData.policy_number || rawData.numero_poliza || rawData.policyNumber,
      client_name: rawData.client_name || rawData.nombre_cliente || rawData.insured_name,
      client_national_id: rawData.client_id || rawData.cedula || rawData.national_id,
      client_email: rawData.email || rawData.correo,
      client_phone: rawData.phone || rawData.telefono || rawData.celular,
      insurer_name: rawData.insurer || rawData.aseguradora || rawData.company,
      policy_type: this.normalizeRamo(rawData.policy_type || rawData.tipo || rawData.ramo),
      start_date: rawData.start_date || rawData.fecha_inicio || rawData.effective_date,
      renewal_date: rawData.renewal_date || rawData.fecha_renovacion || rawData.expiration_date,
      expiration_date: rawData.expiration_date || rawData.fecha_vencimiento,
      status: this.normalizeStatus(rawData.status || rawData.estado),
      premium_amount: rawData.premium || rawData.prima || rawData.amount,
      coverage: rawData.coverage || rawData.cobertura,
      additional_data: rawData,
    };
  }

  /**
   * Normalizar el tipo de póliza (ramo) a nuestro formato
   */
  private normalizeRamo(ramo?: string): string | undefined {
    if (!ramo) return undefined;

    const ramoUpper = ramo.toUpperCase().trim();

    // Mapeo de variaciones comunes
    const mapping: Record<string, string> = {
      'AUTO': 'AUTO',
      'AUTOMOVIL': 'AUTO',
      'AUTOMOBILE': 'AUTO',
      'VEHICLE': 'AUTO',
      'VIDA': 'VIDA',
      'LIFE': 'VIDA',
      'SALUD': 'SALUD',
      'HEALTH': 'SALUD',
      'HOGAR': 'HOGAR',
      'HOME': 'HOGAR',
      'RESIDENCIAL': 'HOGAR',
      'COMERCIO': 'COMERCIO',
      'COMMERCIAL': 'COMERCIO',
      'RESPONSABILIDAD': 'RESPONSABILIDAD CIVIL',
      'LIABILITY': 'RESPONSABILIDAD CIVIL',
      'INCENDIO': 'INCENDIO',
      'FIRE': 'INCENDIO',
      'TRANSPORTE': 'TRANSPORTE',
      'CARGO': 'TRANSPORTE',
      'FIANZA': 'OTROS',
      'BOND': 'OTROS',
    };

    return mapping[ramoUpper] || ramoUpper;
  }

  /**
   * Normalizar el estado de la póliza
   */
  private normalizeStatus(status?: string): 'ACTIVA' | 'CANCELADA' | 'VENCIDA' | undefined {
    if (!status) return undefined;

    const statusUpper = status.toUpperCase().trim();

    if (statusUpper.includes('ACTIV') || statusUpper.includes('ACTIVE') || statusUpper.includes('VIGENTE')) {
      return 'ACTIVA';
    }
    if (statusUpper.includes('CANCEL') || statusUpper.includes('ANULADA')) {
      return 'CANCELADA';
    }
    if (statusUpper.includes('VENC') || statusUpper.includes('EXPIR') || statusUpper.includes('CADUCADA')) {
      return 'VENCIDA';
    }

    return 'ACTIVA'; // Default
  }

  /**
   * Utilidad para pausas entre requests
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verificar si la API está disponible
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      const response = await fetch(`${this.apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error('[FEDPA] Health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const fedpaService = new FEDPAService();

// Export types
export type { FEDPAPolicyData, FEDPAResponse };
