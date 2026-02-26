/**
 * API Endpoint: Emitir póliza Auto
 * POST /api/is/auto/emitir
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaAuto, crearClienteYPolizaIS } from '@/lib/is/quotes.service';
import { ISEnvironment } from '@/lib/is/config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { findAcreedor } from '@/lib/constants/acreedores';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      vIdPv,
      paymentToken,
      tipo_cobertura,
      // Datos del cliente
      vcodtipodoc,
      vnrodoc,
      vnombre,
      vapellido1,
      vapellido2,
      vtelefono,
      vcelular,
      vcorreo,
      vfecnacimiento,
      vsexo,
      vdireccion,
      vestadocivil,
      // Dirección estructurada IS
      vcodprovincia,
      vcoddistrito,
      vcodcorregimiento,
      vcodurbanizacion,
      vcasaapto,
      // Datos del vehículo
      vcodmarca,
      vmarca_label,
      vcodmodelo,
      vmodelo_label,
      vanioauto,
      vsumaaseg,
      vcodplancobertura,
      vcodgrupotarifa,
      vplaca,
      vmotor,
      vchasis,
      vcolor,
      vcantpasajeros,
      vcantpuertas,
      vtipotransmision,
      // Pago
      formaPago,
      cantCuotas,
      // Opción de deducible (1=bajo, 2=medio, 3=alto)
      opcion,
      // Acreedor (banco)
      vacreedor,
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
    
    // Resolver acreedor: buscar código IS de la institución seleccionada
    let codTipoConducto = 0;
    let codConducto = 0;
    if (vacreedor && vacreedor.trim() !== '') {
      const acreedor = findAcreedor(vacreedor);
      if (acreedor) {
        codTipoConducto = acreedor.codTipoConductoIS;
        codConducto = acreedor.codConductoIS;
        console.log('[API IS Auto Emitir] Acreedor:', acreedor.label, '→ tipo:', codTipoConducto, 'cod:', codConducto);
      }
    }
    
    // Emitir póliza — estructura anidada para getemision
    const result = await emitirPolizaAuto(
      {
        vIdPv,
        codTipoDoc: parseInt(vcodtipodoc as string) || 1,
        nroDoc: vnrodoc,
        nombre: vnombre,
        apellido1: vapellido1,
        apellido2: vapellido2 || '',
        telefono: vtelefono,
        celular: vcelular || vtelefono,
        correo: vcorreo,
        fechaNacimiento: vfecnacimiento,
        sexo: vsexo,
        direccion: vdireccion,
        estadoCivil: vestadocivil,
        codProvincia: parseInt(vcodprovincia) || undefined,
        codDistrito: parseInt(vcoddistrito) || undefined,
        codCorregimiento: parseInt(vcodcorregimiento) || undefined,
        codUrbanizacion: parseInt(vcodurbanizacion) || 0,
        casaApto: vcasaapto || '',
        codMarca: parseInt(vcodmarca as string),
        codModelo: parseInt(vcodmodelo as string),
        anioAuto: String(vanioauto),
        sumaAseg: String(vsumaaseg || '0'),
        codPlanCobertura: parseInt(vcodplancobertura as string),
        codPlanCoberturaAdic: 0,
        codGrupoTarifa: parseInt(vcodgrupotarifa as string),
        placa: vplaca,
        motor: vmotor,
        chasis: vchasis,
        color: vcolor,
        tipoTransmision: vtipotransmision,
        cantPasajeros: parseInt(vcantpasajeros as string) || 5,
        cantPuertas: parseInt(vcantpuertas as string) || 4,
        paymentToken,
        formaPago: parseInt(formaPago as string) || 1,
        cantCuotas: parseInt(cantCuotas as string) || 1,
        opcion: parseInt(opcion as string) || 1,
        codTipoConducto,
        codConducto,
      },
      environment as ISEnvironment
    );
    
    if (!result.success || !result.nroPoliza) {
      console.error('[API IS Auto Emitir] Emission failed:', JSON.stringify(result));
      return NextResponse.json(
        { success: false, error: result.error || 'Error al emitir poliza', details: result },
        { status: 500 }
      );
    }
    
    // Crear cliente y póliza en BD
    const clientePolicyResult = await crearClienteYPolizaIS({
      insurer_id: insurer.id,
      broker_id: oficinaBroker.p_id,
      nro_poliza: result.nroPoliza,
      cliente_nombre: vnombre,
      cliente_apellido: `${vapellido1} ${vapellido2 || ''}`.trim(),
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
      pdfBase64: result.pdfBase64,
      clientId: clientePolicyResult.clientId,
      policyId: clientePolicyResult.policyId,
      ramo: 'AUTO',
      // Datos del cliente para visualización
      cliente: {
        nombre: `${vnombre} ${vapellido1} ${vapellido2 || ''}`.trim(),
        cedula: vnrodoc,
        email: vcorreo,
        telefono: vtelefono,
      },
      // Datos del vehículo
      vehiculo: {
        marca: vmarca_label || 'N/A',
        modelo: vmodelo_label || 'N/A',
        ano: parseInt(vanioauto),
        placa: vplaca || 'Por asignar',
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
