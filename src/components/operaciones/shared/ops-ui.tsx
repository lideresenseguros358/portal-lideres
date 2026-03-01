'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FaEllipsisH, FaInbox } from 'react-icons/fa';

// ═══════════════════════════════════════════
// BRANDING CONSTANTS
// ═══════════════════════════════════════════

export const OPS_PRIMARY = '#010139';
export const OPS_ACCENT = '#8AAA19';

// ═══════════════════════════════════════════
// CONTEXT MENU (three-dot)
// ═══════════════════════════════════════════

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

export function OpsContextMenu({ items }: { items: ContextMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Acciones"
      >
        <FaEllipsisH className="text-[11px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px] ops-dropdown-enter">
          {items.map((item, i) => (
            item.divider ? (
              <div key={i} className="border-t border-gray-100 my-1" />
            ) : (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); item.onClick(); setOpen(false); }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors duration-100 cursor-pointer disabled:opacity-40 ${
                  item.danger
                    ? 'text-red-600 hover:bg-red-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {item.icon && <span className="text-[10px] w-4 flex-shrink-0">{item.icon}</span>}
                {item.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// STATUS DROPDOWN (replaces big transition buttons)
// ═══════════════════════════════════════════

interface StatusDropdownProps {
  currentStatus: string;
  currentLabel: string;
  transitions: { value: string; label: string }[];
  onSelect: (status: string) => void;
  disabled?: boolean;
}

export function OpsStatusDropdown({ currentStatus, currentLabel, transitions, onSelect, disabled }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (transitions.length === 0 || disabled) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all duration-150 cursor-pointer"
      >
        Cambiar estado
        <svg className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px] ops-dropdown-enter">
          <div className="px-3 py-1.5 text-[10px] text-gray-400 uppercase tracking-wider">Actual: {currentLabel}</div>
          <div className="border-t border-gray-100 my-0.5" />
          {transitions.map((t) => (
            <button
              key={t.value}
              onClick={() => { onSelect(t.value); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors duration-100 cursor-pointer flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export function OpsEmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
        {icon || <FaInbox className="text-gray-300 text-lg" />}
      </div>
      <p className="text-sm font-medium text-gray-500 text-center">{title}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1.5 text-center max-w-[260px]">{subtitle}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-1.5 text-xs font-medium text-[#010139] border border-[#010139]/20 rounded-lg hover:bg-[#010139]/5 transition-colors duration-150 cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// SMOOTH SKELETON
// ═══════════════════════════════════════════

export function OpsSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-100 rounded ops-skeleton ${className}`} />
  );
}

export function OpsSkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 border-b border-gray-50 ops-skeleton">
          <div className="flex items-center justify-between mb-2">
            <OpsSkeleton className="h-3.5 w-36" />
            <OpsSkeleton className="h-3 w-10" />
          </div>
          <OpsSkeleton className="h-2.5 w-48 mb-2" />
          <div className="flex gap-1.5">
            <OpsSkeleton className="h-4 w-14 rounded-full" />
            <OpsSkeleton className="h-4 w-10 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// TOAST SYSTEM (top-right, non-blocking)
// ═══════════════════════════════════════════

export interface OpsToast {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

export function OpsToastContainer({ toasts }: { toasts: OpsToast[] }) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium ops-toast-enter ${
            t.type === 'error'
              ? 'bg-red-600 text-white'
              : t.type === 'info'
                ? 'bg-[#010139] text-white'
                : 'bg-gray-800 text-white'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

export function useOpsToasts(autoDismissMs = 3000) {
  const [toasts, setToasts] = useState<OpsToast[]>([]);

  const addToast = useCallback((message: string, type: OpsToast['type'] = 'success') => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, autoDismissMs);
  }, [autoDismissMs]);

  return { toasts, addToast };
}

// ═══════════════════════════════════════════
// MINI AI GAUGE (circular)
// ═══════════════════════════════════════════

export function MiniAiGauge({ score, size = 32 }: { score: number; size?: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const color = pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f3f4f6" strokeWidth={3} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-[8px] font-bold" style={{ color }}>{Math.round(pct)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// KEYBOARD SHORTCUTS HOOK
// ═══════════════════════════════════════════

interface ShortcutMap {
  [key: string]: () => void;
}

export function useOpsKeyboard(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        // Only allow Escape
        if (e.key === 'Escape' && shortcuts['Escape']) {
          shortcuts['Escape']();
          return;
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;
      let combo = '';
      if (mod) combo += 'Mod+';
      combo += e.key;

      const comboFn = shortcuts[combo];
      const keyFn = shortcuts[e.key];
      if (comboFn) {
        e.preventDefault();
        comboFn();
      } else if (keyFn) {
        // Simple keys like Escape, ArrowUp, ArrowDown
        if (['Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          e.preventDefault();
          keyFn();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
