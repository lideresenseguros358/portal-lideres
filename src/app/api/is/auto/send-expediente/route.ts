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
    
    // Generate inspection PDF (only for CC)
    if (isCC) {
      try {
        const nombreCompleto = `${clientData.primerNombre || ''} ${clientData.segundoNombre || ''} ${clientData.primerApellido || ''} ${clientData.segundoApellido || ''}`.trim();
        
        const pdfData = {
          propietario: nombreCompleto,
          direccion: clientData.direccion || '',
          cedula: clientData.cedula || '',
          telefonos: `${clientData.telefono || ''} / ${clientData.celular || ''}`,
          color: vehicleData.color || '',
          placa: vehicleData.placa || '',
          anio: quoteData.anio?.toString() || quoteData.anno?.toString() || '',
          tipo: quoteData.tipoVehiculo || 'SEDAN',
          marca: quoteData.marca || '',
          modelo: quoteData.modelo || '',
          motor: vehicleData.motor || '',
          chasis: vehicleData.vinChasis || '',
          kilometraje: vehicleData.kilometraje || '',
          pasajeros: vehicleData.pasajeros?.toString() || '5',
          tipoCombustible: vehicleData.tipoCombustible || 'GASOLINA',
          tipoTransmision: vehicleData.tipoTransmision || 'AUTOMATICO',
          buenEstadoFisico: inspectionData.buenEstadoFisico ?? true,
          tieneExtras: inspectionData.tieneExtras ?? false,
          extrasSeleccionados: inspectionData.extrasSeleccionados || [],
          extrasDetalle: inspectionData.extrasDetalle || '',
          sumaAsegurada: quoteData.valorVehiculo?.toLocaleString('en-US') || '0',
          valorVehiculo: quoteData.valorVehiculo?.toString() || '',
          aseguradoAnteriormente: vehicleData.aseguradoAnteriormente ?? false,
          aseguradoraAnterior: vehicleData.aseguradoraAnterior || '',
          firmaDataUrl: firmaDataUrl || '',
          fecha: new Date().toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        };
        
        console.log('[IS EXPEDIENTE] Generando PDF de inspección...');
        const pdfBuffer = await generateInspectionPdf(pdfData);
        attachments.push({
          filename: `formulario_inspeccion_${clientData.cedula}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        });
        console.log('[IS EXPEDIENTE] PDF de inspección generado:', pdfBuffer.length, 'bytes');
      } catch (pdfError: any) {
        console.error('[IS EXPEDIENTE] Error generando PDF de inspección:', pdfError);
        // Continue without PDF - don't block the email
      }
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
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #010139, #020270); color: white; padding: 30px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
    .success-badge { display: inline-block; background: #8AAA19; color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: bold; margin-top: 12px; }
    .poliza-box { background: #f0f4e0; border: 2px solid #8AAA19; border-radius: 10px; padding: 16px; margin: 20px 24px; text-align: center; }
    .poliza-box .label { font-size: 12px; color: #666; text-transform: uppercase; font-weight: bold; }
    .poliza-box .number { font-size: 28px; font-weight: 800; color: #010139; margin-top: 4px; }
    .content { padding: 0 24px 24px; }
    .section { margin-bottom: 16px; }
    .section h3 { color: #010139; font-size: 15px; border-bottom: 2px solid #8AAA19; padding-bottom: 6px; margin-bottom: 10px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    .row .label { color: #666; }
    .row .value { font-weight: 600; color: #333; }
    .prima-box { background: #010139; color: white; padding: 16px; border-radius: 10px; text-align: center; margin: 16px 0; }
    .prima-box .amount { font-size: 28px; font-weight: 800; color: #8AAA19; }
    .prima-box .label { font-size: 12px; opacity: 0.8; }
    .btn { display: inline-block; background: #8AAA19; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; margin-top: 16px; }
    .footer { background: #f8f8f8; padding: 16px 24px; text-align: center; font-size: 11px; color: #999; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Líderes en Seguros</h1>
      <p>Carátula de Póliza</p>
      <div class="success-badge">✓ Póliza Emitida Exitosamente</div>
    </div>
    
    <div style="padding: 20px 24px 0; font-size: 15px; color: #333;">
      <p>Estimado/a <strong>${data.nombreCompleto}</strong>,</p>
      <p>Nos complace informarle que su póliza de seguro ha sido emitida exitosamente. A continuación encontrará los detalles de su cobertura.</p>
    </div>
    
    ${data.nroPoliza ? `
    <div class="poliza-box">
      <div class="label">Número de Póliza</div>
      <div class="number">${data.nroPoliza}</div>
    </div>` : ''}
    
    <div class="content">
      <div class="section">
        <h3>Información General</h3>
        <div class="row"><span class="label">Aseguradora:</span><span class="value">${data.insurerName}</span></div>
        <div class="row"><span class="label">Cobertura:</span><span class="value">${data.cobertura}</span></div>
        <div class="row"><span class="label">Vigencia:</span><span class="value">${data.vigenciaDesde} al ${data.vigenciaHasta}</span></div>
      </div>
      
      <div class="section">
        <h3>Datos del Asegurado</h3>
        <div class="row"><span class="label">Nombre:</span><span class="value">${data.nombreCompleto}</span></div>
        <div class="row"><span class="label">Identificación:</span><span class="value">${data.cedula}</span></div>
      </div>
      
      <div class="section">
        <h3>Datos del Vehículo</h3>
        <div class="row"><span class="label">Vehículo:</span><span class="value">${data.marca} ${data.modelo} ${data.anio}</span></div>
        ${data.placa ? `<div class="row"><span class="label">Placa:</span><span class="value">${data.placa}</span></div>` : ''}
      </div>
      
      ${data.primaTotal ? `
      <div class="prima-box">
        <div class="label">Prima Total Anual</div>
        <div class="amount">$${Number(data.primaTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>` : ''}
      
      ${data.pdfUrl ? `
      <div style="text-align:center;margin-top:20px;">
        <a href="${data.pdfUrl}" class="btn">Descargar Póliza Oficial</a>
        <p style="font-size:11px;color:#999;margin-top:8px;">Enlace al documento oficial de la aseguradora</p>
      </div>` : ''}
    </div>
    
    <div class="footer">
      <p>Documento generado por Líderes en Seguros, S.A. — ${new Date().toLocaleDateString('es-PA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      <p style="margin-top:4px;">Este es un correo informativo. La póliza oficial es emitida por ${data.insurerName}.</p>
      <p style="margin-top:4px;">Si tiene alguna consulta, no dude en contactarnos.</p>
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
