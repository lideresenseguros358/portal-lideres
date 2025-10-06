"use client";

import clsx from "clsx";
import { ReactNode } from "react";

interface LabelItemProps {
  icon: ReactNode;
  label: string;
  value: string;
  title?: string;
  variant?: "default" | "pill" | "ghost";
  className?: string;
}

export default function LabelItem({
  icon,
  label,
  value,
  title,
  variant = "default",
  className,
}: LabelItemProps) {
  const tooltip = title ?? `${label} ${value}`;

  return (
    <div
      className={clsx("label-item", `label-item--${variant}`, className)}
      title={tooltip}
      aria-label={`${label} ${value}`}
    >
      <span className="label-item__icon" aria-hidden>{icon}</span>
      <span className="label-item__text">
        <span className="label-item__label">{label}</span>
        <span className="label-item__separator">:</span>
        <span className="label-item__value">{value}</span>
      </span>
      <style jsx>{`
        .label-item {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 100%;
          color: var(--text-primary, #010139);
        }
        .label-item--pill {
          padding: 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(1, 1, 57, 0.12);
          background: rgba(1, 1, 57, 0.05);
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .label-item--pill:hover {
          background: rgba(1, 1, 57, 0.12);
          border-color: rgba(1, 1, 57, 0.24);
        }
        .label-item--ghost {
          gap: 6px;
          color: var(--text-muted, #6b7280);
        }
        .label-item__icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          color: var(--text-muted, #6b7280);
          flex-shrink: 0;
        }
        .label-item__text {
          display: inline-flex;
          align-items: baseline;
          gap: 4px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary, #010139);
          max-width: calc(100% - 28px);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .label-item__label {
          font-weight: 500;
          color: var(--text-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .label-item__separator {
          font-weight: 500;
          color: var(--text-muted, #6b7280);
        }
        .label-item__value {
          font-weight: 600;
          color: inherit;
        }
        @media (max-width: 480px) {
          .label-item {
            gap: 6px;
          }
          .label-item__text {
            gap: 3px;
          }
        }
      `}</style>
    </div>
  );
}
