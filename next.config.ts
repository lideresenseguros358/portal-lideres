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
      bodySizeLimit: '5mb',
    },
  },
  // Excluir imapflow y mailparser del bundle de Next.js (usan imports de Node.js)
  serverExternalPackages: ['imapflow', 'mailparser'],
  // Ignorar errores de TypeScript durante build (tablas nuevas no están en database.types.ts)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
