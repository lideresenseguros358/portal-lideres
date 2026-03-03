/**
 * VERTEX AI — PENDIENTES CLASSIFIER
 * ====================================
 * Enhanced classification for the Pendientes module (tramites@).
 *
 * Extends the base Vertex AI client to produce a richer JSON schema:
 *   - case_type (emision, reclamo, modificacion, etc.)
 *   - ramo, aseguradora, priority
 *   - ticket_required + exception rules (ASSA Vida Regular, ASSA Salud)
 *   - suggested_status + confidence
 *   - policy_number extraction
 *   - attachments detected / missing_expected
 *   - detected_entities (client_name, cedula, email)
 *   - rationale + evidence
 *
 * Confidence thresholds:
 *   >= 0.80  → auto-apply status
 *   <  0.80  → suggest only (manual approval)
 */

import { GoogleAuth } from 'google-auth-library';

// ══════════════════════════════════════════
// INPUT / OUTPUT TYPES
// ══════════════════════════════════════════

export interface PendientesClassificationInput {
  subject: string;
  body_text: string | null;
  from_email: string;
  cc_emails: string[];
  attachments_summary: string;
  /** Full thread context (previous messages) for status suggestion */
  thread_context?: string | null;
}

export interface PendientesClassificationResult {
  should_create_case: boolean;
  ticket_required: boolean;
  ticket_exception_reason: 'ASSA_VIDA_REGULAR' | 'ASSA_SALUD' | null;

  case_type: 'emision' | 'reclamo' | 'modificacion' | 'cambio_corredor' | 'cotizacion' | 'cancelacion' | 'rehabilitacion' | 'otro';
  ramo: 'vida' | 'auto' | 'incendio' | 'salud' | 'hogar' | 'generales' | 'otro';
  aseguradora: string; // 'ASSA' | 'FEDPA' | 'Internacional' | etc.

  priority: 'alta' | 'media' | 'baja';
  suggested_status: 'pendiente' | 'en_proceso' | 'en_espera_cliente' | 'en_espera_aseguradora' | 'emitido' | 'cerrado' | 'rechazado' | 'aplazado';
  status_confidence: number; // 0.0 - 1.0

  policy_number: string | null;
  policy_number_confidence: number; // 0.0 - 1.0

  detected_entities: {
    client_name: string | null;
    cedula: string | null;
    email: string | null;
  };

  attachments: {
    has_attachments: boolean;
    detected: string[]; // e.g. ['cedula','formulario','pago']
    missing_expected: string[];
    notes: string;
  };

  rationale: string; // 1-3 lines
  evidence: {
    matched_terms: string[];
    message_id: string | null;
  };

  // Pass-through from base classifier for backward compat
  ramo_bucket: 'vida_assa' | 'ramos_generales' | 'ramo_personas' | 'desconocido';
  confidence: number;
  broker_email_detected: string | null;
}

// ══════════════════════════════════════════
// MAIN FUNCTION
// ══════════════════════════════════════════

export async function classifyPendientesEmail(
  input: PendientesClassificationInput,
): Promise<PendientesClassificationResult> {
  // Feature flag
  if (process.env.FEATURE_ENABLE_VERTEX !== 'true') {
    console.log('[PEND-VERTEX] AI classification disabled by feature flag');
    return buildFallback('AI classification disabled');
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_EMAIL || 'gemini-1.5-flash';

  if (!projectId) {
    console.error('[PEND-VERTEX] GOOGLE_CLOUD_PROJECT_ID not configured');
    return buildFallback('Missing GCP project ID');
  }

  try {
    const auth = createAuthClient();
    const client = await auth.getClient();

    const prompt = buildPendientesPrompt(input);
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 10,
          maxOutputTokens: 2048,
        },
      },
    });

    const data: any = response.data;
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    console.log('[PEND-VERTEX] Raw response (first 300 chars):', textResponse.substring(0, 300));

    return parseResponse(textResponse);
  } catch (err: any) {
    console.error('[PEND-VERTEX] Error:', err.message);
    return buildFallback(`AI error: ${err.message}`);
  }
}

// ══════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════

function createAuthClient(): GoogleAuth {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');
  }
  const credentials = JSON.parse(credentialsJson);
  return new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

// ══════════════════════════════════════════
// PROMPT
// ══════════════════════════════════════════

function buildPendientesPrompt(input: PendientesClassificationInput): string {
  const threadSection = input.thread_context
    ? `\nHISTORIAL DEL HILO:\n${input.thread_context}\n`
    : '';

  return `Eres un asistente experto en clasificación de correos de trámites de seguros en Panamá.
Tu tarea: Analizar el correo y devolver JSON estricto con la clasificación completa.

CORREO:
---
Subject: ${input.subject}
From: ${input.from_email}
CC: ${input.cc_emails.join(', ') || 'ninguno'}
Adjuntos: ${input.attachments_summary || 'ninguno'}

Body:
${input.body_text || '(vacío)'}
---
${threadSection}
REGLAS DE CLASIFICACIÓN:

TIPOS DE TRÁMITE (case_type):
- emision: Emisión de póliza nueva
- reclamo: Reclamo o siniestro
- modificacion: Modificación de póliza existente
- cambio_corredor: Cambio de corredor/intermediario
- cotizacion: Solicitud de cotización
- cancelacion: Cancelación de póliza
- rehabilitacion: Rehabilitación de póliza cancelada
- otro: No encaja en ninguna categoría

RAMOS:
- vida, auto, incendio, salud, hogar, generales, otro

ASEGURADORAS COMUNES EN PANAMÁ:
ASSA, FEDPA, Internacional de Seguros, Mapfre, Acerta, Vivir, Universal, Pan American Life (PALIC), Aseguradora del Istmo, Otra

REGLAS DE TICKET (CRÍTICO):
- ticket_required = true por defecto
- EXCEPCIONES (ticket_required = false):
  * ASSA Vida Regular (NO Express, NO Web) → ticket_exception_reason: "ASSA_VIDA_REGULAR"
  * ASSA Salud → ticket_exception_reason: "ASSA_SALUD"
- Para detectar "ASSA Vida Regular": el correo menciona ASSA + Vida + NO contiene "Express" ni "Web"
- Para detectar "ASSA Salud": el correo menciona ASSA + Salud

ESTADO SUGERIDO (suggested_status):
- pendiente: Recién recibido, sin acción
- en_proceso: Se está trabajando
- en_espera_cliente: Falta info del cliente
- en_espera_aseguradora: Esperando respuesta de aseguradora
- emitido: Póliza ya emitida/confirmada
- cerrado: Trámite finalizado
- rechazado: Trámite rechazado
- aplazado: Pospuesto

PRIORIDAD:
- alta: Urgente, vencimiento próximo, reclamo
- media: Normal
- baja: Informativo, cotización

DETECCIÓN DE ADJUNTOS:
Documentos comunes en trámites de seguros:
cedula, formulario, declaracion, pago, caratula, carta_poder, certificado_medico, estado_cuenta, cotizacion_doc, poliza, otro
Según el tipo de trámite, indica qué documentos se esperan y cuáles faltan.

EXTRACCIÓN DE ENTIDADES:
- client_name: nombre del asegurado/cliente si se menciona
- cedula: número de cédula si aparece (formato X-XXX-XXXX o XXXXXXXXX)
- email: email del cliente si es diferente al remitente
- policy_number: número de póliza si aparece

RAMO_BUCKET (para compatibilidad):
- vida_assa: Vida con ASSA
- ramo_personas: Salud, AP, Vida (otras aseguradoras), Colectivos
- ramos_generales: Auto, Hogar, Incendio, Empresarial
- desconocido: No se puede determinar

RESPONDE ÚNICAMENTE CON JSON (sin markdown, sin backticks, sin texto adicional):

{
  "should_create_case": true,
  "ticket_required": true,
  "ticket_exception_reason": null,
  "case_type": "emision",
  "ramo": "vida",
  "aseguradora": "ASSA",
  "priority": "media",
  "suggested_status": "pendiente",
  "status_confidence": 0.85,
  "policy_number": null,
  "policy_number_confidence": 0.0,
  "detected_entities": {
    "client_name": null,
    "cedula": null,
    "email": null
  },
  "attachments": {
    "has_attachments": false,
    "detected": [],
    "missing_expected": ["formulario", "cedula"],
    "notes": "Emisión requiere formulario y cédula"
  },
  "rationale": "Correo de emisión de vida ASSA detectado por...",
  "evidence": {
    "matched_terms": ["emision", "vida", "ASSA"],
    "message_id": null
  },
  "ramo_bucket": "vida_assa",
  "confidence": 0.85,
  "broker_email_detected": null
}`;
}

// ══════════════════════════════════════════
// PARSE RESPONSE
// ══════════════════════════════════════════

function parseResponse(text: string): PendientesClassificationResult {
  try {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const parsed = JSON.parse(cleaned);

    // Validate and coerce required fields
    return {
      should_create_case: parsed.should_create_case ?? true,
      ticket_required: parsed.ticket_required ?? true,
      ticket_exception_reason: parsed.ticket_exception_reason ?? null,
      case_type: parsed.case_type || 'otro',
      ramo: parsed.ramo || 'otro',
      aseguradora: parsed.aseguradora || 'Otra',
      priority: parsed.priority || 'media',
      suggested_status: parsed.suggested_status || 'pendiente',
      status_confidence: Math.min(1, Math.max(0, parsed.status_confidence ?? 0)),
      policy_number: parsed.policy_number || null,
      policy_number_confidence: Math.min(1, Math.max(0, parsed.policy_number_confidence ?? 0)),
      detected_entities: {
        client_name: parsed.detected_entities?.client_name || null,
        cedula: parsed.detected_entities?.cedula || null,
        email: parsed.detected_entities?.email || null,
      },
      attachments: {
        has_attachments: parsed.attachments?.has_attachments ?? false,
        detected: Array.isArray(parsed.attachments?.detected) ? parsed.attachments.detected : [],
        missing_expected: Array.isArray(parsed.attachments?.missing_expected) ? parsed.attachments.missing_expected : [],
        notes: parsed.attachments?.notes || '',
      },
      rationale: parsed.rationale || '',
      evidence: {
        matched_terms: Array.isArray(parsed.evidence?.matched_terms) ? parsed.evidence.matched_terms : [],
        message_id: parsed.evidence?.message_id || null,
      },
      ramo_bucket: parsed.ramo_bucket || 'desconocido',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0)),
      broker_email_detected: parsed.broker_email_detected || null,
    };
  } catch (err) {
    console.error('[PEND-VERTEX] Parse error:', err);
    return buildFallback('Error parsing AI response');
  }
}

// ══════════════════════════════════════════
// FALLBACK
// ══════════════════════════════════════════

function buildFallback(reason: string): PendientesClassificationResult {
  return {
    should_create_case: true,
    ticket_required: true,
    ticket_exception_reason: null,
    case_type: 'otro',
    ramo: 'otro',
    aseguradora: 'Otra',
    priority: 'media',
    suggested_status: 'pendiente',
    status_confidence: 0,
    policy_number: null,
    policy_number_confidence: 0,
    detected_entities: { client_name: null, cedula: null, email: null },
    attachments: { has_attachments: false, detected: [], missing_expected: [], notes: '' },
    rationale: reason,
    evidence: { matched_terms: [], message_id: null },
    ramo_bucket: 'desconocido',
    confidence: 0,
    broker_email_detected: null,
  };
}
