'use client';

/**
 * Shared case/thread action primitives used across:
 *   - PetCaseList (Peticiones)
 *   - RenCaseList (Renovaciones)
 *   - UrgCaseList (Urgencias)
 *   - ThreadList in AdmCotChats
 *
 * Desktop: 3-dot (⋮) button opens a dropdown with PIN / Assign Master / Delete.
 * Mobile:  swipe-left on the row reveals the same 3 actions as coloured buttons.
 */

import { useState, useRef, useEffect } from 'react';
import { FaEllipsisV, FaThumbtack, FaUserTie, FaTrashAlt, FaTimes, FaSearch, FaBan, FaCheckCircle } from 'react-icons/fa';

// ─────────────────────────────────────────────
// SWIPEABLE ROW  (mobile)  +  3-DOT BUTTON (desktop)
// ─────────────────────────────────────────────

const BUTTON_WIDTH = 48; // width of each action button

interface CaseActionsRowProps {
  isPinned: boolean;
  onPin: () => void;
  onAssignMaster: () => void;
  onDelete: () => void;
  /** Optional 4th action: block/unblock */
  onBlock?: () => void;
  isBlocked?: boolean;
  /** Normal card click (select case). Blocked while swipe is open. */
  onCardClick: () => void;
  children: React.ReactNode;
}

export function CaseActionsRow({
  isPinned, onPin, onAssignMaster, onDelete, onBlock, isBlocked, onCardClick, children,
}: CaseActionsRowProps) {
  const hasBlockAction = !!onBlock;
  const REVEAL_WIDTH_RIGHT = 3 * BUTTON_WIDTH; // PIN, Master, Delete
  const REVEAL_WIDTH_LEFT = 1 * BUTTON_WIDTH; // Block (isolated on left)
  const DIRECTION_THRESHOLD = 8; // pixels to determine direction

  // Mobile swipe state: positive = left swipe, negative = right swipe
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isScrollRef = useRef<boolean | null>(null); // null=undetermined, true=scroll, false=swipe
  const swipeDirectionRef = useRef<'left' | 'right' | null>(null); // Direction lock

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? 0;
    touchStartY.current = e.touches[0]?.clientY ?? 0;
    isScrollRef.current = null;
    swipeDirectionRef.current = null; // Reset direction lock
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const dx = touchStartX.current - t.clientX; // positive = left, negative = right
    const dy = Math.abs(touchStartY.current - t.clientY);
    const absDx = Math.abs(dx);

    // Step 1: Determine if it's a vertical scroll or horizontal swipe
    if (isScrollRef.current === null && (absDx > DIRECTION_THRESHOLD || dy > DIRECTION_THRESHOLD)) {
      // If vertical movement > horizontal, it's a scroll
      isScrollRef.current = dy > absDx * 1.4;
    }

    // If it's a scroll, ignore
    if (isScrollRef.current) return;

    // Step 2: Lock swipe direction on first significant horizontal movement
    if (swipeDirectionRef.current === null && absDx > DIRECTION_THRESHOLD) {
      swipeDirectionRef.current = dx > 0 ? 'left' : 'right';
    }

    // Step 3: Only allow movement in the locked direction
    if (swipeDirectionRef.current === 'left') {
      // LEFT swipe only (positive dx)
      if (dx > 0) {
        setSwipeX(Math.min(REVEAL_WIDTH_RIGHT, dx));
      }
    } else if (swipeDirectionRef.current === 'right' && hasBlockAction) {
      // RIGHT swipe only (negative dx)
      if (dx < 0) {
        setSwipeX(Math.max(-REVEAL_WIDTH_LEFT, dx));
      }
    }
  };

  const handleTouchEnd = () => {
    if (isScrollRef.current) return;
    const threshold = 20;
    if (swipeX > threshold) {
      setSwipeX(REVEAL_WIDTH_RIGHT);
    } else if (swipeX < -threshold) {
      setSwipeX(-REVEAL_WIDTH_LEFT);
    } else {
      setSwipeX(0);
    }
    // Reset for next swipe
    swipeDirectionRef.current = null;
  };

  const handleCardClick = () => {
    if (swipeX !== 0) { setSwipeX(0); return; }
    onCardClick();
  };

  return (
    // overflow-hidden only on mobile so the desktop dropdown can escape
    <div className="relative overflow-hidden md:overflow-visible">
      {/* ── Left action strip (swipe RIGHT) - Block/Unblock only ── */}
      {hasBlockAction && (
        <div
          className="md:hidden absolute left-0 top-0 h-full flex"
          style={{ width: REVEAL_WIDTH_LEFT }}
          aria-hidden
        >
          <button
            onClick={(e) => { e.stopPropagation(); onBlock?.(); setSwipeX(0); }}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-bold select-none ${
              isBlocked ? 'bg-emerald-600' : 'bg-red-600'
            }`}
          >
            {isBlocked ? <FaCheckCircle className="text-base" /> : <FaBan className="text-base" />}
            {isBlocked ? 'Desbloquear' : 'Bloquear'}
          </button>
        </div>
      )}

      {/* ── Right action strip (swipe LEFT) - PIN, Master, Delete ── */}
      <div
        className="md:hidden absolute right-0 top-0 h-full flex"
        style={{ width: REVEAL_WIDTH_RIGHT }}
        aria-hidden
      >
        <button
          onClick={(e) => { e.stopPropagation(); onPin(); setSwipeX(0); }}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-white text-[10px] font-bold select-none ${
            isPinned ? 'bg-blue-600' : 'bg-blue-500'
          }`}
        >
          <FaThumbtack className="text-base" />
          {isPinned ? 'Quitar' : 'PIN'}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onAssignMaster(); setSwipeX(0); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-[#010139] text-white text-[10px] font-bold select-none"
        >
          <FaUserTie className="text-base" />
          Master
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); setSwipeX(0); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-red-500 text-white text-[10px] font-bold select-none"
        >
          <FaTrashAlt className="text-base" />
          Eliminar
        </button>
      </div>

      {/* ── Sliding card content ── */}
      <div
        className="relative bg-white"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX === 0 || Math.abs(swipeX) === REVEAL_WIDTH_RIGHT || Math.abs(swipeX) === REVEAL_WIDTH_LEFT ? 'transform 0.22s ease' : 'none',
          willChange: 'transform',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleCardClick}
      >
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 3-DOT DROPDOWN  (desktop only)
// ─────────────────────────────────────────────

interface CaseDotsMenuProps {
  isPinned: boolean;
  onPin: () => void;
  onAssignMaster: () => void;
  onDelete: () => void;
  /** Optional block/unblock action */
  onBlock?: () => void;
  isBlocked?: boolean;
}

export function CaseDotsMenu({ isPinned, onPin, onAssignMaster, onDelete, onBlock, isBlocked }: CaseDotsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const items = [
    {
      label: isPinned ? 'Quitar PIN' : 'Fijar arriba (PIN)',
      icon: <FaThumbtack className={isPinned ? 'text-blue-500' : ''} />,
      action: onPin,
      danger: false,
    },
    { label: 'Asignar master', icon: <FaUserTie />, action: onAssignMaster, danger: false },
    { label: 'Eliminar', icon: <FaTrashAlt />, action: onDelete, danger: true },
    ...(onBlock ? [{
      label: isBlocked ? 'Desbloquear' : 'Bloquear',
      icon: isBlocked ? <FaCheckCircle className="text-emerald-500" /> : <FaBan className="text-red-500" />,
      action: onBlock,
      danger: !isBlocked,
    }] : []),
  ];

  return (
    // hidden on mobile — swipe handles it
    <div className="hidden md:block relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className="p-1.5 rounded-md text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Opciones"
      >
        <FaEllipsisV className="text-[11px]" />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 z-[100] min-w-[176px]"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.action(); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-[12px] font-medium transition-colors text-left ${
                item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className={`text-[11px] ${item.danger ? 'text-red-500' : 'text-gray-400'}`}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// DELETE CONFIRMATION MODAL
// ─────────────────────────────────────────────

interface DeleteModalProps {
  name: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CaseDeleteModal({ name, loading, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-red-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <FaTrashAlt className="text-base" />
            <span className="font-bold text-sm">Eliminar caso</span>
          </div>
          <button onClick={onCancel} className="text-white/70 hover:text-white transition-colors">
            <FaTimes />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-sm text-gray-700">
            ¿Estás seguro de que deseas eliminar el caso de{' '}
            <strong className="text-[#010139]">{name || 'este cliente'}</strong>?
          </p>
          <p className="text-xs text-gray-400 mt-1">Esta acción no se puede deshacer.</p>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2 rounded-lg bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <FaTrashAlt className="text-[11px]" />
            )}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// ASSIGN MASTER MODAL
// ─────────────────────────────────────────────

export interface MasterUser {
  id: string;
  name: string;
  email: string;
}

interface AssignModalProps {
  masters: MasterUser[];
  currentMasterId: string | null | undefined;
  loading: boolean;
  onAssign: (masterId: string | null) => void;
  onCancel: () => void;
}

export function CaseAssignModal({ masters, currentMasterId, loading, onAssign, onCancel }: AssignModalProps) {
  const [search, setSearch] = useState('');
  const filtered = masters.filter(m =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#010139] px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <FaUserTie className="text-base" />
            <span className="font-bold text-sm">Asignar master</span>
          </div>
          <button onClick={onCancel} className="text-white/70 hover:text-white transition-colors">
            <FaTimes />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 focus-within:border-[#8AAA19]">
            <FaSearch className="text-gray-400 text-xs flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar master..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-sm border-0 outline-none bg-transparent text-gray-700 placeholder-gray-400"
              autoFocus
            />
          </div>
        </div>

        {/* Master list */}
        <div className="px-2 py-2 max-h-64 overflow-y-auto">
          {/* Unassign option */}
          <button
            onClick={() => onAssign(null)}
            disabled={loading}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors text-sm ${
              !currentMasterId ? 'bg-gray-100 text-gray-500 font-semibold' : 'hover:bg-gray-50 text-gray-500'
            }`}
          >
            <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
              <FaUserTie className="text-xs" />
            </span>
            Sin asignar
          </button>

          {filtered.map(m => (
            <button
              key={m.id}
              onClick={() => onAssign(m.id)}
              disabled={loading}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                currentMasterId === m.id
                  ? 'bg-[#010139]/[0.06] text-[#010139] font-semibold'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="w-8 h-8 rounded-full bg-[#010139]/10 flex items-center justify-center text-[#010139] text-xs font-bold flex-shrink-0">
                {m.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{m.name}</p>
                <p className="text-[10px] text-gray-400 truncate">{m.email}</p>
              </div>
              {currentMasterId === m.id && (
                <span className="ml-auto text-[#8AAA19] text-xs">✓</span>
              )}
            </button>
          ))}

          {filtered.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-4">No se encontraron masters</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 pt-2 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="w-full py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
