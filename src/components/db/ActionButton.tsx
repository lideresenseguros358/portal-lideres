"use client";

import Link from "next/link";
import clsx from "clsx";
import { ReactNode } from "react";

interface BaseActionButtonProps {
  icon: ReactNode;
  label: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

type AnchorActionButtonProps = BaseActionButtonProps & {
  href: string;
  type?: never;
};

type ButtonActionButtonProps = BaseActionButtonProps & {
  href?: never;
  type?: "button" | "submit" | "reset";
};

type ActionButtonProps = AnchorActionButtonProps | ButtonActionButtonProps;

const variantClass: Record<NonNullable<ActionButtonProps["variant"]>, string> = {
  primary: "action-btn-wrapper--primary",
  secondary: "action-btn-wrapper--secondary",
  danger: "action-btn-wrapper--danger",
  ghost: "action-btn-wrapper--ghost",
};

export default function ActionButton({
  icon,
  label,
  variant = "secondary",
  disabled,
  onClick,
  className,
  ...props
}: ActionButtonProps) {
  const baseClass = clsx(
    "action-btn-wrapper",
    variantClass[variant],
    { "action-btn-wrapper--disabled": disabled },
    className,
  );

  const content = (
    <span className="action-btn-icon" aria-hidden>
      {icon}
    </span>
  );

  const Wrapper = (inner: ReactNode) => (
    <div className="action-btn-tooltip" data-tooltip={label}>
      {inner}
      <style jsx>{`
        .action-btn-tooltip {
          position: relative;
          display: inline-flex;
        }
        .action-btn-tooltip::after {
          content: attr(data-tooltip);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(1, 1, 57, 0.9);
          color: white;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          opacity: 0;
          pointer-events: none;
          white-space: nowrap;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .action-btn-tooltip:hover::after,
        .action-btn-tooltip:focus-within::after {
          opacity: 1;
          transform: translate(-50%, -4px);
        }
        @media (max-width: 640px) {
          .action-btn-tooltip::after {
            display: none;
          }
        }
        .action-btn-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 14px;
          border: 1px solid transparent;
          background: transparent;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
          color: inherit;
        }
        .action-btn-wrapper--disabled {
          pointer-events: none;
          opacity: 0.5;
        }
        .action-btn-wrapper:focus-visible {
          outline: 3px solid rgba(1, 1, 57, 0.32);
          outline-offset: 3px;
        }
        .action-btn-wrapper--primary {
          background: linear-gradient(135deg, #010139, #020270);
          color: #ffffff;
          box-shadow: 0 12px 20px rgba(1, 1, 57, 0.28);
        }
        .action-btn-wrapper--primary:hover,
        .action-btn-wrapper--primary:focus-visible {
          transform: translateY(-1px);
          box-shadow: 0 18px 30px rgba(1, 1, 57, 0.32);
        }
        .action-btn-wrapper--secondary {
          background: rgba(1, 1, 57, 0.08);
          color: #010139;
          border-color: rgba(1, 1, 57, 0.16);
        }
        .action-btn-wrapper--secondary:hover,
        .action-btn-wrapper--secondary:focus-visible {
          background: rgba(1, 1, 57, 0.16);
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(1, 1, 57, 0.18);
        }
        .action-btn-wrapper--danger {
          background: rgba(220, 38, 38, 0.12);
          color: #b91c1c;
          border-color: rgba(220, 38, 38, 0.35);
        }
        .action-btn-wrapper--danger:hover,
        .action-btn-wrapper--danger:focus-visible {
          background: rgba(220, 38, 38, 0.22);
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 12px 20px rgba(220, 38, 38, 0.28);
        }
        .action-btn-wrapper--ghost {
          background: rgba(107, 114, 128, 0.08);
          color: #374151;
        }
        .action-btn-wrapper--ghost:hover,
        .action-btn-wrapper--ghost:focus-visible {
          background: rgba(107, 114, 128, 0.16);
          transform: translateY(-1px);
          box-shadow: 0 10px 18px rgba(107, 114, 128, 0.18);
        }
        .action-btn-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        @media (min-width: 768px) {
          .action-btn-wrapper {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }
          .action-btn-icon {
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );

  if ("href" in props && props.href) {
    return Wrapper(
      <Link
        href={props.href}
        aria-label={label}
        className={baseClass}
        aria-disabled={disabled}
        onClick={disabled ? undefined : onClick}
        tabIndex={disabled ? -1 : 0}
      >
        {content}
      </Link>
    );
  }

  return Wrapper(
    <button
      type={props.type ?? "button"}
      aria-label={label}
      className={baseClass}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {content}
    </button>
  );
}
