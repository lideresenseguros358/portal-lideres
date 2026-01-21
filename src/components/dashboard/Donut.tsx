"use client";

import clsx from "clsx";

interface DonutProps {
  label: string;
  percent: number;
  target: number;
  current: number;
  baseColor: string;
  successColor?: string;
  tooltip?: string;
  onClick?: () => void;
  contestStatus?: 'active' | 'closed' | 'won' | 'lost'; // Estado del concurso
  quotaType?: 'single' | 'double'; // Tipo de cupo ganado
  targetDouble?: number; // Meta doble (si existe)
  enableDoubleGoal?: boolean; // Si el doble está habilitado
  periodLabel?: string;
  remaining?: number;
  doubleRemaining?: number;
}

const clampPercent = (value: number) => {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 200) return 200;
  return value;
};

const Donut = ({
  label,
  percent,
  target,
  current,
  baseColor,
  successColor = "#d4af37",
  tooltip,
  onClick,
  contestStatus = 'active',
  quotaType,
  targetDouble,
  enableDoubleGoal,
  periodLabel,
  remaining,
  doubleRemaining,
}: DonutProps) => {
  const safePercent = clampPercent(percent);
  
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const Element = onClick ? "button" : "div";

  // CASO: Concurso cerrado sin meta cumplida
  if (contestStatus === 'closed') {
    return (
      <Element
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={clsx(
          "flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between",
          onClick ? "cursor-pointer hover:-translate-y-0.5" : undefined
        )}
      >
        <p className="text-base font-bold text-gray-400">{label}</p>
        
        <div
          className="relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#e5e7eb 100%)' }}
        >
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-gray-400">
            <span className="text-2xl font-semibold">🔒</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-base font-bold text-gray-500">Concurso Cerrado</p>
          <p className="text-sm text-gray-400">Próximo ciclo disponible</p>
        </div>
      </Element>
    );
  }

  // CASO: Meta cumplida (ganado)
  if (contestStatus === 'won') {
    const quotaLabel = quotaType === 'double' ? 'Cupo Doble' : 'Cupo Sencillo';
    return (
      <Element
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={clsx(
          "flex w-full flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between border-2 border-green-300",
          onClick ? "cursor-pointer hover:-translate-y-0.5" : undefined
        )}
      >
        <p className="text-base font-bold text-[#010139]">{label}</p>
        
        <div
          className="relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#10b981 100%)' }}
        >
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-green-600">
            <span className="text-5xl">🎉</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-green-600">¡Felicidades!</p>
          <p className="text-sm font-semibold text-[#010139]">Ganaste: {quotaLabel}</p>
          <div className="mt-1 space-y-1 text-xs text-gray-600">
            <p>✓ Meta Sencillo: {formatCurrency(target)}</p>
            {quotaType === 'double' && targetDouble && (
              <p>✓ Meta Doble: {formatCurrency(targetDouble)}</p>
            )}
          </div>
        </div>
      </Element>
    );
  }

  // CASO: No cumplió la meta y ya cerró
  if (contestStatus === 'lost') {
    return (
      <Element
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={clsx(
          "flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between",
          onClick ? "cursor-pointer hover:-translate-y-0.5" : undefined
        )}
      >
        <p className="text-base font-bold text-gray-600">{label}</p>
        
        <div
          className="relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#f87171 100%)' }}
        >
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-red-400">
            <span className="text-3xl font-semibold">{safePercent.toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-base font-bold text-red-500">Meta no alcanzada</p>
          <p className="text-sm text-gray-500">Concurso finalizado</p>
          <p className="text-xs text-gray-400">Meta: {formatCurrency(target)}</p>
        </div>
      </Element>
    );
  }

  // CASO: Concurso activo (normal)
  const singleRemaining = typeof remaining === 'number' ? Math.max(0, remaining) : Math.max(0, target - current);
  const effectiveDoubleRemaining = typeof doubleRemaining === 'number'
    ? Math.max(0, doubleRemaining)
    : (targetDouble ? Math.max(0, targetDouble - current) : undefined);

  // Verificar si alcanzó la meta doble
  const reachedDouble = enableDoubleGoal && targetDouble && current >= targetDouble;
  // Verificar si alcanzó la meta sencilla pero no el doble
  const reachedSingle = current >= target && (!enableDoubleGoal || !targetDouble || current < targetDouble);
  
  // Calcular el porcentaje basado en la meta doble si está habilitado
  let displayPercent = safePercent;
  if (enableDoubleGoal && targetDouble && target > 0) {
    displayPercent = (current / targetDouble) * 100;
  }
  displayPercent = clampPercent(displayPercent);
  
  const progress = Math.min(displayPercent, 100);
  const remainder = 100 - progress;
  
  // CASO ESPECIAL: Alcanzó meta doble
  if (reachedDouble) {
    return (
      <Element
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={clsx(
          "flex w-full flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-green-50 to-emerald-50 p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between border-2 border-green-300",
          onClick ? "cursor-pointer hover:-translate-y-0.5" : undefined
        )}
      >
        <p className="text-base font-bold text-[#010139]">{label}</p>
        
        <div
          className="relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#10b981 100%)' }}
        >
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-green-600">
            <span className="text-5xl">🎉</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-green-600">¡Felicidades has logrado el máximo!</p>
          <p className="text-sm font-semibold text-[#010139]">Te has ganado el Cupo Doble</p>
          <div className="mt-2 space-y-1 text-xs text-gray-600">
            <p>✓ Meta Sencillo: {formatCurrency(target)}</p>
            <p>✓ Meta Doble: {formatCurrency(targetDouble!)}</p>
            <p className="text-green-600 font-semibold mt-1">Total producido: {formatCurrency(current)}</p>
          </div>
        </div>
      </Element>
    );
  }
  
  // CASO ESPECIAL: Alcanzó meta sencilla, sigue contando hacia doble
  if (reachedSingle && enableDoubleGoal && targetDouble) {
    const color = "#10b981"; // Verde
    const gradient = `conic-gradient(${color} ${progress}%, rgba(1,1,57,0.08) ${progress}% ${progress + remainder}%)`;
    
    return (
      <Element
        type={onClick ? "button" : undefined}
        onClick={onClick}
        className={clsx(
          "flex w-full flex-col items-center gap-3 rounded-2xl bg-gradient-to-br from-green-50 to-white p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between border-2 border-green-200",
          onClick ? "cursor-pointer hover:-translate-y-0.5" : undefined
        )}
      >
        <p className="text-base font-bold text-[#010139]">{label}</p>
        
        <div
          className="relative flex h-40 w-40 items-center justify-center rounded-full"
          style={{ background: gradient }}
        >
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-green-600">
            <span className="text-3xl font-semibold">{displayPercent.toFixed(0)}%</span>
          </div>
        </div>

        <div className="flex flex-col gap-1 w-full">
          <p className="text-base font-bold text-green-600">¡Felicidades lo lograste!</p>
          <p className="text-xs font-semibold text-[#010139]">Cupo Sencillo ganado</p>
          
          {periodLabel && (
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-1">{periodLabel}</p>
          )}

          <div className="border-t border-green-200 my-2 w-full"></div>
          
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-gray-600">✓ Meta Sencillo</p>
            <p className="text-base font-bold text-green-600">{formatCurrency(target)}</p>
          </div>

          <div className="border-t border-gray-200 my-1 w-full"></div>
          <div className="flex items-baseline justify-between">
            <p className="text-sm font-semibold text-gray-600">Meta Doble</p>
            <p className="text-lg font-bold text-[#8AAA19]">{formatCurrency(targetDouble)}</p>
          </div>
          {typeof effectiveDoubleRemaining === 'number' && effectiveDoubleRemaining > 0 && (
            <p className="text-xs text-orange-600 text-right font-semibold">Faltan: {formatCurrency(effectiveDoubleRemaining)}</p>
          )}
        </div>
      </Element>
    );
  }

  // CASO: Aún no alcanza ninguna meta
  const color = baseColor;
  const gradient = `conic-gradient(${color} ${progress}%, rgba(1,1,57,0.08) ${progress}% ${progress + remainder}%)`;
  
  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between",
        onClick ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8aaa19]" : undefined
      )}
      title={tooltip}
    >
      <p className="text-base font-bold text-[#010139]">{label}</p>
      
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: gradient }}
      >
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white text-[#010139]">
          <span className="text-3xl font-semibold">{displayPercent.toFixed(0)}%</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 w-full">
        {periodLabel && (
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{periodLabel}</p>
        )}

        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-gray-600">Meta Sencillo</p>
          <p className="text-lg font-bold text-[#010139]">{formatCurrency(target)}</p>
        </div>
        {singleRemaining > 0 && (
          <p className="text-xs text-red-600 text-right">Faltan: {formatCurrency(singleRemaining)}</p>
        )}

        {enableDoubleGoal && targetDouble && (
          <>
            <div className="border-t border-gray-200 my-1 w-full"></div>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-gray-600">Meta Doble</p>
              <p className="text-lg font-bold text-[#8AAA19]">{formatCurrency(targetDouble)}</p>
            </div>
            {typeof effectiveDoubleRemaining === 'number' && effectiveDoubleRemaining > 0 && (
              <p className="text-xs text-orange-600 text-right">Faltan: {formatCurrency(effectiveDoubleRemaining)}</p>
            )}
          </>
        )}
      </div>
    </Element>
  );
};

export default Donut;
