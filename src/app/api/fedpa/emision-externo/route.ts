/**
 * Endpoint: Emitir Póliza CC via Emisor Externo (2021)
 * POST /api/fedpa/emision-externo
 *
 * Complete flow per manual:
 *   1. POST get_cotizacion  → IdCotizacion, SubRamo, TOTAL_PRIMA_IMPUESTO
 *   2. GET  get_nropoliza   → NroPoliza
 *   3. POST crear_poliza_auto_cc_externos (multipart: "data" JSON + File1/File2/File3)
 *
 * Date formats per manual (page 9):
 *   FechaHora / FechaAprobada → "yyyy-MM-dd HH:mm:ss tt"  e.g. "2020-12-28 19:25:10 PM"
 *   FechaDesde / FechaHasta / FechaNacimiento → "yyyy-MM-dd"  e.g. "2020-12-28"
 *
 * NroPoliza: string from get_nropoliza (NOT null)
 * IdCotizacion: string from get_cotizacion response field COTIZACION
 */

import { NextRequest, NextResponse } from 'next/server';
import { FEDPA_CONFIG, EMISOR_EXTERNO_ENDPOINTS, getFedpaDefaultEnv } from '@/lib/fedpa/config';
import { crearClienteYPolizaFEDPA } from '@/lib/fedpa/emision.service';
import { normalizeText } from '@/lib/fedpa/utils';
import { getFedpaMarcaFromIS, normalizarModeloFedpa } from '@/lib/cotizadores/fedpa-vehicle-mapper';

const FEDPA_API = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';

function getCredentials() {
  return {
    Usuario: process.env.USUARIO_FEDPA || 'SLIDERES',
    Clave: process.env.CLAVE_FEDPA || 'lider836',
  };
}

/**
 * Format current datetime as "yyyy-MM-dd HH:mm:ss tt" for Oracle
 * Example: "2026-03-04 01:30:00 PM"
 */
function formatDateTimeOracle(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  let hh = date.getHours();
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const tt = hh >= 12 ? 'PM' : 'AM';
  if (hh > 12) hh -= 12;
  if (hh === 0) hh = 12;
  return `${yyyy}-${MM}-${dd} ${String(hh).padStart(2, '0')}:${mm}:${ss} ${tt}`;
}

/**
 * Format date as "yyyy-MM-dd" for Oracle date fields
 */
function formatDateOracle(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
}

/**
 * Convert dd/mm/yyyy to yyyy-MM-dd
 */
function convertDDMMYYYY(ddmmyyyy: string): string {
  if (!ddmmyyyy) return '';
  // Already yyyy-MM-dd?
  if (/^\d{4}-\d{2}-\d{2}$/.test(ddmmyyyy)) return ddmmyyyy;
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  if (!dd || !mm || !yyyy) return ddmmyyyy;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  const requestId = `emiext-${Date.now().toString(36)}`;
  const creds = getCredentials();
  const steps: any[] = [];

  try {
    // Parse multipart form data (files + JSON fields)
    const formData = await request.formData();

    const jsonStr = formData.get('emisionData') as string;
    if (!jsonStr) {
      return NextResponse.json(
        { success: false, error: 'Missing emisionData field', requestId },
        { status: 400 }
      );
    }
    const body = JSON.parse(jsonStr);

    // Extract files
    const file1 = formData.get('File1') as File | null;
    const file2 = formData.get('File2') as File | null;
    const file3 = formData.get('File3') as File | null;

    // Determine environment: DEV uses get_nropoliza (test), PROD uses get_nropoliza_emitir (real)
    const defaultEnv = getFedpaDefaultEnv();
    const environment = (body.environment || defaultEnv).toUpperCase() === 'DEV' ? 'DEV' : 'PROD';
    const nroPolizaEndpoint = environment === 'DEV'
      ? '/Polizas/get_nropoliza'
      : '/Polizas/get_nropoliza_emitir';

    console.log(`\n[EMISOR EXTERNO] ${requestId} ═══ START (env=${environment}) ═══`);
    console.log(`[EMISOR EXTERNO] Files: File1=${file1?.name || 'NONE'} (${file1?.size || 0}B), File2=${file2?.name || 'NONE'} (${file2?.size || 0}B), File3=${file3?.name || 'NONE'} (${file3?.size || 0}B)`);

    // ═══════════════════════════════════════════════════
    // STEP 1: get_cotizacion
    // ═══════════════════════════════════════════════════
    console.log(`[EMISOR EXTERNO] ${requestId} PASO 1: get_cotizacion`);

    const cotBody = {
      Ano: parseInt(String(body.Ano)) || new Date().getFullYear(),
      Uso: body.Uso || '10',
      CantidadPasajeros: parseInt(String(body.Pasajero)) || 5,
      SumaAsegurada: String(body.sumaAsegurada || '0'),
      CodLimiteLesiones: String(body.CodLimiteLesiones || '1'),
      CodLimitePropiedad: String(body.CodLimitePropiedad || '7'),
      CodLimiteGastosMedico: String(body.CodLimiteGastosMedico || '16'),
      EndosoIncluido: body.EndosoIncluido || 'S',
      CodPlan: String(body.CodPlan || '411'),
      CodMarca: String(body.Marca || '5'),
      CodModelo: String(body.Modelo || '10'),
      Nombre: normalizeText(body.PrimerNombre),
      Apellido: normalizeText(body.PrimerApellido),
      Cedula: body.Identificacion || '0-0-0',
      Telefono: String(body.Telefono || '00000000').replace(/\D/g, ''),
      Email: body.Email || 'emision@lideresenseguros.com',
      ...creds,
    };

    console.log(`[EMISOR EXTERNO] ${requestId} get_cotizacion body:`, JSON.stringify(cotBody, null, 2));

    const cotRes = await fetch(`${FEDPA_API}/Polizas/get_cotizacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cotBody),
    });

    const cotText = await cotRes.text();
    console.log(`[EMISOR EXTERNO] ${requestId} get_cotizacion status=${cotRes.status} body=${cotText.substring(0, 500)}`);

    if (!cotRes.ok) {
      steps.push({ step: 1, name: 'get_cotizacion', success: false, status: cotRes.status, body: cotText.substring(0, 500) });
      return NextResponse.json({ success: false, error: `get_cotizacion failed: HTTP ${cotRes.status} — ${cotText.substring(0, 300)}`, steps, requestId }, { status: 400 });
    }

    let cotData: any;
    try { cotData = JSON.parse(cotText); } catch { cotData = cotText; }

    // Response is array of coverages; extract IdCotizacion and SubRamo from first item
    const coberturas = Array.isArray(cotData) ? cotData : [];
    if (coberturas.length === 0) {
      steps.push({ step: 1, name: 'get_cotizacion', success: false, data: cotData });
      return NextResponse.json({ success: false, error: 'get_cotizacion returned empty array', steps, requestId }, { status: 400 });
    }

    const firstCob = coberturas[0];
    const idCotizacion = String(firstCob.COTIZACION || firstCob.IdCotizacion || firstCob.IDCOTIZACION || '');
    const subRamo = String(firstCob.SUBRAMO || firstCob.SubRamo || '04');
    const ramo = String(firstCob.RAMO || '04');

    // Calculate total prima from coverages
    const primaReal = coberturas.reduce((sum: number, c: any) => sum + (c.PRIMA_IMPUESTO || c.TOTAL_PRIMA_IMPUESTO || 0), 0);

    steps.push({ step: 1, name: 'get_cotizacion', success: true, idCotizacion, subRamo, ramo, primaReal: Math.round(primaReal * 100) / 100, coberturasCount: coberturas.length });
    console.log(`[EMISOR EXTERNO] ${requestId} ✅ IdCotizacion=${idCotizacion}, SubRamo=${subRamo}, Ramo=${ramo}, Prima=${primaReal}`);

    if (!idCotizacion || idCotizacion === 'undefined') {
      return NextResponse.json({ success: false, error: 'get_cotizacion did not return COTIZACION id', steps, requestId }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════
    // STEP 2: get_nropoliza
    // ═══════════════════════════════════════════════════
    console.log(`[EMISOR EXTERNO] ${requestId} PASO 2: get_nropoliza`);

    const nroBody = {
      ...creds,
      codCotizacion: String(idCotizacion),
    };
    console.log(`[EMISOR EXTERNO] ${requestId} get_nropoliza body:`, JSON.stringify(nroBody));

    const nroRes = await fetch(`${FEDPA_API}${nroPolizaEndpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nroBody),
    });

    const nroText = await nroRes.text();
    console.log(`[EMISOR EXTERNO] ${requestId} get_nropoliza status=${nroRes.status} body=${nroText.substring(0, 300)}`);

    if (!nroRes.ok) {
      steps.push({ step: 2, name: 'get_nropoliza', success: false, status: nroRes.status, body: nroText.substring(0, 300) });
      return NextResponse.json({ success: false, error: `get_nropoliza failed: HTTP ${nroRes.status}`, steps, requestId }, { status: 400 });
    }

    let nroData: any;
    try { nroData = JSON.parse(nroText); } catch { nroData = nroText; }

    // PROD returns: [{"NUMPOL":"04-04-XXXXXXX-0","RAMO":"04","SUBRAMO":"04","POLIZA":XXXXXXX}]
    // DEV  returns: [{"NUMPOL":"XXXXXXX","IDCOTIZACION":null}]
    // crear_poliza_auto_cc_externos needs the numeric POLIZA value, not the formatted NUMPOL
    let nroPoliza: string = '';
    let nroPolizaFormatted: string = '';
    if (Array.isArray(nroData) && nroData.length > 0) {
      const item = nroData[0];
      // Prefer POLIZA (numeric) for emission, NUMPOL (formatted) for carátula
      nroPoliza = String(item.POLIZA || item.NroPoliza || item.NROPOLIZA || item.NRO_POLIZA || item.NUMPOL || '');
      nroPolizaFormatted = String(item.NUMPOL || '');
    } else if (typeof nroData === 'object' && nroData !== null) {
      nroPoliza = String(nroData.POLIZA || nroData.NroPoliza || nroData.NROPOLIZA || nroData.NRO_POLIZA || nroData.NUMPOL || '');
      nroPolizaFormatted = String(nroData.NUMPOL || '');
    } else if (typeof nroData === 'string') {
      nroPoliza = nroData.trim();
    }

    // If formatted is not available, build it from ramo-subRamo-poliza-0
    if (!nroPolizaFormatted && nroPoliza) {
      nroPolizaFormatted = `${ramo.padStart(2, '0')}-${subRamo.padStart(2, '0')}-${nroPoliza}-0`;
    }

    steps.push({ step: 2, name: 'get_nropoliza', success: !!nroPoliza, nroPoliza, nroPolizaFormatted, rawResponse: nroText.substring(0, 200) });
    console.log(`[EMISOR EXTERNO] ${requestId} ✅ NroPoliza=${nroPoliza} | Formatted=${nroPolizaFormatted}`);

    if (!nroPoliza) {
      return NextResponse.json({ success: false, error: 'get_nropoliza did not return a policy number', steps, requestId }, { status: 400 });
    }

    // ═══════════════════════════════════════════════════
    // STEP 3: crear_poliza_auto_cc_externos
    // ═══════════════════════════════════════════════════
    console.log(`[EMISOR EXTERNO] ${requestId} PASO 3: crear_poliza_auto_cc_externos`);

    const now = new Date();
    const fechaHora = formatDateTimeOracle(now);
    const fechaDesde = formatDateOracle(now);
    // Vigencia: 1 año
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const fechaHasta = formatDateOracle(nextYear);

    // Convert FechaNacimiento from dd/mm/yyyy or yyyy-MM-dd to yyyy-MM-dd
    const fechaNacimiento = convertDDMMYYYY(body.FechaNacimiento || '');

    // Monto = prima total with tax, as string with 2 decimals
    const monto = (primaReal || body.PrimaTotal || 0).toFixed(2);

    // Build the "data" JSON per manual page 9
    const emisionData: any = {
      FechaHora: fechaHora,
      Monto: monto,
      Aprobada: 'S',
      NroTransaccion: `P-${Date.now()}`,
      FechaAprobada: fechaHora,
      Ramo: ramo,
      SubRamo: subRamo,
      IdCotizacion: idCotizacion,
      NroPoliza: nroPoliza,
      FechaDesde: fechaDesde,
      FechaHasta: fechaHasta,
      Opcion: 'A',
      Usuario: creds.Usuario,
      Clave: creds.Clave,
      Entidad: [
        {
          Juridico: 'N',
          NombreEmpresa: '',
          PrimerNombre: normalizeText(body.PrimerNombre),
          SegundoNombre: normalizeText(body.SegundoNombre || ''),
          PrimerApellido: normalizeText(body.PrimerApellido),
          SegundoApellido: normalizeText(body.SegundoApellido || ''),
          DocumentoIdentificacion: 'CED',
          Cedula: body.Identificacion || '',
          Ruc: '',
          FechaNacimiento: fechaNacimiento,
          Sexo: body.Sexo || 'M',
          CodPais: '999',
          CodProvincia: '999',
          CodCorregimiento: '999',
          Email: body.Email || '',
          TelefonoOficina: String(body.Telefono || '').replace(/\D/g, ''),
          Celular: String(body.Celular || '').replace(/\D/g, ''),
          Direccion: normalizeText(body.Direccion || 'PANAMA'),
          IdVinculo: '1',
        },
      ],
      Auto: {
        CodMarca: /^\d+$/.test(String(body.Marca)) ? getFedpaMarcaFromIS(parseInt(body.Marca), body.MarcaNombre) : normalizeText(body.Marca),
        CodModelo: /^\d+$/.test(String(body.Modelo)) ? normalizarModeloFedpa(body.ModeloNombre || body.Modelo) : normalizeText(body.Modelo),
        Ano: String(body.Ano || new Date().getFullYear()),
        Placa: normalizeText(body.Placa || ''),
        Chasis: normalizeText(body.Vin || ''),
        Motor: normalizeText(body.Motor || ''),
        Color: normalizeText(body.Color || ''),
      },
    };

    // Build multipart form for crear_poliza_auto_cc_externos
    const emisionForm = new FormData();
    emisionForm.append('data', JSON.stringify(emisionData));

    // Attach files as File1, File2, File3 per manual page 10
    if (file1) emisionForm.append('File1', file1, file1.name);
    if (file2) emisionForm.append('File2', file2, file2.name);
    if (file3) emisionForm.append('File3', file3, file3.name);

    console.log(`[EMISOR EXTERNO] ${requestId} data JSON:`, JSON.stringify(emisionData, null, 2));

    const emisionRes = await fetch(`${FEDPA_API}/Polizas/crear_poliza_auto_cc_externos`, {
      method: 'POST',
      body: emisionForm,
      // Do NOT set Content-Type — let browser set multipart boundary
    });

    const emisionText = await emisionRes.text();
    console.log(`[EMISOR EXTERNO] ${requestId} crear_poliza status=${emisionRes.status} body=${emisionText.substring(0, 500)}`);

    let emisionResult: any;
    try { emisionResult = JSON.parse(emisionText); } catch { emisionResult = emisionText; }

    steps.push({
      step: 3,
      name: 'crear_poliza_auto_cc_externos',
      success: emisionRes.ok,
      status: emisionRes.status,
      response: typeof emisionResult === 'string' ? emisionResult.substring(0, 500) : emisionResult,
    });

    if (!emisionRes.ok) {
      console.error(`[EMISOR EXTERNO] ${requestId} ❌ crear_poliza FAILED: ${emisionText.substring(0, 500)}`);
      return NextResponse.json({
        success: false,
        error: `crear_poliza_auto_cc_externos failed: HTTP ${emisionRes.status} — ${emisionText.substring(0, 500)}`,
        steps,
        requestId,
        dataPayload: emisionData,
      }, { status: 400 });
    }

    console.log(`[EMISOR EXTERNO] ${requestId} ✅ Póliza emitida: ${nroPoliza}`);

    // If the emission response contains NroPoliza, prefer it over our computed value
    // Response format: [{"Mensaje":"","Idpoliza":"7535855","NroPoliza":"04-04-2138033-0","CodCorredor":"836"}]
    if (Array.isArray(emisionResult) && emisionResult[0]?.NroPoliza) {
      nroPolizaFormatted = String(emisionResult[0].NroPoliza);
      console.log(`[EMISOR EXTERNO] ${requestId} Using NroPoliza from emission response: ${nroPolizaFormatted}`);
    }

    // Use nroPolizaFormatted from step 2 (already computed above)
    // For PROD: comes directly from NUMPOL ("04-04-2138033-0")
    // For DEV: built as ramo-subRamo-poliza-0
    console.log(`[EMISOR EXTERNO] ${requestId} Formatted policy number for carátula: ${nroPolizaFormatted}`);

    // Build response compatible with existing frontend
    const resultado = {
      success: true,
      amb: environment,
      cotizacion: idCotizacion,
      poliza: nroPolizaFormatted,
      nroPoliza: nroPolizaFormatted,
      nroPolizaRaw: nroPoliza,
      desde: fechaDesde,
      hasta: fechaHasta,
      vigenciaDesde: fechaDesde,
      vigenciaHasta: fechaHasta,
      primaTotal: primaReal,
      steps,
      requestId,
    };

    // Save client + policy in internal DB (non-blocking)
    try {
      const fakeEmitirReq = {
        Plan: parseInt(String(body.CodPlan || 411)),
        idDoc: '',
        PrimerNombre: body.PrimerNombre,
        PrimerApellido: body.PrimerApellido,
        SegundoNombre: body.SegundoNombre,
        SegundoApellido: body.SegundoApellido,
        Identificacion: body.Identificacion,
        FechaNacimiento: body.FechaNacimiento,
        Sexo: body.Sexo || 'M',
        Direccion: body.Direccion,
        Telefono: body.Telefono,
        Celular: body.Celular,
        Email: body.Email,
        esPEP: body.esPEP || 0,
        sumaAsegurada: body.sumaAsegurada || 0,
        Uso: body.Uso || '10',
        Marca: body.Marca,
        Modelo: body.Modelo,
        Ano: body.Ano,
        Motor: body.Motor,
        Placa: body.Placa,
        Vin: body.Vin,
        Color: body.Color,
        Pasajero: body.Pasajero || 5,
        Puerta: body.Puerta || 4,
        PrimaTotal: primaReal,
      };

      const { clientId, policyId, error: dbError } = await crearClienteYPolizaFEDPA(
        fakeEmitirReq as any,
        { success: true, poliza: nroPolizaFormatted, desde: fechaDesde, hasta: fechaHasta }
      );

      if (dbError) {
        console.warn(`[EMISOR EXTERNO] ${requestId} DB save warning:`, dbError);
      } else {
        (resultado as any).clientId = clientId;
        (resultado as any).policyId = policyId;
      }
    } catch (dbErr: any) {
      console.warn(`[EMISOR EXTERNO] ${requestId} DB save error (non-blocking):`, dbErr.message);
    }

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error(`[EMISOR EXTERNO] ${requestId} Error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error inesperado', steps, requestId },
      { status: 500 }
    );
  }
}
