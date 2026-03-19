/**
 * LISSA KNOWLEDGE BASE — Cerebro completo de Lissa
 * ==================================================
 * Este archivo define TODO el conocimiento institucional que Lissa
 * necesita para responder cualquier consulta sobre:
 * - Líderes en Seguros como empresa
 * - El portal y sus módulos (con URLs exactas)
 * - Aseguradoras activas en Panamá y sus números de asistencia
 * - Ramos de seguros disponibles
 * - Horarios y enrutamiento por especialidad
 */

// ─────────────────────────────────────────────────────────────
// PORTAL BASE URL
// ─────────────────────────────────────────────────────────────
export const PORTAL_BASE = 'https://portal.lideresenseguros.com';

// ─────────────────────────────────────────────────────────────
// ASEGURADORAS ACTIVAS EN PANAMÁ — Con números de asistencia
// ─────────────────────────────────────────────────────────────
export const INSURERS_PANAMA = [
  {
    name: 'ASSA Compañía de Seguros',
    keywords: ['assa'],
    emergency: '800-2772',
    customerService: '300-0999',
    website: 'https://www.assaseguros.com',
  },
  {
    name: 'FEDPA Seguros',
    keywords: ['fedpa'],
    emergency: '800-3732',
    customerService: '302-0900',
    website: 'https://www.fedpa.com.pa',
  },
  {
    name: 'Internacional de Seguros',
    keywords: ['internacional', 'iseguros'],
    emergency: '800-4600',
    customerService: '302-3000',
    website: 'https://www.iseguros.com',
  },
  {
    name: 'MAPFRE Panamá',
    keywords: ['mapfre'],
    emergency: '800-6273',
    customerService: '300-6273',
    website: 'https://www.mapfre.com.pa',
  },
  {
    name: 'Seguros SURA',
    keywords: ['sura'],
    emergency: '800-7872',
    customerService: '300-7872',
    website: 'https://www.segurossura.com.pa',
  },
  {
    name: 'General de Seguros',
    keywords: ['general de seguros'],
    emergency: '800-0155',
    customerService: '265-7155',
    website: 'https://www.generalseguros.com',
  },
  {
    name: 'Seguros Ancón',
    keywords: ['ancón', 'ancon', 'seguros ancon'],
    emergency: '800-2626',
    customerService: '210-1200',
    website: 'https://www.segurosaancon.com',
  },
  {
    name: 'Mundial de Seguros',
    keywords: ['mundial'],
    emergency: '800-6200',
    customerService: '300-6200',
    website: 'https://www.mundialseguros.com.pa',
  },
  {
    name: 'Pan-American Life Insurance',
    keywords: ['pan american', 'pan-american', 'palic'],
    emergency: '800-0800',
    customerService: '265-8311',
    website: 'https://www.palic.com',
  },
  {
    name: 'Banistmo Seguros',
    keywords: ['banistmo'],
    emergency: '800-5050',
    customerService: '800-5050',
    website: 'https://www.banistmoseguros.com',
  },
  {
    name: 'Sagicor',
    keywords: ['sagicor'],
    emergency: '340-8080',
    customerService: '340-8080',
    website: 'https://www.sagicor.com.pa',
  },
];

/**
 * Get insurer emergency number by insurer name (for welcome email)
 */
export function getEmergencyNumber(insurerName: string): string {
  const lower = (insurerName || '').toLowerCase();
  for (const ins of INSURERS_PANAMA) {
    if (ins.keywords.some(k => lower.includes(k))) return ins.emergency;
  }
  return '800-4600'; // Default: Internacional
}

// ─────────────────────────────────────────────────────────────
// PORTAL MODULES — URLs exactas para que Lissa pueda enlazar
// ─────────────────────────────────────────────────────────────
export const PORTAL_MODULES = {
  dashboard:        { label: 'Dashboard / Inicio',              url: `${PORTAL_BASE}/dashboard` },
  cotizadores:      { label: 'Cotizadores',                     url: `${PORTAL_BASE}/cotizadores` },
  cotizarDT:        { label: 'Cotizar Daños a Terceros',        url: `${PORTAL_BASE}/cotizadores/third-party` },
  cotizarCC:        { label: 'Cotizar Cobertura Completa',      url: `${PORTAL_BASE}/cotizadores/auto` },
  comisiones:       { label: 'Mis Comisiones',                  url: `${PORTAL_BASE}/commissions` },
  clientes:         { label: 'Base de Datos / Clientes',        url: `${PORTAL_BASE}/db` },
  polizas:          { label: 'Pólizas',                         url: `${PORTAL_BASE}/db` },
  produccion:       { label: 'Producción / Analíticas',         url: `${PORTAL_BASE}/production` },
  agenda:           { label: 'Agenda / Calendario',             url: `${PORTAL_BASE}/agenda` },
  pendientes:       { label: 'Pendientes / Sin Identificar',    url: `${PORTAL_BASE}/pendientes` },
  descargas:        { label: 'Descargas / Formularios',         url: `${PORTAL_BASE}/downloads` },
  guias:            { label: 'Guía para Agentes / Capacitación',url: `${PORTAL_BASE}/guides` },
  aseguradoras:     { label: 'Aseguradoras',                    url: `${PORTAL_BASE}/insurers` },
  casos:            { label: 'Casos / Renovaciones',            url: `${PORTAL_BASE}/cases` },
  renovaciones:     { label: 'Renovaciones con Lissa',          url: `${PORTAL_BASE}/renovaciones-lissa` },
  brokers:          { label: 'Corredores / Agentes',            url: `${PORTAL_BASE}/brokers` },
  solicitudes:      { label: 'Solicitudes',                     url: `${PORTAL_BASE}/requests` },
  delinquency:      { label: 'Morosidad',                       url: `${PORTAL_BASE}/delinquency` },
  admin:            { label: 'Administración',                  url: `${PORTAL_BASE}/admin` },
  cuenta:           { label: 'Mi Cuenta',                       url: `${PORTAL_BASE}/account` },
};

// ─────────────────────────────────────────────────────────────
// RAMOS DE SEGUROS
// ─────────────────────────────────────────────────────────────
export const RAMOS = {
  personas: {
    label: 'Ramos de Personas',
    description: 'Pólizas que cubren directamente a personas',
    types: ['Vida', 'Accidentes Personales', 'Salud / Médico', 'Hospitalización', 'Vida Deudor'],
    specialist: 'lucianieto@lideresenseguros.com',
    specialistName: 'Lucía Nieto',
    keywords: ['vida', 'accidente personal', 'accidentes personales', 'salud', 'medico', 'médico', 'hospitalización', 'hospitalizacion', 'vida deudor', 'ramo personas', 'seguro de vida', 'seguro de salud'],
  },
  generales: {
    label: 'Ramos Generales',
    description: 'Pólizas de bienes, responsabilidad y otros',
    types: ['Auto (Cobertura Completa)', 'Auto (Daños a Terceros)', 'Incendio', 'Contenido', 'Responsabilidad Civil', 'Empresas', 'Transporte', 'Embarcaciones', 'Viajes', 'Fianzas'],
    specialist: 'yiraramos@lideresenseguros.com',
    specialistName: 'Yira Ramos',
    keywords: ['auto', 'carro', 'vehiculo', 'vehículo', 'incendio', 'contenido', 'responsabilidad civil', 'empresa', 'transporte', 'embarcacion', 'embarcación', 'viaje', 'fianza', 'daños a terceros', 'cobertura completa'],
  },
};

/**
 * Detect ramo from message text
 */
export function detectRamo(message: string): 'personas' | 'generales' | null {
  const lower = message.toLowerCase();
  for (const kw of RAMOS.personas.keywords) {
    if (lower.includes(kw)) return 'personas';
  }
  for (const kw of RAMOS.generales.keywords) {
    if (lower.includes(kw)) return 'generales';
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// HORARIOS DE ATENCIÓN
// ─────────────────────────────────────────────────────────────
export const OFFICE_HOURS = {
  normal: 'Lunes a Viernes de 9:00 AM a 5:00 PM (hora de Panamá)',
  note: 'Los horarios pueden variar en días feriados o días de oficina virtual. Verifique la agenda del portal.',
  timezone: 'America/Panama',
};

// ─────────────────────────────────────────────────────────────
// EMPRESA — Líderes en Seguros
// ─────────────────────────────────────────────────────────────
export const COMPANY_INFO = {
  name: 'Líderes en Seguros, S.A.',
  type: 'Correduría de Seguros Autorizada',
  regulatory: 'Regulada y supervisada por la Superintendencia de Seguros y Reaseguros de Panamá',
  email: 'contacto@lideresenseguros.com',
  phone: '223-2373',
  whatsapp: '+507 6833-9167',
  whatsappUrl: 'https://wa.me/50768339167',
  portalUrl: PORTAL_BASE,
  specialties: [
    'Seguros de Auto (Cobertura Completa y Daños a Terceros)',
    'Seguros de Vida',
    'Seguros de Salud / Médico',
    'Accidentes Personales',
    'Seguros de Incendio',
    'Seguros de Contenido',
    'Responsabilidad Civil',
    'Seguros para Empresas',
    'Seguros de Transporte',
    'Seguros de Viajes',
    'Embarcaciones',
    'Fianzas',
  ],
  description: 'Somos una correduría de seguros con presencia en Panamá. Trabajamos con las principales aseguradoras del país para ofrecerle las mejores opciones en todos los ramos. Nuestro equipo de corredores certificados está disponible para asesorarle, comparar opciones y encontrar la cobertura ideal para cada necesidad.',
};

// ─────────────────────────────────────────────────────────────
// PORTAL — Guía de uso para corredores / agentes
// ─────────────────────────────────────────────────────────────
export const PORTAL_GUIDE = `
GUÍA DEL PORTAL LÍDERES EN SEGUROS (${PORTAL_BASE}):

📊 DASHBOARD (${PORTAL_BASE}/dashboard)
- Resumen de producción, comisiones y actividad reciente del corredor.
- Acceso rápido a todos los módulos.

💰 COMISIONES (${PORTAL_BASE}/commissions)
- Ver comisiones generadas, pendientes y pagadas.
- Historial por quincena con desglose detallado.
- Exportar reportes de comisiones.
- Ver anticipos y descuentos aplicados.

👥 BASE DE DATOS / CLIENTES (${PORTAL_BASE}/db)
- Registrar nuevos clientes.
- Ver y editar clientes existentes y sus pólizas.
- Los clientes en estado "Preliminar" tienen datos incompletos — deben actualizarse con nombre, cédula y datos de contacto completos para formalizarlos en la base de datos.
- Buscar clientes por nombre, cédula, email o número de póliza.

⚠️ PENDIENTES / SIN IDENTIFICAR (${PORTAL_BASE}/pendientes)
- Muestra registros de comisiones o pólizas que no pudieron ser asignados automáticamente a un cliente.
- El corredor debe revisar y asignar manualmente cada pendiente.
- También llamados "sin identificar" — registros que requieren atención.

📥 DESCARGAS / FORMULARIOS (${PORTAL_BASE}/downloads)
- Formularios oficiales de aseguradoras para descarga directa.
- Documentos de solicitud, inspección, reclamos, etc.
- Organizados por aseguradora y tipo de ramo.

📚 GUÍA PARA AGENTES / CAPACITACIÓN (${PORTAL_BASE}/guides)
- Módulos de capacitación para corredores.
- Videos, tutoriales y material educativo.
- Información sobre productos y procesos.

📅 AGENDA (${PORTAL_BASE}/agenda)
- Calendario con eventos, reuniones y capacitaciones.
- Eventos de oficina cerrada y oficina virtual.
- Confirmación de asistencia (RSVP) a eventos.

🚗 COTIZADORES (${PORTAL_BASE}/cotizadores)
- Cotizar seguro de auto: Daños a Terceros y Cobertura Completa.
- Comparar planes de FEDPA e Internacional de Seguros.
- Emitir pólizas directamente desde el portal.

📈 PRODUCCIÓN (${PORTAL_BASE}/production)
- Estadísticas de producción por corredor, aseguradora y ramo.
- Gráficas de YTD (año a la fecha) y comparativas.

📋 CASOS / RENOVACIONES (${PORTAL_BASE}/cases)
- Gestión de casos de clientes: renovaciones, modificaciones, reclamos.
- Seguimiento de casos abiertos y cerrados.

🏢 ASEGURADORAS (${PORTAL_BASE}/insurers)
- Directorio completo de aseguradoras con contactos.
- Teléfonos de emergencia y servicio al cliente.
`;

// ─────────────────────────────────────────────────────────────
// CLIENTE PRELIMINAR — Explicación
// ─────────────────────────────────────────────────────────────
export const CLIENTE_PRELIMINAR_EXPLANATION = `
Un cliente en estado "Preliminar" es aquel que fue creado automáticamente por el sistema al importar datos de comisiones o pólizas, pero cuya información está incompleta o no verificada.

Para formalizarlo como cliente en la base de datos oficial, el corredor debe:
1. Ir a la Base de Datos (${PORTAL_BASE}/db)
2. Buscar al cliente con estado "Preliminar"
3. Completar todos sus datos: nombre completo, número de cédula/RUC, email, teléfono, dirección
4. Guardar los cambios — el cliente pasa a estado "Activo"

Los clientes preliminares aparecen marcados visualmente en la base de datos para fácil identificación.
`;

// ─────────────────────────────────────────────────────────────
// TEXTO DEL SISTEMA COMPLETO — Para inyectar en el SYSTEM_PROMPT
// ─────────────────────────────────────────────────────────────
export function buildInstitutionalKnowledge(): string {
  const insurerList = INSURERS_PANAMA.map(i =>
    `- ${i.name}: Emergencias ${i.emergency} | Servicio al Cliente ${i.customerService}`
  ).join('\n');

  const ramosList = [
    `RAMOS DE PERSONAS (especialista: ${RAMOS.personas.specialistName} — ${RAMOS.personas.specialist}):`,
    RAMOS.personas.types.join(', '),
    '',
    `RAMOS GENERALES (especialista: ${RAMOS.generales.specialistName} — ${RAMOS.generales.specialist}):`,
    RAMOS.generales.types.join(', '),
  ].join('\n');

  return `
════════════════════════════════════════════════════════
CONOCIMIENTO INSTITUCIONAL COMPLETO — LÍDERES EN SEGUROS
════════════════════════════════════════════════════════

## SOBRE LA EMPRESA
${COMPANY_INFO.name} — ${COMPANY_INFO.type}
${COMPANY_INFO.description}
${COMPANY_INFO.regulatory}

Contacto:
- Email: ${COMPANY_INFO.email}
- Teléfono: ${COMPANY_INFO.phone}
- WhatsApp Lissa: ${COMPANY_INFO.whatsapp} → ${COMPANY_INFO.whatsappUrl}
- Portal: ${COMPANY_INFO.portalUrl}

Ramos que manejamos: ${COMPANY_INFO.specialties.join(', ')}.

## HORARIOS DE ATENCIÓN
${OFFICE_HOURS.normal}
IMPORTANTE: ${OFFICE_HOURS.note}

## ASEGURADORAS ACTIVAS EN PANAMÁ (con números de asistencia)
${insurerList}

## RAMOS Y ESPECIALISTAS
${ramosList}

## ENRUTAMIENTO POR RAMO
- Si la consulta es de RAMOS DE PERSONAS (vida, salud, accidentes personales): 
  → Redirigir a lucianieto@lideresenseguros.com (Lucía Nieto)
- Si la consulta es de RAMOS GENERALES (auto, incendio, contenido, RC, empresas, etc.):
  → Redirigir a yiraramos@lideresenseguros.com (Yira Ramos)
- En ambos casos, recordar el horario: Lunes a Viernes 9:00 AM – 5:00 PM (Panamá)
  (verificar en la agenda si hay día feriado, oficina cerrada o virtual ese día)

## PORTAL — MÓDULOS Y URLS
${PORTAL_GUIDE}

## CLIENTES PRELIMINARES
${CLIENTE_PRELIMINAR_EXPLANATION}
`.trim();
}
