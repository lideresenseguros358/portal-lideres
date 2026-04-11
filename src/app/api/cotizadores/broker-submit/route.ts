import { NextRequest, NextResponse } from 'next/server';
import { sendZeptoEmail } from '@/lib/email/zepto-api';

// Recipient per product
const RECIPIENT: Record<string, string> = {
  vida:      'lucianieto@lideresenseguros.com',
  incendio:  'yiraramos@lideresenseguros.com',
  contenido: 'yiraramos@lideresenseguros.com',
};

const PRODUCT_LABEL: Record<string, string> = {
  vida:      'Seguro de Vida',
  incendio:  'Seguro de Incendio',
  contenido: 'Seguro de Contenido/Hogar',
};

// ── HTML email builder ────────────────────────────────────────────────────────

function section(title: string, rows: string[]): string {
  const filtered = rows.filter(Boolean);
  if (!filtered.length) return '';
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="background:#010139;color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:6px 6px 0 0;">
          ${title}
        </td>
      </tr>
      <tr>
        <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;padding:10px 12px;">
          ${filtered.map(r => `<p style="margin:3px 0;font-size:13px;color:#374151;">${r}</p>`).join('')}
        </td>
      </tr>
    </table>`;
}

function beneficiariosHtml(list: any[], title: string, admin: any | null): string {
  if (!list || list.length === 0) return '';
  const rows = list.map((b: any, i: number) => {
    const age = calcEdad(b.fechaNacimiento);
    return `<tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:5px 8px;font-size:12px;color:#374151;">${i + 1}. <strong>${b.nombre} ${b.apellido}</strong></td>
      <td style="padding:5px 8px;font-size:12px;color:#374151;">${b.cedula}</td>
      <td style="padding:5px 8px;font-size:12px;color:#374151;">${b.fechaNacimiento} (${age} años)${age < 18 ? ' ⚠️ Menor' : ''}</td>
      <td style="padding:5px 8px;font-size:12px;color:#374151;">${b.parentesco}</td>
      <td style="padding:5px 8px;font-size:12px;color:#374151;font-weight:700;">${b.porcentaje}%</td>
    </tr>`;
  });
  const total = list.reduce((s: number, b: any) => s + (parseFloat(b.porcentaje) || 0), 0);

  let adminHtml = '';
  if (admin) {
    const adm = admin.esExistente
      ? `${list[admin.beneficiarioIdx]?.nombre || ''} ${list[admin.beneficiarioIdx]?.apellido || ''} (beneficiario existente #${(admin.beneficiarioIdx ?? 0) + 1})`
      : `${admin.nombre} ${admin.apellido} — Cédula: ${admin.cedula} — Nacimiento: ${admin.fechaNacimiento}`;
    adminHtml = `<p style="margin:8px 0 0;font-size:12px;color:#b45309;"><strong>Administrador de menores:</strong> ${adm}</p>`;
  }

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
      <tr>
        <td style="background:#010139;color:#fff;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:6px 12px;border-radius:6px 6px 0 0;">
          ${title}
        </td>
      </tr>
      <tr>
        <td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 6px 6px;padding:10px 12px;">
          <table width="100%" style="border-collapse:collapse;">
            <thead>
              <tr style="background:#e5e7eb;">
                <th style="padding:4px 8px;font-size:11px;text-align:left;">Nombre</th>
                <th style="padding:4px 8px;font-size:11px;text-align:left;">Cédula</th>
                <th style="padding:4px 8px;font-size:11px;text-align:left;">Nacimiento / Edad</th>
                <th style="padding:4px 8px;font-size:11px;text-align:left;">Parentesco</th>
                <th style="padding:4px 8px;font-size:11px;text-align:left;">%</th>
              </tr>
            </thead>
            <tbody>${rows.join('')}</tbody>
          </table>
          <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">Total asignado: <strong>${total}%</strong></p>
          ${adminHtml}
        </td>
      </tr>
    </table>`;
}

function calcEdad(fechaNacimiento: string): number {
  if (!fechaNacimiento) return 0;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function buildEmailHtml(body: {
  product: string;
  productLabel: string;
  brokerName: string;
  wizardData: any;
  brokerData: any;
}): string {
  const { productLabel, brokerName, wizardData, brokerData, product } = body;

  // Payment method section
  let pagoSection = '';
  if (brokerData.formaPago === 'ach') {
    pagoSection = section('Forma de Pago', ['Método: ACH (archivo adjunto)']);
  } else if (brokerData.formaPago === 'tcr') {
    pagoSection = section('Forma de Pago — Tarjeta de Crédito (TCR)', [
      `Método: Tarjeta de Crédito`,
      `Número: ${brokerData.tcrNumero || '—'}`,
      `Titular: ${wizardData?.clientName || '—'}`,
      `Banco: ${brokerData.tcrBanco || '—'}`,
      `Tipo: ${brokerData.tcrTipo === 'visa' ? 'Visa' : brokerData.tcrTipo === 'mastercard' ? 'Mastercard' : '—'}`,
      `Código seguridad: ${brokerData.tcrCodigo || '—'}`,
    ]);
  } else if (brokerData.formaPago === 'descuento_salario') {
    pagoSection = section('Forma de Pago', ['Método: Descuento de Salario (archivo adjunto)']);
  }

  // Wizard-specific sections
  let wizardSections = '';
  if (product === 'vida' && wizardData) {
    const w = wizardData;
    wizardSections = [
      section('Datos Personales', [
        `Nombre: <strong>${w.nombre} ${w.apellido}</strong>`,
        `Sexo: ${w.sexo === 'M' ? 'Masculino' : w.sexo === 'F' ? 'Femenino' : '—'}`,
        `Fecha de nacimiento: ${w.fechaNacimiento} (${w.edad} años)`,
        `Celular: ${w.celular}`,
        `Correo: ${w.correo}`,
        `Nacionalidad: ${w.nacionalidad}`,
      ]),
      section('Trabajo e Ingresos', [
        `Ocupación: ${w.ocupacion}`,
        `Lugar de trabajo: ${w.lugarTrabajo}`,
        `Funciones: ${w.funcionesTrabajo}`,
        `Salario mensual: $${w.salarioMensual}`,
      ]),
      section('Dirección Residencial', [
        `Provincia: ${w.provincia}`,
        `Distrito: ${w.distrito}`,
        `Corregimiento: ${w.corregimiento}`,
        w.barriada ? `Barriada: ${w.barriada}` : '',
        w.referencias ? `Referencias: ${w.referencias}` : '',
      ]),
      section('Datos Físicos y Salud', [
        `Altura: ${w.altura} m`,
        `Peso: ${w.peso} lbs`,
        `¿Enfermedad/condición?: ${w.tieneEnfermedad ? `Sí — ${w.descripcionEnfermedad}` : 'No'}`,
        `¿Fumador?: ${!w.haFumadoAlgunaVez ? 'Nunca' : (w.fumaActualmente ? 'Sí, actualmente' : `No — Dejó: ${w.ultimaVezFumo}`)}`,
      ]),
      section('Cobertura y Objetivo', [
        `¿Tiene seguro de vida?: ${w.tieneSeguroVida ? `Sí — ${w.companiaSeguroActual}` : 'No'}`,
        w.tieneSeguroVida ? `Suma asegurada actual: $${w.sumaAseguradaActual}` : '',
        `¿Para cubrir hipoteca?: ${w.esCubrirHipoteca ? `Sí — ${w.aniosHipoteca} años` : 'No'}`,
        `Suma asegurada solicitada: <strong>$${w.sumaAseguradaSolicitada}</strong>`,
      ]),
      section('Tipo de Propuesta', [
        `Propuesta: ${w.tiposPropuesta?.join(', ') || '—'}`,
      ]),
    ].join('');
  } else if ((product === 'incendio' || product === 'contenido') && wizardData) {
    const w = wizardData;
    const valorLabel = product === 'incendio' ? 'Valor del Bien (Estructura)' : 'Valor del Contenido';
    const valorVal = product === 'incendio' ? w.valorBien : w.valorContenido;
    wizardSections = [
      section('Datos del Cliente', [
        `Nombre: <strong>${w.nombre} ${w.apellido}</strong>`,
        `Fecha de nacimiento: ${w.fechaNacimiento} (${w.edad} años)`,
        `Celular: ${w.celular}`,
        `Correo: ${w.correo}`,
      ]),
      section('Dirección Residencial', [
        `Provincia: ${w.provincia}`,
        `Distrito: ${w.distrito}`,
        `Corregimiento: ${w.corregimiento}`,
        w.barriada ? `Barriada: ${w.barriada}` : '',
        `Tipo de vivienda: ${w.tipoVivienda === 'casa' ? 'Casa' : 'Apartamento'}`,
        w.tipoVivienda === 'casa' ? `Calle: ${w.calle}, N° ${w.numeroCasa}` : '',
        w.tipoVivienda === 'apartamento' ? `Edificio: ${w.nombreEdificio}, Piso: ${w.piso}, Apto: ${w.numeroApto}` : '',
      ]),
      section('Medidas de Seguridad', (w.seguridad || []).map((s: string) => `• ${s}`)),
      section(valorLabel, [
        `Valor estimado: <strong>$${valorVal}</strong>`,
        ...(product === 'contenido' && w.articulosAltoValor?.length
          ? ['', '<strong>Artículos de alto valor:</strong>',
              ...w.articulosAltoValor.map((a: any, i: number) => `${i + 1}. ${a.descripcion} — $${a.valor}`)]
          : []),
      ]),
    ].join('');
  }

  // Beneficiarios (vida only)
  const benHtml = product === 'vida'
    ? beneficiariosHtml(brokerData.beneficiarios || [], 'Beneficiarios Principales', brokerData.adminBeneficiario)
      + beneficiariosHtml(brokerData.contingentes || [], 'Beneficiarios Contingentes', brokerData.adminContingente)
    : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;margin:0;padding:20px;">
  <table width="100%" maxWidth="700" cellpadding="0" cellspacing="0" style="max-width:700px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,.10);overflow:hidden;">

    <!-- Header -->
    <tr>
      <td style="background:linear-gradient(135deg,#010139,#020270);padding:28px 32px;">
        <p style="margin:0;color:rgba(255,255,255,.65);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Portal Líderes en Seguros · Broker</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:22px;">📋 Solicitud: ${productLabel}</h1>
        <p style="margin:6px 0 0;color:rgba(255,255,255,.75);font-size:13px;">Enviado el ${new Date().toLocaleString('es-PA')}</p>
      </td>
    </tr>

    <!-- Broker badge -->
    <tr>
      <td style="background:#8AAA19;padding:8px 32px;">
        <p style="margin:0;color:#fff;font-size:13px;">🤝 <strong>Broker:</strong> ${brokerName || 'Sin nombre'}</p>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding:28px 32px;">

        ${wizardSections}
        ${pagoSection}
        ${benHtml}
        ${section('Documentos Adjuntos', [
          brokerData.archivoCedula ? `✅ Cédula adjunta: ${brokerData.archivoCedula.name || 'cedula'}` : '❌ Cédula: no adjuntada',
          brokerData.archivoCotizacion ? `✅ Cotización adjunta: ${brokerData.archivoCotizacion.name || 'cotizacion'}` : '❌ Cotización: no adjuntada',
          brokerData.archivoPago ? `✅ Comprobante de pago adjunto: ${brokerData.archivoPago.name || 'pago'}` : 'ℹ️ Comprobante de pago: no adjuntado (opcional)',
          brokerData.formaPago === 'ach' && brokerData.archivoACH ? `✅ Archivo ACH adjunto: ${brokerData.archivoACH.name || 'ach'}` : '',
          brokerData.formaPago === 'descuento_salario' && brokerData.archivoDescuento ? `✅ Descuento de salario adjunto: ${brokerData.archivoDescuento.name || 'descuento'}` : '',
        ])}

      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;">Este correo fue generado automáticamente por el Portal de Líderes en Seguros</p>
      </td>
    </tr>

  </table>
</body>
</html>`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product, brokerName, wizardData, brokerData, attachments } = body;

    if (!product || !RECIPIENT[product]) {
      return NextResponse.json({ error: 'Producto inválido' }, { status: 400 });
    }
    if (!brokerData) {
      return NextResponse.json({ error: 'Faltan datos del broker' }, { status: 400 });
    }

    const productLabel = PRODUCT_LABEL[product] || product;
    const clientName = wizardData?.clientName || wizardData?.nombre || '';
    const subject = `📋 Solicitud Broker — ${productLabel} — ${clientName} — ${new Date().toLocaleDateString('es-PA')}`;

    const htmlBody = buildEmailHtml({ product, productLabel, brokerName: brokerName || '', wizardData, brokerData });

    // Build attachment list: all base64 files (ACH, descuento, cédula, cotización, pago)
    const zeptoAttachments = (attachments || [])
      .filter((a: any) => a?.base64 && a?.name)
      .map((a: any) => ({
        content: a.base64,
        mime_type: a.mimeType || 'application/octet-stream',
        name: a.name,
      }));

    const result = await sendZeptoEmail({
      to: RECIPIENT[product],
      subject,
      htmlBody,
      attachments: zeptoAttachments,
      replyTo: wizardData?.correo || undefined,
    });

    if (!result.success) {
      console.error('[broker-submit] Zepto error:', result.error);
      return NextResponse.json({ error: result.error || 'Error al enviar correo' }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
  } catch (err: any) {
    console.error('[broker-submit] Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
