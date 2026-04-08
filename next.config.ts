import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
    serverBodySizeLimit: '20mb',
  },
  // Excluir imapflow y mailparser del bundle de Next.js (usan imports de Node.js)
  serverExternalPackages: ['imapflow', 'mailparser'],
  // Ignorar errores de TypeScript durante build (tablas nuevas no están en database.types.ts)
  typescript: {
    ignoreBuildErrors: true,
  },
  // Security headers globales — cubren rutas fuera del middleware (api, login, cotizadores, etc.)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://secure.paguelofacil.com https://sandbox.paguelofacil.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https://*.supabase.co https://portal.lideresenseguros.com https://lh3.googleusercontent.com",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://secure.paguelofacil.com https://sandbox.paguelofacil.com https://api.pfserver.net https://api-sand.pfserver.net",
              "frame-src 'self' https://secure.paguelofacil.com https://sandbox.paguelofacil.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
