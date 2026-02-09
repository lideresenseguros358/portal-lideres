/**
 * API Endpoint: Emitir póliza Auto
 * POST /api/is/auto/emitir
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaAuto, crearClienteYPolizaIS } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      vIdPv,
      paymentToken,
      tipo_cobertura,
      // Todos los campos del request original
      vcodtipodoc,
      vnrodoc,
      vnombre,
      vapellido,
      vtelefono,
      vcorreo,
      vcodmarca,
      vmarca_label,
      vcodmodelo,
      vmodelo_label,
      vanioauto,
      vsumaaseg,
      vcodplancobertura,
      vcodgrupotarifa,
      environment = 'development',
    } = body;
    
    const supabase = getSupabaseAdmin();
    
    // Obtener insurer_id de INTERNACIONAL
    const { data: insurer } = await supabase
      .from('insurers')
      .select('id')
      .ilike('name', '%internacional%')
      .single();
    
    if (!insurer) {
      return NextResponse.json(
        { success: false, error: 'No se encontró aseguradora Internacional' },
        { status: 500 }
      );
    }
    
    // Obtener broker_id de oficina (master principal: contacto@lideresenseguros.com)
    const { data: oficinaBroker } = await supabase
      .from('brokers')
      .select('p_id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    if (!oficinaBroker) {
      return NextResponse.json(
        { success: false, error: 'No se encontró broker oficina (contacto@lideresenseguros.com)' },
        { status: 500 }
      );
    }
    
    if (!vIdPv) {
      return NextResponse.json(
        { success: false, error: 'Falta ID de cotización (vIdPv)' },
        { status: 400 }
      );
    }
    
    // Emitir póliza — mapear campos viejos a nuevos (Swagger CotizadorRequest)
    const result = await emitirPolizaAuto(
      {
        vIdPv,
        codTipoDoc: parseInt(vcodtipodoc as string) || 1,
        nroDoc: vnrodoc,
        nroNit: vnrodoc,
        nombre: vnombre,
        apellido: vapellido,
        telefono: vtelefono,
        correo: vcorreo,
        codMarca: parseInt(vcodmarca as string),
        codModelo: parseInt(vcodmodelo as string),
        anioAuto: String(vanioauto),
        sumaAseg: String(vsumaaseg || '0'),
        codPlanCobertura: parseInt(vcodplancobertura as string),
        codPlanCoberturaAdic: 0,
        codGrupoTarifa: parseInt(vcodgrupotarifa as string),
        paymentToken,
      },
      environment as ISEnvironment
    );
    
    if (!result.success || !result.nroPoliza) {
      return NextResponse.json(
        { success: false, error: result.error || 'Error al emitir póliza' },
        { status: 500 }
      );
    }
    
    // Crear cliente y póliza en BD
    const clientePolicyResult = await crearClienteYPolizaIS({
      insurer_id: insurer.id,
      broker_id: oficinaBroker.p_id,
      nro_poliza: result.nroPoliza,
      cliente_nombre: vnombre,
      cliente_apellido: vapellido,
      cliente_documento: vnrodoc,
      cliente_telefono: vtelefono,
      cliente_correo: vcorreo,
      tipo_cobertura: tipo_cobertura || 'Daños a terceros',
      marca: vmarca_label,
      modelo: vmodelo_label,
      anio_auto: parseInt(vanioauto),
    });
    
    if (!clientePolicyResult.success) {
      console.error('[API IS Auto Emitir] Error guardando cliente/póliza:', clientePolicyResult.error);
      // No fallar emisión si BD falla, pero logear
    }
    
    // Preparar datos completos para visualización de póliza
    const policyData = {
      success: true,
      insurer: 'INTERNACIONAL',
      nroPoliza: result.nroPoliza,
      poliza: result.nroPoliza, // Alias
      pdfUrl: result.pdfUrl,
      clientId: clientePolicyResult.clientId,
      policyId: clientePolicyResult.policyId,
      ramo: 'AUTO',
      // Datos del cliente para visualización
      cliente: {
        nombre: `${vnombre} ${vapellido}`.trim(),
        cedula: vnrodoc,
        email: vcorreo,
        telefono: vtelefono,
      },
      // Datos del vehículo
      vehiculo: {
        marca: vmarca_label || 'N/A',
        modelo: vmodelo_label || 'N/A',
        ano: parseInt(vanioauto),
        placa: 'Por asignar', // No tenemos placa en el flujo actual
      },
      // Vigencia por defecto (1 año)
      vigencia: {
        desde: new Date().toLocaleDateString('es-PA'),
        hasta: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA'),
      },
    };
    
    return NextResponse.json(policyData);
    
  } catch (error: any) {
    console.error('[API IS Auto Emitir] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
