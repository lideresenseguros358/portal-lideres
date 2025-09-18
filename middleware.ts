// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIX = '/app';

function safeDateISO(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir explícitamente auth y login
  if (pathname.startsWith('/app/auth') || pathname === '/login') {
    return NextResponse.next();
  }

  // Solo proteger /app/**
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Reglas de sesión por cookies (puestas al hacer login)
  const session = req.cookies.get('portal_session')?.value ?? '';
  const expISO = req.cookies.get('portal_expires')?.value ?? '';
  const exp = safeDateISO(expISO);

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
