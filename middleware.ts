// /middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIX = '/app';

function safeDateISO(x: string | null): Date | null {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Solo proteger /app y subrutas
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  const session = req.cookies.get('portal_session')?.value ?? '';
  const expISO = req.cookies.get('portal_expires')?.value ?? ''; // la pone el cliente al loguear
  const exp = safeDateISO(expISO);

  const unauth = !session || (exp && exp.getTime() <= Date.now());
  if (unauth) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `redirect=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
