import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        new URL("/login?error=missing_code", request.url)
      );
    }

    const supabase = await getSupabaseServer();
    
    // Intercambiar código por sesión
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error en exchangeCodeForSession:', error);
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url)
      );
    }

    if (!data.session) {
      return NextResponse.redirect(
        new URL("/login?error=no_session", request.url)
      );
    }

    // Obtener perfil del usuario
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", data.session.user.id)
      .single();

    // Detectar recovery: por recovery_sent_at del usuario
    const isRecovery = !!data.session.user.recovery_sent_at;

    if (isRecovery) {
      return NextResponse.redirect(new URL("/update-password", request.url));
    }

    // Verificar si debe cambiar contraseña
    const mustChange =
      (profile?.must_change_password ?? false) || 
      data.session.user.user_metadata?.tempPassword === true;

    if (mustChange) {
      return NextResponse.redirect(new URL("/account?forcePassword=1", request.url));
    }

    // Login normal exitoso
    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error('Error en callback:', error);
    return NextResponse.redirect(
      new URL("/login?error=callback_error", request.url)
    );
  }
}
