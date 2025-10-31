/**
 * Endpoint: Emitir Póliza FEDPA
 * POST /api/fedpa/emision
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPoliza, crearClienteYPolizaFEDPA } from '@/lib/fedpa/emision.service';
import type { EmitirPolizaRequest } from '@/lib/fedpa/types';
import type { FedpaEnvironment } from '@/lib/fedpa/config';

export async function POST(request: NextRequest) {
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
        { success: false, error: `Campos requeridos faltantes: ${missing.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Validar formato fecha (dd/mm/yyyy)
    const fechaRegex = /^\d{2}\/\d{2}\/\d{4}$/;
    if (!fechaRegex.test(emisionData.FechaNacimiento)) {
      return NextResponse.json(
        { success: false, error: 'FechaNacimiento debe estar en formato dd/mm/yyyy' },
        { status: 400 }
      );
    }
    
    // Validar sexo
    if (!['M', 'F'].includes(emisionData.Sexo)) {
      return NextResponse.json(
        { success: false, error: 'Sexo debe ser M o F' },
        { status: 400 }
      );
    }
    
    // Validar PEP
    if (![0, 1].includes(emisionData.esPEP)) {
      return NextResponse.json(
        { success: false, error: 'esPEP debe ser 0 o 1' },
        { status: 400 }
      );
    }
    
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
      
      // Vehículo
      sumaAsegurada: emisionData.sumaAsegurada || 0,
      Uso: emisionData.Uso,
      Marca: emisionData.Marca,
      Modelo: emisionData.Modelo,
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
    
    // Emitir con FEDPA
    const result = await emitirPoliza(emisionRequest, env);
    
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }
    
    // Crear cliente y póliza en sistema interno
    const { clientId, policyId, error: dbError } = await crearClienteYPolizaFEDPA(emisionRequest, result);
    
    if (dbError) {
      console.warn('[API FEDPA Emisión] No se pudo guardar en BD:', dbError);
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
      message: `Póliza ${result.poliza} emitida exitosamente`,
    });
  } catch (error: any) {
    console.error('[API FEDPA Emisión] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error emitiendo póliza' },
      { status: 500 }
    );
  }
}
