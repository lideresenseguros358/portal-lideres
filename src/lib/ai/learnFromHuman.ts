/**
 * AI Engine — Learn From Human Intervention
 * Extracts policies, procedures, and response templates
 * from human replies in urgent cases and saves them as AI memory items.
 */

import { getAiProvider } from './aiProvider';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

const LEARN_SYSTEM_PROMPT = `Eres un sistema de extracción de conocimiento para Líderes en Seguros (correduría en Panamá).

Tu tarea: analizar la respuesta humana en un caso urgente y extraer conocimiento reutilizable.

Del hilo de mensajes, extrae:

1. **policy_applied**: ¿Qué política o procedimiento aplicó el humano? (ej: "reembolso parcial", "corrección de póliza", "explicación de cobro"). Si no es claro, pon "general".
2. **steps**: Array de pasos que siguió el humano (checklist). Máx 5 pasos cortos.
3. **template**: Estructura de respuesta útil (generalizada, sin datos del cliente). Usa "el cliente" en vez de nombres.
4. **domain**: Categoría del conocimiento: "quejas" | "pagos" | "renovaciones" | "politicas" | "tono" | "procedimiento"
5. **title**: Título corto para este item de memoria (ej: "Proceso de reembolso por cobro doble")
6. **content**: Resumen/guía de 2-5 líneas que un agente puede seguir en casos similares.
7. **tags**: Array de tags relevantes (max 5). Ej: ["reembolso", "cobro_doble", "queja", "auto"]
8. **confidence**: 0-1, qué tan seguro estás de que esto es conocimiento útil y correcto.

REGLAS:
- NO incluyas datos personales del cliente (nombre, cédula, teléfono, email).
- Generaliza: "el cliente" en vez del nombre real.
- Si la respuesta humana es muy genérica o no aporta conocimiento nuevo, pon confidence < 0.3.
- Solo extrae si hay contenido sustancial (no saludos genéricos).

Responde SOLO JSON válido:
{
  "policy_applied": "string",
  "steps": ["paso1", "paso2"],
  "template": "estructura de respuesta generalizada",
  "domain": "quejas",
  "title": "título corto",
  "content": "resumen/guía",
  "tags": ["tag1"],
  "confidence": 0.7
}`;

export async function learnFromHumanIntervention(caseId: string): Promise<{
  success: boolean;
  memoryId?: string;
  error?: string;
}> {
  const supabase = getSupabaseAdmin() as any;
  const provider = getAiProvider();

  try {
    // 1. Get case data
    const { data: caseData } = await supabase
      .from('ops_cases')
      .select('id, ticket, case_type, status, chat_thread_id, assigned_master_id')
      .eq('id', caseId)
      .single();

    if (!caseData) return { success: false, error: 'Case not found' };

    // 2. Get messages — find human replies
    let messages: { direction: string; body: string; ai_generated?: boolean; created_at: string }[] = [];

    if (caseData.chat_thread_id) {
      const { data: chatMsgs } = await supabase
        .from('chat_messages')
        .select('direction, body, ai_generated, created_at')
        .eq('thread_id', caseData.chat_thread_id)
        .order('created_at', { ascending: true })
        .limit(50);
      messages = chatMsgs || [];
    } else {
      const { data: emailMsgs } = await supabase
        .from('ops_case_messages')
        .select('direction, body_text, received_at')
        .eq('case_id', caseId)
        .order('received_at', { ascending: true })
        .limit(50);
      messages = (emailMsgs || []).map((m: any) => ({
        direction: m.direction,
        body: m.body_text || '',
        ai_generated: false,
        created_at: m.received_at,
      }));
    }

    // Filter to find human outbound messages (not AI-generated)
    const humanReplies = messages.filter(m => m.direction === 'outbound' && !m.ai_generated);
    if (humanReplies.length === 0) {
      return { success: false, error: 'No human replies found' };
    }

    // 3. Build context
    const threadSummary = messages.map((m, i) => {
      const role = m.direction === 'inbound' ? 'CLIENTE' : (m.ai_generated ? 'IA' : 'HUMANO');
      return `[${i + 1}] ${role}: ${(m.body || '').substring(0, 300)}`;
    }).join('\n');

    const userPrompt = `CASO: ${caseData.ticket} (${caseData.case_type})
Estado: ${caseData.status}
Respuestas humanas: ${humanReplies.length}

HILO COMPLETO:
${threadSummary}

Extrae el conocimiento de las respuestas humanas.`;

    // 4. Call AI
    const aiResult = await provider.callJson({
      systemPrompt: LEARN_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 512,
    });

    const p = aiResult.parsed;
    const confidence = Number(p.confidence) || 0;

    // 5. Only save if confidence is meaningful
    if (confidence < 0.3) {
      await supabase.from('ops_ai_training_events').insert({
        case_id: caseId,
        event_type: 'learn_from_human_reply',
        payload: { skipped: true, confidence, reason: 'Low confidence — no meaningful knowledge extracted' },
        model_provider: aiResult.provider,
        model_name: aiResult.model,
        success: true,
      });
      return { success: true, memoryId: undefined };
    }

    // 6. Check for duplicate memory items (same title + domain)
    const { data: existing } = await supabase
      .from('ops_ai_memory_items')
      .select('id')
      .eq('domain', p.domain || 'procedimiento')
      .eq('title', p.title || '')
      .limit(1);

    if (existing && existing.length > 0) {
      // Update confidence and last_used_at instead of creating duplicate
      await supabase.from('ops_ai_memory_items').update({
        confidence: Math.min(1, confidence + 0.1),
        last_used_at: new Date().toISOString(),
        metadata: {
          last_case_id: caseId,
          last_message_ids: humanReplies.map((_: any, i: number) => `msg_${i}`),
          updated_from_case: caseData.ticket,
        },
      }).eq('id', existing[0].id);

      await supabase.from('ops_ai_training_events').insert({
        case_id: caseId,
        event_type: 'learn_from_human_reply',
        payload: { updated_existing: existing[0].id, confidence },
        model_provider: aiResult.provider,
        model_name: aiResult.model,
        success: true,
      });

      return { success: true, memoryId: existing[0].id };
    }

    // 7. Create new memory item
    const validDomains = ['quejas', 'pagos', 'renovaciones', 'politicas', 'tono', 'procedimiento'];
    const domain = validDomains.includes(p.domain) ? p.domain : 'procedimiento';

    const { data: memoryRow, error: memErr } = await supabase
      .from('ops_ai_memory_items')
      .insert({
        created_by: 'auto',
        domain,
        title: p.title || `Conocimiento de caso ${caseData.ticket}`,
        content: p.content || '',
        tags: Array.isArray(p.tags) ? p.tags : [],
        confidence,
        metadata: {
          source_case_id: caseId,
          source_ticket: caseData.ticket,
          policy_applied: p.policy_applied || null,
          steps: p.steps || [],
          template: p.template || null,
          message_count: humanReplies.length,
          ai_provider: aiResult.provider,
        },
      })
      .select('id')
      .single();

    if (memErr) throw memErr;

    // 8. Log training event
    await supabase.from('ops_ai_training_events').insert({
      case_id: caseId,
      event_type: 'learn_from_human_reply',
      payload: {
        memory_id: memoryRow?.id,
        domain,
        title: p.title,
        confidence,
        tags: p.tags,
      },
      model_provider: aiResult.provider,
      model_name: aiResult.model,
      success: true,
    });

    // 9. Activity log
    await supabase.from('ops_activity_log').insert({
      user_id: null,
      action_type: 'status_change',
      entity_type: 'case',
      entity_id: caseId,
      metadata: {
        action: 'ai_memory_created',
        memory_id: memoryRow?.id,
        domain,
        title: p.title,
      },
    });

    return { success: true, memoryId: memoryRow?.id };
  } catch (err: any) {
    await supabase.from('ops_ai_training_events').insert({
      case_id: caseId,
      event_type: 'learn_from_human_reply',
      payload: { error: err.message },
      model_provider: provider.name,
      model_name: null,
      success: false,
      error: err.message,
    }).catch(() => {});

    console.error('[AI-LEARN] learnFromHumanIntervention error:', err.message);
    return { success: false, error: err.message };
  }
}
