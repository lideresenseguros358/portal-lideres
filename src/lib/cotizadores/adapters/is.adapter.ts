/**
 * ADAPTADOR PARA INTERNACIONAL DE SEGUROS (IS)
 */

import type { AseguradoraAdapter, Marca, Modelo, Plan, CotizacionRequest, CotizacionResponse } from './base.adapter';
import { getMarcas, getModelos } from '@/lib/is/catalogs.service';
import { generarCotizacionAuto } from '@/lib/is/quotes.service';
import type { ISEnvironment } from '@/lib/is/config';

export class ISAdapter implements AseguradoraAdapter {
  nombre = 'Internacional de Seguros';
  slug = 'INTERNACIONAL';
  private env: ISEnvironment;
  
  constructor(env: ISEnvironment = 'development') {
    this.env = env;
  }
  
  async getMarcas(): Promise<Marca[]> {
    const marcasIS = await getMarcas(this.env);
    
    // Mapear formato IS a formato común
    return marcasIS.map(m => ({
      codigo: String(m.vcodmarca),
      nombre: m.vdescripcion,
    }));
  }
  
  async getModelos(codigoMarca?: string): Promise<Modelo[]> {
    const modelosIS = await getModelos(this.env);
    
    let modelos = modelosIS;
    
    // Filtrar por marca si se proporciona
    if (codigoMarca) {
      modelos = modelosIS.filter(m => m.vcodmarca === codigoMarca);
    }
    
    // Mapear formato IS a formato común
    return modelos.map(m => ({
      codigo: String(m.vcodmodelo),
      nombre: m.vdescripcion,
      codigoMarca: m.vcodmarca,
    }));
  }
  
  async getPlanes(): Promise<Plan[]> {
    // IS tiene planes dinámicos que se obtienen después de cotizar
    // Por ahora retornamos los planes básicos conocidos
    return [
      { codigo: '1', nombre: 'Cobertura Amplia' },
      { codigo: '2', nombre: 'Cobertura Terceros' },
    ];
  }
  
  async cotizar(request: CotizacionRequest): Promise<CotizacionResponse> {
    try {
      const result = await generarCotizacionAuto({
        vnombre: request.nombre,
        vapellido: request.apellido,
        vtipodocumento: '1', // Por defecto cédula
        vdocidentidad: request.cedula,
        vtelefono: request.telefono,
        vcorreo: request.email,
        vcodmarca: parseInt(request.codigoMarca),
        vcodmodelo: parseInt(request.codigoModelo),
        vanioauto: request.anio,
        vsumaaseg: request.valorVehiculo,
        vcodplancobertura: parseInt(request.codigoPlan),
        vlesionescorporalesporpersona: request.lesionesCorpora || 0,
        vdaniosalapropiedadajenaporevento: request.daniosPropiedad || 0,
        vgastosmedicosporpersona: request.gastosMedicos || 0,
        vdeducible: request.deducible || 0,
      }, this.env);
      
      if (result.success && result.idCotizacion) {
        return {
          success: true,
          idCotizacion: result.idCotizacion,
          detalles: result.data,
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
      'codigoMarca',
      'codigoModelo',
      'anio',
      'valorVehiculo',
      'codigoPlan',
    ];
  }
  
  getCamposOpcionales(): string[] {
    return [
      'lesionesCorpora',
      'daniosPropiedad',
      'gastosMedicos',
      'deducible',
    ];
  }
}
