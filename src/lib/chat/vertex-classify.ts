/**
 * Vertex AI — Chat Classifier & AI Reply Generator
 * ==================================================
 * Uses Vertex AI (Gemini 2.0 Flash) for:
 *   1. classifyMessageVertex() — classify thread category/severity/intent/tags/summary
 *   2. generateAiReply() — generate contextual reply for LISSA AI auto-response
 *
 * Auth: Google Service Account via GOOGLE_APPLICATION_CREDENTIALS_JSON
 * Model: gemini-2.0-flash (confirmed working in this GCP project)
 */

import { GoogleAuth } from 'google-auth-library';
import type { ClassificationResult, ThreadCategory, ThreadSeverity } from '@/types/chat.types';
import { SYSTEM_PROMPT } from '@/lib/ai/vertex';

// ── Auth ──

function createAuthClient(): GoogleAuth {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');

  let credentials: any;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format');
  }

  return new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

async function callVertex(systemPrompt: string, userPrompt: string): Promise<{ text: string; tokens: number }> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_CHAT || 'gemini-2.0-flash';

  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');

  const auth = createAuthClient();
  const client = await auth.getClient();

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await client.request({
    url: endpoint,
    method: 'POST',
    data: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json',
      },
    },
  });

  const data: any = response.data;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const tokens = data?.usageMetadata?.totalTokenCount || 0;

  return { text, tokens };
}

// ════════════════════════════════════════════
// 1. CLASSIFIER
// ════════════════════════════════════════════

const CLASSIFIER_SYSTEM_PROMPT = `Eres un clasificador de mensajes de WhatsApp para Líderes en Seguros (correduría de seguros en Panamá).

Tu tarea: analizar los últimos mensajes de una conversación y devolver clasificación estructurada.

CATEGORÍAS:
- "simple": consultas generales, saludos, preguntas informativas, agradecimientos
- "lead": el usuario quiere cotizar, pedir precios, comparar planes, comprar un seguro. Palabras clave: "cotizar", "precio", "cuánto cuesta", "quiero un seguro", "necesito cobertura", "comparar planes"
- "urgent": queja fuerte, amenaza legal, fraude, denuncia, superintendencia, estafa, cobro indebido, demanda, abogado, muerte, accidente grave, siniestro con lesiones. Palabras clave: "demanda", "abogado", "superintendencia", "fraude", "estafa", "denuncia", "cobro indebido", "defensor del asegurado"

SEVERIDAD (solo relevante si urgent):
- "low": tono molesto pero sin amenaza concreta
- "medium": mención de queja formal o reclamo escalado
- "high": amenaza legal directa, mención de abogado/superintendencia/demanda, siniestro con lesiones graves

REGLAS:
1. Si hay CUALQUIER palabra de urgencia → category = "urgent"
2. Si mencionan cotizar/precio/comprar pero NO hay urgencia → category = "lead"
3. Todo lo demás → category = "simple"
4. executive_summary debe ser 2-4 bullets concisos en español
5. suggested_next_step debe ser 1 línea concisa en español
6. tags: array de strings relevantes (max 5) como "auto", "vida", "salud", "pago", "reclamo", "cotización", "renovación", "siniestro", "cancelación"

Responde SOLO JSON válido con esta estructura exacta:
{
  "category": "simple" | "lead" | "urgent",
  "severity": "low" | "medium" | "high",
  "intent": "string breve del intent principal",
  "tags": ["tag1", "tag2"],
  "executive_summary": ["bullet 1", "bullet 2"],
  "suggested_next_step": "acción sugerida en 1 línea"
}`;

interface ClassifyInput {
  lastMessages: { direction: string; body: string }[];
  clientName?: string | null;
  phone?: string;
}

export async function classifyMessageVertex(input: ClassifyInput): Promise<ClassificationResult & { tokens: number }> {
  const msgContext = input.lastMessages
    .map(m => `[${m.direction === 'inbound' ? 'CLIENTE' : 'BOT/PORTAL'}]: ${m.body}`)
    .join('\n');

  const userPrompt = `Clasifica esta conversación de WhatsApp:

Cliente: ${input.clientName || 'Desconocido'}
Teléfono: ${input.phone || 'N/A'}

Últimos mensajes:
${msgContext}`;

  try {
    const { text, tokens } = await callVertex(CLASSIFIER_SYSTEM_PROMPT, userPrompt);

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON from classifier');
      }
    }

    // Validate and sanitize
    const validCategories: ThreadCategory[] = ['simple', 'lead', 'urgent'];
    const validSeverities: ThreadSeverity[] = ['low', 'medium', 'high'];

    const category = validCategories.includes(parsed.category) ? parsed.category : 'simple';
    const severity = validSeverities.includes(parsed.severity) ? parsed.severity : 'low';

    return {
      category,
      severity,
      intent: typeof parsed.intent === 'string' ? parsed.intent : 'general',
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      executive_summary: Array.isArray(parsed.executive_summary) ? parsed.executive_summary.slice(0, 4) : [],
      suggested_next_step: typeof parsed.suggested_next_step === 'string' ? parsed.suggested_next_step : 'Revisar conversación',
      tokens,
    };
  } catch (err: any) {
    console.error('[VERTEX-CLASSIFY] Error:', err.message);
    // Fallback to simple/low
    return {
      category: 'simple',
      severity: 'low',
      intent: 'error_fallback',
      tags: [],
      executive_summary: ['Error en clasificación automática'],
      suggested_next_step: 'Revisar conversación manualmente',
      tokens: 0,
    };
  }
}

// ════════════════════════════════════════════
// 2. AI REPLY GENERATOR
// ════════════════════════════════════════════

/**
 * Call Vertex AI with proper Gemini conversation turns (user/model alternation).
 * Unlike callVertex() which sends a single user prompt with JSON response,
 * this sends the full conversation history as Gemini contents for natural chat.
 */
async function callVertexChat(
  systemPrompt: string,
  contents: { role: string; parts: { text: string }[] }[],
): Promise<{ text: string; tokens: number }> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_CHAT || 'gemini-2.0-flash';

  if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');

  const auth = createAuthClient();
  const client = await auth.getClient();

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const response = await client.request({
    url: endpoint,
    method: 'POST',
    data: {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    },
  });

  const data: any = response.data;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokens = data?.usageMetadata?.totalTokenCount || 0;

  return { text, tokens };
}

interface ReplyInput {
  currentMessage: string;
  conversationHistory: { direction: string; body: string }[];
  clientName?: string | null;
  category: string;
  severity: string;
}

export interface AiReplyResult {
  reply: string;
  tokens: number;
  latencyMs: number;
}

export async function generateAiReply(input: ReplyInput): Promise<AiReplyResult> {
  const start = Date.now();

  // Build system prompt with WhatsApp-specific addendum and client context
  let fullSystemPrompt = SYSTEM_PROMPT;

  // Add WhatsApp channel context
  fullSystemPrompt += `\n\n<channel>
CANAL: WhatsApp — Mensajes cortos y legibles. Mantén respuestas ideales para móvil (2-5 oraciones, máximo 8 si el tema lo requiere). No uses formato markdown.
</channel>`;

  // Add client name context if available
  if (input.clientName) {
    fullSystemPrompt += `\n\n--- CONTEXTO DE ESTA CONVERSACIÓN ---\nCliente: se llama ${input.clientName}.`;
  }

  // Add category context for urgent cases
  if (input.category === 'urgent') {
    fullSystemPrompt += `\n\nNOTA INTERNA: Este caso fue clasificado como URGENTE (severidad: ${input.severity}). Un superior ya fue notificado por email. Sé empática, reconoce la frustración, indica que un superior contactará al cliente, y ofrece contacto@lideresenseguros.com para seguimiento.`;
  }

  // Build proper Gemini contents array with alternating user/model turns
  const contents: { role: string; parts: { text: string }[] }[] = [];

  if (input.conversationHistory?.length) {
    let lastRole = '';
    for (const msg of input.conversationHistory) {
      const role = msg.direction === 'inbound' ? 'user' : 'model';
      // Gemini requires strict user/model alternation — skip duplicates
      if (role === lastRole) continue;
      contents.push({ role, parts: [{ text: msg.body }] });
      lastRole = role;
    }
    // If last history entry was user, add a model placeholder to maintain alternation
    if (lastRole === 'user') {
      contents.push({ role: 'model', parts: [{ text: 'Entendido, ¿en qué más te ayudo?' }] });
    }
  }

  // Always end with the current user message
  contents.push({ role: 'user', parts: [{ text: input.currentMessage }] });

  try {
    const { text, tokens } = await callVertexChat(fullSystemPrompt, contents);

    // Clean up reply
    let reply = text;

    // Handle case where Gemini wraps in JSON
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') reply = parsed;
      else if (parsed.reply) reply = parsed.reply;
      else if (parsed.response) reply = parsed.response;
    } catch {
      // Not JSON — use as-is (expected)
    }

    // Clean up any markdown formatting for WhatsApp
    reply = reply.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1: $2');

    const latencyMs = Date.now() - start;
    console.log(`[VERTEX-REPLY] Generated reply (${tokens} tokens, ${latencyMs}ms, history: ${contents.length - 1} turns)`);

    return { reply: reply.trim(), tokens, latencyMs };
  } catch (err: any) {
    console.error('[VERTEX-REPLY] Error:', err.message);
    const latencyMs = Date.now() - start;
    return {
      reply: '¡Hola! Disculpa, estoy teniendo un pequeño problema técnico. Puedes escribirnos a contacto@lideresenseguros.com o llamar al 223-2373 y te atendemos con gusto. 💚',
      tokens: 0,
      latencyMs,
    };
  }
}
