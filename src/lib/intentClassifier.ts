/**
 * INTENT CLASSIFIER — Using Vertex AI
 * =====================================
 * Classifies user messages into business intents.
 * Uses Vertex AI Gemini for NLU classification.
 */

import { GoogleAuth } from 'google-auth-library';

export type ChatIntent =
  | 'SALUDO'
  | 'COTIZAR'
  | 'PORTAL'
  | 'COBERTURA_GENERAL'
  | 'POLIZA_ESPECIFICA'
  | 'EMERGENCIA'
  | 'CONTACTO_ASEGURADORA'
  | 'QUEJA'
  | 'EXTREMO'
  | 'OTRO';

export interface ClassificationResult {
  intent: ChatIntent;
  confidence: number;
  requiresIdentityVerification: boolean;
  detectedInsurer: string | null;
  reasoning: string;
}

// Keywords for fast pre-classification (before AI call)
const EXTREME_KEYWORDS = [
  'demanda', 'superintendencia', 'denuncia', 'abogado', 'fraude',
  'medios', 'escándalo', 'estafa', 'tribunal', 'defensor del asegurado',
];

const EMERGENCY_KEYWORDS = [
  'emergencia', 'accidente', 'choque', 'incendio', 'robo', 'asalto',
  'urgente', 'siniestro', 'grúa', 'ambulancia', 'hospital',
];

const GREETING_KEYWORDS = [
  'hola', 'buenos dias', 'buenos días', 'buenas tardes', 'buenas noches',
  'buen dia', 'buen día', 'hey', 'hi', 'hello', 'saludos', 'qué tal',
  'que tal', 'buenas',
];

function createAuthClient(): GoogleAuth {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');
  const credentials = JSON.parse(credentialsJson);
  return new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

/**
 * Fast keyword-based pre-check before AI call
 */
function preClassify(message: string): ChatIntent | null {
  const lower = message.toLowerCase();

  // EXTREMO — check first (highest priority)
  if (EXTREME_KEYWORDS.some(k => lower.includes(k))) return 'EXTREMO';

  // EMERGENCIA
  if (EMERGENCY_KEYWORDS.some(k => lower.includes(k))) return 'EMERGENCIA';

  // SALUDO — short greetings (< 30 chars to avoid false positives)
  if (lower.length < 30 && GREETING_KEYWORDS.some(k => lower.includes(k))) return 'SALUDO';

  return null; // needs AI classification
}

/**
 * Classify a message using Vertex AI
 */
export async function classifyIntent(message: string): Promise<ClassificationResult> {
  // 1. Fast keyword pre-check
  const fastResult = preClassify(message);
  if (fastResult === 'EXTREMO') {
    return {
      intent: 'EXTREMO',
      confidence: 0.99,
      requiresIdentityVerification: false,
      detectedInsurer: null,
      reasoning: 'Detected critical keyword',
    };
  }
  if (fastResult === 'EMERGENCIA') {
    return {
      intent: 'EMERGENCIA',
      confidence: 0.95,
      requiresIdentityVerification: false,
      detectedInsurer: null,
      reasoning: 'Detected emergency keyword',
    };
  }
  if (fastResult === 'SALUDO') {
    return {
      intent: 'SALUDO',
      confidence: 0.99,
      requiresIdentityVerification: false,
      detectedInsurer: null,
      reasoning: 'Detected greeting keyword',
    };
  }

  // 2. AI classification via Vertex
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_CHAT || 'gemini-1.5-flash';

  if (!projectId) {
    console.warn('[INTENT] No GOOGLE_CLOUD_PROJECT_ID — falling back to OTRO');
    return { intent: 'OTRO', confidence: 0, requiresIdentityVerification: false, detectedInsurer: null, reasoning: 'No AI configured' };
  }

  try {
    const auth = createAuthClient();
    const client = await auth.getClient();

    const prompt = `Eres un clasificador de intenciones para una correduría de seguros en Panamá (Líderes en Seguros).

Clasifica el siguiente mensaje del cliente en UNA de estas intenciones:

COTIZAR — Quiere cotizar un seguro
PORTAL — Quiere acceder al portal de clientes
COBERTURA_GENERAL — Pregunta sobre coberturas de forma general
POLIZA_ESPECIFICA — Pregunta sobre su póliza específica, pagos, renovación
EMERGENCIA — Tiene una emergencia (accidente, siniestro, robo)
CONTACTO_ASEGURADORA — Necesita contacto de su aseguradora
QUEJA — Tiene una queja o reclamo
EXTREMO — Amenaza legal, denuncia, fraude
OTRO — No encaja en ninguna

MENSAJE: "${message}"

Responde SOLO con JSON (sin markdown, sin backticks):
{
  "intent": "COTIZAR",
  "confidence": 0.9,
  "requires_identity_verification": false,
  "detected_insurer": null,
  "reasoning": "El cliente quiere cotizar un seguro de auto"
}

Reglas:
- requires_identity_verification = true si pide info de su póliza, pagos, datos personales
- detected_insurer = nombre de la aseguradora si la menciona, null si no
- confidence entre 0 y 1`;

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, topP: 0.8, maxOutputTokens: 512 },
      },
    });

    const data: any = response.data;
    const textResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON
    const cleaned = textResponse.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '');
    const parsed = JSON.parse(cleaned);

    const validIntents: ChatIntent[] = ['SALUDO', 'COTIZAR', 'PORTAL', 'COBERTURA_GENERAL', 'POLIZA_ESPECIFICA', 'EMERGENCIA', 'CONTACTO_ASEGURADORA', 'QUEJA', 'EXTREMO', 'OTRO'];
    const intent: ChatIntent = validIntents.includes(parsed.intent) ? parsed.intent : 'OTRO';

    return {
      intent,
      confidence: Number(parsed.confidence) || 0.5,
      requiresIdentityVerification: !!parsed.requires_identity_verification,
      detectedInsurer: parsed.detected_insurer || null,
      reasoning: parsed.reasoning || '',
    };
  } catch (err: any) {
    console.error('[INTENT] Vertex classification error:', err.message);
    return { intent: 'OTRO', confidence: 0, requiresIdentityVerification: false, detectedInsurer: null, reasoning: `AI error: ${err.message}` };
  }
}
