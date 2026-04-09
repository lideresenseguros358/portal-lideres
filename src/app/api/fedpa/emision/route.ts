/**
 * Endpoint: Emitir Póliza FEDPA
 * POST /api/fedpa/emision
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPoliza, crearClienteYPolizaFEDPA } from '@/lib/fedpa/emision.service';
import { getSupabaseServer } from '@/lib/supabase/server';
import type { EmitirPolizaRequest } from '@/lib/fedpa/types';
import type { FedpaEnvironment } from '@/lib/fedpa/config';
// NOTE: EmisorPlan (DT) sends IS numeric codes for Marca/Modelo directly from the frontend.
// DO NOT import or use resolveFedpaMarca / normalizarModeloFedpa here — those belong to
// EmisorExterno (CC) which uses a completely different catalog of 3-char string codes.
// Mixing the two systems causes ORA-02291 AUT_MODELO_FK violations in EmisorPlan.

export async function POST(request: NextRequest) {
  const requestId = `emi-${Date.now().toString(36)}`;
  
  try {
    const body = await request.json();
    const { environment = 'PROD', ...emisionData } = body;
    
    // Validar campos requeridos
    const required = ['Plan', 'idDoc', 'PrimaTotal', 'PrimerNombre', 'PrimerApellido', 'Identificacion', 
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
    
    // ── Marca/Modelo: EmisorPlan (DT) — pass IS numeric codes as-is from the frontend ──
    // EmisorPlan uses IS numeric codes (e.g. 156=Toyota, 217=Geely) as Marca/Modelo values.
    // EmisorExterno (CC) uses 3-char string codes — that is a completely separate catalog.
    const rawMarca = String(emisionData.Marca || '');
    const rawModelo = String(emisionData.Modelo || '');
    const marcaNombre = String(emisionData.MarcaNombre || '');
    const modeloNombre = String(emisionData.ModeloNombre || '');
    console.log(`[API FEDPA Emisión] ${requestId} Vehicle: IS marca ${rawMarca}/${marcaNombre}, modelo ${rawModelo}/${modeloNombre}`);

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

      // Vehículo — IS numeric codes passed directly (EmisorPlan catalog)
      sumaAsegurada: emisionData.sumaAsegurada || 0,
      Uso: emisionData.Uso,
      Marca: rawMarca,
      Modelo: rawModelo,
      Ano: emisionData.Ano,
      Motor: emisionData.Motor,
      Placa: emisionData.Placa,
      MesVencimientoPlaca: emisionData.MesVencimientoPlaca,
      Vin: emisionData.Vin,
      Color: emisionData.Color,
      Pasajero: emisionData.Pasajero,
      Puerta: emisionData.Puerta,
      
      // Pago
      PrimaTotal: emisionData.PrimaTotal,
      cantidadPago: emisionData.cantidadPago || 1,
    };
    
    // ═══ LOG: JSON completo que se envía a FEDPA ═══
    console.log(`\n[FEDPA EMISIÓN] ${requestId} ═══ PAYLOAD JSON ═══`);
    console.log(JSON.stringify(emisionRequest, null, 2));
    console.log(`[FEDPA EMISIÓN] ${requestId} Marca: ${rawMarca} | Modelo: ${rawModelo} | MarcaNombre: ${marcaNombre} | ModeloNombre: ${modeloNombre}`);
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

    // ═══ Master broker override verification ═══
    let masterBrokerId: string | undefined;
    if (emisionData.masterBrokerId) {
      try {
        const supabase = await getSupabaseServer();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role === 'master') {
            masterBrokerId = emisionData.masterBrokerId;
            console.log(`[API FEDPA Emisión] ${requestId} Master broker override:`, masterBrokerId);
          }
        }
      } catch (err) {
        console.warn(`[API FEDPA Emisión] ${requestId} Master verification failed:`, err);
      }
    }

    // Crear cliente y póliza en sistema interno
    const { clientId, policyId, error: dbError } = await crearClienteYPolizaFEDPA(emisionRequest, result, masterBrokerId);
    
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
      // Echo back sent data for carátula verification
      cliente: {
        nombre: `${emisionRequest.PrimerNombre} ${emisionRequest.PrimerApellido}`.trim(),
        cedula: emisionRequest.Identificacion,
        email: emisionRequest.Email,
        telefono: emisionRequest.Celular || emisionRequest.Telefono,
        sexo: emisionRequest.Sexo,
        fechaNacimiento: emisionRequest.FechaNacimiento,
      },
      vehiculo: {
        marca: emisionRequest.Marca,
        modelo: emisionRequest.Modelo,
        ano: emisionRequest.Ano,
        placa: emisionRequest.Placa,
        motor: emisionRequest.Motor,
        vin: emisionRequest.Vin,
        color: emisionRequest.Color,
      },
    });
  } catch (error: any) {
    console.error(`[API FEDPA Emisión] ${requestId} Error no controlado:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error emitiendo póliza', requestId },
      { status: 500 }
    );
  }
}
