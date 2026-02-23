import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

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
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://portal.lideresenseguros.com';

  if (!eventId || !response) {
    return NextResponse.redirect(`${appUrl}/agenda`);
  }

  // Redirigir a la agenda con parámetros para que el frontend procese el RSVP
  // El usuario necesita sesión iniciada, así que redirigimos a la agenda
  // con query params que el frontend puede usar para confirmar
  const redirectUrl = `${appUrl}/agenda?rsvp=${eventId}&response=${response}`;
  
  return NextResponse.redirect(redirectUrl);
}
