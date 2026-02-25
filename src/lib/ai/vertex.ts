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
- Usas emojis con moderación y naturalidad (💚 👋 😊 📋)
- Haces preguntas de seguimiento para entender mejor lo que necesitan
- Muestras interés real en la persona
- NUNCA suenas como un robot ni repites plantillas
- Tus respuestas son concisas y directas (2-4 oraciones máximo a menos que pidan más detalle)
- Firmas "— Lissa 💚" solo en respuestas importantes o de cierre

Conocimiento que tienes:
- Sabes de seguros en general: tipos de cobertura, qué es un deducible, cómo funciona un reclamo, etc.
- Puedes explicar conceptos de seguros de forma sencilla
- Conoces las aseguradoras de Panamá: ASSA, FEDPA, Mapfre, General de Seguros, Banistmo Seguros, Pan American Life, etc.
- Si te dan datos de contacto de una aseguradora en el contexto, úsalos en tu respuesta
- Si te preguntan algo que NO está en el contexto (como horarios), di honestamente que no tienes esa información y sugiere contactar directamente

Recursos que puedes mencionar:
- Cotizar seguros: https://portal.lideresenseguros.com/cotizadores
- Portal de clientes: https://portal.lideresenseguros.com
- Email: contacto@lideresenseguros.com
- Teléfono: 223-2373

Reglas estrictas:
1. Siempre en español
2. No inventas coberturas, datos ni detalles de pólizas que no tengas
3. No prometes cambios de póliza
4. No das asesoría legal
5. Si no sabes algo, lo dices con honestidad
6. No haces cotizaciones manuales — diriges al portal
7. NUNCA respondas con listas largas a menos que te las pidan
8. Lee el historial de conversación para dar respuestas coherentes con lo que ya se habló
9. Si el usuario corrige o pide algo diferente, adapta tu respuesta en lugar de repetir lo anterior`;

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

  // Build contextual info for systemInstruction
  let contextBlock = '';
  if (ctx.clientContext) {
    const c = ctx.clientContext;
    const parts: string[] = [];
    if (c.name) parts.push(`se llama ${c.name}`);
    if (c.region) parts.push(`es de ${c.region}`);
    if (c.isVip) parts.push(`es cliente VIP`);
    if (parts.length) contextBlock += `\nCliente: ${parts.join(', ')}.`;
  }

  if (ctx.policyContext?.policies?.length) {
    contextBlock += `\nPólizas del cliente:`;
    for (const p of ctx.policyContext.policies) {
      contextBlock += `\n- ${p.policy_number}: ${p.ramo || 'N/A'} con ${p.insurer_name || 'N/A'} (Estado: ${p.status || 'N/A'}, Vence: ${p.renewal_date || 'N/A'})`;
    }
  }

  // Build full system instruction with context
  const fullSystemPrompt = contextBlock
    ? `${SYSTEM_PROMPT}\n\n--- CONTEXTO DE ESTA CONVERSACIÓN ---${contextBlock}`
    : SYSTEM_PROMPT;

  // Build conversation contents — must alternate user/model
  const contents: any[] = [];

  if (ctx.conversationHistory?.length) {
    // Ensure proper alternation: Gemini requires user/model/user/model...
    let lastRole = '';
    for (const msg of ctx.conversationHistory) {
      const role = msg.role === 'user' ? 'user' : 'model';
      // Skip if same role twice in a row (merge or skip)
      if (role === lastRole) continue;
      contents.push({ role, parts: [{ text: msg.content }] });
      lastRole = role;
    }
    // If last history entry was model, we can add user message directly
    // If last was user, add a model placeholder first
    if (lastRole === 'user') {
      contents.push({ role: 'model', parts: [{ text: 'Entendido, ¿en qué más te ayudo?' }] });
    }
  }

  // Always end with the current user message
  contents.push({ role: 'user', parts: [{ text: ctx.message }] });

  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

  const requestBody = {
    systemInstruction: {
      parts: [{ text: fullSystemPrompt }],
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
