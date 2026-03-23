/**
 * Test Route: FEDPA CC Emission via Emisor Externo (2021)
 * GET /api/test/fedpa-emission-externo?cuotas=1|2&wait=N
 *
 * Flow: get_cotizacion → get_nropoliza → crear_poliza_auto_cc_externos
 * No EmisorPlan token needed — Emisor Externo uses Usuario/Clave directly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireCronSecret } from '@/lib/security/api-guard';

const FEDPA_API = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';
const USUARIO = process.env.USUARIO_FEDPA || '';
const CLAVE = process.env.CLAVE_FEDPA || '';

// Minimal valid JPEG (1x1 pixel)
function createTestJpeg(filename: string): File {
  const base64 =
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS' +
    'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ' +
    'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy' +
    'MjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEA' +
    'AAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh' +
    'MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6' +
    'Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZ' +
    'mqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx' +
    '8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREA' +
    'AgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV' +
    'YnLRChYkNOEl8RcYI4Q/RFhHRUYnJCk0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNk' +
    'ZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6SlpqeoqaqysLGys7S1' +
    'tre4ubqCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/aAAwD' +
    'AQACEQMRAD8A/9k=';
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new File([bytes], filename, { type: 'image/jpeg' });
}

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

function formatDateOracle(date: Date): string {
  const yyyy = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
}

export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  const cuotas = parseInt(request.nextUrl.searchParams.get('cuotas') || '1');
  const dryRun = request.nextUrl.searchParams.get('dry') === '1';
  const results: any = { timestamp: new Date().toISOString(), cuotas, steps: [] };

  try {
    // ══════════════════════════════════════════════
    // STEP 1: get_cotizacion (CC plan 411)
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST EXT] STEP 1: get_cotizacion (CC plan 411)');
    console.log('══════════════════════════════════════════════');

    const cotBody = {
      Ano: new Date().getFullYear(),
      Uso: '10',
      CantidadPasajeros: 5,
      SumaAsegurada: '15000',
      CodLimiteLesiones: '1',
      CodLimitePropiedad: '7',
      CodLimiteGastosMedico: '16',
      EndosoIncluido: 'S',
      CodPlan: '411',
      CodMarca: 'TOY',
      CodModelo: 'COROLLA',
      Nombre: 'PRUEBA',
      Apellido: 'EXTERNO',
      Cedula: '8-888-9999',
      Telefono: '67891234',
      Email: 'test@lideresenseguros.com',
      Usuario: USUARIO,
      Clave: CLAVE,
    };

    console.log('[TEST EXT] cotBody:', JSON.stringify(cotBody, null, 2));

    const cotRes = await fetch(`${FEDPA_API}/Polizas/get_cotizacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cotBody),
    });

    const cotText = await cotRes.text();
    console.log(`[TEST EXT] get_cotizacion status=${cotRes.status} length=${cotText.length}`);

    if (!cotRes.ok) {
      results.steps.push({ step: 1, name: 'get_cotizacion', success: false, status: cotRes.status, body: cotText.substring(0, 500) });
      results.error = `get_cotizacion HTTP ${cotRes.status}`;
      return NextResponse.json(results, { status: 400 });
    }

    let cotData: any;
    try { cotData = JSON.parse(cotText); } catch { cotData = cotText; }

    const coberturas = Array.isArray(cotData) ? cotData : [];
    if (coberturas.length === 0) {
      results.steps.push({ step: 1, name: 'get_cotizacion', success: false, data: cotData });
      results.error = 'get_cotizacion returned empty';
      return NextResponse.json(results, { status: 400 });
    }

    const first = coberturas[0];
    const idCotizacion = String(first.COTIZACION || first.IdCotizacion || '');
    const subRamo = String(first.SUBRAMO || '04');
    const ramo = String(first.RAMO || '04');
    const primaReal = coberturas.reduce((s: number, c: any) => s + (c.PRIMA_IMPUESTO || 0), 0);

    results.steps.push({ step: 1, name: 'get_cotizacion', success: true, idCotizacion, subRamo, ramo, primaReal: Math.round(primaReal * 100) / 100, coberturasCount: coberturas.length });
    console.log(`[TEST EXT] ✅ IdCotizacion=${idCotizacion}, SubRamo=${subRamo}, Prima=${primaReal}`);

    // Show all coverages
    coberturas.forEach((c: any) => {
      console.log(`  ${c.COBERTURA} — ${c.DESCCOBERTURA} | Prima=${c.PRIMA} | Con imp=${c.PRIMA_IMPUESTO} | Opcion=${c.OPCION}`);
    });

    // ══════════════════════════════════════════════
    // STEP 2: get_nropoliza
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST EXT] STEP 2: get_nropoliza');
    console.log('══════════════════════════════════════════════');

    const nroBody = { Usuario: USUARIO, Clave: CLAVE, codCotizacion: idCotizacion };
    console.log('[TEST EXT] get_nropoliza body:', JSON.stringify(nroBody));

    const nroRes = await fetch(`${FEDPA_API}/Polizas/get_nropoliza`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nroBody),
    });

    const nroText = await nroRes.text();
    console.log(`[TEST EXT] get_nropoliza status=${nroRes.status} body=${nroText}`);

    if (!nroRes.ok) {
      results.steps.push({ step: 2, name: 'get_nropoliza', success: false, status: nroRes.status, body: nroText });
      results.error = `get_nropoliza HTTP ${nroRes.status}`;
      return NextResponse.json(results, { status: 400 });
    }

    let nroData: any;
    try { nroData = JSON.parse(nroText); } catch { nroData = nroText; }

    let nroPoliza = '';
    if (Array.isArray(nroData) && nroData.length > 0) {
      nroPoliza = String(nroData[0].NroPoliza || nroData[0].NROPOLIZA || nroData[0].NUMPOL || '');
    } else if (typeof nroData === 'object' && nroData !== null) {
      nroPoliza = String(nroData.NroPoliza || nroData.NROPOLIZA || nroData.NUMPOL || '');
    }

    results.steps.push({ step: 2, name: 'get_nropoliza', success: !!nroPoliza, nroPoliza, raw: nroText.substring(0, 200) });
    console.log(`[TEST EXT] ✅ NroPoliza=${nroPoliza}`);

    if (!nroPoliza) {
      results.error = 'get_nropoliza returned empty';
      return NextResponse.json(results, { status: 400 });
    }

    // ══════════════════════════════════════════════
    // STEP 3: crear_poliza_auto_cc_externos
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST EXT] STEP 3: crear_poliza_auto_cc_externos');
    console.log('══════════════════════════════════════════════');

    const now = new Date();
    const fechaHora = formatDateTimeOracle(now);
    const fechaDesde = formatDateOracle(now);
    const nextYear = new Date(now);
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    const fechaHasta = formatDateOracle(nextYear);

    const dataPayload: any = {
      FechaHora: fechaHora,
      Monto: primaReal.toFixed(2),
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
      Usuario: USUARIO,
      Clave: CLAVE,
      Entidad: [
        {
          Juridico: 'N',
          NombreEmpresa: '',
          PrimerNombre: 'MARIA',
          SegundoNombre: '',
          PrimerApellido: 'PRUEBA',
          SegundoApellido: 'TEST',
          DocumentoIdentificacion: 'CED',
          Cedula: '8-888-9999',
          Ruc: '',
          FechaNacimiento: '1985-08-22',
          Sexo: 'F',
          CodPais: '999',
          CodProvincia: '999',
          CodCorregimiento: '999',
          Email: 'test@lideresenseguros.com',
          TelefonoOficina: '12412412',
          Celular: '69457821',
          Direccion: 'PANAMA',
          IdVinculo: '1',
        },
      ],
      Auto: {
        CodMarca: 'TOY',
        CodModelo: 'COROLLA',
        Ano: String(new Date().getFullYear()),
        Placa: 'CD5678',
        Chasis: 'JTDBR32E160654321',
        Motor: 'TEST987654321',
        Color: 'GRIS',
      },
    };

    console.log('[TEST EXT] data JSON:', JSON.stringify(dataPayload, null, 2));

    if (dryRun) {
      results.steps.push({ step: 3, name: 'crear_poliza (DRY RUN)', success: true, dataPayload });
      results.dryRun = true;
      results.success = true;
      results.message = 'Dry run — payload built but not sent';
      return NextResponse.json(results);
    }

    const formData = new FormData();
    formData.append('data', JSON.stringify(dataPayload));
    formData.append('File1', createTestJpeg('documento_identidad.jpg'));
    formData.append('File2', createTestJpeg('licencia_conducir.jpg'));
    formData.append('File3', createTestJpeg('registro_vehicular.jpg'));

    const emisionRes = await fetch(`${FEDPA_API}/Polizas/crear_poliza_auto_cc_externos`, {
      method: 'POST',
      body: formData,
    });

    const emisionText = await emisionRes.text();
    console.log(`[TEST EXT] crear_poliza status=${emisionRes.status} body=${emisionText.substring(0, 500)}`);

    let emisionData: any;
    try { emisionData = JSON.parse(emisionText); } catch { emisionData = emisionText; }

    results.steps.push({
      step: 3,
      name: 'crear_poliza_auto_cc_externos',
      success: emisionRes.ok,
      status: emisionRes.status,
      response: typeof emisionData === 'string' ? emisionData.substring(0, 500) : emisionData,
      dataPayloadSent: dataPayload,
    });

    if (emisionRes.ok) {
      console.log(`[TEST EXT] ✅ PÓLIZA EMITIDA: ${nroPoliza}`);
      results.success = true;
      results.poliza = nroPoliza;
      results.vigencia = { desde: fechaDesde, hasta: fechaHasta };
      results.prima = primaReal;
    } else {
      console.error(`[TEST EXT] ❌ EMISIÓN FALLÓ: ${emisionText.substring(0, 500)}`);
      results.success = false;
      results.error = `crear_poliza HTTP ${emisionRes.status}: ${emisionText.substring(0, 300)}`;
    }

    // ══════════════════════════════════════════════
    // SUMMARY
    // ══════════════════════════════════════════════
    console.log('\n══════════════════════════════════════════════');
    console.log('[TEST EXT] RESUMEN');
    console.log(`  IdCotizacion: ${idCotizacion}`);
    console.log(`  NroPoliza: ${nroPoliza}`);
    console.log(`  Prima: ${primaReal}`);
    console.log(`  Emisión: ${results.success ? '✅ OK' : '❌ FALLÓ'}`);
    console.log('══════════════════════════════════════════════\n');

    return NextResponse.json(results, { status: results.success ? 200 : 400 });

  } catch (error: any) {
    console.error('[TEST EXT] Error:', error);
    results.error = error.message || 'Error no controlado';
    return NextResponse.json(results, { status: 500 });
  }
}
