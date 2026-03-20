/**
 * POST /api/is/auto/send-expediente
 * Generates IS inspection PDF and sends expediente email
 * with all required documents to IS contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { generateInspectionPdf } from '@/lib/is/inspection-pdf';
import { generateISQuotePdf } from '@/lib/is/quote-pdf';
import { generateAuthorizationPdf } from '@/lib/authorization-pdf';
import { guardarDocumentosExpediente } from '@/lib/storage/expediente-server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 60;

// ZeptoMail REST API for sending emails with attachments
const ZEPTO_API_URL = 'https://api.zeptomail.com/v1.1/email';

async function sendZeptoWithAttachments(opts: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}): Promise<{ ok: boolean; messageId: string }> {
  const apiKey = process.env.ZEPTO_API_KEY || process.env.ZEPTO_SMTP_PASS || '';
  const sender = process.env.ZEPTO_SENDER || 'portal@lideresenseguros.com';
  const senderName = process.env.ZEPTO_SENDER_NAME || 'Líderes en Seguros';

  const toArr = Array.isArray(opts.to) ? opts.to : [opts.to];
  const recipients = toArr.map(addr => ({ email_address: { address: addr, name: addr } }));

  const body: Record<string, any> = {
    from: { address: sender, name: senderName },
    to: recipients,
    subject: opts.subject,
    htmlbody: opts.html,
    textbody: '',
  };

  if (opts.attachments && opts.attachments.length > 0) {
    body.attachments = opts.attachments.map(att => ({
      name: att.filename,
      content: att.content.toString('base64'),
      mime_type: att.contentType,
    }));
  }

  const res = await fetch(ZEPTO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ZeptoMail API error (${res.status}): ${errText.substring(0, 300)}`);
  }

  const data = await res.json();
  const messageId = data?.data?.[0]?.message_id || data?.request_id || 'unknown';
  return { ok: true, messageId };
}

// Expediente recipients
const OFFICE_EMAIL = 'contacto@lideresenseguros.com';
// Dev: everything goes to office for testing
const IS_RECIPIENTS_DEV = [OFFICE_EMAIL];
// Prod: IS contacts + office always gets a copy
const IS_LIVE_RECIPIENTS = true;
const IS_RECIPIENTS_PROD = IS_LIVE_RECIPIENTS
  ? [OFFICE_EMAIL, 'mprestan@iseguros.com', 'slopez@iseguros.com']
  : [OFFICE_EMAIL];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Parse JSON data fields
    const clientDataStr = formData.get('clientData') as string;
    const vehicleDataStr = formData.get('vehicleData') as string;
    const inspectionDataStr = formData.get('inspectionData') as string;
    const quoteDataStr = formData.get('quoteData') as string;
    const tipoCobertura = formData.get('tipoCobertura') as string; // 'CC' or 'DT'
    const environment = formData.get('environment') as string || 'development';
    const firmaDataUrl = formData.get('firmaDataUrl') as string || '';
    const nroPoliza = formData.get('nroPoliza') as string || '';
    const insurerName = formData.get('insurerName') as string || 'Internacional de Seguros';
    const clientId = formData.get('clientId') as string || '';
    const policyId = formData.get('policyId') as string || '';
    const codCotizacion = formData.get('codCotizacion') as string || '';
    // Use server-side env to determine prod vs dev (client always sends 'development')
    const serverEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
    const isProduction = serverEnv === 'production';
    const isDev = !isProduction;
    
    if (!clientDataStr || !vehicleDataStr) {
      return NextResponse.json({ error: 'Faltan datos del cliente o vehículo' }, { status: 400 });
    }
    
    const clientData = JSON.parse(clientDataStr);
    const vehicleData = JSON.parse(vehicleDataStr);
    const inspectionData = inspectionDataStr ? JSON.parse(inspectionDataStr) : {};
    const quoteData = quoteDataStr ? JSON.parse(quoteDataStr) : {};
    
    const isCC = tipoCobertura === 'CC';
    const isIS = (insurerName || '').toUpperCase().includes('INTERNACIONAL');
    const isRecipients = isProduction ? IS_RECIPIENTS_PROD : IS_RECIPIENTS_DEV;
    
    console.log(`[IS EXPEDIENTE] Tipo: ${tipoCobertura}, Aseguradora: ${insurerName}, IS: ${isIS}, ServerEnv: ${serverEnv}, ClientEnv: ${environment}, IsProduction: ${isProduction}`);
    
    // Collect file attachments
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    
    // Document files — read buffers once, reuse for email + expediente
    const cedulaFile = formData.get('cedulaFile') as File | null;
    const licenciaFile = formData.get('licenciaFile') as File | null;
    const registroVehicularFile = formData.get('registroVehicularFile') as File | null;
    
    console.log('[IS EXPEDIENTE] Archivos recibidos en FormData:', {
      cedulaFile: cedulaFile ? `${cedulaFile.name} (${cedulaFile.size} bytes)` : 'NO RECIBIDO',
      licenciaFile: licenciaFile ? `${licenciaFile.name} (${licenciaFile.size} bytes)` : 'NO RECIBIDO',
      registroVehicularFile: registroVehicularFile ? `${registroVehicularFile.name} (${registroVehicularFile.size} bytes)` : 'NO RECIBIDO',
    });
    
    let cedulaBuffer: Buffer | null = null;
    let licenciaBuffer: Buffer | null = null;
    let registroBuffer: Buffer | null = null;
    
    if (cedulaFile) {
      cedulaBuffer = Buffer.from(await cedulaFile.arrayBuffer());
      attachments.push({ filename: `cedula_${clientData.cedula}.${getExtension(cedulaFile.name)}`, content: cedulaBuffer, contentType: cedulaFile.type });
      console.log('[IS EXPEDIENTE] Adjuntando cédula:', cedulaFile.name);
    }
    
    if (licenciaFile) {
      licenciaBuffer = Buffer.from(await licenciaFile.arrayBuffer());
      attachments.push({ filename: `licencia_${clientData.cedula}.${getExtension(licenciaFile.name)}`, content: licenciaBuffer, contentType: licenciaFile.type });
      console.log('[IS EXPEDIENTE] Adjuntando licencia:', licenciaFile.name);
    }
    
    if (registroVehicularFile) {
      registroBuffer = Buffer.from(await registroVehicularFile.arrayBuffer());
      attachments.push({ filename: `registro_vehicular.${getExtension(registroVehicularFile.name)}`, content: registroBuffer, contentType: registroVehicularFile.type });
      console.log('[IS EXPEDIENTE] Adjuntando registro vehicular:', registroVehicularFile.name);
    }
    
    // Inspection photos (only for CC)
    if (isCC) {
      const photoKeys = [
        'frontal', 'lateral-izq', 'lateral-der', 'trasera',
        'motor', 'kilometraje', 'tablero', 'asientos', 'llave', 'chasis-placa'
      ];
      
      for (const key of photoKeys) {
        const photoFile = formData.get(`photo_${key}`) as File | null;
        if (photoFile) {
          const buffer = Buffer.from(await photoFile.arrayBuffer());
          attachments.push({ filename: `inspeccion_${key}.${getExtension(photoFile.name)}`, content: buffer, contentType: photoFile.type });
        }
      }
      console.log(`[IS EXPEDIENTE] ${attachments.length - 3} fotos de inspección adjuntadas`);
    }
    
    // Generate inspection PDF — ONLY for IS + CC (Internacional requires it for Cobertura Completa only)
    if (isIS && isCC) try {
      const nombreCompleto = `${clientData.primerNombre || ''} ${clientData.segundoNombre || ''} ${clientData.primerApellido || ''} ${clientData.segundoApellido || ''}`.trim();
      
      const pdfData = {
        propietario: nombreCompleto,
        direccion: clientData.direccion || '',
        cedula: clientData.cedula || '',
        telefonos: [clientData.telefono, clientData.celular].filter(Boolean).join(' / '),
        color: vehicleData.color || '',
        placa: vehicleData.placa || '',
        anio: quoteData.anio?.toString() || quoteData.anno?.toString() || '',
        tipo: quoteData.tipoVehiculo || 'SEDAN',
        marca: quoteData.marca || '',
        modelo: quoteData.modelo || '',
        motor: vehicleData.motor || '',
        chasis: vehicleData.vinChasis || '',
        kilometraje: vehicleData.kilometraje?.toString() || '',
        pasajeros: vehicleData.pasajeros?.toString() || '5',
        tipoCombustible: (vehicleData.tipoCombustible as 'GASOLINA' | 'DIESEL') || 'GASOLINA',
        tipoTransmision: (vehicleData.tipoTransmision as 'AUTOMATICO' | 'MANUAL') || 'AUTOMATICO',
        // Inspection extras only collected during CC flow; DT defaults to clean
        buenEstadoFisico: inspectionData.buenEstadoFisico ?? true,
        partConditions: inspectionData.partConditions || {},
        tieneExtras: inspectionData.tieneExtras ?? false,
        extrasSeleccionados: inspectionData.extrasSeleccionados || [],
        extrasDetalle: inspectionData.extrasDetalle || '',
        sumaAsegurada: quoteData.valorVehiculo
          ? Number(quoteData.valorVehiculo).toLocaleString('en-US', { minimumFractionDigits: 2 })
          : '0.00',
        valorVehiculo: quoteData.valorVehiculo?.toString() || '',
        aseguradoAnteriormente: vehicleData.aseguradoAnteriormente ?? false,
        aseguradoraAnterior: vehicleData.aseguradoraAnterior || '',
        observaciones: inspectionData.observaciones || inspectionData.notas || '',
        firmaDataUrl: firmaDataUrl || '',
        fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      };
      
      console.log('[IS EXPEDIENTE] Generando formulario de inspección...');
      const pdfBuffer = await generateInspectionPdf(pdfData);
      attachments.push({
        filename: `formulario_inspeccion_${clientData.cedula}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      });
      console.log('[IS EXPEDIENTE] Formulario de inspección generado:', pdfBuffer.length, 'bytes');
    } catch (pdfError: any) {
      console.error('[IS EXPEDIENTE] Error generando formulario de inspección:', pdfError);
    }

    // Generate IS Quotation PDF — ONLY for IS + CC with real-API quote data
    if (
      isIS && isCC &&
      quoteData._allCoberturas &&
      quoteData._idCotizacion &&
      typeof quoteData._descuentoFactor === 'number' &&
      typeof quoteData._vIdOpt === 'number'
    ) {
      try {
        const nombreCompleto = `${clientData.primerNombre || ''} ${clientData.segundoNombre || ''} ${clientData.primerApellido || ''} ${clientData.segundoApellido || ''}`.trim();
        const quotePdfData = {
          clientName: nombreCompleto,
          cedula: clientData.cedula || '',
          email: clientData.email || '',
          telefono: clientData.telefono || clientData.celular || '',
          marca: quoteData.marca || '',
          modelo: quoteData.modelo || '',
          anio: quoteData.anio || quoteData.anno || '',
          valorVehiculo: Number(quoteData.valorVehiculo) || 0,
          tipoCobertura: (tipoCobertura as 'CC' | 'DT') || 'CC',
          idCotizacion: String(quoteData._idCotizacion),
          nroCotizacion: quoteData._nroCotizacion ? Number(quoteData._nroCotizacion) : undefined,
          fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
          opcionSeleccionada: Number(quoteData._vIdOpt) as 1 | 2 | 3,
          endosoTexto: quoteData._endosoTexto || '',
          planType: quoteData._planType || '',
          allCoberturas: quoteData._allCoberturas,
          apiPrimaTotal: Number(quoteData._apiPrimaTotal) || 0,
          descuentoFactor: Number(quoteData._descuentoFactor),
          descuentoPorcentaje: Number(quoteData._descuentoPorcentaje) || 0,
        };
        console.log('[IS EXPEDIENTE] Generando cotización PDF (opción seleccionada:', quotePdfData.opcionSeleccionada, ')...');
        const quotePdfBuffer = await generateISQuotePdf(quotePdfData);
        attachments.push({
          filename: `cotizacion_IS_${quoteData._nroCotizacion || quoteData._idCotizacion}_${clientData.cedula}.pdf`,
          content: quotePdfBuffer,
          contentType: 'application/pdf',
        });
        console.log('[IS EXPEDIENTE] Cotización PDF generada:', quotePdfBuffer.length, 'bytes');
      } catch (quotePdfError: any) {
        console.error('[IS EXPEDIENTE] Error generando cotización PDF:', quotePdfError);
        // Non-blocking
      }
    }

    // Generate Authorization PDF (for portal@ expediente, NOT for IS expediente)
    const nombreCompleto = `${clientData.primerNombre || ''} ${clientData.segundoNombre || ''} ${clientData.primerApellido || ''} ${clientData.segundoApellido || ''}`.trim();
    let authPdfBuffer: Buffer | null = null;
    let authPdfFilename = `debida_diligencia_y_autorizacion_${clientData.cedula}${nroPoliza ? `_poliza_${nroPoliza}` : ''}.pdf`;
    try {
      const authPdfData = {
        nombreCompleto,
        cedula: clientData.cedula || '',
        email: clientData.email || '',
        direccion: clientData.direccion || 'Panamá',
        nroPoliza: nroPoliza || '',
        marca: quoteData.marca || vehicleData.marca || '',
        modelo: quoteData.modelo || vehicleData.modelo || '',
        anio: quoteData.anio || quoteData.anno || vehicleData.anio || '',
        placa: vehicleData.placa || '',
        chasis: vehicleData.vinChasis || vehicleData.chasis || '',
        motor: vehicleData.motor || '',
        color: vehicleData.color || '',
        firmaDataUrl: firmaDataUrl || '',
        fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        // KYC fields for Section 0
        fechaNacimiento: clientData.fechaNacimiento || '',
        sexo: clientData.sexo || '',
        estadoCivil: clientData.estadoCivil || '',
        telefono: clientData.telefono || '',
        celular: clientData.celular || '',
        actividadEconomica: clientData.actividadEconomica || '',
        nivelIngresos: clientData.nivelIngresos || '',
        dondeTrabaja: clientData.dondeTrabaja || '',
        esPEP: clientData.esPEP === true || clientData.esPEP === 'true',
        pepEsUsted: clientData.pepEsUsted === true || clientData.pepEsUsted === 'true',
        pepCargoUsted: clientData.pepCargoUsted || '',
        pepEsFamiliar: clientData.pepEsFamiliar === true || clientData.pepEsFamiliar === 'true',
        pepNombreFamiliar: clientData.pepNombreFamiliar || '',
        pepCargoFamiliar: clientData.pepCargoFamiliar || '',
        pepRelacionFamiliar: clientData.pepRelacionFamiliar || '',
        pepEsColaborador: clientData.pepEsColaborador === true || clientData.pepEsColaborador === 'true',
        pepNombreColaborador: clientData.pepNombreColaborador || '',
        pepCargoColaborador: clientData.pepCargoColaborador || '',
        pepRelacionColaborador: clientData.pepRelacionColaborador || '',
        tipoCobertura: isCC ? 'CC' : 'DT',
        insurerName: insurerName || '',
        valorAsegurado: quoteData.valorVehiculo ? `$${Number(quoteData.valorVehiculo).toLocaleString('en-US')}` : '',
        primaAnual: quoteData.primaTotal ? `B/.${Number(quoteData.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
      };
      console.log('[IS EXPEDIENTE] Generando PDF de autorización... firmaDataUrl:', firmaDataUrl ? `${firmaDataUrl.substring(0, 30)}... (${firmaDataUrl.length} chars)` : 'VACÍO');
      authPdfBuffer = await generateAuthorizationPdf(authPdfData);
      // NOTE: Do NOT attach to IS expediente email — carta autorización goes to portal@ only
      console.log('[IS EXPEDIENTE] PDF de autorización generado:', authPdfBuffer.length, 'bytes');
    } catch (authPdfError: any) {
      console.error('[IS EXPEDIENTE] Error generando PDF de autorización:', authPdfError);
    }

    // Build email HTML
    const coberturaLabel = isCC ? 'Cobertura Completa' : 'Daños a Terceros';
    
    const htmlBody = buildExpedienteEmail({
      nombreCompleto,
      cedula: clientData.cedula,
      email: clientData.email,
      telefono: clientData.telefono,
      celular: clientData.celular,
      direccion: clientData.direccion,
      fechaNacimiento: clientData.fechaNacimiento,
      marca: quoteData.marca,
      modelo: quoteData.modelo,
      anio: quoteData.anio || quoteData.anno,
      placa: vehicleData.placa,
      color: vehicleData.color,
      motor: vehicleData.motor,
      chasis: vehicleData.vinChasis,
      valorVehiculo: quoteData.valorVehiculo,
      cobertura: coberturaLabel,
      nroPoliza,
      attachmentCount: attachments.length,
      pdfUrl: (formData.get('pdfUrl') as string) || '',
      insurerName,
    });
    
    // Send emails via ZeptoMail REST API
    let isMailMessageId = '';

    // ═══ EMAIL 1: EXPEDIENTE PARA ASEGURADORA (solo Internacional) ═══
    // Incluye: docs del cliente + formulario inspección (CC) + cotización (CC)
    // NO incluye: carta de autorización (eso es nuestro)
    if (isIS) {
      try {
        console.log('[IS EXPEDIENTE] Enviando expediente a Internacional...', isRecipients);
        const isMailResult = await sendZeptoWithAttachments({
          to: isRecipients,
          subject: `Expediente de Emisión - ${coberturaLabel} - ${nombreCompleto} - ${clientData.cedula}${nroPoliza ? ` - Póliza ${nroPoliza}` : ''}`,
          html: htmlBody,
          attachments,
        });
        isMailMessageId = isMailResult.messageId;
        console.log('[IS EXPEDIENTE] ✅ Correo expediente IS enviado:', isMailMessageId);
      } catch (isMailError: any) {
        console.error('[IS EXPEDIENTE] Error enviando expediente a IS:', isMailError.message);
      }
    }

    // ═══ EMAIL 2: EXPEDIENTE PORTAL (para TODAS las aseguradoras) ═══
    // Incluye: todos los docs del cliente + carta de autorización + enlace carátula
    // NO incluye: formulario inspección ni cotización (exclusivos IS)
    // Destino: SIEMPRE portal@lideresenseguros.com (expediente interno)
    const PORTAL_RECIPIENT = 'portal@lideresenseguros.com';
    try {
      // Build portal attachments: client docs + carta autorización (no inspection/cotización)
      const portalAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      if (cedulaBuffer && cedulaFile) {
        portalAttachments.push({ filename: `cedula_${clientData.cedula}.${getExtension(cedulaFile.name)}`, content: cedulaBuffer, contentType: cedulaFile.type });
      }
      if (licenciaBuffer && licenciaFile) {
        portalAttachments.push({ filename: `licencia_${clientData.cedula}.${getExtension(licenciaFile.name)}`, content: licenciaBuffer, contentType: licenciaFile.type });
      }
      if (registroBuffer && registroVehicularFile) {
        portalAttachments.push({ filename: `registro_vehicular.${getExtension(registroVehicularFile.name)}`, content: registroBuffer, contentType: registroVehicularFile.type });
      }
      if (authPdfBuffer) {
        portalAttachments.push({ filename: authPdfFilename, content: authPdfBuffer, contentType: 'application/pdf' });
      }

      const portalHtml = buildExpedienteEmail({
        nombreCompleto,
        cedula: clientData.cedula,
        email: clientData.email,
        telefono: clientData.telefono,
        celular: clientData.celular,
        direccion: clientData.direccion,
        fechaNacimiento: clientData.fechaNacimiento,
        marca: quoteData.marca,
        modelo: quoteData.modelo,
        anio: quoteData.anio || quoteData.anno,
        placa: vehicleData.placa,
        color: vehicleData.color,
        motor: vehicleData.motor,
        chasis: vehicleData.vinChasis,
        valorVehiculo: quoteData.valorVehiculo,
        cobertura: coberturaLabel,
        nroPoliza,
        attachmentCount: portalAttachments.length,
        pdfUrl: (formData.get('pdfUrl') as string) || '',
        insurerName,
      });

      console.log('[IS EXPEDIENTE] Enviando expediente portal a:', PORTAL_RECIPIENT);
      await sendZeptoWithAttachments({
        to: PORTAL_RECIPIENT,
        subject: `Expediente Portal - ${insurerName} - ${coberturaLabel} - ${nombreCompleto} - ${clientData.cedula}${nroPoliza ? ` - Póliza ${nroPoliza}` : ''}`,
        html: portalHtml,
        attachments: portalAttachments,
      });
      console.log('[IS EXPEDIENTE] ✅ Expediente portal enviado a:', PORTAL_RECIPIENT);
    } catch (portalMailError: any) {
      console.error('[IS EXPEDIENTE] Error enviando expediente portal:', portalMailError.message);
    }

    // === ENVIAR RESUMEN Y BIENVENIDA AL CLIENTE ===
    const clientEmail = clientData.email;
    const primaTotal = quoteData.primaTotal || quoteData.valorVehiculo || 0;
    const vigenciaDesde = new Date().toLocaleDateString('es-PA');
    const vigenciaHasta = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA');
    
    // Bienvenida SIEMPRE al correo real del cliente ingresado en el formulario de emisión
    const welcomeRecipient = clientEmail || OFFICE_EMAIL;
    
    try {
      // Build download URLs for email links
      const siteUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://portal.lideresenseguros.com');
      const isFedpa = (insurerName || '').toUpperCase().includes('FEDPA');
      const caratulaUrl = isFedpa && nroPoliza
        ? `${siteUrl}/api/fedpa/caratula?poliza=${encodeURIComponent(nroPoliza)}&env=PROD`
        : '';

      // Resolve pdfUrl: make relative paths absolute for email links
      let resolvedPdfUrl = (formData.get('pdfUrl') as string) || '';
      if (resolvedPdfUrl && resolvedPdfUrl.startsWith('/')) {
        resolvedPdfUrl = `${siteUrl}${resolvedPdfUrl}`;
      }

      const welcomeHtml = buildWelcomeEmail({
        nombreCompleto,
        cedula: clientData.cedula,
        marca: quoteData.marca,
        modelo: quoteData.modelo,
        anio: quoteData.anio || quoteData.anno,
        placa: vehicleData.placa,
        nroPoliza,
        cobertura: coberturaLabel,
        primaTotal,
        primaContado: quoteData.primaContado || 0,
        formaPago: quoteData.formaPago || 'contado',
        cantidadCuotas: quoteData.cantidadCuotas || 1,
        montoCuota: quoteData.montoCuota || 0,
        vigenciaDesde,
        vigenciaHasta,
        pdfUrl: resolvedPdfUrl,
        insurerName,
        caratulaUrl,
        insurerPaymentPlan: quoteData.insurerPaymentPlan || undefined,
      });
      
      const welcomeSubject = `¡Bienvenido! Tu póliza ha sido emitida - ${coberturaLabel}${nroPoliza ? ` - Póliza ${nroPoliza}` : ''}`;
      
      // Send welcome email to client's real email (fallback to office if no email)
      const welcomeResult = await sendZeptoWithAttachments({
        to: welcomeRecipient,
        subject: welcomeSubject,
        html: welcomeHtml,
      });
      console.log('[IS EXPEDIENTE] ✅ Bienvenida enviada a:', welcomeRecipient, welcomeResult.messageId);
    } catch (welcomeError: any) {
      console.error('[IS EXPEDIENTE] Error enviando bienvenida:', welcomeError.message);
    }
    
    // ═══ GUARDAR DOCUMENTOS EN EXPEDIENTE (Supabase Storage) ═══
    let expedienteSaved: string[] = [];
    let expedienteErrors: string[] = [];
    let resolvedClientId = clientId;
    let resolvedPolicyId = policyId;

    // Fallback: look up OR CREATE clientId/policyId if not provided by emission API
    if ((!resolvedClientId || !resolvedPolicyId) && clientData.cedula) {
      try {
        const sbAdmin = getSupabaseAdmin();
        console.log('[IS EXPEDIENTE] clientId/policyId no proporcionados, buscando/creando por cédula:', clientData.cedula, 'nroPoliza:', nroPoliza);

        // ── Resolve or create client ──
        if (!resolvedClientId) {
          const { data: foundClient } = await sbAdmin
            .from('clients')
            .select('id')
            .eq('national_id', clientData.cedula)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (foundClient) {
            resolvedClientId = foundClient.id;
            console.log('[IS EXPEDIENTE] Cliente encontrado por cédula:', resolvedClientId);
          } else {
            // Create client — find broker "portal" first
            const { data: oficinaBroker } = await sbAdmin
              .from('brokers')
              .select('id')
              .eq('email', 'portal@lideresenseguros.com')
              .single();
            if (oficinaBroker) {
              const clientName = `${clientData.primerNombre || ''} ${clientData.segundoNombre || ''} ${clientData.primerApellido || ''} ${clientData.segundoApellido || ''}`.trim();
              let birthDate: string | undefined;
              if (clientData.fechaNacimiento) {
                const parts = clientData.fechaNacimiento.split('/');
                if (parts.length === 3) birthDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
              const { data: newClient } = await sbAdmin
                .from('clients')
                .insert({
                  broker_id: oficinaBroker.id,
                  name: clientName || `Cliente ${clientData.cedula}`,
                  national_id: clientData.cedula,
                  email: clientData.email || null,
                  phone: String(clientData.celular || clientData.telefono || ''),
                  active: true,
                  ...(birthDate ? { birth_date: birthDate } : {}),
                })
                .select('id')
                .single();
              if (newClient) {
                resolvedClientId = newClient.id;
                console.log('[IS EXPEDIENTE] Cliente CREADO:', resolvedClientId);
              }
            }
          }
        }

        // ── Resolve or create policy ──
        if (resolvedClientId && !resolvedPolicyId && nroPoliza) {
          // Try by client_id + policy_number first
          const { data: foundPolicy } = await sbAdmin
            .from('policies')
            .select('id')
            .eq('client_id', resolvedClientId)
            .eq('policy_number', nroPoliza)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (foundPolicy) {
            resolvedPolicyId = foundPolicy.id;
            console.log('[IS EXPEDIENTE] Póliza encontrada por client+nroPoliza:', resolvedPolicyId);
          } else {
            // Broaden: search by policy_number alone (may be under different client record)
            const { data: anyPolicy } = await sbAdmin
              .from('policies')
              .select('id')
              .eq('policy_number', nroPoliza)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            if (anyPolicy) {
              resolvedPolicyId = anyPolicy.id;
              console.log('[IS EXPEDIENTE] Póliza encontrada solo por nroPoliza:', resolvedPolicyId);
            }
          }
        }

        // If still no policyId, try latest policy for this client (created in last 5 min)
        if (resolvedClientId && !resolvedPolicyId) {
          const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
          const { data: latestPolicy } = await sbAdmin
            .from('policies')
            .select('id')
            .eq('client_id', resolvedClientId)
            .gte('created_at', fiveMinAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestPolicy) {
            resolvedPolicyId = latestPolicy.id;
            console.log('[IS EXPEDIENTE] Póliza reciente encontrada:', resolvedPolicyId);
          }
        }

        // ── Last resort: CREATE the policy if we have clientId + nroPoliza ──
        if (resolvedClientId && !resolvedPolicyId && nroPoliza) {
          // Look up insurer by name
          const inName = (insurerName || '').toUpperCase();
          let insurerFilter = '%';
          if (inName.includes('FEDPA')) insurerFilter = '%FEDPA%';
          else if (inName.includes('INTERNACIONAL')) insurerFilter = '%INTERNACIONAL%';
          else if (inName.includes('REGIONAL')) insurerFilter = '%REGIONAL%';
          else if (inName.includes('ANCÓN') || inName.includes('ANCON')) insurerFilter = '%ANCON%';
          else if (inName.includes('ASSA')) insurerFilter = '%ASSA%';

          const { data: insurer } = await sbAdmin
            .from('insurers')
            .select('id')
            .ilike('name', insurerFilter)
            .limit(1)
            .maybeSingle();

          const { data: clientRow } = await sbAdmin
            .from('clients')
            .select('broker_id')
            .eq('id', resolvedClientId)
            .single();

          if (insurer && clientRow) {
            const cobLabel = isCC ? 'Cobertura Completa' : 'Daños a Terceros';
            const today = new Date().toISOString().split('T')[0];
            const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0];
            const { data: newPolicy } = await sbAdmin
              .from('policies')
              .insert({
                broker_id: clientRow.broker_id,
                client_id: resolvedClientId,
                insurer_id: insurer.id,
                policy_number: nroPoliza,
                ramo: 'AUTO',
                status: 'ACTIVA',
                start_date: today,
                renewal_date: nextYear,
                notas: [
                  quoteData.marca && quoteData.modelo ? `Vehículo: ${quoteData.marca} ${quoteData.modelo} ${quoteData.anio || quoteData.anno || ''}` : null,
                  vehicleData.placa ? `Placa: ${vehicleData.placa}` : null,
                  `Cobertura: ${cobLabel}`,
                ].filter(Boolean).join('\n'),
              })
              .select('id')
              .single();
            if (newPolicy) {
              resolvedPolicyId = newPolicy.id;
              console.log('[IS EXPEDIENTE] Póliza CREADA como último recurso:', resolvedPolicyId, 'para', nroPoliza);
            }
          } else {
            console.warn('[IS EXPEDIENTE] No se pudo crear póliza — insurer:', !!insurer, 'clientRow:', !!clientRow);
          }
        }
      } catch (lookupErr: any) {
        console.warn('[IS EXPEDIENTE] Error buscando/creando clientId/policyId:', lookupErr.message);
      }
    }

    if (resolvedClientId && resolvedPolicyId) {
      try {
        // Download policy PDF from pdfUrl if available
        let polizaPdfBuffer: Buffer | null = null;
        const pdfUrl = (formData.get('pdfUrl') as string) || '';
        if (pdfUrl) {
          try {
            console.log('[IS EXPEDIENTE] Descargando carátula de póliza desde:', pdfUrl.substring(0, 80) + '...');
            const pdfResponse = await fetch(pdfUrl, { signal: AbortSignal.timeout(15000) });
            if (pdfResponse.ok) {
              const pdfArrayBuffer = await pdfResponse.arrayBuffer();
              polizaPdfBuffer = Buffer.from(pdfArrayBuffer);
              console.log('[IS EXPEDIENTE] Carátula descargada:', polizaPdfBuffer.length, 'bytes');
            } else {
              console.warn('[IS EXPEDIENTE] Error descargando carátula:', pdfResponse.status, pdfResponse.statusText);
            }
          } catch (pdfDownErr: any) {
            console.warn('[IS EXPEDIENTE] No se pudo descargar carátula:', pdfDownErr.message);
          }
        }

        console.log('[IS EXPEDIENTE] 📋 Docs disponibles para expediente:', {
          clientId: resolvedClientId,
          policyId: resolvedPolicyId,
          cedula: cedulaBuffer ? `${cedulaBuffer.length}b` : 'NO',
          licencia: licenciaBuffer ? `${licenciaBuffer.length}b` : 'NO',
          registroVehicular: registroBuffer ? `${registroBuffer.length}b` : 'NO — registroVehicularFile=' + (registroVehicularFile ? `${registroVehicularFile.name} (${registroVehicularFile.size}b)` : 'NULL'),
          cartaAutorizacion: authPdfBuffer ? `${authPdfBuffer.length}b` : 'NO — authPdfBuffer es null (generateAuthorizationPdf falló o no se ejecutó)',
          polizaPdf: polizaPdfBuffer ? `${polizaPdfBuffer.length}b` : 'NO',
          firmaDataUrl: firmaDataUrl ? `${firmaDataUrl.length} chars` : 'VACÍO',
        });

        const polizaPdfFilename = `caratula_poliza_${clientData.cedula}${nroPoliza ? `_${nroPoliza}` : ''}.pdf`;

        const expedienteResult = await guardarDocumentosExpediente({
          clientId: resolvedClientId,
          policyId: resolvedPolicyId,
          cedula: cedulaBuffer && cedulaFile ? { buffer: cedulaBuffer, fileName: cedulaFile.name, mimeType: cedulaFile.type } : undefined,
          licencia: licenciaBuffer && licenciaFile ? { buffer: licenciaBuffer, fileName: licenciaFile.name, mimeType: licenciaFile.type } : undefined,
          registroVehicular: registroBuffer && registroVehicularFile ? { buffer: registroBuffer, fileName: registroVehicularFile.name, mimeType: registroVehicularFile.type } : undefined,
          cartaAutorizacion: authPdfBuffer ? { buffer: authPdfBuffer, fileName: authPdfFilename, mimeType: 'application/pdf' } : undefined,
          polizaPdf: polizaPdfBuffer ? { buffer: polizaPdfBuffer, fileName: polizaPdfFilename, mimeType: 'application/pdf' } : undefined,
          nroPoliza,
        });
        expedienteSaved = expedienteResult.saved;
        expedienteErrors = expedienteResult.errors;
        const expedienteSkipped = expedienteResult.skipped || [];
        if (expedienteResult.ok) {
          console.log('[IS EXPEDIENTE] ✅ Documentos guardados en expediente:', expedienteSaved, '| Omitidos (ya existen):', expedienteSkipped);
        } else {
          console.warn('[IS EXPEDIENTE] ⚠️ Algunos documentos no se guardaron:', expedienteErrors);
        }
      } catch (expError: any) {
        console.error('[IS EXPEDIENTE] Error guardando documentos en expediente:', expError.message);
      }
    } else {
      console.warn('[IS EXPEDIENTE] ⚠️ No se pudo resolver clientId/policyId — cedula:', clientData.cedula, 'nroPoliza:', nroPoliza);
    }

    // Audit metadata for the due diligence PDF
    const authPdfHash = authPdfBuffer
      ? createHash('sha256').update(authPdfBuffer).digest('hex')
      : null;

    return NextResponse.json({
      success: true,
      messageId: isMailMessageId || 'portal-only',
      recipients: isIS ? isRecipients : [PORTAL_RECIPIENT],
      attachmentCount: attachments.length,
      clientEmailSent: !!clientEmail,
      expediente: { saved: expedienteSaved, errors: expedienteErrors },
      audit: {
        consent_version: '1.0',
        pdf_hash_sha256: authPdfHash,
        wizard_type: isCC ? 'full_coverage' : 'third_party',
        generated_at: new Date().toISOString(),
      },
    });
    
  } catch (error: any) {
    console.error('[IS EXPEDIENTE] Error:', error);
    return NextResponse.json({
      error: error.message || 'Error al enviar expediente',
    }, { status: 500 });
  }
}

function getInsurerEmergencyNumber(insurerName: string): string {
  const name = (insurerName || '').toUpperCase();
  if (name.includes('INTERNACIONAL')) return '800-4600';
  if (name.includes('FEDPA'))         return '800-3732';
  if (name.includes('ASSA'))          return '800-2772';
  if (name.includes('MAPFRE'))        return '800-6273';
  if (name.includes('SURA'))          return '800-7872';
  if (name.includes('GENERAL'))       return '800-0155';
  if (name.includes('ANCÓN') || name.includes('ANCON')) return '800-2626';
  if (name.includes('REGIONAL'))      return '800-0155';
  if (name.includes('MUNDIAL'))       return '800-6200';
  if (name.includes('PAN AMERICAN'))  return '800-0800';
  return '800-4600';
}

function buildWelcomeEmail(data: {
  nombreCompleto: string;
  cedula: string;
  marca: string;
  modelo: string;
  anio: string | number;
  placa: string;
  nroPoliza: string;
  cobertura: string;
  primaTotal: number;
  vigenciaDesde: string;
  vigenciaHasta: string;
  pdfUrl: string;
  insurerName: string;
  caratulaUrl?: string;
  primaContado?: number;
  formaPago?: string;
  cantidadCuotas?: number;
  montoCuota?: number;
  // When insurer payment plan differs from client's chosen PF plan
  insurerPaymentPlan?: {
    insurerCuotas: number;
    insurerFrequency: string;
    clientCuotas: number;
  };
}): string {
  const emergencyNumber = getInsurerEmergencyNumber(data.insurerName);
  const whatsappUrl = 'https://wa.me/50768339167';
  const whatsappNumber = '+507 6833-9167';
  const contactEmail = 'contacto@lideresenseguros.com';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f0f2f5; }
    .container { max-width: 620px; margin: 24px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.12); }
    .header { background: linear-gradient(135deg, #010139 0%, #020270 100%); color: white; padding: 36px 28px; text-align: center; }
    .header-logo { font-size: 28px; font-weight: 900; letter-spacing: -0.5px; margin: 0; }
    .header-sub { margin: 6px 0 0; opacity: 0.8; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }
    .success-badge { display: inline-block; background: #8AAA19; color: white; padding: 8px 22px; border-radius: 25px; font-size: 14px; font-weight: 700; margin-top: 16px; letter-spacing: 0.3px; }
    .welcome-band { background: linear-gradient(90deg, #f0f4e0, #e8f0d0); padding: 22px 28px; border-left: 4px solid #8AAA19; }
    .welcome-band p { margin: 0 0 8px; font-size: 15px; color: #222; line-height: 1.6; }
    .welcome-band p:last-child { margin-bottom: 0; }
    .poliza-box { background: #f0f4e0; border: 2px solid #8AAA19; border-radius: 12px; padding: 18px; margin: 20px 28px; text-align: center; }
    .poliza-box .label { font-size: 11px; color: #666; text-transform: uppercase; font-weight: 700; letter-spacing: 1px; }
    .poliza-box .number { font-size: 30px; font-weight: 900; color: #010139; margin-top: 6px; letter-spacing: 1px; }
    .content { padding: 0 28px 28px; }
    .section { margin-bottom: 18px; }
    .section h3 { color: #010139; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #8AAA19; padding-bottom: 7px; margin: 20px 0 12px; }
    .row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 14px; border-bottom: 1px solid #f3f3f3; }
    .row .lbl { color: #888; }
    .row .val { font-weight: 600; color: #222; text-align: right; }
    .prima-box { background: linear-gradient(135deg, #010139, #020270); color: white; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0; }
    .prima-box .amount { font-size: 32px; font-weight: 900; color: #8AAA19; }
    .prima-box .lbl { font-size: 12px; opacity: 0.75; margin-top: 4px; }
    .btn-green { display: inline-block; background: #8AAA19; color: white !important; padding: 13px 30px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; }

    /* Emergency card */
    .emergency-card { background: #fff3cd; border: 2px solid #f0ad4e; border-radius: 12px; padding: 18px 20px; margin: 20px 0; }
    .emergency-card h4 { margin: 0 0 10px; color: #7d4e00; font-size: 15px; }
    .emergency-card .phone { font-size: 26px; font-weight: 900; color: #010139; letter-spacing: 1px; text-align: center; display: block; }
    .emergency-card p { margin: 6px 0 0; font-size: 12px; color: #7d4e00; }

    /* WhatsApp card */
    .wa-card { background: #e8f5e9; border: 2px solid #43a047; border-radius: 12px; padding: 22px 20px; margin: 20px 0; text-align: center; }
    .wa-card h4 { margin: 0 0 8px; color: #1b5e20; font-size: 16px; font-weight: 700; }
    .wa-card p { margin: 0 0 16px; font-size: 13px; color: #2e7d32; line-height: 1.5; }
    .wa-btn { display: inline-block; background: #25D366; color: white !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 13px 28px; border-radius: 50px; letter-spacing: 0.3px; }

    /* Services card */
    .services-card { background: linear-gradient(135deg, #f8faff, #eef2ff); border: 1px solid #c5cae9; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .services-card h4 { margin: 0 0 12px; color: #010139; font-size: 15px; font-weight: 700; }
    .service-tag { display: inline-block; background: #010139; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin: 3px 3px; }

    /* Contact card */
    .contact-card { background: #f5f5f5; border-radius: 10px; padding: 16px 20px; margin: 20px 0; text-align: center; }
    .contact-card p { margin: 0 0 6px; font-size: 13px; color: #555; }
    .contact-card a { color: #010139; font-weight: 700; text-decoration: none; border-bottom: 1px solid #8AAA19; }

    .footer { background: #f8f8f8; padding: 18px 28px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; }
    .footer a { color: #8AAA19; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">

    <!-- HEADER -->
    <div class="header">
      <div class="header-logo">Líderes en Seguros</div>
      <div class="header-sub">Su corredor de confianza</div>
      <div class="success-badge">✓ ¡Póliza Emitida Exitosamente!</div>
    </div>

    <!-- WARM WELCOME -->
    <div class="welcome-band">
      <p>Estimado/a <strong>${data.nombreCompleto}</strong>,</p>
      <p>¡Bienvenido/a a la familia de <strong>Líderes en Seguros</strong>! 🎉 Es un honor contar con su confianza y estamos genuinamente emocionados de protegerle a usted y a su patrimonio.</p>
      <p>Su póliza ha sido emitida exitosamente con <strong>${data.insurerName}</strong>. A partir de este momento está completamente cubierto/a. A continuación encontrará todos los detalles importantes que debe conservar.</p>
    </div>

    <!-- POLICY NUMBER -->
    ${data.nroPoliza ? `
    <div class="poliza-box">
      <div class="label">Número de Póliza</div>
      <div class="number">${data.nroPoliza}</div>
    </div>` : ''}

    <div class="content">

      <!-- POLICY DETAILS -->
      <div class="section">
        <h3>📋 Detalles de su Póliza</h3>
        <div class="row"><span class="lbl">Aseguradora</span><span class="val">${data.insurerName}</span></div>
        <div class="row"><span class="lbl">Cobertura</span><span class="val">${data.cobertura}</span></div>
        <div class="row"><span class="lbl">Vigencia</span><span class="val">${data.vigenciaDesde} al ${data.vigenciaHasta}</span></div>
        <div class="row"><span class="lbl">Nombre</span><span class="val">${data.nombreCompleto}</span></div>
        <div class="row"><span class="lbl">Identificación</span><span class="val">${data.cedula}</span></div>
        <div class="row"><span class="lbl">Vehículo</span><span class="val">${data.marca} ${data.modelo} ${data.anio}</span></div>
        ${data.placa ? `<div class="row"><span class="lbl">Placa</span><span class="val">${data.placa}</span></div>` : ''}
      </div>

      ${data.primaTotal ? `
      <div class="prima-box">
        ${data.formaPago === 'cuotas' && data.cantidadCuotas && data.cantidadCuotas > 1 && data.montoCuota ? `
          <div class="lbl">Su Plan de Pago</div>
          <div class="amount">${data.cantidadCuotas} x $${Number(data.montoCuota).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.2);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;opacity:0.75;">Prima Anual</span>
              <span style="font-size:18px;font-weight:800;color:#8AAA19;">$${Number(data.montoCuota * data.cantidadCuotas).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        ` : `
          <div class="lbl">Prima Total Anual</div>
          <div class="amount">$${Number(data.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        `}
      </div>` : ''}

      ${data.insurerPaymentPlan && data.insurerPaymentPlan.clientCuotas > 1 ? `
      <!-- SPECIAL NOTICE: Insurer payment plan differs from client's PF plan -->
      <div style="background:linear-gradient(135deg,#e3f2fd,#bbdefb);border:2px solid #1976d2;border-radius:12px;padding:18px 20px;margin:20px 0;">
        <h4 style="margin:0 0 10px;color:#0d47a1;font-size:15px;font-weight:700;">&#x2139;&#xFE0F; Nota Importante sobre su Plan de Pagos</h4>
        <p style="margin:0 0 10px;font-size:14px;color:#1a237e;line-height:1.6;">
          En la <strong>car&aacute;tula oficial</strong> de su p&oacute;liza emitida por <strong>${data.insurerName}</strong>, 
          usted ver&aacute; que el plan de pago figura como 
          <strong>${data.insurerPaymentPlan.insurerFrequency === 'contado' || data.insurerPaymentPlan.insurerFrequency === 'CONTADO'
            ? 'pago de contado'
            : `${data.insurerPaymentPlan.insurerCuotas} pagos ${data.insurerPaymentPlan.insurerFrequency.toLowerCase()}es`}</strong>.
        </p>
        <p style="margin:0 0 10px;font-size:14px;color:#1a237e;line-height:1.6;">
          Sin embargo, <strong>sus pagos reales ser&aacute;n descontados en ${data.insurerPaymentPlan.clientCuotas} cuota(s)</strong> 
          seg&uacute;n lo acordado con usted, a trav&eacute;s de nuestro sistema de cobro autom&aacute;tico.
        </p>
        ${data.montoCuota ? `
        <div style="background:white;border-radius:8px;padding:12px 16px;margin-top:10px;">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#333;">
            <span>Monto por cuota:</span>
            <strong style="color:#0d47a1;">$${Number(data.montoCuota).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#333;margin-top:6px;">
            <span>N&uacute;mero de cuotas:</span>
            <strong style="color:#0d47a1;">${data.insurerPaymentPlan.clientCuotas}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#333;margin-top:6px;padding-top:6px;border-top:1px solid #e0e0e0;">
            <span>Total a pagar:</span>
            <strong style="color:#0d47a1;">$${Number(data.montoCuota * data.insurerPaymentPlan.clientCuotas).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
          </div>
        </div>` : ''}
        <p style="margin:12px 0 0;font-size:12px;color:#1565c0;line-height:1.5;">
          Esto es completamente normal y no afecta su cobertura. Su p&oacute;liza est&aacute; activa y vigente. 
          Si tiene alguna duda, no dude en contactarnos.
        </p>
      </div>` : ''}

      ${data.caratulaUrl ? `
      <div style="text-align:center;margin:20px 0;">
        <a href="${data.caratulaUrl}" style="display:inline-block;background:#8AAA19;color:white;padding:13px 30px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">📄 Descargar Póliza Oficial</a>
        <p style="font-size:11px;color:#999;margin-top:8px;">Descargue su carátula de póliza oficial emitida por ${data.insurerName}</p>
      </div>` : data.pdfUrl ? `
      <div style="text-align:center;margin:20px 0;">
        <a href="${data.pdfUrl}" class="btn-green">📄 Descargar Póliza Oficial</a>
        <p style="font-size:11px;color:#999;margin-top:8px;">Enlace al documento oficial emitido por ${data.insurerName}</p>
      </div>` : ''}

      <!-- EMERGENCY NUMBER -->
      <div class="emergency-card">
        <h4>🚨 Línea de Asistencia y Siniestros — ${data.insurerName}</h4>
        <div class="phone">${emergencyNumber}</div>
        <p>Disponible las 24 horas, los 7 días de la semana. Ante cualquier siniestro o emergencia, llame de inmediato a este número y mencione su número de póliza.</p>
      </div>

      <!-- WHATSAPP LISSA -->
      <div class="wa-card">
        <h4>💬 Chatea con LISSA — Nuestra Asistente Virtual</h4>
        <p>¿Tiene dudas sobre su póliza, desea renovar, agregar coberturas o simplemente consultar algo?<br><strong>LISSA</strong> está disponible para asistirle en cualquier momento.</p>
        <a href="${whatsappUrl}" target="_blank" class="wa-btn">&#x1F4F1; Escribir por WhatsApp</a>
        <p style="margin:10px 0 0;font-size:11px;color:#2e7d32;">${whatsappNumber}</p>
      </div>

      <!-- SERVICES -->
      <div class="services-card">
        <h4>&#x1F31F; En Líderes en Seguros le cubrimos en todo</h4>
        <p style="font-size:13px;color:#444;margin:0 0 14px;line-height:1.6;">
          Somos corredores de seguros con experiencia en <strong>todos los ramos</strong>. Estamos aquí para asesorarle, comparar opciones y encontrar la mejor cobertura para cada etapa de su vida y su negocio. ¡No espere a necesitarlo para contactarnos!
        </p>
        <div style="line-height:2;">
          <span class="service-tag">&#x1F697; Auto</span>
          <span class="service-tag">&#x2764;&#xFE0F; Vida</span>
          <span class="service-tag">&#x1F3E0; Incendio</span>
          <span class="service-tag">&#x1F4E6; Contenido</span>
          <span class="service-tag">&#x2696;&#xFE0F; Responsabilidad Civil</span>
          <span class="service-tag">&#x1F3E2; Empresas</span>
          <span class="service-tag">&#x1F3E5; Salud</span>
          <span class="service-tag">&#x2708;&#xFE0F; Viajes</span>
          <span class="service-tag">&#x26F5; Embarcaciones</span>
          <span class="service-tag">Y mucho m&#225;s...</span>
        </div>
      </div>

      <!-- CONTACT -->
      <div class="contact-card">
        <p><strong>¿Alguna consulta, reclamo o novedad en su póliza?</strong></p>
        <p>Escríbanos a <a href="mailto:${contactEmail}">${contactEmail}</a> o contacte a LISSA por WhatsApp.<br>Siempre habrá alguien de nuestro equipo para atenderle.</p>
      </div>

    </div>

    <!-- Regulatory Footer -->
    <div style="background:#010139;padding:20px 32px;text-align:center;">
      <p style="margin:0 0 8px;font-size:11px;color:#9ca3af;line-height:1.5;">
        Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá | Licencia PJ750
      </p>
      <img src="https://portal.lideresenseguros.com/aseguradoras/logo-SSRP.png" alt="SSRP" width="90" style="display:inline-block;max-width:90px;opacity:0.85;" />
    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p><strong>Líderes en Seguros, S.A.</strong> — Corredores de Seguros Autorizados</p>
      <p style="margin-top:4px;">
        <a href="mailto:${contactEmail}">${contactEmail}</a> &nbsp;|&nbsp;
        <a href="${whatsappUrl}">WhatsApp ${whatsappNumber}</a>
      </p>
    </div>

  </div>
</body>
</html>`;
}

function getExtension(filename: string): string {
  return filename.split('.').pop() || 'bin';
}

function buildExpedienteEmail(data: {
  nombreCompleto: string;
  cedula: string;
  email: string;
  telefono: string;
  celular: string;
  direccion: string;
  fechaNacimiento: string;
  marca: string;
  modelo: string;
  anio: string | number;
  placa: string;
  color: string;
  motor: string;
  chasis: string;
  valorVehiculo: number;
  cobertura: string;
  nroPoliza: string;
  attachmentCount: number;
  pdfUrl?: string;
  insurerName?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #010139, #020270); color: white; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 8px 0 0; opacity: 0.8; font-size: 14px; }
    .badge { display: inline-block; background: #8AAA19; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; margin-top: 8px; }
    .content { padding: 24px; }
    .section { margin-bottom: 20px; }
    .section h3 { color: #010139; font-size: 16px; border-bottom: 2px solid #8AAA19; padding-bottom: 8px; margin-bottom: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item { padding: 8px; background: #f8f9fa; border-radius: 6px; }
    .info-item .label { font-size: 11px; color: #666; text-transform: uppercase; font-weight: bold; }
    .info-item .value { font-size: 14px; color: #333; font-weight: 600; margin-top: 2px; }
    .footer { background: #f0f0f0; padding: 16px 24px; text-align: center; font-size: 12px; color: #666; }
    .attachment-note { background: #e8f5e9; border: 1px solid #a5d6a7; border-radius: 8px; padding: 12px; margin-top: 16px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📋 Expediente de Emisión</h1>
      <p>Líderes en Seguros, S.A.</p>
      <div class="badge">${data.cobertura}</div>
      ${data.insurerName ? `<div class="badge" style="background:#020270;margin-left:8px;">${data.insurerName}</div>` : ''}
      ${data.nroPoliza ? `<div class="badge" style="background:#010139;margin-left:8px;">Póliza: ${data.nroPoliza}</div>` : ''}
    </div>
    
    <div class="content">
      <div class="section">
        <h3>👤 Datos del Cliente</h3>
        <div class="info-grid">
          <div class="info-item">
            <div class="label">Nombre Completo</div>
            <div class="value">${data.nombreCompleto}</div>
          </div>
          <div class="info-item">
            <div class="label">Cédula</div>
            <div class="value">${data.cedula}</div>
          </div>
          <div class="info-item">
            <div class="label">Email</div>
            <div class="value">${data.email}</div>
          </div>
          <div class="info-item">
            <div class="label">Teléfono</div>
            <div class="value">${data.telefono}</div>
          </div>
          <div class="info-item">
            <div class="label">Celular</div>
            <div class="value">${data.celular}</div>
          </div>
          <div class="info-item">
            <div class="label">Fecha Nacimiento</div>
            <div class="value">${data.fechaNacimiento}</div>
          </div>
          <div class="info-item" style="grid-column: span 2;">
            <div class="label">Dirección</div>
            <div class="value">${data.direccion}</div>
          </div>
        </div>
      </div>
      
      <div class="section">
        <h3>🚗 Datos del Vehículo</h3>
        <div class="info-grid">
          <div class="info-item">
            <div class="label">Marca</div>
            <div class="value">${data.marca}</div>
          </div>
          <div class="info-item">
            <div class="label">Modelo</div>
            <div class="value">${data.modelo}</div>
          </div>
          <div class="info-item">
            <div class="label">Año</div>
            <div class="value">${data.anio}</div>
          </div>
          <div class="info-item">
            <div class="label">Placa</div>
            <div class="value">${data.placa}</div>
          </div>
          <div class="info-item">
            <div class="label">Color</div>
            <div class="value">${data.color}</div>
          </div>
          <div class="info-item">
            <div class="label">Motor</div>
            <div class="value">${data.motor}</div>
          </div>
          <div class="info-item">
            <div class="label">Chasis/VIN</div>
            <div class="value">${data.chasis}</div>
          </div>
          <div class="info-item">
            <div class="label">Valor Asegurado</div>
            <div class="value">$${data.valorVehiculo?.toLocaleString('en-US') || '0'}</div>
          </div>
        </div>
      </div>
      
      ${data.pdfUrl ? `
      <div style="text-align:center;margin:16px 0;">
        <a href="${data.pdfUrl}" style="display:inline-block;background:#010139;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">📄 Descargar Carátula de Póliza</a>
        <p style="font-size:11px;color:#999;margin-top:6px;">Documento oficial emitido por Internacional de Seguros</p>
      </div>` : ''}

      <div class="attachment-note">
        <strong>📎 ${data.attachmentCount} archivo(s) adjunto(s)</strong>
        <p style="margin:4px 0 0;font-size:12px;color:#555;">
          Incluye: documentos del cliente, registro vehicular${data.cobertura === 'Cobertura Completa' ? ', fotos de inspección y formulario de inspección' : ''}
        </p>
      </div>
    </div>
    
    <div class="footer">
      Enviado automáticamente por el Portal de Líderes en Seguros, S.A.<br>
      ${new Date().toLocaleDateString('es-PA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    </div>
  </div>
</body>
</html>`;
}
