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
}: DonutProps) => {
  const safePercent = clampPercent(percent);
  const progress = Math.min(safePercent, 100);
  const remainder = 100 - progress;
  
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
          className="relative flex h-32 w-32 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#e5e7eb 100%)' }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-gray-400">
            <span className="text-xl font-semibold">🔒</span>
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
          className="relative flex h-32 w-32 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#10b981 100%)' }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-green-600">
            <span className="text-4xl">🎉</span>
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
          className="relative flex h-32 w-32 items-center justify-center rounded-full"
          style={{ background: 'conic-gradient(#f87171 100%)' }}
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-red-400">
            <span className="text-2xl font-semibold">{safePercent.toFixed(0)}%</span>
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
  const color = safePercent >= 100 ? successColor : baseColor;
  const gradient = `conic-gradient(${color} ${progress}%, rgba(1,1,57,0.08) ${progress}% ${progress + remainder}%)`;
  const remaining = Math.max(0, target - current);

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform h-full justify-between",
        onClick ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8aaa19]" : undefined
      )}
      title={tooltip ?? (safePercent >= 100 ? "Felicidades lo lograste" : undefined)}
    >
      <p className="text-base font-bold text-[#010139]">{label}</p>
      
      <div
        className="relative flex h-32 w-32 items-center justify-center rounded-full"
        style={{ background: gradient }}
      >
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white text-[#010139]">
          <span className="text-2xl font-semibold">{safePercent.toFixed(0)}%</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-gray-600">Meta Sencillo:</p>
        <p className="text-lg font-bold text-[#010139]">{formatCurrency(target)}</p>
        {remaining > 0 && (
          <p className="text-xs text-red-600">Faltan: {formatCurrency(remaining)}</p>
        )}
        
        {/* Mostrar meta doble si existe y está habilitada */}
        {enableDoubleGoal && targetDouble && (
          <>
            <div className="border-t border-gray-200 my-1 w-full"></div>
            <p className="text-sm font-semibold text-gray-600">Meta Doble:</p>
            <p className="text-lg font-bold text-[#8AAA19]">{formatCurrency(targetDouble)}</p>
            {current < targetDouble && (
              <p className="text-xs text-orange-600">Faltan: {formatCurrency(targetDouble - current)}</p>
            )}
          </>
        )}
      </div>
    </Element>
  );
};

export default Donut;
