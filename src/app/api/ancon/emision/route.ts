/**
 * API Endpoint: Emisión ANCON (DT + CC)
 * POST /api/ancon/emision
 *
 * Accepts FormData with:
 *   - emissionData (JSON string): all client/vehicle/quote fields
 *   - cedulaFile, licenciaFile, registroVehicularFile: document files
 *
 * Backend flow (confirmed by ANCON 2026-03-24):
 *   1. GenerarNoDocumento → policy number
 *   2. Upload documents via REST API (cédula, licencia, registro)
 *   3. EmitirDatos → EmisionServer handles client creation internally (no GuardarCliente needed)
 *   4. ImpresionPoliza → carátula PDF link
 *
 * NOTE: GuardarCliente is NOT called. ANCON confirmed EmitirDatos/EmisionServer
 *       handles client creation internally.
 * NOTE: Inspection (ListadoInspeccion/EnlazarInspeccion) is CC-only. DT does NOT require inspection.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  uploadInspectionAndDocuments,
  getRequiredDocuments,
} from '@/lib/ancon/emission.service';
import { generateAnconSolicitudPdf } from '@/lib/ancon/solicitud-pdf';
import { generateAuthorizationPdf } from '@/lib/authorization-pdf';
import { getAnconCredentials, ANCON_SOAP_URL } from '@/lib/ancon/config';
import { getAnconToken } from '@/lib/ancon/http-client';
import { crearClienteYPoliza, parseDdMmYyyy } from '@/lib/supabase/create-client-policy';
import { resolveAnconVehicleCodes, getAcreedores } from '@/lib/ancon/catalogs.service';
import { cotizarEstandar } from '@/lib/ancon/quotes.service';
import { getSupabaseServer } from '@/lib/supabase/server';

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

  // Log full XML request for EmitirDatos so ANCON support can diagnose issues
  if (method === 'EmitirDatos') {
    const CHUNK = 1000;
    console.log(`[SOAP EmitirDatos] REQUEST XML (${body.length} chars total):`);
    for (let i = 0; i < body.length; i += CHUNK) {
      console.log(`[SOAP EmitirDatos] XML[${i}]: ${body.substring(i, i + CHUNK)}`);
    }
  }

  const res = await fetch(ANCON_SOAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `urn:server_otros#${method}` },
    body,
  });
  const text = await res.text();
  const m = text.match(/<data[^>]*>([\s\S]*?)<\/data>/) || text.match(/<return[^>]*>([\s\S]*?)<\/return>/);
  if (!m) {
    // Log full SOAP response when we can't parse it — helps diagnose ANCON server errors
    if (method === 'EmitirDatos') {
      console.error(`[SOAP ${method}] Unparseable response (HTTP ${res.status}, ${text.length} chars): ${text.substring(0, 3000)}`);
    }
    return text.substring(0, 500);
  }
  const decoded = decodeEntities(m[1]!);
  try { return JSON.parse(decoded); } catch { return decoded; }
}


export async function POST(request: NextRequest) {
  const t0 = Date.now();

  try {
    // Parse FormData (supports both FormData with files and JSON body)
    let body: Record<string, string>;
    const files: Record<string, { buffer: Buffer; name: string; type: string }> = {};
    const pendingFiles: { key: string; file: File }[] = [];
    let firmaDataUrl: string | undefined;

    const contentType = request.headers.get('content-type') || '';

    let masterBrokerId: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const emissionDataRaw = formData.get('emissionData');
      body = emissionDataRaw ? JSON.parse(emissionDataRaw as string) : {};

      // Extract firma data URL (base64 PNG)
      const firmaRaw = formData.get('firmaDataUrl');
      if (firmaRaw && typeof firmaRaw === 'string') firmaDataUrl = firmaRaw;

      // ═══ Master broker override verification ═══
      const masterBrokerIdFromForm = formData.get('masterBrokerId');
      if (masterBrokerIdFromForm && typeof masterBrokerIdFromForm === 'string') {
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
              masterBrokerId = masterBrokerIdFromForm;
              console.log('[ANCON Emisión] Master broker override:', masterBrokerId);
            }
          }
        } catch (err) {
          console.warn('[ANCON Emisión] Master verification failed:', err);
        }
      }

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
    // Note: no_cotizacion can be empty for SOBAT plans — backend will re-quote with real vehicle data
    if (!primer_nombre || !primer_apellido) {
      return NextResponse.json(
        { success: false, error: 'Faltan datos del cliente' },
        { status: 400 }
      );
    }

    const log = (step: string, msg: string) =>
      console.log(`[API ANCON Emisión] [${step}] ${msg}`);

    // Normalize pep for EmitirDatos: docs show cod_pep = 0 (no) or 1 (si).
    // GuardarCliente used pipe format ('002|campo_pep') but EmitirDatos uses simple numeric.
    // Map any "no PEP" value → '0', any "si PEP" value → '1'.
    const pepIsYes = pep && pep !== '0' && pep !== 'N' && pep !== 'false' && pep !== '002|campo_pep' && pep !== '002';
    const pepNormalized = pepIsYes ? '1' : '0';

    // Resolve cod_acreedor from nombre_acreedor when not explicitly provided
    let resolvedCodAcreedor = codigo_acreedor || '';
    if (!resolvedCodAcreedor && nombre_acreedor) {
      const acreResult = await getAcreedores();
      if (acreResult.success && acreResult.data) {
        const found = acreResult.data.find(
          a => a.nombre.toUpperCase().trim() === nombre_acreedor.toUpperCase().trim()
        );
        if (found) resolvedCodAcreedor = found.cod_acreedor;
      }
      if (resolvedCodAcreedor) {
        log('0/5', `Acreedor resuelto: ${nombre_acreedor} → cod ${resolvedCodAcreedor}`);
      }
    }

    const currentYear = new Date().getFullYear().toString();

    // ── Resolve correct SOBAT product code from name when old sessions send 07159 ──
    // nombre_producto was always set correctly even when _codProducto defaulted to 07159.
    // Map name → code so old cached sessions still work.
    const sobatNameUpper = (nombre_producto || '').toUpperCase();
    let resolvedCodProducto = cod_producto || '';
    if (sobatNameUpper.includes('SOBAT BASICO') || sobatNameUpper.includes('BASICO TALLER')) {
      resolvedCodProducto = '05769';
    } else if (sobatNameUpper.includes('SOBAT EXPRESS PLUS') || sobatNameUpper.includes('EXPRESS PLUS')) {
      resolvedCodProducto = '01492';
    }
    if (resolvedCodProducto !== cod_producto) {
      log('0/4', `Product code remapped: ${cod_producto} (${nombre_producto}) → ${resolvedCodProducto}`);
    }

    // CC products use ramo 001, SOBAT (SODA) use ramo 020, other DT/RC use ramo 002
    const isCC = resolvedCodProducto === '00312' || resolvedCodProducto === '10394' || resolvedCodProducto === '10395' || resolvedCodProducto === '10602' || resolvedCodProducto === '00318';
    const isSobat = resolvedCodProducto === '05769' || resolvedCodProducto === '01492'; // SODA ramo 020

    // ── Pre-compute PDF/form fields (needed by Phase A Track 3 at start time) ──
    const nombreCompleto = [
      primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, apellido_casada
    ].filter(Boolean).join(' ').toUpperCase();

    let fnDia = '', fnMes = '', fnAnio = '';
    if (fecha_nacimiento) {
      const parts = fecha_nacimiento.includes('/') ? fecha_nacimiento.split('/') : fecha_nacimiento.split('-');
      if (fecha_nacimiento.includes('/')) {
        fnDia = parts[0] || ''; fnMes = parts[1] || ''; fnAnio = parts[2] || '';
      } else {
        fnAnio = parts[0] || ''; fnMes = parts[1] || ''; fnDia = parts[2] || '';
      }
    }

    const nivelIngresoRaw = (body as Record<string, string>).nivel_ingreso || (body as Record<string, string>).nivelIngreso || '';
    const INGRESO_LABEL_MAP: Record<string, string> = {
      '001': 'Menos de $10,000', 'menos_10k': 'Menos de $10,000',
      '002': 'De $10,000 a $30,000', '10k_30k': 'De $10,000 a $30,000',
      '003': 'De $30,000 a $50,000', '30k_50k': 'De $30,000 a $50,000',
      '004': 'Más de $50,000', 'mas_50k': 'Más de $50,000',
    };
    const nivelIngresoLabel = INGRESO_LABEL_MAP[nivelIngresoRaw] || nivelIngresoRaw;
    const valorVehiculo = isCC ? (suma_asegurada || '') : '';
    const fechaEmisionStr = new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // ═══ PARALLEL PHASE A ═══
    // Three independent tracks start simultaneously:
    //   Track 1 (sequential chain): vehicle resolve → re-cotización
    //   Track 2: GenerarNodocumento (needs no cotización)
    //   Track 3: Solicitud PDF generation (needs no polizaNumber)
    //   Track 4: getRequiredDocuments SOAP (pre-warm cache; cached after first call)
    //
    // After Phase A: diligencia PDF (needs polizaNumber, fast ~14KB) → uploads → EmitirDatos

    const codRamo = isCC ? '001' : isSobat ? '020' : '002';
    // Declared here so Track 1 can write resolved codes for later use in EmitirDatos
    let finalCodMarcaAgt = cod_marca_agt || '';
    let finalCodModeloAgt = cod_modelo_agt || '';

    // Normalize fecha for re-quote before launching parallel tasks
    let fechaNacFormatted = fecha_nacimiento || '01/01/1990';
    if (fecha_nacimiento && !fecha_nacimiento.includes('/')) {
      const parts = fecha_nacimiento.split('-');
      if (parts.length === 3) fechaNacFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    const tPhaseA = Date.now();
    log('0-2/4', 'Iniciando resolución, cotización, póliza y PDFs en paralelo...');

    const [freshNoCotizacion, polizaNumber, solicitudBuffer] = await Promise.all([

      // ── Track 1: Vehicle resolve → re-cotización (sequential chain) ──
      (async (): Promise<string> => {
        let codMarca = cod_marca_agt || '';
        let codModelo = cod_modelo_agt || '';
        if (nombre_marca && nombre_modelo) {
          try {
            const resolved = await resolveAnconVehicleCodes(nombre_marca, nombre_modelo);
            if (resolved) {
              codMarca = resolved.codMarca;
              codModelo = resolved.codModelo;
              log('0/4', `Vehicle codes resolved: "${nombre_marca}/${nombre_modelo}" → marca=${codMarca}, modelo=${codModelo} (${resolved.matchMethod})`);
            } else {
              log('0/4', `Vehicle resolution returned null — using empty codes`);
            }
          } catch (err: unknown) {
            log('0/4', `Vehicle resolution error: ${err instanceof Error ? err.message : String(err)} — using empty codes`);
          }
        }
        if (!codMarca) codMarca = '00001';
        if (!codModelo) codModelo = '00001';

        // Store resolved codes for EmitirDatos (track 1 completes first)
        finalCodMarcaAgt = codMarca;
        finalCodModeloAgt = codModelo;

        if (isCC) return no_cotizacion || '';

        log('0/4', 'Re-cotizando con datos reales del vehículo (DT)...');
        try {
          const freshQuote = await cotizarEstandar({
            cod_marca: codMarca,
            cod_modelo: codModelo,
            ano: String(ano || currentYear),
            suma_asegurada: String(suma_asegurada || '0'),
            cod_producto: resolvedCodProducto,
            cedula: cedula || '8-888-9999',
            nombre: (primer_nombre || 'COTIZACION').toUpperCase(),
            apellido: (primer_apellido || 'WEB').toUpperCase(),
            vigencia: 'A',
            email: email || 'cotizacion@lideresenseguros.com',
            tipo_persona: tipo_de_cliente || 'N',
            fecha_nac: fechaNacFormatted,
            nuevo: '0',
          });
          if (freshQuote.success && freshQuote.data?.noCotizacion) {
            log('0/4', `Re-cotización exitosa → noCotizacion=${freshQuote.data.noCotizacion}`);
            return freshQuote.data.noCotizacion;
          }
          log('0/4', `Re-cotización fallida (${freshQuote.error}) — usando noCotizacion original: ${no_cotizacion}`);
          return no_cotizacion || '';
        } catch (err: unknown) {
          log('0/4', `Re-cotización error: ${err instanceof Error ? err.message : String(err)} — usando noCotizacion original`);
          return no_cotizacion || '';
        }
      })(),

      // ── Track 2: GenerarNodocumento (independent of re-cotización) ──
      (async (): Promise<string> => {
        log('1/4', 'Generando número de póliza...');
        const genToken = await getAnconToken();
        const genDocRaw = await rawSoap('GenerarNodocumento', {
          cod_compania: creds.codCompania,
          cod_sucursal: creds.codSucursal,
          ano: currentYear,
          cod_ramo: codRamo,
          cod_subramo: '001',
          token: genToken,
        });
        const poliza = Array.isArray(genDocRaw)
          ? (genDocRaw[0] as Record<string, string>)?.no_documento
          : typeof genDocRaw === 'object' && genDocRaw !== null
            ? (genDocRaw as Record<string, string>).no_documento
            : undefined;
        if (!poliza) throw new Error(`Error generando número de póliza: ${JSON.stringify(genDocRaw).substring(0, 200)}`);
        log('1/4', `Póliza generada: ${poliza}`);
        return poliza;
      })(),

      // ── Track 3: Solicitud PDF (no polizaNumber needed — start immediately) ──
      generateAnconSolicitudPdf({
        nombreCompleto,
        genero: (sexo === 'M' || sexo === 'MASCULINO' || sexo === '1') ? 'M' : 'F',
        fechaNacDia: fnDia || '',
        fechaNacMes: fnMes || '',
        fechaNacAnio: fnAnio || '',
        cedula: cedula || pasaporte || ruc || '',
        paisNacimiento: 'PANAMÁ',
        nacionalidad: nacionalidad || 'PANAMEÑA',
        paisResidencia: pais_residencia || 'PANAMÁ',
        direccionResidencial: direccion || '',
        email: email || '',
        telResidencia: telefono_residencial || '',
        celular: telefono_celular || '',
        estadoCivil: (body as Record<string, string>).estado_civil || '',
        profesion: profesion || '',
        ocupacion: ocupacion || '',
        empresa: (body as Record<string, string>).empresa || '',
        nivelIngreso: nivelIngresoLabel,
        anioVehiculo: ano || '',
        marcaVehiculo: nombre_marca || '',
        modeloVehiculo: nombre_modelo || '',
        placa: placa || '',
        motor: no_motor || '',
        chasis: no_chasis || vin || '',
        valorVehiculo,
        acreedorHipotecario: nombre_acreedor || '',
        firmaDataUrl,
        fechaEmision: fechaEmisionStr,
      }).then(buf => { log('2/4', `Solicitud PDF generada: ${buf.length} bytes`); return buf as Buffer | undefined; })
        .catch((e: unknown) => { log('2/4', `Error solicitud PDF (soft-fail): ${e}`); return undefined as Buffer | undefined; }),

      // ── Track 4: Pre-warm getRequiredDocuments cache (silent — result used by uploadInspectionAndDocuments) ──
      getRequiredDocuments(tipo_de_cliente || 'N').catch(() => undefined),
    ]);

    log('0-2/4', `Phase A completado en ${Date.now() - tPhaseA}ms`);

    // ── Phase B: Debida diligencia PDF (needs polizaNumber — fast, ~14KB) ──
    const diligenciaBuffer = await generateAuthorizationPdf({
      nombreCompleto,
      cedula: cedula || pasaporte || ruc || '',
      email: email || '',
      direccion: direccion || 'Panamá',
      nroPoliza: polizaNumber,
      marca: nombre_marca || '',
      modelo: nombre_modelo || '',
      anio: ano || currentYear,
      placa: placa || '',
      chasis: no_chasis || vin || '',
      motor: no_motor || '',
      color: nombre_color_agt || '',
      firmaDataUrl: firmaDataUrl || '',
      fecha: fechaEmisionStr,
      fechaNacimiento: fecha_nacimiento || '',
      sexo: sexo || '',
      estadoCivil: (body as Record<string, string>).estado_civil || '',
      telefono: telefono_residencial || '',
      celular: telefono_celular || '',
      actividadEconomica: actividad_economica || '',
      nivelIngresos: nivelIngresoRaw,
      dondeTrabaja: (body as Record<string, string>).empresa || '',
      esPEP: pepNormalized === '1',
      tipoCobertura: isCC ? 'CC' : 'DT',
      insurerName: 'ANCÓN Seguros',
      valorAsegurado: suma_asegurada && suma_asegurada !== '0' ? `$${Number(suma_asegurada).toLocaleString('en-US')}` : '',
    }).then(buf => { log('2/4', `Debida Diligencia PDF generada: ${buf.length} bytes`); return buf; })
      .catch((e: unknown) => { log('2/4', `Error generando Debida Diligencia PDF (soft-fail): ${e}`); return undefined; });

    // ── Phase C: Upload all documents in parallel ──
    const hasFiles = Object.keys(files).length > 0 || !!solicitudBuffer;
    if (hasFiles) {
      log('2/4', `Subiendo ${Object.keys(files).length} archivo(s) + solicitud + debida diligencia...`);
      const uploadResult = await uploadInspectionAndDocuments(
        tipo_de_cliente || 'N',
        polizaNumber,
        files,
        solicitudBuffer,
        diligenciaBuffer
      );
      log('2/4', `Subidos: ${uploadResult.uploaded}, Fallidos: ${uploadResult.failed}`);
    } else {
      log('2/4', 'Sin archivos adjuntos — continuando sin documentos');
    }

    // ═══ STEP 3: Emit policy ═══
    // EmitirDatos/EmisionServer handles client creation internally.
    // Inspection is CC-only — not called for DT.
    log('3/4', 'Emitiendo póliza (EmisionServer)...');
    const emitToken = await getAnconToken();

    const today = new Date();
    const nextYear = new Date(today);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const fmtDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const emitRaw = await rawSoap('EmitirDatos', {
      poliza: polizaNumber,
      ramo_agt: isSobat ? 'SODA' : 'AUTOMOVIL',
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
      fecha_nacimiento: (() => {
        // Normalize to DD/MM/YYYY — HTML date inputs send YYYY-MM-DD
        const fn = fecha_nacimiento || '';
        if (fn && !fn.includes('/')) {
          const p = fn.split('-');
          if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
        }
        return fn;
      })(),
      sexo: sexo || 'M',
      telefono_Residencial: telefono_residencial || '',
      telefono_oficina: telefono_oficina || '',
      telefono_celular: telefono_celular || '',
      email: email || '',
      tipo: 'POLIZA',
      fecha_de_registro: fmtDate(today),
      cantidad_de_pago: String(cantidad_de_pago || '10'),
      codigo_producto_agt: resolvedCodProducto || '00312',
      nombre_producto: nombre_producto || 'AUTO COMPLETA',
      Responsable_de_cobro: 'CORREDOR',
      suma_asegurada: suma_asegurada !== undefined && suma_asegurada !== null ? String(suma_asegurada) : '15000',
      codigo_acreedor: resolvedCodAcreedor,
      nombre_acreedor: nombre_acreedor || '',
      cod_marca_agt: String(finalCodMarcaAgt || ''),
      nombre_marca: (nombre_marca || '').toUpperCase(),
      cod_modelo_agt: String(finalCodModeloAgt || ''),
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
      no_cotizacion: freshNoCotizacion || '',
      // Docs example explicitly uses cod_grupo:'00001', nombre_grupo:'SIN GRUPO'.
      // ListadoGrupos returns null for agent 01009 but '00001' is the ANCON default group.
      cod_grupo: cod_grupo || '00001',
      nombre_grupo: nombre_grupo || 'SIN GRUPO',
      token: emitToken,
      nacionalidad: nacionalidad || 'PANAMÁ',
      pep: pepNormalized,
      // ocupacion/profesion/actividad_economica MUST be numeric catalog codes.
      // Guard: reject free-text values and fall back to ANCON defaults.
      ocupacion: /^\d+$/.test(ocupacion || '') ? ocupacion! : '001',
      profesion: /^\d+$/.test(profesion || '') ? profesion! : '1',
      pais_residencia: pais_residencia || 'PANAMÁ',
      actividad_economica: /^\d+$/.test(actividad_economica || '') ? actividad_economica! : '001',
      representante_legal: representante_legal || '',
      nombre_comercial: nombre_comercial || '',
      aviso_operacion: aviso_operacion || '',
    });

    // Parse EmitirDatos response
    const emitStr = typeof emitRaw === 'string' ? emitRaw : JSON.stringify(emitRaw);
    log('3/4', `EmitirDatos response: ${emitStr.substring(0, 300)}`);

    const emitObj = typeof emitRaw === 'object' && emitRaw !== null ? emitRaw as Record<string, unknown> : null;
    const emitError = emitObj?.Respuesta
      ? (typeof emitObj.Respuesta === 'string' ? emitObj.Respuesta : (emitObj.Respuesta as Array<Record<string, string>>)?.[0]?.Respuesta)
      : (emitStr.includes('Token Inactivo') ? 'Token Inactivo' : null);

    // Check for success — two known formats:
    // Format 1 (flat): { "p1": "0", "p2": "Actualización Exitosa", "no_cotizacion": "..." }
    // Format 2 (wrapped): { "": [{ "p1": "0", "p2": "Exito" }] }
    let emitSuccess = false;
    if (emitObj) {
      if ((emitObj as Record<string, string>).p1 === '0') {
        emitSuccess = true;
      } else {
        for (const val of Object.values(emitObj)) {
          if (Array.isArray(val) && val.length > 0 && (val[0] as Record<string, string>)?.p1 === '0') {
            emitSuccess = true;
            break;
          }
        }
      }
    }

    if (!emitSuccess) {
      const elapsed = Date.now() - t0;
      console.error(`[API ANCON Emisión] FAILED in ${elapsed}ms — emitError=${emitError} raw=${emitStr.substring(0, 400)}`);
      return NextResponse.json(
        {
          success: false,
          error: emitError || 'EmitirDatos no devolvió éxito',
          poliza: polizaNumber,
          emitRaw: typeof emitRaw === 'object' ? emitRaw : emitStr.substring(0, 500),
        },
        { status: 500 }
      );
    }

    log('3/4', `Póliza emitida: ${polizaNumber}`);

    // ═══ STEP 4: PDF link ═══
    // ImpresionPoliza is NOT called here — it always returns "Token Inactivo" immediately
    // after EmitirDatos (ANCON timing issue). The /api/ancon/caratula endpoint handles it
    // lazily on first download: fetches ImpresionPoliza with a fresh token, stores the HTML
    // in Supabase, and serves it from storage on all subsequent requests.
    const pdfUrl = `/api/ancon/caratula?poliza=${encodeURIComponent(polizaNumber)}`;

    const elapsed = Date.now() - t0;
    log('DONE', `SUCCESS in ${elapsed}ms. Poliza: ${polizaNumber}`);

    // ── Auto-save client + policy to Supabase ──
    const anconNationalId = cedula || pasaporte || ruc || '';
    const anconClientName = [primer_nombre, segundo_nombre, primer_apellido, segundo_apellido]
      .filter(Boolean).join(' ').trim();

    const dbResult = await crearClienteYPoliza({
      insurerPattern: '%ANCON%',
      national_id: anconNationalId,
      name: anconClientName,
      email: email || undefined,
      phone: telefono_celular || telefono_residencial || undefined,
      birth_date: parseDdMmYyyy(fecha_nacimiento),
      policy_number: polizaNumber,
      ramo: 'AUTO',
      notas: [
        nombre_marca && nombre_modelo ? `Vehículo: ${nombre_marca} ${nombre_modelo} ${ano || ''}` : null,
        placa ? `Placa: ${placa}` : null,
        isCC ? 'Cobertura: Cobertura Completa' : 'Cobertura: Daños a Terceros',
      ].filter(Boolean).join('\n'),
      start_date: new Date().toISOString().split('T')[0],
      renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      overrideBrokerId: masterBrokerId,
    });

    if (dbResult.error) {
      console.warn('[API ANCON Emisión] DB save warning (non-fatal):', dbResult.error);
    }

    return NextResponse.json({
      success: true,
      poliza: polizaNumber,
      nroPoliza: polizaNumber,
      noCotizacion: freshNoCotizacion,
      insurer: 'ANCON',
      clientId: dbResult.clientId,
      policyId: dbResult.policyId,
      pdfUrl: pdfUrl || `/api/ancon/print?poliza=${encodeURIComponent(polizaNumber)}`,
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
