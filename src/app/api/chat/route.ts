/**
 * PORTAL CHAT ENDPOINT
 * =====================
 * Receives messages from the portal's built-in chat widget.
 * Same pipeline as WhatsApp but channel = 'portal'.
 * 
 * POST /api/chat
 * Body: { message, cedula?, sessionId?, conversationHistory? }
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/chatProcessor';

// Simple in-memory rate limiter (per IP, 30 msgs/min)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    // Get client IP
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    // Rate limit by IP
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Demasiados mensajes. Espere un momento antes de intentar de nuevo.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { message, cedula, sessionId, conversationHistory } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
    }

    // Limit message length
    if (message.length > 2000) {
      return NextResponse.json({ error: 'Mensaje demasiado largo (máximo 2000 caracteres)' }, { status: 400 });
    }

    // Process through shared pipeline
    const result = await processMessage({
      message,
      channel: 'portal',
      cedula: cedula || null,
      sessionId: sessionId || null,
      ipAddress: ip,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : undefined,
    });

    return NextResponse.json({
      success: true,
      data: {
        reply: result.reply,
        intent: result.intent,
        escalated: result.escalated,
        clientIdentified: result.clientIdentified,
        requiresIdentityVerification: result.requiresIdentityVerification,
      },
    });
  } catch (err: any) {
    console.error('[PORTAL CHAT] Error:', err.message);
    return NextResponse.json(
      { error: 'Error procesando mensaje. Intente de nuevo.' },
      { status: 500 }
    );
  }
}
