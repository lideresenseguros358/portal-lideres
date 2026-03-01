/**
 * AI Provider — Unified interface for AI calls
 * Supports: vertex (Gemini), openai, mock
 * Configured via AI_PROVIDER env var (default: openai)
 */

export interface AiJsonRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AiJsonResponse {
  parsed: Record<string, any>;
  raw: string;
  tokens: number;
  provider: string;
  model: string;
}

export interface AiProvider {
  name: string;
  callJson(req: AiJsonRequest): Promise<AiJsonResponse>;
}

export function getAiProvider(): AiProvider {
  const providerName = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  switch (providerName) {
    case 'vertex':
      return new VertexProvider();
    case 'openai':
      return new OpenAIProvider();
    case 'mock':
      return new MockProvider();
    default:
      console.warn(`[AI] Unknown provider "${providerName}", falling back to openai`);
      return new OpenAIProvider();
  }
}

// ════════════════════════════════════════════
// OpenAI Provider (reuses existing OPENAI_API_KEY)
// ════════════════════════════════════════════

class OpenAIProvider implements AiProvider {
  name = 'openai';

  async callJson(req: AiJsonRequest): Promise<AiJsonResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
    const model = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxTokens ?? 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '{}';
    const tokens = data.usage?.total_tokens || 0;
    let parsed: Record<string, any>;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return { parsed, raw, tokens, provider: 'openai', model };
  }
}

// ════════════════════════════════════════════
// Vertex AI Provider (reuses existing GOOGLE_APPLICATION_CREDENTIALS_JSON)
// ════════════════════════════════════════════

class VertexProvider implements AiProvider {
  name = 'vertex';

  async callJson(req: AiJsonRequest): Promise<AiJsonResponse> {
    const { GoogleAuth } = await import('google-auth-library');
    const credJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (!credJson) throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON not configured');

    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    const model = process.env.VERTEX_MODEL_CHAT || 'gemini-2.0-flash';
    if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT_ID not configured');

    let credentials: any;
    try { credentials = JSON.parse(credJson); } catch { throw new Error('Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON'); }

    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
    const client = await auth.getClient();

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;

    const response = await client.request({
      url: endpoint,
      method: 'POST',
      data: {
        systemInstruction: { parts: [{ text: req.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
        generationConfig: {
          temperature: req.temperature ?? 0.2,
          topP: 0.8,
          maxOutputTokens: req.maxTokens ?? 1024,
          responseMimeType: 'application/json',
        },
      },
    });

    const data: any = response.data;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const tokens = data?.usageMetadata?.totalTokenCount || 0;
    let parsed: Record<string, any>;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return { parsed, raw, tokens, provider: 'vertex', model };
  }
}

// ════════════════════════════════════════════
// Mock Provider (for dev/testing)
// ════════════════════════════════════════════

class MockProvider implements AiProvider {
  name = 'mock';

  async callJson(_req: AiJsonRequest): Promise<AiJsonResponse> {
    const mockResult = {
      final_sentiment_label: 'neutral',
      final_sentiment_score: 55,
      effectiveness_score: 72,
      escalation_recommended: false,
      unresolved_signals: [],
      rationale: 'Mock evaluation — no real AI analysis performed.',
      improvements: ['Configurar proveedor IA real para evaluaciones precisas.'],
      // Learning fields
      policy_applied: 'Mock policy',
      steps: ['Paso 1: Mock'],
      template: 'Mock template response',
      domain: 'procedimiento',
      title: 'Mock learned item',
      content: 'Mock content for testing.',
      tags: ['mock', 'test'],
      confidence: 0.3,
    };

    return {
      parsed: mockResult,
      raw: JSON.stringify(mockResult),
      tokens: 0,
      provider: 'mock',
      model: 'mock-v1',
    };
  }
}
