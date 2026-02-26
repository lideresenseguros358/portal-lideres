/**
 * API Endpoint: Cotización completa IS (quote + coberturas en UNA llamada)
 * POST /api/is/auto/quote-full
 * 
 * Combina generarCotizacion + getlistacoberturas en un solo round-trip
 * para eliminar la latencia de ida/vuelta entre cliente y servidor.
 * Ahorra ~2-5s vs hacer 2 llamadas separadas desde el frontend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarCotizacionAuto, obtenerCoberturasCotizacion } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();
  
  try {
    const body = await request.json();
    const { environment = 'development', ...formData } = body;
    
    // Accept both old (vcodmarca) and new (codMarca) param names
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
    
    // Validations
    if (!nroDoc || !nombre || !apellido || !correo) {
      return NextResponse.json({ success: false, error: 'Faltan datos del cliente' }, { status: 400 });
    }
    if (!codMarca || !codModelo || !anioAuto) {
      return NextResponse.json({ success: false, error: 'Faltan datos del vehículo' }, { status: 400 });
    }
    if (!codPlanCobertura || !codGrupoTarifa) {
      return NextResponse.json({ success: false, error: 'Faltan datos de cobertura' }, { status: 400 });
    }
    
    console.log(`[IS QuoteFull] Iniciando cotización completa...`);
    
    // Step 1: Generate quote (this is the slow part — IS API call)
    const quoteResult = await generarCotizacionAuto(
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
        fecNacimiento: formData.fecNacimiento || '01/01/1990',
        codProvincia: formData.codProvincia || 8,
      },
      environment as ISEnvironment
    );
    
    if (!quoteResult.success || !quoteResult.idCotizacion) {
      const isWafError = quoteResult.error?.includes('temporalmente no disponible') || quoteResult.error?.includes('firewall');
      return NextResponse.json(
        { success: false, error: quoteResult.error || 'Error al generar cotización', isTemporary: isWafError },
        { status: isWafError ? 503 : 500 }
      );
    }
    
    const tQuote = Date.now();
    console.log(`[IS QuoteFull] Cotización generada en ${tQuote - t0}ms. Obteniendo coberturas...`);
    
    // Step 2: Get coberturas IMMEDIATELY (no client round-trip needed)
    const cobResult = await obtenerCoberturasCotizacion(
      quoteResult.idCotizacion,
      1, // vIdOpt doesn't matter — IS returns all 3 tables (Table/Table1/Table2)
      environment as ISEnvironment
    );
    
    const tCob = Date.now();
    console.log(`[IS QuoteFull] Coberturas en ${tCob - tQuote}ms. Total: ${tCob - t0}ms`);
    
    return NextResponse.json({
      success: true,
      idCotizacion: quoteResult.idCotizacion,
      primaTotal: quoteResult.primaTotal,
      coberturas: cobResult.success ? cobResult.data : null,
      coberturasError: cobResult.success ? undefined : cobResult.error,
      _timing: {
        quoteMs: tQuote - t0,
        coberturasMs: tCob - tQuote,
        totalMs: tCob - t0,
      },
    });
    
  } catch (error: any) {
    console.error('[API IS QuoteFull] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
