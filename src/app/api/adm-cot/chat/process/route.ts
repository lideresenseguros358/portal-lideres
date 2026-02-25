/**
 * ADM COT — Chat Process Endpoint
 * 
 * POST /api/adm-cot/chat/process
 * 
 * Receives a user message, stores it, calls OpenAI for:
 *   - Classification (CONSULTA | COTIZACION | SOPORTE | QUEJA)
 *   - Complex complaint detection
 *   - Summary generation
 *   - Identity verification requirement check
 *   - Reply generation
 * 
 * If complex → creates task, escalates, sends email.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendEmail } from '@/server/email/sendEmail';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const openaiKey = process.env.OPENAI_API_KEY!;
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const ESCALATION_EMAIL = 'contacto@lideresenseguros.com';

function getSb() { return createClient(supabaseUrl, supabaseServiceKey); }

async function getMasterUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    } as any);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    return profile?.role === 'master' ? user.id : null;
  } catch { return null; }
}

// ═══════════════════════════════════════
// OpenAI call
// ═══════════════════════════════════════

const SYSTEM_PROMPT = `Eres el asistente virtual de Líderes en Seguros, una correduría de seguros en Panamá.

Tu rol:
1. Responder consultas sobre seguros de auto (coberturas, precios, procesos).
2. Clasificar la intención del usuario.
3. Detectar si es una queja compleja (amenaza legal, reclamo formal, cobro indebido, error en póliza).
4. Generar un resumen corto de la conversación.
5. Detectar si el usuario pide información sensible que requiere verificación de identidad.

Idioma: Español.

IMPORTANTE: Responde SIEMPRE en formato JSON con exactamente estas claves:
{
  "classification": "CONSULTA" | "COTIZACION" | "SOPORTE" | "QUEJA",
  "is_complex": true | false,
  "complex_reason": "razón si es compleja" | null,
  "summary": "resumen corto de la conversación",
  "requires_identity_verification": true | false,
  "reply": "tu respuesta al usuario en español"
}

Marca is_complex=true si detectas:
- Amenaza legal o mención de abogado/demanda
- Reclamo formal por cobro indebido
- Error grave en póliza (cobertura incorrecta, datos erróneos)
- Palabras como: "demanda", "abogado", "denuncia", "superintendencia", "defensor del asegurado", "cobro indebido", "fraude", "estafa"

Marca requires_identity_verification=true si el usuario solicita:
- Información de su póliza
- Datos de pagos
- Estado de reclamos
- Información personal almacenada
- Cualquier dato sensible`;

async function callOpenAI(messages: { role: string; content: string }[], knowledgeContext?: string): Promise<any> {
  const systemMessages: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  
  if (knowledgeContext) {
    systemMessages.push({
      role: 'system',
      content: `Contexto de base de conocimiento para esta conversación:\n${knowledgeContext}`,
    });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [...systemMessages, ...messages],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const tokensUsed = data.usage?.total_tokens || 0;

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {
      classification: 'CONSULTA',
      is_complex: false,
      complex_reason: null,
      summary: '',
      requires_identity_verification: false,
      reply: content || 'Lo siento, no pude procesar tu mensaje.',
    };
  }

  return { ...parsed, tokens_used: tokensUsed };
}

// ═══════════════════════════════════════
// Knowledge base context builder
// ═══════════════════════════════════════

async function buildKnowledgeContext(sb: any, cedula?: string): Promise<string> {
  const parts: string[] = [];

  // If we have a cedula, look up client data
  if (cedula) {
    const { data: policies } = await sb.from('policies')
      .select('policy_number, insurer, ramo, coverage_type, status, start_date, end_date, premium')
      .eq('cedula', cedula)
      .limit(5);
    if (policies && policies.length > 0) {
      parts.push(`Pólizas del cliente (cédula ${cedula}):\n${JSON.stringify(policies, null, 2)}`);
    }

    const { data: clients } = await sb.from('clients')
      .select('name, phone, email, region')
      .eq('cedula', cedula)
      .limit(1);
    if (clients && clients.length > 0) {
      parts.push(`Datos del cliente: ${JSON.stringify(clients[0])}`);
    }
  }

  // General coverage info
  parts.push(`Aseguradoras disponibles: FEDPA Seguros, Internacional de Seguros.
Ramos: AUTO (Cobertura Completa, Daños a Terceros).
Formas de pago: Contado, 2 cuotas semestrales, 4 cuotas trimestrales, 12 cuotas mensuales.
Para cotizar: visitatr la página de cotizador en el portal.`);

  return parts.join('\n\n');
}

// ═══════════════════════════════════════
// Identity verification
// ═══════════════════════════════════════

const IDENTITY_FIELDS: { key: string; label: string }[] = [
  { key: 'nro_poliza', label: 'número de póliza' },
  { key: 'cedula', label: 'cédula' },
  { key: 'client_name', label: 'nombre completo' },
  { key: 'region', label: 'provincia/región' },
  { key: 'phone', label: 'teléfono registrado' },
];

function selectRandomChallenges(count: number = 3): typeof IDENTITY_FIELDS {
  const shuffled = [...IDENTITY_FIELDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function verifyIdentity(sb: any, answers: Record<string, string>): Promise<boolean> {
  // Try to find a matching client/policy
  const conditions: string[] = [];
  
  if (answers.cedula) {
    const { data } = await sb.from('clients')
      .select('name, phone, region')
      .eq('cedula', answers.cedula)
      .maybeSingle();
    
    if (!data) return false;

    let matches = 1; // cedula already matched
    if (answers.client_name && data.name?.toLowerCase().includes(answers.client_name.toLowerCase())) matches++;
    if (answers.phone && data.phone?.includes(answers.phone.replace(/\D/g, ''))) matches++;
    if (answers.region && data.region?.toLowerCase().includes(answers.region.toLowerCase())) matches++;
    
    return matches >= 2;
  }

  if (answers.nro_poliza) {
    const { data } = await sb.from('policies')
      .select('cedula, insured_name')
      .eq('policy_number', answers.nro_poliza)
      .maybeSingle();
    
    if (!data) return false;
    
    let matches = 1; // policy matched
    if (answers.cedula && data.cedula === answers.cedula) matches++;
    if (answers.client_name && data.insured_name?.toLowerCase().includes(answers.client_name.toLowerCase())) matches++;
    
    return matches >= 2;
  }

  return false;
}

// ═══════════════════════════════════════
// Escalation email sender
// ═══════════════════════════════════════

async function sendEscalationEmail(conversation: any, summary: string, messages: any[], complexReason: string) {
  try {
    const messageHistory = messages
      .map((m: any) => `[${m.role}] ${m.content}`)
      .join('\n\n');

    const html = `
      <h2 style="color: #dc2626;">⚠️ QUEJA COMPLEJA DETECTADA</h2>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Conversación ID</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.id}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cliente</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.client_name || 'No identificado'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cédula</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.cedula || '—'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Teléfono</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.phone || '—'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.email || '—'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Origen</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.source}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Clasificación</td><td style="padding: 8px; border: 1px solid #ddd;">QUEJA</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Razón compleja</td><td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">${complexReason}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Resumen IA</td><td style="padding: 8px; border: 1px solid #ddd;">${summary}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Región</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.region || '—'}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toISOString()}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">IP</td><td style="padding: 8px; border: 1px solid #ddd;">${conversation.ip_address || '—'}</td></tr>
      </table>
      <h3>Historial completo:</h3>
      <pre style="background: #f3f4f6; padding: 16px; border-radius: 8px; font-size: 12px; white-space: pre-wrap;">${messageHistory}</pre>
      <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Prioridad: <strong style="color: #dc2626;">URGENTE</strong> — Generado automáticamente por ADM COT</p>
    `;

    const result = await sendEmail({
      to: ESCALATION_EMAIL,
      subject: `⚠️ QUEJA COMPLEJA — ${conversation.client_name || 'Cliente no identificado'} — ${complexReason}`,
      html,
      fromType: 'PORTAL',
      metadata: {
        type: 'adm_cot_escalation',
        conversationId: conversation.id,
        complexReason,
      },
    });

    if (result.success) {
      console.log('[CHAT ESCALATION] Email sent via ZeptoMail to', ESCALATION_EMAIL);
    } else {
      console.error('[CHAT ESCALATION] ZeptoMail failed:', result.error);
    }
  } catch (err) {
    console.error('[CHAT ESCALATION] Email failed:', err);
  }
}

// ═══════════════════════════════════════
// POST handler
// ═══════════════════════════════════════

export async function POST(request: NextRequest) {
  const sb = getSb();

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {

      // ── Process a new message ──
      case 'process_message': {
        const { conversation_id, message, source, phone, email, cedula, client_name, session_id, ip_address, region } = body;
        
        if (!message?.trim()) {
          return NextResponse.json({ error: 'Empty message' }, { status: 400 });
        }

        let convId = conversation_id;

        // Create conversation if new
        if (!convId) {
          const { data: conv, error: convErr } = await sb.from('adm_cot_conversations').insert({
            source: source || 'PORTAL',
            phone: phone || null,
            email: email || null,
            cedula: cedula || null,
            client_name: client_name || null,
            session_id: session_id || null,
            ip_address: ip_address || null,
            region: region || null,
            status: 'OPEN',
          }).select('id').single();
          if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 });
          convId = conv.id;
        }

        // Store user message
        await sb.from('adm_cot_messages').insert({
          conversation_id: convId,
          role: 'USER',
          content: message,
        });

        // Fetch conversation history for context
        const { data: prevMessages } = await sb.from('adm_cot_messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(20);

        const chatHistory = (prevMessages ?? []).map((m: any) => ({
          role: m.role === 'USER' ? 'user' : m.role === 'SYSTEM' ? 'system' : 'assistant',
          content: m.content,
        }));

        // Build knowledge context
        const { data: conv } = await sb.from('adm_cot_conversations')
          .select('cedula').eq('id', convId).single();
        const knowledgeCtx = await buildKnowledgeContext(sb, conv?.cedula || cedula);

        // Call OpenAI
        const aiResult = await callOpenAI(chatHistory, knowledgeCtx);

        // Store assistant reply
        await sb.from('adm_cot_messages').insert({
          conversation_id: convId,
          role: 'ASSISTANT',
          content: aiResult.reply,
          tokens_used: aiResult.tokens_used || 0,
          metadata: {
            classification: aiResult.classification,
            is_complex: aiResult.is_complex,
            summary: aiResult.summary,
          },
        });

        // Update conversation classification & summary
        const updateData: any = {
          classification: aiResult.classification,
          ai_summary: aiResult.summary,
        };

        // Handle complex complaint detection
        if (aiResult.is_complex && !body.already_escalated) {
          updateData.is_complex = true;
          updateData.status = 'ESCALATED';
          updateData.escalated_at = new Date().toISOString();
          updateData.escalated_reason = aiResult.complex_reason || 'Queja compleja detectada por IA';

          // Create urgent task
          await sb.from('adm_cot_tasks').insert({
            conversation_id: convId,
            status: 'OPEN',
            priority: 'URGENTE',
            summary: aiResult.summary || `Queja compleja: ${aiResult.complex_reason}`,
          });

          // Send escalation email
          const { data: fullConv } = await sb.from('adm_cot_conversations')
            .select('*').eq('id', convId).single();
          const { data: allMessages } = await sb.from('adm_cot_messages')
            .select('role, content, created_at')
            .eq('conversation_id', convId)
            .order('created_at', { ascending: true });

          await sendEscalationEmail(
            fullConv || { id: convId, source: source || 'PORTAL' },
            aiResult.summary,
            allMessages || [],
            aiResult.complex_reason || 'Queja compleja',
          );
        }

        await sb.from('adm_cot_conversations').update(updateData).eq('id', convId);

        // Audit
        await sb.from('adm_cot_audit_log').insert({
          event_type: 'chat_message_processed',
          entity_type: 'conversation',
          entity_id: convId,
          detail: {
            classification: aiResult.classification,
            is_complex: aiResult.is_complex,
            tokens_used: aiResult.tokens_used,
          },
        });

        return NextResponse.json({
          success: true,
          data: {
            conversation_id: convId,
            reply: aiResult.reply,
            classification: aiResult.classification,
            is_complex: aiResult.is_complex,
            summary: aiResult.summary,
            requires_identity_verification: aiResult.requires_identity_verification,
          },
        });
      }

      // ── Get identity verification challenges ──
      case 'get_identity_challenges': {
        const challenges = selectRandomChallenges(3);
        return NextResponse.json({
          success: true,
          data: { challenges: challenges.map(c => ({ key: c.key, label: c.label })) },
        });
      }

      // ── Verify identity ──
      case 'verify_identity': {
        const { conversation_id: vConvId, answers } = body;
        if (!answers || Object.keys(answers).length === 0) {
          return NextResponse.json({ error: 'No answers provided' }, { status: 400 });
        }

        const verified = await verifyIdentity(sb, answers);

        if (vConvId) {
          // Store system message about verification
          await sb.from('adm_cot_messages').insert({
            conversation_id: vConvId,
            role: 'SYSTEM',
            content: verified
              ? 'Identidad verificada exitosamente.'
              : 'Verificación de identidad fallida. No se revelará información sensible.',
            metadata: { verification_result: verified },
          });

          // Fetch current metadata and merge
          const { data: currentConv } = await sb.from('adm_cot_conversations')
            .select('metadata').eq('id', vConvId).single();
          const merged = { ...(currentConv?.metadata || {}), identity_verified: verified };
          await sb.from('adm_cot_conversations').update({ metadata: merged }).eq('id', vConvId);
        }

        return NextResponse.json({ success: true, data: { verified } });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[ADM-COT CHAT] Error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
