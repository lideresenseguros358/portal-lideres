"use client";

import clsx from "clsx";

interface DonutProps {
  label: string;
  percent: number;
  value?: string;
  baseColor: string;
  successColor?: string;
  tooltip?: string;
  onClick?: () => void;
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
  value,
  baseColor,
  successColor = "#d4af37",
  tooltip,
  onClick,
}: DonutProps) => {
  const safePercent = clampPercent(percent);
  const progress = Math.min(safePercent, 100);
  const remainder = 100 - progress;
  const color = safePercent >= 100 ? successColor : baseColor;
  const gradient = `conic-gradient(${color} ${progress}%, rgba(1,1,57,0.08) ${progress}% ${progress + remainder}%)`;

  const Element = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col items-center gap-3 rounded-2xl bg-white p-5 text-center shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform",
        onClick ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8aaa19]" : undefined
      )}
      title={tooltip ?? (safePercent >= 100 ? "Felicidades lo lograste" : undefined)}
    >
      <div
        className="relative flex h-40 w-40 items-center justify-center rounded-full"
        style={{ background: gradient }}
      >
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white text-[#010139]">
          <span className="text-3xl font-semibold">{safePercent.toFixed(0)}%</span>
          {value ? <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">{value}</span> : null}
        </div>
      </div>

      <p className="text-sm font-semibold text-[#010139]">{label}</p>
    </Element>
  );
};

export default Donut;
