'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { ActivityActionType, OpsEntityType } from '@/types/operaciones.types';

// ═══════════════════════════════════════════════════════
// AUTO SESSION TRACKER
// - First event of the day = session_start
// - 2h without productive activity = session_end
// - Navigation alone does NOT count as productive
// - Multiple devices: each logs independently, server sums
// ═══════════════════════════════════════════════════════

const INACTIVITY_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_BLOCK_KEY = 'ops_session_block_id';
const SESSION_DATE_KEY = 'ops_session_date';

function generateBlockId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function postActivity(payload: {
  user_id: string;
  action_type: ActivityActionType;
  entity_type?: OpsEntityType | null;
  entity_id?: string | null;
  metadata?: Record<string, any> | null;
  session_block_id?: string | null;
}) {
  try {
    await fetch('/api/operaciones/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'log_activity', ...payload }),
    });
  } catch {
    // silent — activity logging should never break the app
  }
}

function getOrCreateSessionBlock(): string {
  const storedDate = typeof window !== 'undefined' ? localStorage.getItem(SESSION_DATE_KEY) : null;
  const today = todayStr();

  if (storedDate === today) {
    const existing = localStorage.getItem(SESSION_BLOCK_KEY);
    if (existing) return existing;
  }

  // New day or first session — create new block
  const blockId = generateBlockId();
  localStorage.setItem(SESSION_DATE_KEY, today);
  localStorage.setItem(SESSION_BLOCK_KEY, blockId);
  return blockId;
}

function startNewBlock(): string {
  const blockId = generateBlockId();
  localStorage.setItem(SESSION_DATE_KEY, todayStr());
  localStorage.setItem(SESSION_BLOCK_KEY, blockId);
  return blockId;
}

export function useActivityTracker(userId: string | null) {
  const sessionStartedRef = useRef(false);
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blockIdRef = useRef<string | null>(null);

  // Log a productive activity
  const logActivity = useCallback(
    (actionType: ActivityActionType, entityType?: OpsEntityType | null, entityId?: string | null, metadata?: Record<string, any> | null) => {
      if (!userId) return;

      const now = Date.now();
      const gap = now - lastActivityRef.current;

      // If gap > 2h, end previous block and start a new one
      if (gap > INACTIVITY_TIMEOUT_MS && sessionStartedRef.current) {
        // End old block
        postActivity({
          user_id: userId,
          action_type: 'session_end',
          session_block_id: blockIdRef.current,
          metadata: { reason: 'inactivity_timeout' },
        });
        // Start new block
        blockIdRef.current = startNewBlock();
        postActivity({
          user_id: userId,
          action_type: 'session_start',
          session_block_id: blockIdRef.current,
        });
      }

      lastActivityRef.current = now;

      // Log the activity
      postActivity({
        user_id: userId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: entityId,
        metadata,
        session_block_id: blockIdRef.current,
      });

      // Reset inactivity timer
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(() => {
        if (!userId) return;
        postActivity({
          user_id: userId,
          action_type: 'session_end',
          session_block_id: blockIdRef.current,
          metadata: { reason: 'inactivity_timeout' },
        });
        sessionStartedRef.current = false;
      }, INACTIVITY_TIMEOUT_MS);
    },
    [userId]
  );

  // Auto-start session on first event of the day
  useEffect(() => {
    if (!userId) return;

    const handleFirstEvent = () => {
      if (sessionStartedRef.current) return;
      sessionStartedRef.current = true;
      blockIdRef.current = getOrCreateSessionBlock();
      lastActivityRef.current = Date.now();

      postActivity({
        user_id: userId,
        action_type: 'session_start',
        session_block_id: blockIdRef.current,
      });

      // Start inactivity timer
      inactivityTimerRef.current = setTimeout(() => {
        if (!userId) return;
        postActivity({
          user_id: userId,
          action_type: 'session_end',
          session_block_id: blockIdRef.current,
          metadata: { reason: 'inactivity_timeout' },
        });
        sessionStartedRef.current = false;
      }, INACTIVITY_TIMEOUT_MS);
    };

    // First click/interaction of the day triggers session start
    window.addEventListener('click', handleFirstEvent, { once: true });
    window.addEventListener('keydown', handleFirstEvent, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstEvent);
      window.removeEventListener('keydown', handleFirstEvent);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [userId]);

  return { logActivity };
}
