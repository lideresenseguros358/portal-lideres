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

const SYSTEM_PROMPT = `Eres Lissa, la asistente virtual de Líderes en Seguros, una correduría de seguros en Panamá. Hablas como una persona real: cálida, empática, cercana. Usas "tú" y un tono conversacional natural, como si fueras una amiga que sabe mucho de seguros.

Tu personalidad:
- Eres genuinamente amable y te importa ayudar
- Usas emojis de forma natural pero sin exagerar (💚 👋 � 📋)
- Haces preguntas de seguimiento para entender mejor
- Muestras interés real en lo que la persona necesita
- Firmas con "— Lissa 💚" solo al final de respuestas largas o importantes
- NUNCA suenas como un robot ni repites plantillas

Reglas que siempre sigues:
1. Siempre en español
2. No inventas coberturas ni detalles de pólizas
3. No prometes cambios de póliza
4. No das asesoría legal
5. Si no sabes algo, lo dices con honestidad y ofreces alternativas
6. Para cotizar, diriges a: https://portal.lideresenseguros.com/cotizadores
7. No haces cotizaciones manuales
8. Si no puedes resolver algo, ofreces: contacto@lideresenseguros.com o 223-2373

Ejemplos de cómo hablas:
- "¡Claro que sí! Déjame ver qué puedo encontrar para ti 😊"
- "Entiendo perfectamente tu preocupación, es algo muy común..."
- "¡Qué bueno que preguntas! Te explico..."
- "Mmm, déjame pensarlo... Lo mejor sería que..."

NUNCA respondas con listas largas de opciones a menos que te las pidan. Sé conversacional.`;

/**
 * Generate a chat response using Vertex AI (Gemini)
 */
export async function generateResponse(ctx: ChatContext): Promise<VertexChatResponse> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const model = process.env.VERTEX_MODEL_CHAT || 'gemini-2.0-flash';

  if (!projectId) {
    console.error('[VERTEX-CHAT] GOOGLE_CLOUD_PROJECT_ID not configured');
    throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');
  }

  console.log('[VERTEX-CHAT] Calling Vertex AI:', { projectId, location, model, intent: ctx.intent });

  let auth: GoogleAuth;
  try {
    auth = createAuthClient();
  } catch (authErr: any) {
    console.error('[VERTEX-CHAT] Auth creation failed:', authErr.message);
    throw authErr;
  }

  let client: any;
  try {
    client = await auth.getClient();
  } catch (clientErr: any) {
    console.error('[VERTEX-CHAT] getClient() failed:', clientErr.message);
    throw clientErr;
  }

  // Build contextual info
  let contextBlock = '';
  if (ctx.clientContext) {
    const c = ctx.clientContext;
    contextBlock += `\nDatos del cliente: `;
    const parts: string[] = [];
    if (c.name) parts.push(`se llama ${c.name}`);
    if (c.region) parts.push(`es de ${c.region}`);
    if (c.isVip) parts.push(`es cliente VIP`);
    contextBlock += parts.join(', ') + '.\n';
  }

  if (ctx.policyContext?.policies?.length) {
    contextBlock += `\nSus pólizas:\n`;
    for (const p of ctx.policyContext.policies) {
      contextBlock += `- ${p.policy_number}: ${p.ramo || 'N/A'} con ${p.insurer_name || 'N/A'} (Estado: ${p.status || 'N/A'}, Vence: ${p.renewal_date || 'N/A'})\n`;
    }
  }

  if (ctx.intent) {
    contextBlock += `\nIntención detectada: ${ctx.intent}\n`;
  }

  // Build conversation contents
  const contents: any[] = [];

  if (ctx.conversationHistory?.length) {
    // Include history: system context first, then alternating messages
    contents.push({
      role: 'user',
      parts: [{ text: `[Contexto para ti, no repitas esto al usuario]\n${contextBlock}\n\nResponde al último mensaje de forma natural y conversacional.` }],
    });
    contents.push({
      role: 'model',
      parts: [{ text: '¡Claro! Estoy lista para ayudar 😊' }],
    });

    for (const msg of ctx.conversationHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    contents.push({
      role: 'user',
      parts: [{ text: ctx.message }],
    });
  } else {
    // Single message — include context in user turn
    contents.push({
      role: 'user',
      parts: [{ text: `[Contexto: ${contextBlock}]\n\nCliente dice: ${ctx.message}` }],
    });
  }

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
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
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '¡Hola! Soy Lissa 💚 No logré procesar tu mensaje, pero puedes escribirnos a contacto@lideresenseguros.com o llamarnos al 223-2373 y te atendemos con gusto.';
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;

    console.log(`[VERTEX-CHAT] Reply generated (${tokensUsed} tokens)`);

    return { reply: reply.trim(), tokensUsed };
  } catch (err: any) {
    console.error('[VERTEX-CHAT] Error details:', {
      message: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: JSON.stringify(err.response?.data)?.substring(0, 500),
      code: err.code,
      stack: err.stack?.substring(0, 300),
    });
    throw err;
  }
}
