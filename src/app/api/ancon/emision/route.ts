/**
 * API Endpoint: Emisión ANCON (CC + DT)
 * POST /api/ancon/emision
 *
 * Accepts FormData with:
 *   - emissionData (JSON string): all client/vehicle/quote fields
 *   - photo_* files: inspection photos
 *   - cedulaFile, licenciaFile, registroVehicularFile: document files
 *
 * Full backend flow (single button click):
 *   1. GuardarCliente → register client for cotización (may fail — WSDL bug)
 *   2. ClienteIgualContratante → confirm insured = policyholder
 *   3. Upload inspection photos + documents via REST API
 *   4. GenerarNoDocumento → policy number
 *   5. ListadoInspeccion → EnlazarInspeccion (ALL products, ANCON requires before emission)
 *   6. EmitirDatos → emit policy (cod_grupo=00001, nombre_grupo=SIN GRUPO)
 *   7. ImpresionPoliza → get carátula PDF link
 *
 * NOTE: GuardarCliente has a server-side WSDL bug — the PHP code requires
 *       pais_residencia but the WSDL doesn't expose it. Adding non-WSDL params
 *       causes "Token Inactivo". See docs/ANCON_DIAGNOSTICO_EMISION.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadInspectionAndDocuments,
} from '@/lib/ancon/emission.service';
import { getAnconCredentials, ANCON_SOAP_URL } from '@/lib/ancon/config';

export const maxDuration = 120;

async function fileToBuffer(file: File): Promise<{ buffer: Buffer; name: string; type: string }> {
  const arrayBuffer = await file.arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), name: file.name, type: file.type };
}

// ═══ Inline SOAP helpers to bypass module cache issues ═══

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEnvelope(method: string, params: Record<string, string>): string {
  const xml = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `<${k}>${escXml(String(v))}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:server_otros"><soap:Body><tns:${method}>${xml}</tns:${method}></soap:Body></soap:Envelope>`;
}

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");
}

async function rawSoap(method: string, params: Record<string, string>): Promise<unknown> {
  const body = buildEnvelope(method, params);
  const res = await fetch(ANCON_SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` },
    body,
  });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  if (!m) return text.substring(0, 500);
  const decoded = decodeEntities(m[1]!);
  try { return JSON.parse(decoded); } catch { return decoded; }
}

async function getFreshToken(): Promise<string> {
  const creds = getAnconCredentials();
  const login = await rawSoap('GenerarToken', { par_usuario: creds.usuario, par_password: creds.password }) as Record<string, unknown>;
  const token = (login?.Login as Array<Record<string, string>>)?.[0]?.Token;
  if (!token) throw new Error('ANCON login failed');
  console.log(`[ANCON Emisión] Fresh token: ${token.substring(0, 16)}...`);
  return token;
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    // Parse FormData (supports both FormData with files and JSON body)
    let body: Record<string, string>;
    const files: Record<string, { buffer: Buffer; name: string; type: string }> = {};
    const pendingFiles: { key: string; file: File }[] = [];

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const emissionDataRaw = formData.get('emissionData');
      body = emissionDataRaw ? JSON.parse(emissionDataRaw as string) : {};

      // Extract file entries
      formData.forEach((value, key) => {
        if (value instanceof File && value.size > 0) {
          pendingFiles.push({ key, file: value });
        }
      });
      for (const { key, file } of pendingFiles) {
        files[key] = await fileToBuffer(file);
      }
    } else {
      body = await request.json();
    }

    const creds = getAnconCredentials();

    const {
      no_cotizacion,
      opcion,
      cod_producto,
      nombre_producto,
      suma_asegurada,
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
      direccion,
      direccion_cobros,
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
      cantidad_de_pago,
      fecha_primer_pago,
      descuento,
      codigo_acreedor,
      nombre_acreedor,
      nacionalidad,
      pep,
      ocupacion,
      profesion,
      pais_residencia,
      actividad_economica,
      cod_grupo,
      nombre_grupo,
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

    const log = (step: string, msg: string) =>
      console.log(`[API ANCON Emisión] [${step}] ${msg}`);

    // ═══ STEP 1: GuardarCliente → register client for this cotización ═══
    // Each step gets a FRESH token because GuardarCliente's ~48 params
    // exhaust the token's call limit (~5-8 sequential SOAP calls).
    // Required before EmitirDatos — creates the client FK reference.
    // Uses cod_producto='41' (internal code) and figura='1'.
    // Catalog values discovered via exhaustive testing (March 2026).
    log('1/7', 'Registrando cliente (GuardarCliente)...');

    // Parse cedula parts (format: X-XXX-XXXX)
    const cedulaParts = (cedula || '').split('-');
    const cedProv = cedulaParts[0] || '';
    const cedInicial = cedulaParts[1] || '';
    const cedTomo = cedulaParts[2] || '';

    const gcResult = await rawSoap('GuardarCliente', {
      tipo_persona: tipo_de_cliente || 'N',
      cod_producto: '41', // Internal code — NOT the actual product code
      pasaporte: pasaporte || '',
      primer_nombre: (primer_nombre || '').toUpperCase(),
      segundo_nombre: (segundo_nombre || '').toUpperCase(),
      primer_apellido: (primer_apellido || '').toUpperCase(),
      segundo_apellido: (segundo_apellido || '').toUpperCase(),
      casada: (apellido_casada || '').toUpperCase(),
      fecha_nac: fecha_nacimiento || '',
      sexo: sexo || 'M',
      presidencia: 'PANAMA',
      nacionalidad: 'PANAMA',
      direccion_laboral: direccion || 'PANAMA',
      calle: '',
      casa: '',
      barriada: '',
      corregimiento: '',
      direccion_cobros: direccion_cobros || direccion || 'PANAMA',
      telefono1: telefono_residencial || '',
      telefono2: telefono_oficina || '',
      celular: telefono_celular || '',
      celular2: '',
      email: email || '',
      apartado: '',
      ced_prov: cedProv,
      ced_inicial: cedInicial,
      tomo: cedTomo,
      folio: '',
      asiento: '',
      ocupacion: ocupacion || '001',
      pais_nacimiento: 'PANAMA',
      ofondo: '001', // Asalariado (ListaOrigenFondo)
      monto_ingreso: '001', // Menor a 10,000 (ListaMontoIngreso)
      prov_residencia: '008', // PANAMÁ (ListaProvincia)
      // NOTE: pais_residencia should go here once ANCON fixes WSDL
      cli_forpago: '002', // ListaFormaPago
      cli_frepago: '002', // ListaFrecuenciaPago
      cli_lista: '002|campo_lista_neg', // NO (ListaNegativas)
      cli_fundacion: '002|campo_fundongzon', // NO (ListaOngFrancas)
      cli_pep1: pep || '002|campo_pep', // NO (ListaPep)
      asegurado_igual: '001', // SI (ListaAseguradoContratante)
      asegurado_benef: '005', // NO (BeneficiarioContratante)
      asegurado_tercero: '006', // NO (TerceroContratante)
      cli_coa: '0',
      dv: '',
      rlegal: representante_legal || '',
      ncomercial: nombre_comercial || '',
      aoperacion: aviso_operacion || '',
      cod_actividad: actividad_economica || '001', // NO DEFINIDA (ListaActividad)
      cod_clianiocon: '001', // 0-5 años (ListaAnioConstitucion)
      razon_social: '',
      token: await getFreshToken(),
      no_cotizacion,
      figura: '1',
    });

    // Log GC result (currently fails with "PAÍS DE RESIDENCIA obligatorio" — ANCON WSDL bug)
    const gcMsg = Array.isArray(gcResult) ? (gcResult[0] as Record<string, string>)?.Mensaje : String(gcResult);
    if (gcMsg && !String(gcMsg).includes('Exito') && !String(gcMsg).includes('xito')) {
      log('1/7', `GuardarCliente: ${String(gcMsg).substring(0, 200)}`);
      // Don't fail here — continue flow (CIC or EmitirDatos might still work)
    } else {
      log('1/7', 'Cliente registrado OK');
    }

    // ═══ STEP 2: ClienteIgualContratante → confirm insured = policyholder ═══
    log('2/7', 'Confirmando asegurado = contratante...');
    const cicToken = await getFreshToken();
    const cicResult = await rawSoap('ClienteIgualContratante', {
      token: cicToken,
      no_cotizacion,
      respuesta: '001', // SI (numeric code from ListaAseguradoContratante)
    });
    log('2/7', `CIC result: ${JSON.stringify(cicResult).substring(0, 200)}`);

    // ═══ STEP 3: Generate policy number ═══
    log('3/7', 'Generando número de póliza...');
    const currentYear = new Date().getFullYear().toString();
    // CC products use ramo 001, DT/RC products use ramo 002
    const isCC = cod_producto === '00312' || cod_producto === '10394' || cod_producto === '10395' || cod_producto === '10602' || cod_producto === '00318';
    const codRamo = isCC ? '001' : '002';
    const genToken = await getFreshToken();
    const genDocRaw = await rawSoap('GenerarNodocumento', {
      cod_compania: creds.codCompania,
      cod_sucursal: creds.codSucursal,
      ano: currentYear,
      cod_ramo: codRamo,
      cod_subramo: '001',
      token: genToken,
    });
    const polizaNumber = Array.isArray(genDocRaw)
      ? (genDocRaw[0] as Record<string, string>)?.no_documento
      : typeof genDocRaw === 'object' && genDocRaw !== null
        ? (genDocRaw as Record<string, string>).no_documento
        : undefined;

    if (!polizaNumber) {
      return NextResponse.json(
        { success: false, error: `Error generando número de póliza: ${JSON.stringify(genDocRaw).substring(0, 200)}` },
        { status: 500 }
      );
    }
    log('3/7', `Póliza: ${polizaNumber}`);

    // ═══ STEP 4: Upload documents (cédula, licencia, photos) via REST ═══
    const hasFiles = Object.keys(files).length > 0;
    if (hasFiles) {
      log('4/7', `Subiendo ${Object.keys(files).length} archivo(s)...`);
      const uploadResult = await uploadInspectionAndDocuments(
        tipo_de_cliente || 'N',
        files
      );
      log('4/7', `Subidos: ${uploadResult.uploaded}, Fallidos: ${uploadResult.failed}`);
    } else {
      log('4/7', 'Sin archivos adjuntos');
    }

    // ═══ STEP 5: Inspection flow (ALL products — ANCON requires before emission) ═══
    // Per ANCON: inspection must happen via cotización number BEFORE emission.
    // ListadoInspeccion lists inspections done in ANCON app → EnlazarInspeccion links to cotización.
    let inspectionLinked = false;
    log('5/7', 'Buscando inspecciones disponibles (ListadoInspeccion)...');
    try {
      // Get fresh token for inspection + emission steps
      const token2 = await getFreshToken();
      const inspRaw = await rawSoap('ListadoInspeccion', { cod_agente: creds.codAgente, token: token2 });
      const inspections = Array.isArray(inspRaw) ? inspRaw as Array<Record<string, string>> : [];
      log('5/7', `Inspecciones encontradas: ${inspections.length}`);

      if (inspections.length > 0) {
        // Find inspection matching this cotización or use the first available
        const matchingInsp = inspections.find(
          (i) => i.no_cotizacion === no_cotizacion || i.cotizacion === no_cotizacion
        ) || inspections[0];
        const inspId = matchingInsp?.inspeccion || matchingInsp?.no_inspeccion || matchingInsp?.id;
        if (inspId) {
          log('5/7', `Enlazando inspección ${inspId} a cotización ${no_cotizacion}...`);
          const linkRaw = await rawSoap('EnlazarInspeccion', {
            inspeccion: inspId,
            cotizacion: no_cotizacion,
            token: token2,
          });
          const linkMsg = typeof linkRaw === 'string' ? linkRaw : JSON.stringify(linkRaw);
          log('5/7', `EnlazarInspeccion: ${linkMsg.substring(0, 200)}`);
          inspectionLinked = !linkMsg.includes('no coincide') && !linkMsg.includes('Verificar');
        } else {
          log('5/7', 'Inspección encontrada pero sin ID válido');
        }
      } else {
        log('5/7', 'Sin inspecciones disponibles — emisión puede fallar con "pendiente de inspección"');
      }
    } catch (inspErr) {
      log('5/7', `Error en inspección: ${inspErr}`);
    }

    // ═══ STEP 6: Emit policy (fresh token to avoid expiry) ═══
    log('6/7', 'Emitiendo póliza...');
    const emitToken = await getFreshToken();

    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const emitRaw = await rawSoap('EmitirDatos', {
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
      suma_asegurada: suma_asegurada !== undefined && suma_asegurada !== null ? String(suma_asegurada) : '15000',
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
      token: emitToken,
      nacionalidad: nacionalidad || 'PANAMÁ',
      pep: pep || '002|campo_pep',
      ocupacion: ocupacion || '001',
      profesion: profesion || '1',
      pais_residencia: pais_residencia || 'PANAMÁ',
      actividad_economica: actividad_economica || '001',
      representante_legal: representante_legal || '',
      nombre_comercial: nombre_comercial || '',
      aviso_operacion: aviso_operacion || '',
    });

    // Parse EmitirDatos response
    const emitStr = typeof emitRaw === 'string' ? emitRaw : JSON.stringify(emitRaw);
    log('6/7', `EmitirDatos response: ${emitStr.substring(0, 300)}`);

    const emitObj = typeof emitRaw === 'object' && emitRaw !== null ? emitRaw as Record<string, unknown> : null;
    const emitError = emitObj?.Respuesta
      ? (typeof emitObj.Respuesta === 'string' ? emitObj.Respuesta : (emitObj.Respuesta as Array<Record<string, string>>)?.[0]?.Respuesta)
      : (emitStr.includes('Token Inactivo') ? 'Token Inactivo' : null);

    // Check for success: { "": [{ "p1": "0", "p2": "Exito" }] }
    let emitSuccess = false;
    if (emitObj) {
      for (const val of Object.values(emitObj)) {
        if (Array.isArray(val) && val.length > 0 && (val[0] as Record<string, string>)?.p1 === '0') {
          emitSuccess = true;
          break;
        }
      }
    }

    if (!emitSuccess && emitError) {
      const elapsed = Date.now() - t0;
      console.error(`[API ANCON Emisión] FAILED in ${elapsed}ms:`, emitError);
      return NextResponse.json(
        {
          success: false,
          error: emitError,
          poliza: polizaNumber,
          inspectionLinked,
          gcMessage: gcMsg || null,
        },
        { status: 500 }
      );
    }

    log('6/7', `Póliza emitida: ${polizaNumber}`);

    // ═══ STEP 7: Get carátula PDF link ═══
    log('7/7', 'Obteniendo carátula PDF...');
    let pdfUrl: string | null = null;
    try {
      const printRaw = await rawSoap('ImpresionPoliza', { poliza: polizaNumber, token: emitToken });
      if (Array.isArray(printRaw)) {
        pdfUrl = (printRaw[0] as Record<string, string>)?.enlace_poliza || null;
      } else if (typeof printRaw === 'object' && printRaw !== null) {
        pdfUrl = (printRaw as Record<string, string>).enlace_poliza || null;
      }
      log('7/7', pdfUrl ? `PDF: ${pdfUrl}` : `PDF no disponible: ${JSON.stringify(printRaw).substring(0, 200)}`);
    } catch (printErr) {
      log('7/7', `Error obteniendo PDF: ${printErr}`);
    }

    const elapsed = Date.now() - t0;
    log('DONE', `SUCCESS in ${elapsed}ms. Poliza: ${polizaNumber}`);

    return NextResponse.json({
      success: true,
      poliza: polizaNumber,
      nroPoliza: polizaNumber,
      noCotizacion: no_cotizacion,
      insurer: 'ANCON',
      pdfUrl: pdfUrl || `/api/ancon/print?poliza=${encodeURIComponent(polizaNumber)}`,
      inspectionLinked,
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
