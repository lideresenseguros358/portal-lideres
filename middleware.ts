// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PREFIX = '/app';

/** Convierte ISO a Date seguro (o null) */
function safeDateISO(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  // Deja pasar explícitamente rutas públicas
  // (el matcher ya limita a /app/**, pero así evitamos bloquear /app/auth/**)
  if (pathname.startsWith('/app/auth') || pathname === '/login') {
    return NextResponse.next();
  }

  // Sólo proteger /app/**
  if (!pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  // Reglas de sesión vía cookies (puestas al hacer login)
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

// Ejecutar sólo en /app/**
export const config = {
  matcher: ['/app/:path*'],
};
