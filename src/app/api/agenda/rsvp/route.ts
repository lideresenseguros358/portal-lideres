import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isValidUUID } from '@/lib/security/sanitize';

/**
 * GET /api/agenda/rsvp?eventId=xxx&response=yes|no
 * 
 * Endpoint público para RSVP desde correo electrónico.
 * Redirige al usuario a /agenda después de procesar.
 * El usuario debe tener sesión iniciada para ver la agenda.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const eventId = searchParams.get('eventId');
  const response = searchParams.get('response');

  // Build redirect from request origin to prevent open redirect
  const origin = request.nextUrl.origin;

  if (!eventId || !response) {
    return NextResponse.redirect(`${origin}/agenda`);
  }

  // Validate inputs to prevent injection in redirect URL
  if (!isValidUUID(eventId) || !['yes', 'no'].includes(response)) {
    return NextResponse.redirect(`${origin}/agenda`);
  }

  // Safe redirect: origin is always the app itself, params are validated
  const redirectUrl = `${origin}/agenda?rsvp=${eventId}&response=${response}`;
  
  return NextResponse.redirect(redirectUrl);
}
