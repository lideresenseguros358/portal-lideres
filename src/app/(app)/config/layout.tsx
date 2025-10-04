import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LISSA | Configuración",
};

export default function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
