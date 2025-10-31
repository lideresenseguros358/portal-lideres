/**
 * API Endpoint: Emitir póliza Incendio
 * POST /api/is/incendio/emitir
 * 
 * ⚠️ PREPARADO PARA CONECTAR - Esperando API real de INTERNACIONAL
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirIncendio, crearClienteYPolizaOptiSeguro } from '@/lib/is/optiseguro.service';
import { ISEnvironment } from '@/lib/is/config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      vIdPv, // ID de cotización
      paymentToken,
      // Cliente
      vcodtipodoc,
      vnrodoc,
      vnombre,
      vapellido,
      vtelefono,
      vcorreo,
      // Inmueble
      direccion,
      tipo_construccion,
      anio_construccion,
      suma_asegurada,
      // Seguridad
      tiene_alarma,
      tiene_extintores,
      // Config
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
    
    // Obtener broker_id de oficina
    const { data: oficinaBroker } = await supabase
      .from('brokers')
      .select('p_id')
      .eq('email', 'contacto@lideresenseguros.com')
      .single();
    
    if (!oficinaBroker) {
      return NextResponse.json(
        { success: false, error: 'No se encontró broker oficina' },
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
    const result = await emitirIncendio(
      {
        vIdPv,
        vcodtipodoc: parseInt(vcodtipodoc as string) || 1,
        vnrodoc,
        vnombre,
        vapellido,
        vtelefono,
        vcorreo,
        direccion,
        tipo_construccion: tipo_construccion || 'concreto',
        anio_construccion: parseInt(anio_construccion) || new Date().getFullYear(),
        suma_asegurada: parseFloat(suma_asegurada),
        tiene_alarma: tiene_alarma || false,
        tiene_extintores: tiene_extintores || false,
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
    const clientePolicyResult = await crearClienteYPolizaOptiSeguro({
      insurer_id: insurer.id,
      broker_id: oficinaBroker.p_id,
      nro_poliza: result.nroPoliza,
      cliente_nombre: vnombre,
      cliente_apellido: vapellido,
      cliente_documento: vnrodoc,
      cliente_telefono: vtelefono,
      cliente_correo: vcorreo,
      ramo: 'INCENDIO',
      suma_asegurada: parseFloat(suma_asegurada),
      direccion,
    });
    
    if (!clientePolicyResult.success) {
      console.error('[API IS Incendio Emitir] Error guardando cliente/póliza:', clientePolicyResult.error);
      // No fallar emisión si BD falla
    }
    
    return NextResponse.json({
      success: true,
      nroPoliza: result.nroPoliza,
      pdfUrl: result.pdfUrl,
      clientId: clientePolicyResult.clientId,
      policyId: clientePolicyResult.policyId,
    });
    
  } catch (error: any) {
    console.error('[API IS Incendio Emitir] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
