import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LISSA | Portal",
  description: "Portal virtual LISSA base",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
