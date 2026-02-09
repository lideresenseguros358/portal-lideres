/**
 * API Endpoint: Generar cotización Auto
 * POST /api/is/auto/quote
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacionAuto } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { environment = 'development', ...formData } = body;
    
    // Aceptar tanto nombres viejos (vcodmarca) como nuevos (codMarca) del Swagger
    const nroDoc = formData.nroDoc || formData.vnrodoc;
    const nombre = formData.nombre || formData.vnombre;
    const apellido = formData.apellido || formData.vapellido;
    const correo = formData.correo || formData.vcorreo;
    const telefono = formData.telefono || formData.vtelefono;
    const codMarca = formData.codMarca || formData.vcodmarca;
    const codModelo = formData.codModelo || formData.vcodmodelo;
    const anioAuto = formData.anioAuto || formData.vanioauto;
    const codPlanCobertura = formData.codPlanCobertura || formData.vcodplancobertura;
    const codGrupoTarifa = formData.codGrupoTarifa || formData.vcodgrupotarifa;
    
    console.log('[IS Quotes API] Generando cotización...', { codMarca, codModelo, anioAuto });
    
    // Validaciones básicas
    if (!nroDoc || !nombre || !apellido || !correo) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }
    
    if (!codMarca || !codModelo || !anioAuto) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del vehículo' },
        { status: 400 }
      );
    }
    
    if (!codPlanCobertura || !codGrupoTarifa) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos de cobertura' },
        { status: 400 }
      );
    }
    
    // Generar cotización — POST /generarcotizacion con JSON body (Swagger CotizadorRequest)
    const result = await generarCotizacionAuto(
      {
        codTipoDoc: formData.codTipoDoc || formData.vcodtipodoc || 1,
        nroDoc,
        nroNit: formData.nroNit || nroDoc,
        nombre,
        apellido,
        telefono,
        correo,
        codMarca,
        codModelo,
        anioAuto: String(anioAuto),
        sumaAseg: String(formData.sumaAseg || formData.vsumaaseg || '0'),
        codPlanCobertura,
        codPlanCoberturaAdic: formData.codPlanCoberturaAdic || 0,
        codGrupoTarifa,
      },
      environment as ISEnvironment
    );
    
    if (!result.success || !result.idCotizacion) {
      const isWafError = result.error?.includes('temporalmente no disponible') || result.error?.includes('firewall');
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Error al generar cotización',
          isTemporary: isWafError, // Para que el frontend pueda mostrar "reintentar"
        },
        { status: isWafError ? 503 : 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      idCotizacion: result.idCotizacion,
      primaTotal: result.primaTotal,
    });
    
  } catch (error: any) {
    console.error('[API IS Auto Quote] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
