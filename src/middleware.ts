import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './lib/database.types';

export async function middleware(request: NextRequest) {
  // Si hay errores de Supabase en la URL (token expirado, etc), redirigir a login con el error
  const error_code = request.nextUrl.searchParams.get('error_code');
  const error_description = request.nextUrl.searchParams.get('error_description');
  
  if (error_code || error_description) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', error_description || error_code || 'authentication_failed');
    return NextResponse.redirect(loginUrl);
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value, options }: any) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }: any) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      } as any,
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is authenticated and not on /account, check must_change_password
  if (user && !request.nextUrl.pathname.startsWith('/account')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('must_change_password')
      .eq('id', user.id)
      .single();

    if (profile?.must_change_password === true) {
      const url = request.nextUrl.clone();
      url.pathname = '/account';
      url.searchParams.set('forcePassword', '1');
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     * - login, forgot, new-user, update-password pages
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api|login|forgot|new-user|update-password|auth).*)',
  ],
};
