/**
 * VERTEX AI — Chat Response Generator
 * ====================================
 * Uses existing Google Cloud Vertex AI (Gemini) connection.
 * Reuses auth pattern from src/lib/vertex/vertexClient.ts
 * 
 * NO OpenAI. Exclusively Vertex AI.
 */

import { GoogleAuth } from 'google-auth-library';

export interface ChatContext {
  message: string;
  clientContext?: {
    name?: string;
    cedula?: string;
    phone?: string;
    email?: string;
    region?: string;
    isVip?: boolean;
    clientType?: string;
  } | null;
  policyContext?: {
    policies?: any[];
  } | null;
  intent: string;
  conversationHistory?: { role: string; content: string }[];
}

export interface VertexChatResponse {
  reply: string;
  tokensUsed: number;
}

function createAuthClient(): GoogleAuth {
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!credentialsJson) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');
  }

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

const SYSTEM_PROMPT = `Eres el asistente virtual de Líderes en Seguros, una correduría de seguros en Panamá.

REGLAS ESTRICTAS:
1. Responde siempre en español.
2. Sé profesional, claro y conciso.
3. NO inventes coberturas ni detalles de pólizas.
4. NO prometas cambios de póliza.
5. NO des asesoría legal.
6. Si no estás seguro de algo, recomienda contactar directamente a la aseguradora.
7. Usa un tono empático y profesional.
8. NO reveles datos sensibles del cliente sin verificación previa.
9. Para cotizaciones, siempre dirige al portal: https://portal.lideresenseguros.com/cotizadores
10. NO hagas cotizaciones manuales ni pidas datos para cotizar.

INTENCIONES RECONOCIDAS:
- COTIZAR: Dirigir al portal de cotizaciones
- PORTAL: Dar link del portal de clientes
- COBERTURA_GENERAL: Explicar coberturas de forma general
- POLIZA_ESPECIFICA: Dar info de póliza verificada
- EMERGENCIA: Dar número de emergencia inmediatamente
- CONTACTO_ASEGURADORA: Dar datos de contacto de la aseguradora
- QUEJA: Responder con empatía, indicar que será revisado
- EXTREMO: Caso crítico, indicar que un supervisor contactará
- OTRO: Responder de forma general y útil

Ajusta tu tono según el tipo de cliente:
- VIP/corporativo: formal y atento
- Regular: amable y directo
- Nuevo: acogedor y explicativo`;

/**
 * Generate a chat response using Vertex AI (Gemini)
 */
export async function generateResponse(ctx: ChatContext): Promise<VertexChatResponse> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_CHAT || 'gemini-1.5-flash';

  if (!projectId) {
    throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');
  }

  const auth = createAuthClient();
  const client = await auth.getClient();

  // Build contextual prompt
  let contextBlock = '';
  if (ctx.clientContext) {
    const c = ctx.clientContext;
    contextBlock += `\nCONTEXTO DEL CLIENTE:\n`;
    if (c.name) contextBlock += `- Nombre: ${c.name}\n`;
    if (c.region) contextBlock += `- Región: ${c.region}\n`;
    if (c.isVip) contextBlock += `- Tipo: VIP/Prioritario\n`;
    if (c.clientType) contextBlock += `- Clasificación: ${c.clientType}\n`;
  }

  if (ctx.policyContext?.policies?.length) {
    contextBlock += `\nPÓLIZAS DEL CLIENTE:\n`;
    for (const p of ctx.policyContext.policies) {
      contextBlock += `- ${p.policy_number}: ${p.ramo || 'N/A'} con ${p.insurer_name || 'N/A'} (Estado: ${p.status || 'N/A'}, Vence: ${p.renewal_date || 'N/A'})\n`;
    }
  }

  contextBlock += `\nINTENCIÓN DETECTADA: ${ctx.intent}\n`;

  // Build conversation messages
  const contents: any[] = [];

  // System instruction via first user turn
  contents.push({
    role: 'user',
    parts: [{ text: `${SYSTEM_PROMPT}\n${contextBlock}\n\nMensaje del cliente: ${ctx.message}` }],
  });

  // If we have conversation history, include it
  if (ctx.conversationHistory?.length) {
    // Replace first message with system + history
    contents.length = 0;

    // System + context as first user turn
    contents.push({
      role: 'user',
      parts: [{ text: `${SYSTEM_PROMPT}\n${contextBlock}\n\nA continuación el historial de la conversación. Responde al último mensaje.` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'Entendido. Responderé siguiendo las reglas establecidas.' }],
    });

    for (const msg of ctx.conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Final user message
    contents.push({
      role: 'user',
      parts: [{ text: ctx.message }],
    });
  }

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const requestBody = {
    contents,
    generationConfig: {
      temperature: 0.25,
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
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento, no pude generar una respuesta en este momento.';
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;

    console.log(`[VERTEX-CHAT] Reply generated (${tokensUsed} tokens)`);

    return { reply: reply.trim(), tokensUsed };
  } catch (err: any) {
    console.error('[VERTEX-CHAT] Error:', err.message);
    return {
      reply: 'Disculpe, estoy experimentando dificultades técnicas. Por favor intente de nuevo o comuníquese con nosotros al portal: https://portal.lideresenseguros.com',
      tokensUsed: 0,
    };
  }
}
