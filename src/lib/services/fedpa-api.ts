/**
 * FEDPA API Service - Integración Completa
 * 
 * Servicio para cotizar y emitir pólizas con FEDPA
 * Basado en documentación oficial de FEDPA API
 */

const FEDPA_API_BASE = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';

// ⚠️ SEGURIDAD: Credenciales desde variables de entorno
const FEDPA_USER = process.env.USUARIO_FEDPA;
const FEDPA_CLAVE = process.env.CLAVE_FEDPA;

if (!FEDPA_USER || !FEDPA_CLAVE) {
  console.warn('[FEDPA] ADVERTENCIA: Variables de entorno USUARIO_FEDPA y CLAVE_FEDPA no configuradas');
}

// ============================================================================
// TIPOS Y INTERFACES
// ============================================================================

export interface FedpaLimite {
  CODCOBERTURA: number;
  IDLIMITE: number;
  LIMITE: string;
}

export interface FedpaPlan {
  PLAN: number;
  NOMBREPLAN: string;
  USO: string;
}

export interface FedpaBeneficio {
  PLAN: number;
  BENEFICIOS: string;
}

export interface FedpaUso {
  USO: string;
  DESCRIPCION: string;
}

export interface FedpaCotizacionRequest {
  Ano: string;
  Uso: string;
  CantidadPasajeros: string;
  SumaAsegurada: string;
  CodLimiteLesiones: string;
  CodLimitePropiedad: string;
  CodLimiteGastosMedico: string;
  EndosoIncluido: string;
  CodPlan: string;
  CodMarca: string;
  CodModelo: string;
  Nombre: string;
  Apellido: string;
  Cedula: string;
  Telefono: string;
  Email: string;
  Usuario: string;
  Clave: string;
}

export interface FedpaCotizacionResponse {
  Cotizacion: {
    PrimaTotal: number;
    PrimaNeta: number;
    Recargo: number;
    Derecho: number;
    Impuesto: number;
    // Otros campos según respuesta de FEDPA
  };
}

export interface FedpaEmisionRequest {
  FechaHora: string;
  Monto: string;
  Aprobada: string;
  NroTransaccion: string;
  FechaAprobada: string;
  Ramo: string;
  SubRamo: string;
  FechaDesde: string;
  FechaHasta: string;
  Opcion: string;
  Usuario: string;
  Clave: string;
  Entidad: Array<{
    Juridico: string;
    NombreCompleto: string;
    PrimerNombre: string;
    SegundoNombre: string;
    PrimerApellido: string;
    SegundoApellido: string;
    DocumentoIdentificacion: string;
    Cedula: string;
    Ruc: string;
    CodPais: string;
    CodProvincia: string;
    CodCorregiemiento: string;
    Email: string;
    TelefonoOficina: string;
    Celular: string;
    Direccion: string;
    IdVinculo: string;
  }>;
  Auto: {
    CodMarca: string;
    CodModelo: string;
    Ano: string;
    Placa: string;
    Chasis: string;
    Motor: string;
    Color: string;
  };
}

export interface FedpaEmisionResponse {
  NroPoliza: string;
  UrlPoliza?: string;
  Mensaje?: string;
}

// ============================================================================
// SERVICIO PRINCIPAL
// ============================================================================

class FedpaApiService {
  private baseUrl = FEDPA_API_BASE;

  /**
   * Consultar límites de cobertura configurados
   */
  async consultarLimites(): Promise<FedpaLimite[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Polizas/consultar_limites_externos?Usuario=${FEDPA_USER}&Clave=${FEDPA_CLAVE}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error consultando límites:', error);
      throw error;
    }
  }

  /**
   * Consultar planes de cobertura completa disponibles
   */
  async consultarPlanes(): Promise<FedpaPlan[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Polizas/consultar_planes_cc_externos?Usuario=${FEDPA_USER}&Clave=${FEDPA_CLAVE}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error consultando planes:', error);
      throw error;
    }
  }

  /**
   * Consultar beneficios de un plan específico
   */
  async consultarBeneficios(idPlan: number): Promise<FedpaBeneficio[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Polizas/consultar_beneficios_planes_externos?Usuario=${FEDPA_USER}&Clave=${FEDPA_CLAVE}&IdPlan=${idPlan}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error consultando beneficios:', error);
      throw error;
    }
  }

  /**
   * Consultar tipos de uso de vehículos permitidos
   */
  async consultarUsos(): Promise<FedpaUso[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Polizas/consultar_uso_externos?Usuario=${FEDPA_USER}&Clave=${FEDPA_CLAVE}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error consultando usos:', error);
      throw error;
    }
  }

  /**
   * Cotizar póliza de auto con cobertura completa y daños a terceros
   */
  async cotizar(datos: FedpaCotizacionRequest): Promise<FedpaCotizacionResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Polizas/get_cotizacion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...datos,
            Usuario: FEDPA_USER,
            Clave: FEDPA_CLAVE,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error cotizando:', error);
      throw error;
    }
  }

  /**
   * Generar número de póliza antes de emitir
   */
  async generarNroPoliza(): Promise<{ NroPoliza: string }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/Polizas/get_nropoliza?Usuario=${FEDPA_USER}&Clave=${FEDPA_CLAVE}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error generando número de póliza:', error);
      throw error;
    }
  }

  /**
   * Emitir póliza de auto con cobertura completa
   * Requiere subir documentos (cédula, licencia, fotos del vehículo)
   */
  async emitirPoliza(
    datos: FedpaEmisionRequest,
    archivos: File[]
  ): Promise<FedpaEmisionResponse> {
    try {
      const formData = new FormData();

      // Agregar datos como JSON en el campo "data"
      formData.append('data', JSON.stringify({
        ...datos,
        Usuario: FEDPA_USER,
        Clave: FEDPA_CLAVE,
      }));

      // Agregar archivos
      archivos.forEach((archivo, index) => {
        formData.append(`file${index}`, archivo);
      });

      const response = await fetch(
        `${this.baseUrl}/Polizas/crear_poliza_auto_cc_externos`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[FEDPA] Error emitiendo póliza:', error);
      throw error;
    }
  }
}

// Exportar instancia singleton
export const fedpaApi = new FedpaApiService();
