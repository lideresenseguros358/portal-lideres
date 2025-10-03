import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LISSA | Configuración",
};

export default function ConfigLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--grey,#e6e6e6)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 md:px-6">
        <header className="flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-md sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--olive,#8aaa19)]">
              Configuración
            </p>
            <h1 className="text-2xl font-semibold text-[var(--blue,#010139)]">
              Portal LISSA · Panel de Control
            </h1>
          </div>
          <div className="text-sm text-gray-500">
            Administra mapeos y reglas de normalización para aseguradoras.
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
