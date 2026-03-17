/**
 * API Endpoint: Emisión ANCON (CC + DT)
 * POST /api/ancon/emision
 *
 * Flow: GenerarNoDocumento → EmisionServer
 * (GuardarCliente is handled within EmisionServer for ANCON)
 */

import { NextRequest, NextResponse } from 'next/server';
import { generarNoDocumento, emitirPoliza } from '@/lib/ancon/emission.service';
import { getAnconToken } from '@/lib/ancon/http-client';
import { getAnconCredentials, ANCON_RAMO } from '@/lib/ancon/config';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    const body = await request.json();
    const creds = getAnconCredentials();

    const {
      // Cotización reference
      no_cotizacion,
      opcion, // A, B, or C
      cod_producto,
      nombre_producto,
      suma_asegurada,
      // Cliente
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      apellido_casada,
      tipo_de_cliente,
      cedula,
      pasaporte,
      ruc,
      fecha_nacimiento,
      sexo,
      telefono_residencial,
      telefono_oficina,
      telefono_celular,
      email,
      // Dirección
      direccion,
      direccion_cobros,
      // Vehículo
      cod_marca_agt,
      nombre_marca,
      cod_modelo_agt,
      nombre_modelo,
      uso,
      codigo_color_agt,
      nombre_color_agt,
      no_chasis,
      nombre_conductor,
      apellido_conductor,
      sexo_conductor,
      placa,
      puertas,
      pasajeros,
      cilindros,
      vin,
      no_motor,
      ano,
      // Pago
      cantidad_de_pago,
      fecha_primer_pago,
      descuento,
      // Acreedor
      codigo_acreedor,
      nombre_acreedor,
      // Compliance
      nacionalidad,
      pep,
      ocupacion,
      profesion,
      pais_residencia,
      actividad_economica,
      // Grupo
      cod_grupo,
      nombre_grupo,
      // Juridica
      representante_legal,
      nombre_comercial,
      aviso_operacion,
    } = body;

    // Validations
    if (!no_cotizacion) {
      return NextResponse.json(
        { success: false, error: 'Falta número de cotización' },
        { status: 400 }
      );
    }
    if (!primer_nombre || !primer_apellido) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }

    // 1. Generate policy number
    const currentYear = new Date().getFullYear().toString();
    const docResult = await generarNoDocumento(currentYear);

    if (!docResult.success || !docResult.data?.no_documento) {
      return NextResponse.json(
        { success: false, error: docResult.error || 'Error generando número de póliza' },
        { status: 500 }
      );
    }

    const polizaNumber = docResult.data.no_documento;
    console.log(`[API ANCON Emisión] Policy number: ${polizaNumber}`);

    // 2. Get fresh token
    const token = await getAnconToken();

    // Build vigencia dates
    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    // 3. Emit policy
    const emisionResult = await emitirPoliza({
      poliza: polizaNumber,
      ramo_agt: 'AUTOMOVIL',
      vigencia_inicial: fmtDate(today),
      vigencia_final: fmtDate(nextYear),
      primer_nombre: (primer_nombre || '').toUpperCase(),
      segundo_nombre: (segundo_nombre || '').toUpperCase(),
      primer_apellido: (primer_apellido || '').toUpperCase(),
      segundo_apellido: (segundo_apellido || '').toUpperCase(),
      apellido_casada: (apellido_casada || '').toUpperCase(),
      tipo_de_cliente: tipo_de_cliente || 'N',
      cedula: cedula || '',
      pasaporte: pasaporte || '',
      ruc: ruc || '',
      fecha_nacimiento: fecha_nacimiento || '',
      sexo: sexo || 'M',
      telefono_Residencial: telefono_residencial || '',
      telefono_oficina: telefono_oficina || '',
      telefono_celular: telefono_celular || '',
      email: email || '',
      tipo: 'POLIZA',
      fecha_de_registro: fmtDate(today),
      cantidad_de_pago: String(cantidad_de_pago || '10'),
      codigo_producto_agt: cod_producto || '00312',
      nombre_producto: nombre_producto || 'AUTO COMPLETA',
      Responsable_de_cobro: 'CORREDOR',
      suma_asegurada: String(suma_asegurada || '15000'),
      codigo_acreedor: codigo_acreedor || '',
      nombre_acreedor: nombre_acreedor || '',
      cod_marca_agt: String(cod_marca_agt || ''),
      nombre_marca: (nombre_marca || '').toUpperCase(),
      cod_modelo_agt: String(cod_modelo_agt || ''),
      nombre_modelo: (nombre_modelo || '').toUpperCase(),
      uso: uso || 'PARTICULAR',
      codigo_color_agt: codigo_color_agt || '001',
      nombre_color_agt: nombre_color_agt || 'NO DEFINIDO',
      no_chasis: (no_chasis || '').toUpperCase(),
      nombre_conductor: (nombre_conductor || primer_nombre || '').toUpperCase(),
      apellido_conductor: (apellido_conductor || primer_apellido || '').toUpperCase(),
      sexo_conductor: sexo_conductor || sexo || 'M',
      placa: (placa || '').toUpperCase(),
      puertas: String(puertas || '4'),
      pasajeros: String(pasajeros || '5'),
      cilindros: String(cilindros || '4'),
      vin: (vin || no_chasis || '').toUpperCase(),
      no_motor: (no_motor || '').toUpperCase(),
      ano: String(ano || currentYear),
      direccion: direccion || 'PANAMA',
      observacion: '',
      agencia: '',
      direccion_cobros: direccion_cobros || direccion || 'PANAMA',
      descuento: String(descuento || '0'),
      fecha_primer_pago: fecha_primer_pago || fmtDate(today),
      cod_agente: creds.codAgente,
      opcion: opcion || 'A',
      no_cotizacion: no_cotizacion,
      cod_grupo: cod_grupo || '00001',
      nombre_grupo: nombre_grupo || 'SIN GRUPO',
      token,
      nacionalidad: nacionalidad || '',
      pep: pep || '0',
      ocupacion: ocupacion || '',
      profesion: profesion || '',
      pais_residencia: pais_residencia || '',
      actividad_economica: actividad_economica || '',
      representante_legal: representante_legal || '',
      nombre_comercial: nombre_comercial || '',
      aviso_operacion: aviso_operacion || '',
    });

    const elapsed = Date.now() - t0;

    if (!emisionResult.success) {
      console.error(`[API ANCON Emisión] FAILED in ${elapsed}ms:`, emisionResult.error);
      return NextResponse.json(
        { success: false, error: emisionResult.error || 'Error emitiendo póliza', poliza: polizaNumber },
        { status: 500 }
      );
    }

    console.log(`[API ANCON Emisión] SUCCESS in ${elapsed}ms. Poliza: ${polizaNumber}`);

    return NextResponse.json({
      success: true,
      poliza: polizaNumber,
      nroPoliza: polizaNumber,
      noCotizacion: no_cotizacion,
      insurer: 'ANCON',
      _timing: { totalMs: elapsed },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[API ANCON Emisión] Error:', msg);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
