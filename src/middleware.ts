import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const res = NextResponse.next();
  
  const supabase = createMiddlewareClient({ req: request, res });

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

  return res;
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
     * - login, forgot, new-user pages
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api|login|forgot|new-user|auth).*)',
  ],
};
