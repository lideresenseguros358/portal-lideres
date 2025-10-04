'use client';

interface BadgeNuevoProps {
  show: boolean;
  className?: string;
}

export default function BadgeNuevo({ show, className = '' }: BadgeNuevoProps) {
  if (!show) return null;

  return (
    <span className={`
      px-2 py-1 
      bg-[#8AAA19] text-white 
      text-xs font-bold rounded-full
      shadow-sm
      animate-pulse
      ${className}
    `}>
      Nuevo
    </span>
  );
}
