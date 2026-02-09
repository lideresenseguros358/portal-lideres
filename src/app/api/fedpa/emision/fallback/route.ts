/**
 * Endpoint: Emitir Póliza FEDPA via Emisor Externo (2021)
 * POST /api/fedpa/emision/fallback
 * 
 * Usa crear_poliza_auto_cc_externos que NO requiere Bearer token.
 * Recibe FormData con documentos + datos JSON.
 * Fallback para cuando EmisorPlan (2024) tiene token bloqueado.
 * 
 * REQUISITO CLAVE: IdCotizacion (obtenido en paso de cotización)
 */

import { NextRequest, NextResponse } from 'next/server';
import { FEDPA_CONFIG, type FedpaEnvironment } from '@/lib/fedpa/config';
import { crearClienteYPolizaFEDPA } from '@/lib/fedpa/emision.service';

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

    // VALIDAR IdCotizacion - requerido por Emisor Externo
    if (!emisionData.IdCotizacion) {
      return NextResponse.json(
        { success: false, error: 'Falta IdCotizacion. Se requiere el ID de cotización FEDPA.' },
        { status: 400 }
      );
    }

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

    console.log('[FEDPA Emisión Fallback] Usando Emisor Externo (2021) - sin token...');
    console.log('[FEDPA Emisión Fallback] Datos:', {
      idCotizacion: emisionData.IdCotizacion,
      cliente: `${emisionData.PrimerNombre} ${emisionData.PrimerApellido}`,
      identificacion: emisionData.Identificacion,
      vehiculo: `Marca:${emisionData.Marca} Modelo:${emisionData.Modelo} Año:${emisionData.Ano}`,
      plan: emisionData.Plan,
      prima: emisionData.PrimaTotal,
      archivos: {
        cedula: !!cedulaFile,
        licencia: !!licenciaFile,
        registro: !!registroFile,
      },
    });

    // ============================================
    // PASO 1: Obtener NroPoliza (requerido por API)
    // ============================================
    console.log('[FEDPA Emisión Fallback] Obteniendo NroPoliza...');
    const nroPolizaResponse = await fetch(
      `${EMISOR_EXTERNO_BASE}/Polizas/get_nropoliza`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Usuario: config.usuario, Clave: config.clave }),
      }
    );

    if (!nroPolizaResponse.ok) {
      console.error('[FEDPA Emisión Fallback] Error obteniendo NroPoliza:', nroPolizaResponse.status);
      return NextResponse.json(
        { success: false, error: 'No se pudo obtener número de póliza de FEDPA' },
        { status: 502 }
      );
    }

    const nroPolizaData = await nroPolizaResponse.json();
    const nroPoliza = Array.isArray(nroPolizaData) ? nroPolizaData[0]?.NUMPOL : nroPolizaData?.NUMPOL;
    
    if (!nroPoliza) {
      console.error('[FEDPA Emisión Fallback] NroPoliza vacío:', JSON.stringify(nroPolizaData));
      return NextResponse.json(
        { success: false, error: 'FEDPA no devolvió número de póliza' },
        { status: 502 }
      );
    }
    console.log('[FEDPA Emisión Fallback] NroPoliza obtenido:', nroPoliza);

    // ============================================
    // PASO 2: Determinar tipo de documento
    // DocumentoIdentificacion = tipo (C=Cédula, R=RUC, P=Pasaporte)
    // Cedula = número de cédula, Ruc = número de RUC
    // ============================================
    const identificacion = emisionData.Identificacion || '';
    let tipoDoc = 'C'; // Default: Cédula
    let cedula = identificacion;
    let ruc = '';
    
    if (identificacion.toUpperCase().startsWith('E-') || identificacion.toUpperCase().startsWith('PE-')) {
      tipoDoc = 'C'; // Extranjero con cédula panameña
      cedula = identificacion;
    } else if (identificacion.includes('-DV-') || identificacion.match(/^\d{1,3}-\d+-\d+-DV/)) {
      tipoDoc = 'R'; // RUC
      ruc = identificacion;
      cedula = '';
    } else if (identificacion.match(/^[A-Z]{2}\d+/) || identificacion.length > 12) {
      tipoDoc = 'P'; // Pasaporte
    }

    // Fechas de vigencia
    const today = new Date();
    const dd = today.getDate().toString().padStart(2, '0');
    const mm = (today.getMonth() + 1).toString().padStart(2, '0');
    const yyyy = today.getFullYear();
    const fechaDesde = `${dd}/${mm}/${yyyy}`;
    const fechaHasta = `${dd}/${mm}/${yyyy + 1}`;

    // ============================================
    // PASO 3: CONSTRUIR REQUEST EMISOR EXTERNO (2021)
    // Formato: crear_poliza_auto_cc_externos
    // ============================================
    const externoData: Record<string, any> = {
      // Autenticación (inline, no token)
      Usuario: config.usuario,
      Clave: config.clave,
      
      // IDs requeridos
      IdCotizacion: emisionData.IdCotizacion,
      NroPoliza: nroPoliza,
      
      // Ramo Auto
      Ramo: '04',
      SubRamo: '07',
      
      // Vigencia
      FechaDesde: fechaDesde,
      FechaHasta: fechaHasta,
      
      // Plan/Opción
      Opcion: String(emisionData.Plan),
      
      // Pago
      FechaHora: new Date().toISOString(),
      Monto: String(emisionData.PrimaTotal || 0),
      Aprobada: 'S',
      NroTransaccion: `TXN-${Date.now()}`,
      FechaAprobada: fechaDesde,
      
      // Entidad (asegurado)
      Entidad: [{
        Juridico: 'N',
        NombreCompleto: `${emisionData.PrimerNombre} ${emisionData.SegundoNombre || ''} ${emisionData.PrimerApellido} ${emisionData.SegundoApellido || ''}`.replace(/\s+/g, ' ').trim(),
        PrimerNombre: emisionData.PrimerNombre || '',
        SegundoNombre: emisionData.SegundoNombre || '',
        PrimerApellido: emisionData.PrimerApellido || '',
        SegundoApellido: emisionData.SegundoApellido || '',
        DocumentoIdentificacion: tipoDoc,
        Cedula: cedula,
        Ruc: ruc,
        CodPais: '507',
        CodProvincia: '8',
        CodCorregiemiento: '1',
        Email: emisionData.Email || '',
        TelefonoOficina: String(emisionData.Telefono || ''),
        Celular: String(emisionData.Celular || ''),
        Direccion: emisionData.Direccion || 'Panama',
        IdVinculo: '1',
      }],
      
      // Auto
      Auto: {
        CodMarca: String(emisionData.Marca || ''),
        CodModelo: String(emisionData.Modelo || ''),
        Ano: String(emisionData.Ano || ''),
        Placa: String(emisionData.Placa || ''),
        Chasis: String(emisionData.Vin || ''),
        Motor: String(emisionData.Motor || ''),
        Color: String(emisionData.Color || ''),
      },
    };

    console.log('[FEDPA Emisión Fallback] Payload:', JSON.stringify(externoData, null, 2).substring(0, 1500));

    // Build FormData for Emisor Externo
    const outgoingForm = new FormData();
    outgoingForm.append('data', JSON.stringify(externoData));

    // Append files as file0, file1, file2 (matching fedpa-api.ts pattern)
    // Preserve original filename with extension — FEDPA server needs the extension
    const getFileName = (file: File, fallbackName: string) => {
      const ext = file.name?.split('.').pop() || 'pdf';
      return `${fallbackName}.${ext}`;
    };
    outgoingForm.append('file0', cedulaFile, getFileName(cedulaFile, 'documento_identidad'));
    outgoingForm.append('file1', licenciaFile, getFileName(licenciaFile, 'licencia_conducir'));
    if (registroFile) {
      outgoingForm.append('file2', registroFile, getFileName(registroFile, 'registro_vehicular'));
    }

    console.log('[FEDPA Emisión Fallback] Enviando a Emisor Externo...');

    const response = await fetch(
      `${EMISOR_EXTERNO_BASE}/Polizas/crear_poliza_auto_cc_externos`,
      {
        method: 'POST',
        body: outgoingForm,
      }
    );

    const responseText = await response.text();
    console.log('[FEDPA Emisión Fallback] Response status:', response.status);
    console.log('[FEDPA Emisión Fallback] Response body:', responseText.substring(0, 1000));

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      console.error('[FEDPA Emisión Fallback] Response no es JSON:', responseText.substring(0, 300));
      return NextResponse.json(
        { success: false, error: `Respuesta inesperada de FEDPA: ${responseText.substring(0, 300)}` },
        { status: 502 }
      );
    }

    // Check for API-level errors
    if (data.error || data.Error) {
      const errorMsg = data.error || data.Error || data.Mensaje || 'Error desconocido';
      console.error('[FEDPA Emisión Fallback] Error API:', errorMsg);
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 400 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.Mensaje || data.message || data.error || `Error HTTP ${response.status}` },
        { status: response.status }
      );
    }

    // Usar nroPoliza ya obtenido o el que devuelva la API
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
