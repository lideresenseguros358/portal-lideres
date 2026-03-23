/**
 * DIAGNOSTIC: Vertex AI Chat Test
 * ================================
 * Standalone test to verify Vertex AI connectivity for chat.
 * Uses the EXACT same auth pattern as the working email classifier.
 * 
 * GET  /api/diagnostics/vertex-chat          — run all tests
 * POST /api/diagnostics/vertex-chat          — test with custom message
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';
import { requireCronSecret } from '@/lib/security/api-guard';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

// ── Test 1: Env vars present ──
function testEnvVars() {
  const vars = {
    GOOGLE_APPLICATION_CREDENTIALS_JSON: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || '(not set)',
    GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || '(not set — will default to us-central1)',
    VERTEX_MODEL_CHAT: process.env.VERTEX_MODEL_CHAT || '(not set — will default to gemini-1.5-flash)',
    VERTEX_MODEL_EMAIL: process.env.VERTEX_MODEL_EMAIL || '(not set)',
    VERTEX_API_KEY: process.env.VERTEX_API_KEY ? 'SET (first 10: ' + process.env.VERTEX_API_KEY.substring(0, 10) + '...)' : '(not set)',
  };

  let credentialsParsed = false;
  let credentialsType = '';
  let credentialsProjectId = '';
  let credentialsClientEmail = '';
  try {
    const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '{}');
    credentialsParsed = true;
    credentialsType = creds.type || '(no type)';
    credentialsProjectId = creds.project_id || '(no project_id)';
    credentialsClientEmail = creds.client_email || '(no client_email)';
  } catch {
    credentialsParsed = false;
  }

  return {
    test: 'env_vars',
    pass: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON && !!process.env.GOOGLE_CLOUD_PROJECT_ID,
    vars,
    credentials: {
      parseable: credentialsParsed,
      type: credentialsType,
      project_id: credentialsProjectId,
      client_email: credentialsClientEmail,
    },
  };
}

// ── Test 2: Auth client creation ──
async function testAuthClient() {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credentialsJson) return { test: 'auth_client', pass: false, error: 'No credentials JSON' };

    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const hasToken = !!tokenResponse?.token;

    return {
      test: 'auth_client',
      pass: hasToken,
      tokenPrefix: hasToken ? tokenResponse.token!.substring(0, 20) + '...' : null,
    };
  } catch (err: any) {
    return { test: 'auth_client', pass: false, error: err.message, stack: err.stack?.substring(0, 200) };
  }
}

// ── Test 3: Simple Vertex AI call (same pattern as working email classifier) ──
async function testVertexSimple() {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!;
    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const model = process.env.VERTEX_MODEL_CHAT || 'gemini-1.5-flash';

    // EXACT same pattern as working email classifier — no systemInstruction
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Responde en una oración corta: ¿Qué es un seguro de auto?' }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 10,
        maxOutputTokens: 256,
      },
    };

    console.log('[VERTEX-TEST] Calling:', endpoint);
    const start = Date.now();

    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: requestBody,
    });

    const elapsed = Date.now() - start;
    const data: any = response.data;
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no text in response)';
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;

    return {
      test: 'vertex_simple_call',
      pass: true,
      reply,
      tokensUsed,
      elapsedMs: elapsed,
      endpoint,
      model,
    };
  } catch (err: any) {
    return {
      test: 'vertex_simple_call',
      pass: false,
      error: err.message,
      status: err.response?.status,
      statusText: err.response?.statusText,
      responseData: JSON.stringify(err.response?.data)?.substring(0, 500),
      code: err.code,
    };
  }
}

// ── Test 4: Vertex AI with systemInstruction (Gemini 1.5+ feature) ──
async function testVertexWithSystemInstruction() {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!;
    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const model = process.env.VERTEX_MODEL_CHAT || 'gemini-1.5-flash';

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: 'Eres Lissa, una asistente virtual amigable de una correduría de seguros en Panamá. Hablas en español, eres cálida y cercana. Usas "tú" y emojis moderados.' }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: 'Hola, quiero saber sobre seguros de auto' }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 512,
      },
    };

    const start = Date.now();
    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: requestBody,
    });

    const elapsed = Date.now() - start;
    const data: any = response.data;
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;

    return {
      test: 'vertex_with_system_instruction',
      pass: true,
      reply,
      tokensUsed,
      elapsedMs: elapsed,
    };
  } catch (err: any) {
    return {
      test: 'vertex_with_system_instruction',
      pass: false,
      error: err.message,
      status: err.response?.status,
      responseData: JSON.stringify(err.response?.data)?.substring(0, 500),
    };
  }
}

// ── Test 5: Full Lissa chat simulation ──
async function testLissaChat(userMessage: string) {
  try {
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!;
    const credentials = JSON.parse(credentialsJson);
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const client = await auth.getClient();

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const model = process.env.VERTEX_MODEL_CHAT || 'gemini-1.5-flash';

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const systemPrompt = `Eres Lissa, la asistente virtual de Líderes en Seguros, una correduría de seguros en Panamá. Hablas como una persona real: cálida, empática, cercana. Usas "tú" y un tono conversacional natural, como si fueras una amiga que sabe mucho de seguros.

Tu personalidad:
- Eres genuinamente amable y te importa ayudar
- Usas emojis de forma natural pero sin exagerar (💚 👋 😊 📋)
- Haces preguntas de seguimiento para entender mejor
- Muestras interés real en lo que la persona necesita
- NUNCA suenas como un robot ni repites plantillas

Reglas:
1. Siempre en español
2. No inventas coberturas ni detalles de pólizas
3. Para cotizar, diriges a: https://portal.lideresenseguros.com/cotizadores
4. Si no puedes resolver algo, ofreces: contacto@lideresenseguros.com o 223-2373`;

    const requestBody = {
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 1024,
      },
    };

    const start = Date.now();
    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: requestBody,
    });

    const elapsed = Date.now() - start;
    const data: any = response.data;
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
    const tokensUsed = data?.usageMetadata?.totalTokenCount || 0;
    const finishReason = data?.candidates?.[0]?.finishReason || 'unknown';

    return {
      test: 'lissa_chat',
      pass: true,
      userMessage,
      reply,
      tokensUsed,
      elapsedMs: elapsed,
      finishReason,
    };
  } catch (err: any) {
    return {
      test: 'lissa_chat',
      pass: false,
      userMessage,
      error: err.message,
      status: err.response?.status,
      responseData: JSON.stringify(err.response?.data)?.substring(0, 500),
    };
  }
}

// ── Test: Model discovery via Vertex AI (service account) ──
async function testVertexModels() {
  const models = ['gemini-1.5-flash', 'gemini-1.5-flash-001', 'gemini-1.5-flash-002', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-001'];

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON!;
  const credentials = JSON.parse(credentialsJson);
  const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

  const results: any[] = [];
  for (const model of models) {
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
    try {
      const start = Date.now();
      const res = await client.request({ url: endpoint, method: 'POST', data: { contents: [{ role: 'user', parts: [{ text: 'Di solo: OK' }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } } });
      const reply = (res.data as any)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      results.push({ model, api: 'vertex', status: '✅', reply: reply.trim(), ms: Date.now() - start });
    } catch (err: any) {
      results.push({ model, api: 'vertex', status: '❌', error: err.response?.status || err.message });
    }
  }
  return results;
}

// ── Test: Model discovery via Gemini API (API key) ──
async function testGeminiApiModels() {
  const apiKey = process.env.VERTEX_API_KEY;
  if (!apiKey) return [{ api: 'gemini_api', status: '❌', error: 'No VERTEX_API_KEY set' }];

  const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-1.5-pro-latest', 'gemini-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-2.5-flash-preview-04-17', 'gemini-2.5-pro-preview-03-25'];

  const results: any[] = [];
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const start = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Di solo: OK' }] }], generationConfig: { temperature: 0, maxOutputTokens: 10 } }),
      });
      const data = await res.json();
      if (!res.ok) {
        results.push({ model, api: 'gemini_api', status: '❌', error: res.status, detail: (data as any)?.error?.message?.substring(0, 100) });
      } else {
        const reply = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        results.push({ model, api: 'gemini_api', status: '✅', reply: reply.trim(), ms: Date.now() - start });
      }
    } catch (err: any) {
      results.push({ model, api: 'gemini_api', status: '❌', error: err.message });
    }
  }
  return results;
}

// ── Full Lissa test using Gemini API with API key ──
async function testLissaGeminiApi(userMessage: string, model: string) {
  const apiKey = process.env.VERTEX_API_KEY;
  if (!apiKey) return { test: 'lissa_gemini_api', pass: false, error: 'No API key' };

  const systemPrompt = `Eres Lissa, la asistente virtual de Líderes en Seguros en Panamá. Hablas como una persona real: cálida, empática, cercana. Usas "tú" y un tono conversacional. Usas emojis moderados. Siempre en español. Para cotizar: https://portal.lideresenseguros.com/cotizadores. Contacto: contacto@lideresenseguros.com o 223-2373.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const start = Date.now();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userMessage }] }],
        generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 1024 },
      }),
    });
    const data: any = await res.json();
    if (!res.ok) return { test: 'lissa_gemini_api', pass: false, model, userMessage, error: data?.error?.message };
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(empty)';
    return { test: 'lissa_gemini_api', pass: true, model, userMessage, reply, ms: Date.now() - start };
  } catch (err: any) {
    return { test: 'lissa_gemini_api', pass: false, model, userMessage, error: err.message };
  }
}

// ── GET handler — run all tests ──
export async function GET(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  console.log('[VERTEX-TEST] Running diagnostic tests...');
  const results: any[] = [];

  // 1. Env vars
  results.push(testEnvVars());

  // 2. Auth client
  results.push(await testAuthClient());

  // 3. Vertex AI models (service account)
  const vertexModels = await testVertexModels();
  results.push({ test: 'vertex_ai_models', details: vertexModels });

  // 4. Gemini API models (API key)
  const geminiModels = await testGeminiApiModels();
  results.push({ test: 'gemini_api_models', details: geminiModels });

  // Find best working approach
  const workingVertex = vertexModels.find((r: any) => r.status === '✅');
  const workingGemini = geminiModels.find((r: any) => r.status === '✅');

  let bestApi = '';
  let bestModel = '';

  if (workingGemini) {
    bestApi = 'gemini_api';
    bestModel = workingGemini.model;
  } else if (workingVertex) {
    bestApi = 'vertex';
    bestModel = workingVertex.model;
  }

  // 5. Full Lissa tests with the working model
  if (bestModel) {
    const testMsgs = [
      'Hola, buenos días',
      'Qué significa deducible?',
      'Quiero cotizar un seguro de auto, cómo hago?',
      'Tengo una duda sobre mi cobertura de salud',
      'Tengo un problema con mi pago y nadie me ayuda',
    ];

    if (bestApi === 'gemini_api') {
      for (const msg of testMsgs) {
        results.push(await testLissaGeminiApi(msg, bestModel));
      }
    } else {
      const orig = process.env.VERTEX_MODEL_CHAT;
      process.env.VERTEX_MODEL_CHAT = bestModel;
      for (const msg of testMsgs) {
        results.push(await testLissaChat(msg));
      }
      process.env.VERTEX_MODEL_CHAT = orig;
    }
  } else {
    results.push({ test: 'lissa_tests', pass: false, error: 'No working model found via either API' });
  }

  return json({
    summary: bestModel ? `✅ FOUND WORKING MODEL: ${bestModel} via ${bestApi}` : '❌ NO WORKING MODEL FOUND',
    timestamp: new Date().toISOString(),
    recommendation: bestModel ? { api: bestApi, model: bestModel, action: bestApi === 'gemini_api' ? 'Switch chat code to use Gemini API with VERTEX_API_KEY' : `Set VERTEX_MODEL_CHAT=${bestModel}` } : { action: 'Enable Vertex AI Generative AI API in GCP console, or get a valid Gemini API key' },
    results,
  });
}

// ── POST handler — test with custom message ──
export async function POST(request: NextRequest) {
  const authErr = requireCronSecret(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const message = body.message || 'Hola, ¿qué servicios ofrecen?';
    const result = await testLissaChat(message);
    return json(result);
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }
}
