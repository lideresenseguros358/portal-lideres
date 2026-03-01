/**
 * AI Engine — Evaluate Urgency Effectiveness
 * Analyzes chat/email thread to score effectiveness + sentiment.
 * Saves result to ops_ai_evaluations + ops_ai_training_events.
 */

import { getAiProvider } from './aiProvider';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const EVAL_SYSTEM_PROMPT = `Eres un evaluador de calidad de atención al cliente para Líderes en Seguros (correduría de seguros en Panamá).

Analiza el hilo de mensajes de un caso urgente y evalúa:

1. **final_sentiment_label**: ¿Cómo terminó el cliente? "positive" | "neutral" | "negative"
2. **final_sentiment_score**: 0-100 (0=muy negativo, 50=neutral, 100=muy positivo)
3. **effectiveness_score**: 0-100, score de efectividad de la atención humana.
   - Base: final_sentiment_score
   - Penalizar si: primera respuesta > SLA (-20), cliente sigue negativo al final (-30), múltiples mensajes sin respuesta (-15)
   - Bonificar si: disculpa + solución clara + siguiente paso (+10)
4. **escalation_recommended**: ¿Debería escalarse a supervisión? true/false
5. **unresolved_signals**: Array de señales no resueltas detectadas. Ej: ["amenaza_legal", "cobro_incorrecto", "sin_solucion"]
6. **rationale**: Explicación concisa (1-3 líneas) de por qué calificaste así.
7. **improvements**: Array de 1-3 bullets de qué mejorar.

REGLAS:
- Solo analiza lo que está en los mensajes.
- No inventes datos.
- Si no hay suficientes mensajes, indica baja confianza en rationale.
- NO incluyas datos personales del cliente en la salida (ni nombre, ni cédula, ni teléfono).

Responde SOLO JSON válido:
{
  "final_sentiment_label": "positive" | "neutral" | "negative",
  "final_sentiment_score": number,
  "effectiveness_score": number,
  "escalation_recommended": boolean,
  "unresolved_signals": ["signal1"],
  "rationale": "explicación corta",
  "improvements": ["mejora1", "mejora2"]
}`;

interface EvalInput {
  caseId: string;
  sourceType: 'adm_cot_chat' | 'ops_email_thread';
  sourceId?: string;
}

export async function evaluateUrgencyEffectiveness(input: EvalInput): Promise<{
  success: boolean;
  evaluationId?: string;
  error?: string;
}> {
  const supabase = getSupabaseAdmin() as any;
  const provider = getAiProvider();

  try {
    // 1. Get case data
    const { data: caseData, error: caseErr } = await supabase
      .from('ops_cases')
      .select('id, ticket, case_type, status, created_at, first_response_at, closed_at, assigned_master_id, sla_breached, chat_thread_id')
      .eq('id', input.caseId)
      .single();

    if (caseErr || !caseData) {
      return { success: false, error: 'Case not found' };
    }

    // 2. Get messages from the thread
    let messages: { direction: string; body: string; created_at: string; ai_generated?: boolean }[] = [];

    if (input.sourceType === 'adm_cot_chat' && caseData.chat_thread_id) {
      // Get from chat_messages (WhatsApp/ADM COT)
      const { data: chatMsgs } = await supabase
        .from('chat_messages')
        .select('direction, body, created_at, ai_generated')
        .eq('thread_id', caseData.chat_thread_id)
        .order('created_at', { ascending: true })
        .limit(50);
      messages = chatMsgs || [];
    } else {
      // Get from ops_case_messages (email thread)
      const { data: emailMsgs } = await supabase
        .from('ops_case_messages')
        .select('direction, body_text, received_at')
        .eq('case_id', input.caseId)
        .order('received_at', { ascending: true })
        .limit(50);
      messages = (emailMsgs || []).map((m: any) => ({
        direction: m.direction,
        body: m.body_text || '',
        created_at: m.received_at,
      }));
    }

    if (messages.length === 0) {
      return { success: false, error: 'No messages found for evaluation' };
    }

    // 3. Build user prompt with timeline
    const slaBreached = caseData.sla_breached;
    let firstResponseHours = 0;
    if (caseData.first_response_at && caseData.created_at) {
      firstResponseHours = (new Date(caseData.first_response_at).getTime() - new Date(caseData.created_at).getTime()) / 3600000;
    }

    const threadSummary = messages.map((m, i) => {
      const role = m.direction === 'inbound' ? 'CLIENTE' : (m.ai_generated ? 'IA' : 'HUMANO');
      return `[${i + 1}] ${role}: ${(m.body || '').substring(0, 300)}`;
    }).join('\n');

    const userPrompt = `CASO: ${caseData.ticket}
Tipo: ${caseData.case_type}
Estado: ${caseData.status}
SLA breached: ${slaBreached ? 'SÍ' : 'NO'}
Primera respuesta: ${firstResponseHours.toFixed(1)}h después de creación
Total mensajes: ${messages.length}

HILO DE MENSAJES:
${threadSummary}

Evalúa la efectividad de la atención.`;

    // 4. Call AI provider
    const aiResult = await provider.callJson({
      systemPrompt: EVAL_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.2,
      maxTokens: 512,
    });

    const p = aiResult.parsed;

    // 5. Apply rule-based adjustments
    let effectivenessScore = Number(p.effectiveness_score) || 50;
    const sentimentScore = Number(p.final_sentiment_score) || 50;
    const sentimentLabel = (['positive', 'neutral', 'negative'].includes(p.final_sentiment_label))
      ? p.final_sentiment_label : 'neutral';

    // Penalty: SLA breached
    if (slaBreached) effectivenessScore = Math.max(0, effectivenessScore - 20);
    // Penalty: still negative at end
    if (sentimentLabel === 'negative') effectivenessScore = Math.max(0, effectivenessScore - 30);

    effectivenessScore = Math.min(100, Math.max(0, effectivenessScore));

    // 6. Save evaluation
    const { data: evalRow, error: evalErr } = await supabase
      .from('ops_ai_evaluations')
      .insert({
        case_id: input.caseId,
        source_type: input.sourceType,
        source_id: input.sourceId || caseData.chat_thread_id || null,
        evaluator_version: 'v1',
        final_sentiment_label: sentimentLabel,
        final_sentiment_score: sentimentScore,
        effectiveness_score: effectivenessScore,
        escalation_recommended: !!p.escalation_recommended,
        unresolved_signals: p.unresolved_signals || [],
        rationale: p.rationale || null,
        evidence: {
          message_count: messages.length,
          first_response_hours: firstResponseHours,
          sla_breached: slaBreached,
          improvements: p.improvements || [],
          ai_provider: aiResult.provider,
          ai_model: aiResult.model,
          tokens: aiResult.tokens,
        },
      })
      .select('id')
      .single();

    if (evalErr) throw evalErr;

    // 7. Log training event
    await supabase.from('ops_ai_training_events').insert({
      case_id: input.caseId,
      event_type: 'score_case',
      payload: {
        effectiveness_score: effectivenessScore,
        sentiment_label: sentimentLabel,
        sentiment_score: sentimentScore,
        escalation_recommended: !!p.escalation_recommended,
      },
      model_provider: aiResult.provider,
      model_name: aiResult.model,
      success: true,
    });

    // 8. Activity log
    await supabase.from('ops_activity_log').insert({
      user_id: null,
      action_type: 'status_change',
      entity_type: 'case',
      entity_id: input.caseId,
      metadata: {
        action: 'ai_case_scored',
        effectiveness_score: effectivenessScore,
        sentiment: sentimentLabel,
      },
    });

    // 9. If escalation recommended, log it
    if (p.escalation_recommended) {
      await supabase.from('ops_activity_log').insert({
        user_id: null,
        action_type: 'status_change',
        entity_type: 'case',
        entity_id: input.caseId,
        metadata: {
          action: 'ai_escalation_recommended',
          reason: p.rationale,
          signals: p.unresolved_signals,
        },
      });
    }

    return { success: true, evaluationId: evalRow?.id };
  } catch (err: any) {
    // Log failure
    await supabase.from('ops_ai_training_events').insert({
      case_id: input.caseId,
      event_type: 'score_case',
      payload: { error: err.message },
      model_provider: provider.name,
      model_name: null,
      success: false,
      error: err.message,
    }).catch(() => {});

    console.error('[AI-EVAL] evaluateUrgencyEffectiveness error:', err.message);
    return { success: false, error: err.message };
  }
}
