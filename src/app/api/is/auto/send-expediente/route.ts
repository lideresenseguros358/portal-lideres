/**
 * POST /api/is/auto/send-expediente
 * Generates IS inspection PDF and sends expediente email
 * with all required documents to IS contacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTransport, getFromAddress } from '@/server/email/mailer';
import { generateInspectionPdf } from '@/lib/is/inspection-pdf';

// Expediente recipients
const OFFICE_EMAIL = 'contacto@lideresenseguros.com';
// Dev: everything goes to office for testing
const IS_RECIPIENTS_DEV = [OFFICE_EMAIL];
// Prod: IS contacts + office always gets a copy
const IS_RECIPIENTS_PROD = [OFFICE_EMAIL, 'mprestan@iseguros.com', 'slopez@iseguros.com'];

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
    const isDev = environment !== 'production';
    
    if (!clientDataStr || !vehicleDataStr) {
      return NextResponse.json({ error: 'Faltan datos del cliente o vehículo' }, { status: 400 });
    }
    
    const clientData = JSON.parse(clientDataStr);
    const vehicleData = JSON.parse(vehicleDataStr);
    const inspectionData = inspectionDataStr ? JSON.parse(inspectionDataStr) : {};
    const quoteData = quoteDataStr ? JSON.parse(quoteDataStr) : {};
    
    const isCC = tipoCobertura === 'CC';
    const recipients = environment === 'production' ? IS_RECIPIENTS_PROD : IS_RECIPIENTS_DEV;
    
    console.log(`[IS EXPEDIENTE] Tipo: ${tipoCobertura}, Env: ${environment}, Recipients:`, recipients);
    
    // Collect file attachments
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    
    // Document files
    const cedulaFile = formData.get('cedulaFile') as File | null;
    const licenciaFile = formData.get('licenciaFile') as File | null;
    const registroVehicularFile = formData.get('registroVehicularFile') as File | null;
    
    if (cedulaFile) {
      const buffer = Buffer.from(await cedulaFile.arrayBuffer());
      attachments.push({ filename: `cedula_${clientData.cedula}.${getExtension(cedulaFile.name)}`, content: buffer, contentType: cedulaFile.type });
      console.log('[IS EXPEDIENTE] Adjuntando cédula:', cedulaFile.name);
    }
    
    if (licenciaFile) {
      const buffer = Buffer.from(await licenciaFile.arrayBuffer());
      attachments.push({ filename: `licencia_${clientData.cedula}.${getExtension(licenciaFile.name)}`, content: buffer, contentType: licenciaFile.type });
      console.log('[IS EXPEDIENTE] Adjuntando licencia:', licenciaFile.name);
    }
    
    if (registroVehicularFile) {
      const buffer = Buffer.from(await registroVehicularFile.arrayBuffer());
      attachments.push({ filename: `registro_vehicular.${getExtension(registroVehicularFile.name)}`, content: buffer, contentType: registroVehicularFile.type });
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
    
    // Generate inspection PDF for ALL IS emissions (CC and DT)
    // IS requires the inspection form regardless of coverage type
    try {
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
        tieneExtras: inspectionData.tieneExtras ?? false,
        extrasSeleccionados: inspectionData.extrasSeleccionados || [],
        extrasDetalle: inspectionData.extrasDetalle || '',
        sumaAsegurada: quoteData.valorVehiculo
          ? Number(quoteData.valorVehiculo).toLocaleString('en-US', { minimumFractionDigits: 2 })
          : '0.00',
        valorVehiculo: quoteData.valorVehiculo?.toString() || '',
        aseguradoAnteriormente: vehicleData.aseguradoAnteriormente ?? false,
        aseguradoraAnterior: vehicleData.aseguradoraAnterior || '',
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
      // Continue without PDF - don't block the email
    }
    
    // Build email HTML
    const nombreCompleto = `${clientData.primerNombre || ''} ${clientData.segundoNombre || ''} ${clientData.primerApellido || ''} ${clientData.segundoApellido || ''}`.trim();
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
    });
    
    // Send email via PORTAL SMTP
    console.log('[IS EXPEDIENTE] Enviando correo...');
    const transport = getTransport('PORTAL');
    const fromAddress = getFromAddress('PORTAL');
    
    const mailResult = await transport.sendMail({
      from: fromAddress,
      to: recipients.join(', '),
      subject: `Expediente de Emisión - ${coberturaLabel} - ${nombreCompleto} - ${clientData.cedula}${nroPoliza ? ` - Póliza ${nroPoliza}` : ''}`,
      html: htmlBody,
      attachments: attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    });
    
    console.log('[IS EXPEDIENTE] ✅ Correo expediente enviado:', mailResult.messageId);
    
    // === ENVIAR RESUMEN Y BIENVENIDA AL CLIENTE ===
    const clientEmail = clientData.email;
    const primaTotal = quoteData.primaTotal || quoteData.valorVehiculo || 0;
    const vigenciaDesde = new Date().toLocaleDateString('es-PA');
    const vigenciaHasta = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toLocaleDateString('es-PA');
    
    // In dev: send welcome email to office for testing
    // In prod: send to real client email
    const welcomeRecipient = isDev ? OFFICE_EMAIL : (clientEmail || OFFICE_EMAIL);
    
    try {
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
        vigenciaDesde,
        vigenciaHasta,
        pdfUrl: (formData.get('pdfUrl') as string) || '',
        insurerName,
      });
      
      const welcomeSubject = `¡Bienvenido! Tu póliza ha sido emitida - ${coberturaLabel}${nroPoliza ? ` - Póliza ${nroPoliza}` : ''}`;
      
      // Send welcome email to client (or office in dev)
      const welcomeResult = await transport.sendMail({
        from: fromAddress,
        to: welcomeRecipient,
        subject: welcomeSubject,
        html: welcomeHtml,
      });
      console.log('[IS EXPEDIENTE] ✅ Bienvenida enviada a:', welcomeRecipient, welcomeResult.messageId);
      
      // In prod, also send copy to office
      if (!isDev && welcomeRecipient !== OFFICE_EMAIL) {
        await transport.sendMail({
          from: fromAddress,
          to: OFFICE_EMAIL,
          subject: `Confirmación de Emisión - ${nombreCompleto} - ${clientData.cedula}${nroPoliza ? ` - Póliza ${nroPoliza}` : ''}`,
          html: welcomeHtml,
        });
        console.log('[IS EXPEDIENTE] ✅ Copia de bienvenida enviada a oficina');
      }
    } catch (welcomeError: any) {
      console.error('[IS EXPEDIENTE] Error enviando bienvenida:', welcomeError.message);
    }
    
    return NextResponse.json({
      success: true,
      messageId: mailResult.messageId,
      recipients,
      attachmentCount: attachments.length,
      clientEmailSent: !!clientEmail,
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
}): string {
  const emergencyNumber = getInsurerEmergencyNumber(data.insurerName);
  const whatsappUrl = 'https://wa.me/14155238886';
  const whatsappNumber = '+1 (415) 523-8886';
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
    .emergency-card .phone { font-size: 26px; font-weight: 900; color: #010139; letter-spacing: 1px; }
    .emergency-card p { margin: 6px 0 0; font-size: 12px; color: #7d4e00; }

    /* WhatsApp card */
    .wa-card { background: #e8f5e9; border: 2px solid #43a047; border-radius: 12px; padding: 18px 20px; margin: 20px 0; display: flex; align-items: center; gap: 16px; }
    .wa-icon { flex-shrink: 0; width: 48px; height: 48px; background: #25D366; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .wa-text h4 { margin: 0 0 4px; color: #1b5e20; font-size: 15px; }
    .wa-text p { margin: 0; font-size: 13px; color: #2e7d32; line-height: 1.5; }
    .wa-text a { color: #1b5e20; font-weight: 700; }

    /* Services card */
    .services-card { background: linear-gradient(135deg, #f8faff, #eef2ff); border: 1px solid #c5cae9; border-radius: 12px; padding: 20px; margin: 20px 0; }
    .services-card h4 { margin: 0 0 12px; color: #010139; font-size: 15px; font-weight: 700; }
    .services-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .service-tag { background: #010139; color: white; padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }

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
        <div class="lbl">Prima Total Anual</div>
        <div class="amount">$${Number(data.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>` : ''}

      ${data.pdfUrl ? `
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
        <div class="wa-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </div>
        <div class="wa-text">
          <h4>Chatea con LISSA — Nuestra Asistente Virtual</h4>
          <p>¿Tiene dudas sobre su póliza, desea renovar, agregar coberturas o simplemente consultar algo? <strong>LISSA</strong> está disponible para asistirle en cualquier momento.<br>
          <a href="${whatsappUrl}" target="_blank">💬 Escribir por WhatsApp: ${whatsappNumber}</a></p>
        </div>
      </div>

      <!-- SERVICES -->
      <div class="services-card">
        <h4>🌟 En Líderes en Seguros le cubrimos en todo</h4>
        <p style="font-size:13px;color:#444;margin:0 0 14px;line-height:1.6;">
          Somos corredores de seguros con experiencia en <strong>todos los ramos</strong>. Estamos aquí para asesorarle, comparar opciones y encontrar la mejor cobertura para cada etapa de su vida y su negocio. ¡No espere a necesitarlo para contactarnos!
        </p>
        <div class="services-grid">
          <span class="service-tag">🚗 Auto</span>
          <span class="service-tag">❤️ Vida</span>
          <span class="service-tag">🏠 Incendio</span>
          <span class="service-tag">📦 Contenido</span>
          <span class="service-tag">⚖️ Responsabilidad Civil</span>
          <span class="service-tag">🏢 Empresas</span>
          <span class="service-tag">🏥 Salud</span>
          <span class="service-tag">✈️ Viajes</span>
          <span class="service-tag">⛵ Embarcaciones</span>
          <span class="service-tag">Y mucho más...</span>
        </div>
      </div>

      <!-- CONTACT -->
      <div class="contact-card">
        <p><strong>¿Alguna consulta, reclamo o novedad en su póliza?</strong></p>
        <p>Escríbanos a <a href="mailto:${contactEmail}">${contactEmail}</a> o contacte a LISSA por WhatsApp.<br>Siempre habrá alguien de nuestro equipo para atenderle.</p>
      </div>

    </div>

    <!-- FOOTER -->
    <div class="footer">
      <p><strong>Líderes en Seguros, S.A.</strong> — Corredores de Seguros Autorizados</p>
      <p style="margin-top:4px;">Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá</p>
      <p style="margin-top:4px;">
        <a href="mailto:${contactEmail}">${contactEmail}</a> &nbsp;|&nbsp;
        <a href="${whatsappUrl}">WhatsApp ${whatsappNumber}</a>
      </p>
      <p style="margin-top:8px;color:#ccc;">
        Correo generado automáticamente — ${new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}
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
