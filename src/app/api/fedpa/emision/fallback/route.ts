/**
 * Endpoint: Emitir Póliza FEDPA via Emisor Externo (2021)
 * POST /api/fedpa/emision/fallback
 *
 * Flujo completo según manual Emisor Externo 2021:
 *   1. get_cotizacion  → IdCotizacion, SubRamo, prima real
 *   2. get_nropoliza   → NroPoliza
 *   3. crear_poliza_auto_cc_externos → multipart (data JSON + File1/File2/File3)
 *
 * NO requiere Bearer token — usa Usuario/Clave en body/params.
 * Fallback para cuando EmisorPlan (2024) tiene token bloqueado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { FEDPA_CONFIG, type FedpaEnvironment } from '@/lib/fedpa/config';
import { crearClienteYPolizaFEDPA } from '@/lib/fedpa/emision.service';
import { getFedpaMarcaFromIS, normalizarModeloFedpa } from '@/lib/cotizadores/fedpa-vehicle-mapper';

const EMISOR_EXTERNO_BASE = 'https://wscanales.segfedpa.com/EmisorFedpa.Api/api';

export async function POST(request: NextRequest) {
  try {
    const incomingForm = await request.formData();
    const environment = (incomingForm.get('environment') as string) || 'DEV';
    const env = environment as FedpaEnvironment;
    const config = FEDPA_CONFIG[env];

    // Extract JSON emission data
    const emisionDataRaw = incomingForm.get('emisionData') as string;
    if (!emisionDataRaw) {
      return NextResponse.json(
        { success: false, error: 'Falta emisionData en el FormData' },
        { status: 400 }
      );
    }
    const emisionData = JSON.parse(emisionDataRaw);

    // Extract files
    const cedulaFile = incomingForm.get('documento_identidad') as File | null;
    const licenciaFile = incomingForm.get('licencia_conducir') as File | null;
    const registroFile = incomingForm.get('registro_vehicular') as File | null;

    if (!cedulaFile || !licenciaFile) {
      return NextResponse.json(
        { success: false, error: 'Se requieren al menos documento_identidad y licencia_conducir' },
        { status: 400 }
      );
    }

    // ============================================
    // PASO 0: Normalizar marca/modelo a códigos FEDPA alpha
    // El catálogo mostrado es de IS (códigos numéricos).
    // FEDPA requiere códigos alfa (ej: "NIS", "PATHFINDER").
    // ============================================
    const rawMarca = String(emisionData.Marca || '');
    const rawModelo = String(emisionData.Modelo || '');
    const isNumericMarca = /^\d+$/.test(rawMarca);
    const isNumericModelo = /^\d+$/.test(rawModelo);

    const fedpaMarca = isNumericMarca
      ? getFedpaMarcaFromIS(parseInt(rawMarca), emisionData.MarcaNombre || '')
      : rawMarca;
    const fedpaModelo = isNumericModelo
      ? normalizarModeloFedpa(emisionData.ModeloNombre || '')
      : normalizarModeloFedpa(rawModelo);

    console.log('[FEDPA Fallback] Usando Emisor Externo (2021) - sin token...');
    console.log('[FEDPA Fallback] Datos:', {
      cliente: `${emisionData.PrimerNombre} ${emisionData.PrimerApellido}`,
      identificacion: emisionData.Identificacion,
      vehiculo: `Marca:${rawMarca}(${fedpaMarca}) Modelo:${rawModelo}(${fedpaModelo}) Año:${emisionData.Ano}`,
      plan: emisionData.Plan,
      prima: emisionData.PrimaTotal,
      sumaAsegurada: emisionData.sumaAsegurada,
    });

    if (!fedpaMarca || fedpaMarca === 'OTH') {
      return NextResponse.json(
        { success: false, error: 'No se pudo determinar la marca del vehículo para FEDPA. Seleccione marca y modelo nuevamente.', code: 'FEDPA_INVALID_VEHICLE_DATA' },
        { status: 400 }
      );
    }

    // ============================================
    // PASO 1: COTIZAR via Emisor Externo get_cotizacion
    // Usa códigos FEDPA alpha (Manual página 8)
    // ============================================
    console.log('[FEDPA Fallback] PASO 1: Cotizando via Emisor Externo...');
    const cotizBody: Record<string, any> = {
      Ano: parseInt(emisionData.Ano) || new Date().getFullYear(),
      Uso: emisionData.Uso || '10',
      CantidadPasajeros: parseInt(emisionData.Pasajero) || 5,
      SumaAsegurada: String(emisionData.sumaAsegurada || 0),
      CodLimiteLesiones: '1',
      CodLimitePropiedad: '7',
      CodLimiteGastosMedico: '16',
      EndosoIncluido: 'S',
      CodPlan: String(emisionData.Plan || '411'),
      CodMarca: fedpaMarca,
      CodModelo: fedpaModelo,
      Nombre: emisionData.PrimerNombre || '',
      Apellido: emisionData.PrimerApellido || '',
      Cedula: emisionData.Identificacion || '',
      Telefono: String(emisionData.Celular || emisionData.Telefono || ''),
      Email: emisionData.Email || '',
      Usuario: config.usuario,
      Clave: config.clave,
    };

    const cotizResponse = await fetch(
      `${EMISOR_EXTERNO_BASE}/Polizas/get_cotizacion`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cotizBody),
      }
    );

    let idCotizacion = '';
    let subRamo = '07'; // Default DT, will be overridden by cotización response
    let primaReal = emisionData.PrimaTotal || 0;
    let opcion = String(emisionData.Opcion || 'A');

    if (cotizResponse.ok) {
      try {
        const cotizData = await cotizResponse.json();
        console.log('[FEDPA Fallback] get_cotizacion response (first 500):', JSON.stringify(cotizData).substring(0, 500));

        // Response is an array of coverages; all share the same COTIZACION and SUBRAMO
        const firstItem = Array.isArray(cotizData) ? cotizData[0] : cotizData;
        if (firstItem) {
          idCotizacion = String(firstItem.COTIZACION || '');
          subRamo = String(firstItem.SUBRAMO || '07');
          primaReal = firstItem.TOTAL_PRIMA_IMPUESTO || primaReal;
          opcion = String(firstItem.OPCION || opcion || 'A');
          console.log('[FEDPA Fallback] ✅ Cotización OK:', { idCotizacion, subRamo, primaReal, opcion });
        }
      } catch (parseErr) {
        console.warn('[FEDPA Fallback] Error parseando cotización:', parseErr);
      }
    } else {
      const errText = await cotizResponse.text().catch(() => '');
      console.warn('[FEDPA Fallback] get_cotizacion falló (HTTP', cotizResponse.status, '):', errText.substring(0, 300));
      // Continue with whatever IdCotizacion we have from the frontend
      idCotizacion = String(emisionData.IdCotizacion || '');
    }

    if (!idCotizacion) {
      console.warn('[FEDPA Fallback] Sin IdCotizacion — usando valor del frontend:', emisionData.IdCotizacion);
      idCotizacion = String(emisionData.IdCotizacion || '');
    }

    // ============================================
    // PASO 2: Obtener NroPoliza
    // Manual página 7: GET con Usuario/Clave query params.
    // Este ambiente solo acepta POST, así que POST como fallback.
    // ============================================
    if (!idCotizacion) {
      return NextResponse.json(
        { success: false, error: 'No se pudo obtener IdCotizacion de FEDPA. Intente nuevamente.' },
        { status: 400 }
      );
    }

    console.log('[FEDPA Fallback] PASO 2: Obteniendo NroPoliza...');
    let nroPoliza = '';

    // POST (funciona en este ambiente, GET da 405)
    let nroPolizaResponse = await fetch(
      `${EMISOR_EXTERNO_BASE}/Polizas/get_nropoliza`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Usuario: config.usuario, Clave: config.clave }),
      }
    );

    if (nroPolizaResponse.ok) {
      const nroPolizaData = await nroPolizaResponse.json();
      console.log('[FEDPA Fallback] get_nropoliza raw:', JSON.stringify(nroPolizaData).substring(0, 300));
      const firstItem = Array.isArray(nroPolizaData) ? nroPolizaData[0] : nroPolizaData;
      nroPoliza = String(firstItem?.NUMPOL ?? firstItem?.NroPoliza ?? firstItem?.nroPoliza ?? '');
      console.log('[FEDPA Fallback] ✅ NroPoliza:', nroPoliza);
    } else {
      const errText = await nroPolizaResponse.text().catch(() => '');
      console.error('[FEDPA Fallback] get_nropoliza falló (HTTP', nroPolizaResponse.status, '):', errText.substring(0, 200));
      return NextResponse.json(
        { success: false, error: 'No se pudo reservar número de póliza en FEDPA. Intente nuevamente.' },
        { status: 400 }
      );
    }

    if (!nroPoliza) {
      return NextResponse.json(
        { success: false, error: 'FEDPA no devolvió número de póliza. Intente nuevamente.' },
        { status: 400 }
      );
    }

    // ============================================
    // PASO 3: Tipo de documento
    // ============================================

    const identificacion = emisionData.Identificacion || '';
    let tipoDoc = 'CED';
    let cedula = identificacion;
    let ruc = '';

    if (identificacion.includes('-DV-') || identificacion.match(/^\d{1,3}-\d+-\d+-DV/)) {
      tipoDoc = 'RUC';
      ruc = identificacion;
      cedula = '';
    } else if (identificacion.match(/^[A-Z]{2}\d+/) || identificacion.length > 12) {
      tipoDoc = 'PAS';
    }

    // Fechas
    const today = new Date();
    const dd = today.getDate().toString().padStart(2, '0');
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = today.getFullYear();
    const fechaDesde = `${yyyy}-${mm}-${dd}`;
    const fechaHasta = `${yyyy + 1}-${mm}-${dd}`;
    const hours = today.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const fechaHora = `${yyyy}-${mm}-${dd} ${hours.toString().padStart(2,'0')}:${today.getMinutes().toString().padStart(2,'0')}:${today.getSeconds().toString().padStart(2,'0')} ${ampm}`;

    // Convertir FechaNacimiento a YYYY-MM-DD si viene en DD/MM/YYYY
    let fechaNac = emisionData.FechaNacimiento || '';
    if (fechaNac.includes('/')) {
      const parts = fechaNac.split('/');
      if (parts.length === 3 && parts[2].length === 4) {
        fechaNac = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    // ============================================
    // PASO 4: CONSTRUIR PAYLOAD crear_poliza_auto_cc_externos
    // (Manual página 9 — multipart form-data)
    // ============================================
    const externoData: Record<string, any> = {
      FechaHora: fechaHora,
      Monto: String(primaReal),
      Aprobada: 'S',
      NroTransaccion: `P-${Date.now()}`,
      FechaAprobada: fechaHora,
      Ramo: '04',
      SubRamo: subRamo,
      IdCotizacion: idCotizacion,
      NroPoliza: nroPoliza,
      FechaDesde: fechaDesde,
      FechaHasta: fechaHasta,
      Opcion: opcion,
      Usuario: config.usuario,
      Clave: config.clave,
      Entidad: [{
        Juridico: 'N',
        NombreEmpresa: '',
        PrimerNombre: emisionData.PrimerNombre || '',
        SegundoNombre: emisionData.SegundoNombre || '',
        PrimerApellido: emisionData.PrimerApellido || '',
        SegundoApellido: emisionData.SegundoApellido || '',
        DocumentoIdentificacion: tipoDoc,
        Cedula: cedula,
        Ruc: ruc,
        FechaNacimiento: fechaNac,
        Sexo: emisionData.Sexo || 'M',
        CodPais: '999',
        CodProvincia: '999',
        CodCorregimiento: '999',
        Email: emisionData.Email || '',
        TelefonoOficina: String(emisionData.Telefono || ''),
        Celular: String(emisionData.Celular || ''),
        Direccion: emisionData.Direccion || 'PANAMA',
        IdVinculo: '1',
      }],
      Auto: {
        CodMarca: fedpaMarca,
        CodModelo: fedpaModelo,
        Ano: String(emisionData.Ano || ''),
        Placa: String(emisionData.Placa || ''),
        Chasis: String(emisionData.Vin || ''),
        Motor: String(emisionData.Motor || ''),
        Color: String(emisionData.Color || ''),
      },
    };

    console.log('[FEDPA Fallback] PASO 4: Payload crear_poliza:', JSON.stringify(externoData, null, 2).substring(0, 1500));

    // Re-buffer ALL files upfront into ArrayBuffers (streams can only be read once)
    const cedulaBytes = await cedulaFile.arrayBuffer();
    const licenciaBytes = await licenciaFile.arrayBuffer();
    const registroBytes = registroFile ? await registroFile.arrayBuffer() : null;

    // Helper: build a fresh FormData
    // Manual página 10 (Postman): field names are data, File1, File2, File3
    // RestSharp AddParameter("data", string) in multipart = text field without filename
    const dataJsonString = JSON.stringify(externoData);
    console.log('[FEDPA Fallback] data JSON string (first 800):', dataJsonString.substring(0, 800));

    const buildForm = () => {
      const form = new FormData();
      // Send data as a plain text Blob (no filename) to mimic RestSharp AddParameter
      form.append('data', new Blob([dataJsonString], { type: 'text/plain' }));
      form.append('File1', new Blob([cedulaBytes], { type: cedulaFile.type || 'image/jpeg' }), cedulaFile.name || 'documento_identidad.jpg');
      form.append('File2', new Blob([licenciaBytes], { type: licenciaFile.type || 'image/jpeg' }), licenciaFile.name || 'licencia_conducir.jpg');
      if (registroBytes) {
        form.append('File3', new Blob([registroBytes], { type: registroFile!.type || 'application/pdf' }), registroFile!.name || 'registro_vehicular.pdf');
      }
      return form;
    };

    console.log('[FEDPA Fallback] Enviando a crear_poliza_auto_cc_externos...', {
      file1: `${cedulaFile.name} (${cedulaBytes.byteLength}b)`,
      file2: `${licenciaFile.name} (${licenciaBytes.byteLength}b)`,
      file3: registroFile ? `${registroFile.name} (${registroBytes?.byteLength}b)` : 'N/A',
    });

    // ── Enviar con reintento para errores transitorios (disco FEDPA) ──
    let lastResponseText = '';
    let lastStatus = 0;

    const response = await fetch(
      `${EMISOR_EXTERNO_BASE}/Polizas/crear_poliza_auto_cc_externos`,
      { method: 'POST', body: buildForm() }
    );

    lastResponseText = await response.text();
    lastStatus = response.status;
    console.log(`[FEDPA Fallback] crear_poliza - Status: ${response.status}, Body: ${lastResponseText.substring(0, 500)}`);

    // Retry once on transient disk error
    const isDiskError = lastResponseText.includes('dispositivo no est') || lastResponseText.includes('device is not ready');
    if (isDiskError) {
      console.warn('[FEDPA Fallback] Error de disco FEDPA (transient), reintentando en 3s...');
      await new Promise(r => setTimeout(r, 3000));
      const retryResp = await fetch(
        `${EMISOR_EXTERNO_BASE}/Polizas/crear_poliza_auto_cc_externos`,
        { method: 'POST', body: buildForm() }
      );
      lastResponseText = await retryResp.text();
      lastStatus = retryResp.status;
      console.log(`[FEDPA Fallback] crear_poliza retry - Status: ${retryResp.status}, Body: ${lastResponseText.substring(0, 500)}`);
    }

    let data: any;
    try {
      data = JSON.parse(lastResponseText);
    } catch {
      console.error('[FEDPA Fallback] Response no es JSON:', lastResponseText.substring(0, 300));
      return NextResponse.json(
        { success: false, error: `Respuesta inesperada de FEDPA: ${lastResponseText.substring(0, 300)}` },
        { status: 502 }
      );
    }

    if (data.error || data.Error) {
      const errorMsg = data.error || data.Error || data.Mensaje || 'Error desconocido';
      console.error('[FEDPA Fallback] Error API:', errorMsg);
      const isDiskError = errorMsg.includes('dispositivo no est') || errorMsg.includes('device is not ready');
      const isOraPolizaNull = errorMsg.includes('ORA-01400') && errorMsg.toUpperCase().includes('POLIZA');
      const userMsg = isDiskError
        ? 'El servidor de FEDPA tiene un problema temporal con su almacenamiento. Por favor intente en unos minutos o contacte a FEDPA.'
        : isOraPolizaNull
          ? 'FEDPA rechazó la emisión por datos incompletos de vehículo/póliza. Verifica marca, modelo y vuelve a intentar.'
          : errorMsg;
      return NextResponse.json(
        {
          success: false,
          error: userMsg,
          fedpaError: errorMsg,
          code: isDiskError ? 'FEDPA_DISK_ERROR' : isOraPolizaNull ? 'FEDPA_ORA_POLIZA_NULL' : 'FEDPA_API_ERROR',
        },
        { status: 502 }
      );
    }

    if (!lastStatus || lastStatus >= 400) {
      return NextResponse.json(
        { success: false, error: data.Mensaje || data.message || data.error || `Error HTTP ${lastStatus}` },
        { status: lastStatus || 502 }
      );
    }

    const polizaEmitida = data.NroPoliza || data.poliza || data.nroPoliza || data.POLIZA || data.NUMPOL || nroPoliza;
    
    if (!polizaEmitida) {
      console.warn('[FEDPA Emisión Fallback] Respuesta completa:', JSON.stringify(data).substring(0, 500));
      return NextResponse.json(
        { success: false, error: data.Mensaje || data.message || 'No se recibió número de póliza', rawResponse: data },
        { status: 400 }
      );
    }

    console.log('[FEDPA Emisión Fallback] ✅ Póliza emitida:', polizaEmitida);

    // Save to internal DB
    const emisionRequest = {
      Plan: emisionData.Plan,
      idDoc: 'EXTERNO',
      PrimerNombre: emisionData.PrimerNombre,
      PrimerApellido: emisionData.PrimerApellido,
      SegundoNombre: emisionData.SegundoNombre,
      SegundoApellido: emisionData.SegundoApellido,
      Identificacion: emisionData.Identificacion,
      FechaNacimiento: emisionData.FechaNacimiento,
      Sexo: emisionData.Sexo,
      Email: emisionData.Email,
      Telefono: emisionData.Telefono,
      Celular: emisionData.Celular,
      Direccion: emisionData.Direccion,
      esPEP: emisionData.esPEP,
      Acreedor: emisionData.Acreedor,
      sumaAsegurada: emisionData.sumaAsegurada,
      Uso: emisionData.Uso,
      Marca: emisionData.Marca,
      Modelo: emisionData.Modelo,
      Ano: emisionData.Ano,
      Motor: emisionData.Motor,
      Placa: emisionData.Placa,
      Vin: emisionData.Vin,
      Color: emisionData.Color,
      Pasajero: emisionData.Pasajero,
      Puerta: emisionData.Puerta,
      PrimaTotal: emisionData.PrimaTotal,
    };

    const resultado = {
      success: true,
      amb: env,
      poliza: polizaEmitida,
      desde: fechaDesde,
      hasta: fechaHasta,
    };

    const { clientId, policyId, error: dbError } = await crearClienteYPolizaFEDPA(emisionRequest as any, resultado);
    if (dbError) {
      console.warn('[FEDPA Emisión Fallback] No se pudo guardar en BD:', dbError);
    }

    return NextResponse.json({
      success: true,
      amb: env,
      poliza: polizaEmitida,
      nroPoliza: polizaEmitida,
      desde: fechaDesde,
      hasta: fechaHasta,
      vigenciaDesde: fechaDesde,
      vigenciaHasta: fechaHasta,
      clientId,
      policyId,
      method: 'emisor_externo',
      message: `Póliza ${polizaEmitida} emitida exitosamente (Emisor Externo)`,
    });

  } catch (error: any) {
    console.error('[FEDPA Emisión Fallback] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error emitiendo póliza (fallback)' },
      { status: 500 }
    );
  }
}
