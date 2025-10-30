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
    
    // Emitir póliza
    const result = await emitirPolizaAuto(
      {
        vIdPv,
        vcodtipodoc: vcodtipodoc || 'CED',
        vnrodoc,
        vnombre,
        vapellido,
        vtelefono,
        vcorreo,
        vcodmarca,
        vcodmodelo,
        vanioauto: parseInt(vanioauto),
        vsumaaseg: parseFloat(vsumaaseg) || 0,
        vcodplancobertura,
        vcodgrupotarifa,
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
    
    return NextResponse.json({
      success: true,
      nroPoliza: result.nroPoliza,
      pdfUrl: result.pdfUrl,
      clientId: clientePolicyResult.clientId,
      policyId: clientePolicyResult.policyId,
    });
    
  } catch (error: any) {
    console.error('[API IS Auto Emitir] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
