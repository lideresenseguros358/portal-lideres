/**
 * VERTEX AI CLIENT - Google Gemini
 * =================================
 * Cliente para clasificación de correos usando Vertex AI (Gemini)
 * 
 * - Autenticación con Service Account JSON (sin archivo en disco)
 * - Endpoint regional (us-central1)
 * - Prompt específico para clasificación de correos
 * - Output JSON estricto
 */

import { GoogleAuth } from 'google-auth-library';

export interface VertexAIConfig {
  projectId: string;
  location: string;
  model: string;
  credentials: any; // Service Account JSON parsed
}

export interface EmailClassificationInput {
  subject: string;
  body_text_normalized: string | null;
  from: string;
  cc: string[];
  attachments_summary: string;
}

export interface EmailClassificationResult {
  ramo_bucket: 'vida_assa' | 'ramos_generales' | 'ramo_personas' | 'desconocido';
  ramo_code: string | null; // '01', '02', etc
  aseguradora_code: string | null; // '01', '05', etc
  tramite_code: string | null; // '1', '01', etc
  tipo_poliza: string | null; // Normalizado
  broker_email_detected: string | null;
  case_special_flag: string | null; // 'cambio_corredor_sin_poliza' | 'adjuntos_sueltos' | 'solo_pdf' | null
  confidence: number; // 0 a 1
  missing_fields: string[]; // ['aseguradora', 'tramite', 'tipo_poliza', 'broker']
  reasoning_short: string; // Max 180 chars
  should_autoreply_request_more_info: boolean;
}

/**
 * Crea cliente de autenticación Google desde JSON
 */
function createAuthClient(): GoogleAuth {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');
  }

  let credentials: any;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch (err) {
    throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format');
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  return auth;
}

/**
 * Clasifica un correo usando Vertex AI (Gemini)
 */
export async function classifyInboundEmail(
  input: EmailClassificationInput
): Promise<EmailClassificationResult> {
  // Feature flag check
  if (process.env.FEATURE_ENABLE_VERTEX !== 'true') {
    console.log('[VERTEX] AI classification disabled by feature flag');
    return {
      ramo_bucket: 'desconocido',
      ramo_code: null,
      aseguradora_code: null,
      tramite_code: null,
      tipo_poliza: null,
      broker_email_detected: null,
      case_special_flag: null,
      confidence: 0.0,
      missing_fields: ['ramo', 'aseguradora', 'tramite', 'tipo_poliza'],
      reasoning_short: 'AI classification disabled',
      should_autoreply_request_more_info: false,
    };
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_EMAIL || 'gemini-1.5-flash';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');
  }

  const auth = createAuthClient();
  const client = await auth.getClient();

  // Construir prompt de clasificación
  const prompt = buildClassificationPrompt(input);

  // Endpoint Vertex AI
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.1, // Baja temperatura para resultados consistentes
      topP: 0.8,
      topK: 10,
      maxOutputTokens: 1024,
    },
  };

  try {
    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: requestBody,
    });

    const data: any = response.data;
    
    // Extraer texto de respuesta
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    console.log('[VERTEX] Raw AI response:', textResponse.substring(0, 200));

    // Parsear JSON de respuesta
    const result = parseAIResponse(textResponse);
    
    return result;
  } catch (err: any) {
    console.error('[VERTEX] Error calling Vertex AI:', err.message);
    
    // Fallback: clasificación desconocida
    return {
      ramo_bucket: 'desconocido',
      ramo_code: null,
      aseguradora_code: null,
      tramite_code: null,
      tipo_poliza: null,
      broker_email_detected: null,
      case_special_flag: 'error_ai',
      confidence: 0.0,
      missing_fields: ['ramo', 'aseguradora', 'tramite'],
      reasoning_short: 'Error en clasificación AI',
      should_autoreply_request_more_info: false,
    };
  }
}

/**
 * Construye prompt de clasificación
 */
function buildClassificationPrompt(input: EmailClassificationInput): string {
  return `Eres un asistente experto en clasificación de correos de seguros en Panamá.

Tu tarea: Analizar el siguiente correo y extraer información estructurada en formato JSON.

CORREO A ANALIZAR:
---
Subject: ${input.subject}
From: ${input.from}
CC: ${input.cc.join(', ')}
Adjuntos: ${input.attachments_summary || 'ninguno'}

Body:
${input.body_text_normalized || '(vacío)'}
---

CATÁLOGO DE CÓDIGOS:

RAMOS (2 dígitos):
01 = Vida
02 = Salud
03 = Auto
04 = Hogar
05 = Empresarial
06 = Accidentes Personales
07 = Colectivos
99 = Otro/Desconocido

ASEGURADORAS (2 dígitos):
01 = ASSA (Vida ASSA)
02 = ASSA (otros ramos)
03 = Mapfre
04 = Fedpa
05 = Acerta
06 = Vivir
07 = Universal
08 = Aseguradora del Istmo
09 = Pan American Life (PALIC)
10 = Internacional de Seguros
99 = Otra/Desconocida

TRÁMITES (1-2 dígitos):
1 = Emisión
2 = Renovación
3 = Inclusión
4 = Exclusión
5 = Modificación
6 = Cancelación
7 = Rehabilitación
8 = Reclamo
9 = Cambio de Corredor
10 = Cotización
99 = Otro

REGLAS DE CLASIFICACIÓN:
1. Si subject vacío y solo PDF adjunto => special_flag: "solo_pdf", confidence baja
2. Si detectas email de broker en CC o texto => broker_email_detected
3. Si NO detectas aseguradora/tramite => agregar a missing_fields
4. Cambio de corredor puede NO tener tipo_poliza (permitido)
5. Vida ASSA => ramo_bucket: "vida_assa"
6. Salud, AP, Vida otras aseguradoras, Colectivos => ramo_bucket: "ramo_personas"
7. Auto, Hogar, Empresarial => ramo_bucket: "ramos_generales"
8. Si no puedes clasificar => ramo_bucket: "desconocido"

RESPONDE ÚNICAMENTE CON JSON (sin markdown, sin backticks):

{
  "ramo_bucket": "vida_assa" | "ramos_generales" | "ramo_personas" | "desconocido",
  "ramo_code": "01" | null,
  "aseguradora_code": "01" | null,
  "tramite_code": "1" | null,
  "tipo_poliza": "string normalizada" | null,
  "broker_email_detected": "email@example.com" | null,
  "case_special_flag": "cambio_corredor_sin_poliza" | "adjuntos_sueltos" | "solo_pdf" | null,
  "confidence": 0.85,
  "missing_fields": ["aseguradora", "tramite"],
  "reasoning_short": "Vida ASSA detectada, broker identificado en CC",
  "should_autoreply_request_more_info": false
}`;
}

/**
 * Parsea respuesta de AI a JSON estructurado
 */
function parseAIResponse(text: string): EmailClassificationResult {
  try {
    // Limpiar markdown si existe
    let cleaned = text.trim();
    
    // Quitar bloques de código markdown
    cleaned = cleaned.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    
    // Parsear JSON
    const parsed = JSON.parse(cleaned);
    
    // Validar threshold
    const threshold = Number(process.env.VERTEX_CONFIDENCE_THRESHOLD) || 0.72;
    
    if (parsed.confidence < threshold) {
      console.log(`[VERTEX] Confidence ${parsed.confidence} below threshold ${threshold}`);
    }
    
    return parsed as EmailClassificationResult;
  } catch (err) {
    console.error('[VERTEX] Error parsing AI response:', err);
    
    // Fallback
    return {
      ramo_bucket: 'desconocido',
      ramo_code: null,
      aseguradora_code: null,
      tramite_code: null,
      tipo_poliza: null,
      broker_email_detected: null,
      case_special_flag: null,
      confidence: 0.0,
      missing_fields: ['ramo', 'aseguradora', 'tramite'],
      reasoning_short: 'Error parseando respuesta AI',
      should_autoreply_request_more_info: false,
    };
  }
}
