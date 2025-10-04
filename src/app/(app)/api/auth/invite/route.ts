import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseServer();

    // Verificar autenticación y rol Master
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'master') {
      return NextResponse.json({ error: 'Solo Master puede enviar invitaciones' }, { status: 403 });
    }

    const body = await request.json();
    const { emails } = body;

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un email' }, { status: 400 });
    }

    // Validar formato de emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      return NextResponse.json({ 
        error: 'Emails inválidos', 
        invalid: invalidEmails 
      }, { status: 400 });
    }

    // Enviar invitaciones usando Supabase Admin API
    const results = [];
    const errors = [];

    for (const email of emails) {
      try {
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
        });

        if (error) {
          errors.push({ email, error: error.message });
        } else {
          results.push({ email, success: true, user_id: data.user?.id });
        }
      } catch (err: any) {
        errors.push({ email, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      invited: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error: any) {
    console.error('Error en invite:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al enviar invitaciones' 
    }, { status: 500 });
  }
}
