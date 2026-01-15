import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const token_hash = requestUrl.searchParams.get("token_hash");
    const type = requestUrl.searchParams.get("type");

    if (!code && !token_hash) {
      return NextResponse.redirect(
        new URL("/login?error=missing_code", request.url)
      );
    }

    const cookieStore = await cookies();
    
    // Crear cliente de Supabase para Route Handler con manejo correcto de cookies
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: any) {
            cookiesToSet.forEach(({ name, value, options }: any) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      } as any
    );
    
    let data, error;
    
    // Para recovery, verificar OTP directamente sin PKCE
    if (type === 'recovery' && token_hash) {
      const verifyResult = await supabase.auth.verifyOtp({
        token_hash,
        type: 'recovery'
      });
      data = verifyResult.data;
      error = verifyResult.error;
    } else if (code) {
      // Para login normal, usar exchangeCodeForSession
      const exchangeResult = await supabase.auth.exchangeCodeForSession(code);
      data = exchangeResult.data;
      error = exchangeResult.error;
    } else {
      return NextResponse.redirect(
        new URL("/login?error=invalid_params", request.url)
      );
    }

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
