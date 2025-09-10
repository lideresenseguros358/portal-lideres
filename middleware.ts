// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Solo proteger rutas /app
  if (!pathname.startsWith('/app')) return NextResponse.next();

  const cookie = req.cookies.get('portal_token')?.value || '';
  if(!cookie){
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  try{
    const payload = jwt.verify(cookie, JWT_SECRET) as any;
    // Si es /app (router), redirige según rol
    if(pathname === '/app' || pathname === '/app/'){
      const url = req.nextUrl.clone();
      url.pathname = payload.role === 'master' ? '/app/master' : '/app/broker';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }catch{
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
}

export const config = {
  matcher: ['/app/:path*']
}
