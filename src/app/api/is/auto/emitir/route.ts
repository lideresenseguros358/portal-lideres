/**
 * API Endpoint: Emitir póliza Auto
 * POST /api/is/auto/emitir
 * 
 * Si la cotización ya fue convertida en póliza (idPv stale),
 * regenera automáticamente una nueva cotización y reintenta la emisión.
 */

import { NextRequest, NextResponse } from 'next/server';
import { emitirPolizaAuto, generarCotizacionAuto, crearClienteYPolizaIS } from '@/lib/is/quotes.service';
import { ISEnvironment, getISDefaultEnv } from '@/lib/is/config';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer } from '@/lib/supabase/server';
import { findAcreedor } from '@/lib/constants/acreedores';
import { formatISPolicyNumber } from '@/lib/utils/policy-number';

export const maxDuration = 120; // Vercel: permitir hasta 2 min (regenerar + emitir)

// Cache insurer/broker IDs (these don't change between requests)
let cachedInsurerId: string | null = null;
let cachedBrokerId: string | null = null;

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
      // Descuento buena experiencia (porcentaje)
      pjeBexp,
      // Acreedor (banco)
      vacreedor,
      // Endoso texto para condiciones especiales (imprime en caratula IS)
      vendosoTexto,
      // Plan adicional IS (código de getplanesadicionales): 0 si no aplica
      vcodplancoberturadadic,
      dry_run,
      environment = getISDefaultEnv(),
      masterBrokerId,
    } = body;
    
    const supabase = getSupabaseAdmin();
    
    // Obtener insurer_id de INTERNACIONAL (cached after first call)
    if (!cachedInsurerId) {
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
      cachedInsurerId = insurer.id;
    }
    
    // Obtener broker_id de portal (cached after first call)
    if (!cachedBrokerId) {
      const { data: oficinaBroker } = await supabase
        .from('brokers')
        .select('p_id')
        .eq('email', 'portal@lideresenseguros.com')
        .single();
      if (!oficinaBroker) {
        return NextResponse.json(
          { success: false, error: 'No se encontró broker portal (portal@lideresenseguros.com)' },
          { status: 500 }
        );
      }
      cachedBrokerId = oficinaBroker.p_id;
    }

    // ═══ Master broker override verification ═══
    let effectiveBrokerId = cachedBrokerId;
    if (masterBrokerId) {
      try {
        const supabaseServer = await getSupabaseServer();
        const { data: { user } } = await supabaseServer.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (profile?.role === 'master') {
            effectiveBrokerId = masterBrokerId;
            console.log('[API IS Auto Emitir] Master broker override:', masterBrokerId);
          }
        }
      } catch (err) {
        console.warn('[API IS Auto Emitir] Master verification failed:', err);
      }
    }

    if (!vIdPv) {
      return NextResponse.json(
        { success: false, error: 'Falta ID de cotización (vIdPv)' },
        { status: 400 }
      );
    }
    
    // Resolver acreedor: solo aplica para Cobertura Completa (CC), NUNCA para Daños a Terceros (DT)
    const esCC = tipo_cobertura && (
      tipo_cobertura.toLowerCase().includes('completa') || 
      tipo_cobertura.toLowerCase().includes('cc') ||
      tipo_cobertura === 'Cobertura Completa'
    );
    let codTipoConducto = 0;
    let codConducto = 0;
    let txtBenef = '';
    if (esCC && vacreedor && vacreedor.trim() !== '') {
      const acreedor = findAcreedor(vacreedor);
      if (acreedor) {
        codTipoConducto = acreedor.codTipoConductoIS;
        codConducto = acreedor.codConductoIS;
        txtBenef = acreedor.label.toUpperCase();
        console.log('[API IS Auto Emitir] ✅ Acreedor resuelto (CC):', acreedor.label, '→ codTipoConducto:', codTipoConducto, 'codConducto:', codConducto, 'txtBenef:', txtBenef);
      } else {
        console.warn('[API IS Auto Emitir] ⚠️ Acreedor no encontrado en catálogo para valor:', JSON.stringify(vacreedor));
      }
    } else if (!esCC && vacreedor && vacreedor.trim() !== '') {
      console.log('[API IS Auto Emitir] ⚠️ Acreedor ignorado para DT (Daños a Terceros no permite acreedor):', vacreedor);
    } else {
      console.log('[API IS Auto Emitir] Sin acreedor');
    }
    
    // Construir parámetros de emisión (reutilizados si hay que regenerar cotización)
    const buildEmissionParams = (idPv: string) => ({
      vIdPv: idPv,
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
      codPlanCoberturaAdic: parseInt(vcodplancoberturadadic as string) || 0,
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
      pjeBexp: parseFloat(pjeBexp) || 0,
      codTipoConducto,
      codConducto,
      txtBenef,
      endosoTexto: vendosoTexto || '',
    });
    
    // Intento 1: Emitir con el idPv original (o dry-run para verificar body)
    let result = await emitirPolizaAuto(buildEmissionParams(vIdPv), environment as ISEnvironment, { dryRun: !!dry_run });
    
    // DRY RUN: Retornar body construido sin emitir
    if (dry_run && result.dryRunBody) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        message: 'Body construido correctamente — NO se envió a IS',
        emission_body: result.dryRunBody,
        acreedor_info: { codTipoConducto, codConducto, txtBenef, esCC: !!esCC },
      });
    }
    
    // Si la cotización ya fue convertida en póliza, regenerar automáticamente
    const isStaleQuote = !result.success && result.error && (
      result.error.includes('ya fue emitida') || 
      result.error.includes('nueva cotización') ||
      result.error.includes('convertida en póliza') ||
      result.error.includes('convertida en poliza')
    );
    
    if (isStaleQuote) {
      console.log('[API IS Auto Emitir] Cotización stale, regenerando automáticamente...');
      
      // Separar nombre en nombre + apellido para generarCotizacion
      const apellidoForQuote = `${vapellido1} ${vapellido2 || ''}`.trim();
      
      const regenResult = await generarCotizacionAuto(
        {
          codTipoDoc: parseInt(vcodtipodoc as string) || 1,
          nroDoc: vnrodoc,
          nroNit: vnrodoc,
          nombre: vnombre,
          apellido: apellidoForQuote,
          telefono: vtelefono,
          correo: vcorreo,
          codMarca: parseInt(vcodmarca as string),
          codModelo: parseInt(vcodmodelo as string),
          anioAuto: String(vanioauto),
          sumaAseg: String(vsumaaseg || '0'),
          codPlanCobertura: parseInt(vcodplancobertura as string),
          codPlanCoberturaAdic: parseInt(vcodplancoberturadadic as string) || 0,
          codGrupoTarifa: parseInt(vcodgrupotarifa as string),
          fecNacimiento: vfecnacimiento || '01/01/1990',
          codProvincia: parseInt(vcodprovincia) || 8,
        },
        environment as ISEnvironment
      );
      
      if (!regenResult.success || !regenResult.idCotizacion) {
        console.error('[API IS Auto Emitir] Regeneración de cotización falló:', regenResult.error);
        return NextResponse.json(
          { success: false, error: 'Cotización expirada y no se pudo regenerar: ' + (regenResult.error || 'Error desconocido') },
          { status: 500 }
        );
      }
      
      console.log(`[API IS Auto Emitir] ✅ Nueva cotización: ${regenResult.idCotizacion} (anterior: ${vIdPv})`);
      
      // Intento 2: Emitir con el nuevo idPv
      result = await emitirPolizaAuto(buildEmissionParams(String(regenResult.idCotizacion)), environment as ISEnvironment);
    }
    
    if (!result.success || !result.nroPoliza) {
      console.error('[API IS Auto Emitir] Emission failed:', JSON.stringify(result));
      return NextResponse.json(
        { success: false, error: result.error || 'Error al emitir poliza', details: result },
        { status: 500 }
      );
    }

    // ═══ Prefix IS policy number with full code 1-30-{nro} ═══
    result.nroPoliza = formatISPolicyNumber(result.nroPoliza);
    
    // Crear cliente y póliza en BD
    const clientePolicyResult = await crearClienteYPolizaIS({
      insurer_id: cachedInsurerId!,
      broker_id: effectiveBrokerId!,
      nro_poliza: result.nroPoliza,
      cliente_nombre: vnombre,
      cliente_apellido: `${vapellido1} ${vapellido2 || ''}`.trim(),
      cliente_documento: vnrodoc,
      cliente_telefono: vtelefono,
      cliente_celular: vcelular || vtelefono,
      cliente_correo: vcorreo,
      cliente_fecha_nacimiento: vfecnacimiento || '',
      tipo_cobertura: tipo_cobertura || 'Daños a terceros',
      marca: vmarca_label,
      modelo: vmodelo_label,
      anio_auto: parseInt(vanioauto),
      placa: vplaca || '',
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
