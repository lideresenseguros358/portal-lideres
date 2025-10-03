"use client";

import clsx from "clsx";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

const KpiCard = ({ title, value, subtitle, onClick, className }: KpiCardProps) => {
  const Element = onClick ? "button" : "div";

  return (
    <Element
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={clsx(
        "flex w-full flex-col gap-2 rounded-2xl bg-white p-5 text-left shadow-[0_18px_40px_rgba(1,1,57,0.12)] transition-transform",
        onClick ? "cursor-pointer hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8aaa19]" : undefined,
        className
      )}
    >
      <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8a8a8a]">{title}</span>
      <span className="text-[36px] font-semibold text-[#010139] leading-none">
        {typeof value === "number" ? value.toLocaleString("es-PA", { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value}
      </span>
      {subtitle ? <span className="text-sm text-[#5f6368]">{subtitle}</span> : null}
    </Element>
  );
};

export default KpiCard;
