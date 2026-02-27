/**
 * Endpoint: Emitir Póliza FEDPA
 * POST /api/fedpa/emision
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPoliza, crearClienteYPolizaFEDPA } from '@/lib/fedpa/emision.service';
import type { EmitirPolizaRequest } from '@/lib/fedpa/types';
import type { FedpaEnvironment } from '@/lib/fedpa/config';
import { getFedpaMarcaFromIS, normalizarModeloFedpa } from '@/lib/cotizadores/fedpa-vehicle-mapper';

export async function POST(request: NextRequest) {
  const requestId = `emi-${Date.now().toString(36)}`;
  
  try {
    const body = await request.json();
    const { environment = 'PROD', ...emisionData } = body;
    
    // Validar campos requeridos
    const required = ['Plan', 'idDoc', 'PrimerNombre', 'PrimerApellido', 'Identificacion', 
                     'FechaNacimiento', 'Sexo', 'Email', 'Telefono', 'Celular', 'Direccion',
                     'esPEP', 'Uso', 'Marca', 'Modelo', 'Ano', 'Motor', 'Placa', 'Vin', 
                     'Color', 'Pasajero', 'Puerta'];
    
    const missing = required.filter(field => emisionData[field] === undefined);
    
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Campos requeridos faltantes: ${missing.join(', ')}`, requestId },
        { status: 400 }
      );
    }
    
    // Validar formato fecha (dd/mm/yyyy)
    const fechaRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!fechaRegex.test(emisionData.FechaNacimiento)) {
      return NextResponse.json(
        { success: false, error: 'FechaNacimiento debe estar en formato dd/mm/yyyy', requestId },
        { status: 400 }
      );
    }
    
    // Validar sexo
    if (!['M', 'F'].includes(emisionData.Sexo)) {
      return NextResponse.json(
        { success: false, error: 'Sexo debe ser M o F', requestId },
        { status: 400 }
      );
    }
    
    // Validar PEP
    if (![0, 1].includes(emisionData.esPEP)) {
      return NextResponse.json(
        { success: false, error: 'esPEP debe ser 0 o 1', requestId },
        { status: 400 }
      );
    }
    
    // ── Normalizar marca/modelo: IS numeric codes → FEDPA alpha codes ──
    const rawMarca = String(emisionData.Marca || '');
    const rawModelo = String(emisionData.Modelo || '');
    const marcaNombre = emisionData.MarcaNombre || '';
    const modeloNombre = emisionData.ModeloNombre || rawModelo;
    const isNumericMarca = /^\d+$/.test(rawMarca);
    const fedpaMarca = isNumericMarca
      ? getFedpaMarcaFromIS(parseInt(rawMarca), marcaNombre)
      : rawMarca;
    const fedpaModelo = normalizarModeloFedpa(modeloNombre || rawModelo);
    
    const env = environment as FedpaEnvironment;
    const emisionRequest: EmitirPolizaRequest = {
      Plan: emisionData.Plan,
      idDoc: emisionData.idDoc,
      
      // Cliente
      PrimerNombre: emisionData.PrimerNombre,
      PrimerApellido: emisionData.PrimerApellido,
      SegundoNombre: emisionData.SegundoNombre,
      SegundoApellido: emisionData.SegundoApellido,
      Identificacion: emisionData.Identificacion,
      FechaNacimiento: emisionData.FechaNacimiento,
      Sexo: emisionData.Sexo,
      Ocupacion: emisionData.Ocupacion,
      Direccion: emisionData.Direccion,
      Telefono: emisionData.Telefono,
      Celular: emisionData.Celular,
      Email: emisionData.Email,
      esPEP: emisionData.esPEP,
      Acreedor: emisionData.Acreedor,
      
      // Vehículo — marca/modelo normalizados a formato FEDPA
      sumaAsegurada: emisionData.sumaAsegurada || 0,
      Uso: emisionData.Uso,
      Marca: fedpaMarca,
      Modelo: fedpaModelo,
      Ano: emisionData.Ano,
      Motor: emisionData.Motor,
      Placa: emisionData.Placa,
      MesVencimientoPlaca: emisionData.MesVencimientoPlaca,
      Vin: emisionData.Vin,
      Color: emisionData.Color,
      Pasajero: emisionData.Pasajero,
      Puerta: emisionData.Puerta,
      
      // Opcional
      PrimaTotal: emisionData.PrimaTotal,
    };
    
    // ═══ LOG: JSON completo que se envía a FEDPA ═══
    console.log(`\n[FEDPA EMISIÓN] ${requestId} ═══ PAYLOAD JSON ═══`);
    console.log(JSON.stringify(emisionRequest, null, 2));
    console.log(`[FEDPA EMISIÓN] ${requestId} Marca: ${rawMarca} → ${fedpaMarca} | Modelo: ${rawModelo} → ${fedpaModelo}`);
    console.log(`[FEDPA EMISIÓN] ${requestId} ═════════════════════════\n`);
    
    // Emitir con FEDPA — NO reintentar automáticamente (operación crítica)
    const result = await emitirPoliza(emisionRequest, env);
    
    if (!result.success) {
      // Detectar si es error de token
      const isTokenError = result.error?.toLowerCase().includes('token') || result.error?.toLowerCase().includes('autenticar');
      const status = isTokenError ? 424 : 400;
      const code = isTokenError ? 'TOKEN_NOT_AVAILABLE' : 'EMISSION_FAILED';
      
      console.error(`[API FEDPA Emisión] ${requestId} Error:`, { code, error: result.error });
      
      return NextResponse.json(
        { success: false, error: result.error, code, requestId },
        { status }
      );
    }
    
    console.log(`[API FEDPA Emisión] ${requestId} Póliza emitida:`, { poliza: result.poliza });
    
    // Crear cliente y póliza en sistema interno
    const { clientId, policyId, error: dbError } = await crearClienteYPolizaFEDPA(emisionRequest, result);
    
    if (dbError) {
      console.warn(`[API FEDPA Emisión] ${requestId} No se pudo guardar en BD:`, dbError);
      // No fallar la emisión si BD falla
    }
    
    return NextResponse.json({
      success: true,
      amb: result.amb,
      cotizacion: result.cotizacion,
      poliza: result.poliza,
      nroPoliza: result.poliza, // Alias
      vigenciaDesde: result.desde,
      vigenciaHasta: result.hasta,
      desde: result.desde,
      hasta: result.hasta,
      clientId,
      policyId,
      requestId,
      message: `Póliza ${result.poliza} emitida exitosamente`,
    });
  } catch (error: any) {
    console.error(`[API FEDPA Emisión] ${requestId} Error no controlado:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error emitiendo póliza', requestId },
      { status: 500 }
    );
  }
}
