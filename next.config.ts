/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // No bloquear el build por ESLint en Vercel
  eslint: {
    ignoreDuringBuilds: true
  },

  // Si aún usas <img> o recursos remotos, evita sorpresas
  images: {
    unoptimized: true
    // o define domains: ["..."] si luego usas <Image>
  }
};

module.exports = nextConfig;
