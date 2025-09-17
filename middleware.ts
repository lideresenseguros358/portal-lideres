// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIX = '/app';

function safeDateISO(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1) No proteger auth ni login
  if (!pathname.startsWith(PROTECTED_PREFIX) || pathname.startsWith('/app/auth') || pathname === '/login') {
    return NextResponse.next();
  }

  // 2) Reglas de sesión
  const session = req.cookies.get('portal_session')?.value ?? '';
  const expISO  = req.cookies.get('portal_expires')?.value ?? '';
  const exp     = safeDateISO(expISO);

  const unauth = !session || (exp && exp.getTime() <= Date.now());
  if (unauth) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
