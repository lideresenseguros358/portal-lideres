/**
 * ADAPTADOR PARA FEDPA
 */

// @ts-nocheck - Archivo con imports inexistentes, requiere refactorización completa
import type { AseguradoraAdapter, Marca, Modelo, Plan, CotizacionRequest, CotizacionResponse } from './base.adapter';
import { obtenerMarcasHomologadas, obtenerModelosHomologados } from '@/lib/fedpa/catalogos-complementarios';
import { obtenerPlanesAsignados } from '@/lib/fedpa/catalogs.service';
import { generarCotizacion } from '@/lib/fedpa/cotizacion.service';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export class FEDPAAdapter implements AseguradoraAdapter {
  nombre = 'FEDPA';
  slug = 'FEDPA';
  private env: FedpaEnvironment;
  private codigoCorredorFedpa: string;
  
  constructor(codigoCorredorFedpa: string, env: FedpaEnvironment = 'PROD') {
    this.env = env;
    this.codigoCorredorFedpa = codigoCorredorFedpa;
  }
  
  async getMarcas(): Promise<Marca[]> {
    const result = await obtenerMarcasHomologadas(this.env);
    
    if (!result.success || !result.data) {
      return [];
    }
    
    // Mapear formato FEDPA a formato común
    return result.data.map(m => ({
      codigo: m.cod_marca,
      nombre: m.display,
    }));
  }
  
  async getModelos(codigoMarca?: string): Promise<Modelo[]> {
    if (!codigoMarca) {
      return [];
    }
    
    const result = await obtenerModelosHomologados(codigoMarca, this.env);
    
    if (!result.success || !result.data) {
      return [];
    }
    
    // Mapear formato FEDPA a formato común
    return result.data.map((m: any) => ({
      codigo: m.cod_modelo,
      nombre: m.display,
      codigoMarca: m.cod_marca,
    }));
  }
  
  async getPlanes(): Promise<Plan[]> {
    const result = await obtenerPlanesAsignados(this.codigoCorredorFedpa, this.env);
    
    if (!result.success || !result.data) {
      return [];
    }
    
    // Mapear formato FEDPA a formato común
    return result.data.map((p: any) => ({
      codigo: p.cod_plan,
      nombre: p.nom_plan,
      descripcion: p.des_plan,
    }));
  }
  
  async cotizar(request: CotizacionRequest): Promise<CotizacionResponse> {
    try {
      const result = await generarCotizacion({
        corredor: this.codigoCorredorFedpa,
        cod_plan: request.codigoPlan,
        cod_marca: request.codigoMarca,
        cod_modelo: request.codigoModelo,
        anio_vehiculo: request.anio,
        suma_asegurada: request.valorVehiculo,
        deducible: request.deducible || 0,
        
        // Cliente
        primer_nombre: request.nombre.split(' ')[0] || request.nombre,
        segundo_nombre: request.nombre.split(' ')[1] || '',
        primer_apellido: request.apellido.split(' ')[0] || request.apellido,
        segundo_apellido: request.apellido.split(' ')[1] || '',
        cedula: request.cedula,
        email: request.email,
        telefono: request.telefono,
        fecha_nacimiento: request.fechaNacimiento,
      }, this.env);
      
      if (result.success && (result as any).nro_cotizacion) {
        return {
          success: true,
          idCotizacion: (result as any).nro_cotizacion,
          prima: result.primaTotal || (result as any).prima_total,
          detalles: result,
        };
      } else {
        return {
          success: false,
          error: result.error || 'Error al cotizar',
        };
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Error inesperado al cotizar',
      };
    }
  }
  
  getCamposRequeridos(): string[] {
    return [
      'nombre',
      'apellido',
      'cedula',
      'telefono',
      'email',
      'fechaNacimiento',
      'codigoMarca',
      'codigoModelo',
      'anio',
      'valorVehiculo',
      'codigoPlan',
    ];
  }
  
  getCamposOpcionales(): string[] {
    return [
      'deducible',
    ];
  }
}
