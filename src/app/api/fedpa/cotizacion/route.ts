/**
 * Endpoint: Generar Cotización FEDPA
 * POST /api/fedpa/cotizacion
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacion } from '@/lib/fedpa/cotizacion.service';
import type { CotizacionRequest } from '@/lib/fedpa/types';
import type { FedpaEnvironment } from '@/lib/fedpa/config';
import { updateThirdPartyMinPrice } from '@/lib/services/third-party-price-updater';
import { normalizeQuoteData, logQuoteMapping } from '@/lib/cotizadores/catalog-normalizer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { environment = 'DEV', ...formData } = body;
    
    console.log('[FEDPA Cotización] Generando cotización...', {
      plan: formData.CodPlan || 'auto',
      marca: formData.vcodmarca,
      modelo: formData.vcodmodelo,
      endoso: body.EndosoIncluido || '(auto)',
      planType: body.planType || '(no especificado)'
    });
    
    // Normalizar datos del formulario (mapea IS a FEDPA automáticamente)
    const normalized = normalizeQuoteData(formData);
    
    // Log del mapeo para debugging
    logQuoteMapping(normalized);
    
    const env = environment as FedpaEnvironment;
    
    // Construir request para FEDPA usando datos normalizados
    const plan = normalized.fedpa?.plan || '411';
    const esCoberturabCompleta = plan === '411'; // Plan 411 = Cobertura Completa
    
    const cotizacionRequest: CotizacionRequest = {
      Ano: normalized.vehiculo.anio, // Int32
      Uso: normalized.fedpa?.uso || '10', // String
      CantidadPasajeros: 5, // Int32
      SumaAsegurada: normalized.vehiculo.valor.toString(), // STRING según error API
      // Límites de coberturas mapeados automáticamente
      CodLimiteLesiones: normalized.fedpa?.codLimiteLesiones || '1',
      CodLimitePropiedad: normalized.fedpa?.codLimitePropiedad || '1',
      CodLimiteGastosMedico: normalized.fedpa?.codLimiteGastosMedico || '1',
      // CRÍTICO: Respetar EndosoIncluido del body (básico='N', premium='S')
      EndosoIncluido: body.EndosoIncluido || normalized.fedpa?.endosoIncluido || 'S',
      CodPlan: plan,
      // Para CC: usar códigos mapeados, para DT: vacíos
      CodMarca: esCoberturabCompleta ? (normalized.fedpa?.codMarca || 'TOY') : '',
      CodModelo: esCoberturabCompleta ? (normalized.fedpa?.codModelo || 'AUTO') : '',
      Nombre: normalized.cliente.nombre,
      Apellido: normalized.cliente.apellido,
      Cedula: normalized.cliente.numeroDocumento,
      Telefono: normalized.cliente.telefono,
      Email: normalized.cliente.correo,
      Usuario: '',
      Clave: '',
    };
    
    const result = await generarCotizacion(cotizacionRequest, env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    // Si es Daños a Terceros (SumaAsegurada = 0) y cotización exitosa, actualizar precio mínimo
    const isDanosTerceros = cotizacionRequest.SumaAsegurada === '0' || cotizacionRequest.SumaAsegurada === 0;
    if (isDanosTerceros && result.primaTotal) {
      // Actualizar precio mínimo en background (no bloquea respuesta)
      updateThirdPartyMinPrice({
        insurer: 'FEDPA',
        price: result.primaTotal,
      }).catch(err => console.error('[FEDPA] Error actualizando precio mínimo:', err));
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
