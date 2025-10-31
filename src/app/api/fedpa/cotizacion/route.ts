/**
 * Endpoint: Generar Cotización FEDPA
 * POST /api/fedpa/cotizacion
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacion } from '@/lib/fedpa/cotizacion.service';
import type { CotizacionRequest } from '@/lib/fedpa/types';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { environment = 'PROD', ...cotizacionData } = body;
    
    // Validar campos requeridos
    const required = ['Ano', 'Uso', 'CodPlan', 'CodMarca', 'CodModelo', 'Nombre', 'Apellido', 'Cedula'];
    const missing = required.filter(field => !cotizacionData[field]);
    
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Campos requeridos faltantes: ${missing.join(', ')}` },
        { status: 400 }
      );
    }
    
    const env = environment as FedpaEnvironment;
    const cotizacionRequest: CotizacionRequest = {
      Ano: cotizacionData.Ano,
      Uso: cotizacionData.Uso,
      CantidadPasajeros: cotizacionData.CantidadPasajeros || 5,
      SumaAsegurada: cotizacionData.SumaAsegurada || '0',
      CodLimiteLesiones: cotizacionData.CodLimiteLesiones || '1',
      CodLimitePropiedad: cotizacionData.CodLimitePropiedad || '1',
      CodLimiteGastosMedico: cotizacionData.CodLimiteGastosMedico || '1',
      EndosoIncluido: cotizacionData.EndosoIncluido || 'N',
      CodPlan: cotizacionData.CodPlan,
      CodMarca: cotizacionData.CodMarca,
      CodModelo: cotizacionData.CodModelo,
      Nombre: cotizacionData.Nombre,
      Apellido: cotizacionData.Apellido,
      Cedula: cotizacionData.Cedula,
      Telefono: cotizacionData.Telefono || '',
      Email: cotizacionData.Email || '',
      Usuario: '', // Se llena en el servicio
      Clave: '', // Se llena en el servicio
    };
    
    const result = await generarCotizacion(cotizacionRequest, env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      success: true,
      idCotizacion: result.idCotizacion,
      coberturas: result.coberturas,
      primaBase: result.primaBase,
      impuesto1: result.totalImpuesto1,
      impuesto2: result.totalImpuesto2,
      primaTotal: result.primaTotal,
      sincronizado: result.sincronizado,
    });
  } catch (error: any) {
    console.error('[API FEDPA Cotización] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error generando cotización' },
      { status: 500 }
    );
  }
}
