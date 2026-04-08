/**
 * Loading Skeleton — Comparativa de Cobertura Completa
 * Refleja fielmente la estructura real: carrusel mobile + grid desktop,
 * con header oscuro, toggle de plan, precio, coberturas RC, beneficios y CTA.
 */

function Bone({ className, style }: { className: string; style?: React.CSSProperties }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} style={style} />;
}

/**
 * Tarjeta de aseguradora skeleton.
 * Coincide con la estructura real:
 *   1. Header dark (logo + nombre + badge de plan)
 *   2. Plan toggle (Básico / Premium)
 *   3. Cuerpo: toggle pago → precio → coberturas RC → deducible → beneficios → CTA
 */
function InsurerCardSkeleton({ showRecommended = false }: { showRecommended?: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden border-2 border-gray-200 flex flex-col bg-white shadow-md">
      {/* "RECOMENDADA" stripe (solo en la primera tarjeta) */}
      {showRecommended && (
        <div className="h-7 bg-gray-300 animate-pulse" />
      )}

      {/* Header oscuro: logo + nombre + badge */}
      <div className="bg-gray-700 px-4 py-3 flex items-center gap-3">
        <Bone className="w-10 h-10 rounded-lg flex-shrink-0 bg-gray-500" />
        <div className="flex-1 space-y-1.5 min-w-0">
          <Bone className="h-3.5 w-3/5 bg-gray-500" />
        </div>
        <Bone className="h-5 w-14 rounded-full flex-shrink-0 bg-gray-500" />
      </div>

      {/* Toggle Básico / Premium (dentro de la tarjeta) */}
      <div className="mx-3 my-2.5 bg-gray-100 rounded-xl p-1 flex gap-1">
        <Bone className="flex-1 h-8 rounded-lg bg-gray-300" />
        <Bone className="flex-1 h-8 rounded-lg bg-gray-200" />
      </div>

      {/* Cuerpo */}
      <div className="px-4 pb-4 flex flex-col flex-1 gap-3.5">
        {/* Toggle contado / tarjeta */}
        <div className="flex gap-2 bg-blue-50 rounded-xl p-2.5">
          <Bone className="flex-1 h-8 rounded-lg" />
          <Bone className="flex-1 h-8 rounded-lg" />
        </div>

        {/* Precio */}
        <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-2 text-center -mt-1">
          <Bone className="h-3 w-24 mx-auto" />
          <Bone className="h-9 w-32 mx-auto rounded-lg" />
          <Bone className="h-2.5 w-28 mx-auto" />
        </div>

        {/* Coberturas RC — 3 filas */}
        <div className="space-y-2">
          <Bone className="h-3 w-2/5" />
          {['Lesiones Corporales', 'Daños a la Propiedad', 'Gastos Médicos'].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100">
              <Bone className="h-3 w-2/5" />
              <Bone className="h-3 w-1/4" />
            </div>
          ))}
        </div>

        {/* Deducible */}
        <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
          <Bone className="h-3 w-1/4" />
          <Bone className="h-3 w-1/3" />
        </div>

        {/* Beneficios y Asistencia (colapsable, mostrado cerrado) */}
        <div className="border border-gray-200 rounded-lg px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bone className="w-3 h-3 rounded-full" />
            <Bone className="h-3 w-36" />
          </div>
          <Bone className="w-3 h-3 rounded" />
        </div>

        {/* CTA */}
        <Bone className="h-11 rounded-xl mt-auto" />
      </div>
    </div>
  );
}

/** Carrusel mobile: 1 tarjeta activa + peek del siguiente */
function MobileCarouselSkeleton() {
  return (
    <div
      className="flex overflow-hidden gap-3"
      style={{ padding: '8px 20px 14px', marginInline: '-1rem', width: 'calc(100% + 2rem)' }}
    >
      {/* Tarjeta activa */}
      <div
        className="flex-shrink-0"
        style={{ width: '82vw', maxWidth: 340 }}
      >
        <InsurerCardSkeleton showRecommended />
      </div>
      {/* Peek del siguiente */}
      <div
        className="flex-shrink-0"
        style={{ width: '82vw', maxWidth: 340, opacity: 0.55, transform: 'scale(0.9)', transformOrigin: 'left center' }}
      >
        <InsurerCardSkeleton />
      </div>
    </div>
  );
}

export default function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">

        {/* ── Header ── */}
        <div className="text-center mb-8 space-y-3">
          {/* Título */}
          <Bone className="h-8 w-64 mx-auto" />
          {/* Subtítulo */}
          <Bone className="h-4 w-80 mx-auto" />
          {/* Botón "Editar Información" */}
          <Bone className="h-11 w-44 mx-auto rounded-lg" />
        </div>

        {/* ══════════════════════════════════════════
            MOBILE  (< md)
        ══════════════════════════════════════════ */}
        <div className="md:hidden mt-4 space-y-4">
          {/* Carrusel de tarjetas */}
          <MobileCarouselSkeleton />

          {/* Dot indicators */}
          <div className="flex justify-center items-center gap-2 pt-1">
            <div className="h-1.5 w-5 bg-gray-400 rounded-full animate-pulse" />
            {[1, 2, 3].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════
            DESKTOP  (md+)
        ══════════════════════════════════════════ */}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mt-6 pt-8 sm:pt-10">
          {[true, false, false, false].map((isFirst, i) => (
            <InsurerCardSkeleton key={i} showRecommended={isFirst} />
          ))}
        </div>

      </div>
    </div>
  );
}
