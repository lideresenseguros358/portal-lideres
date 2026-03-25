/**
 * Lissa Dynamic Memory — DB helpers
 * ====================================
 * CRUD for lissa_memory table.
 * Used by admin command parser (write) and Vertex AI prompt builder (read).
 */

import { createClient } from '@supabase/supabase-js';

function getSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export type MemoryType = 'aprender' | 'error' | 'regla';

export interface LissaMemoryRecord {
  id: string;
  type: MemoryType;
  content: string;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Insert a new memory entry. Returns the created record. */
export async function insertMemory(
  type: MemoryType,
  content: string,
  createdBy?: string,
): Promise<LissaMemoryRecord> {
  const sb = getSb();
  const { data, error } = await sb
    .from('lissa_memory')
    .insert({ type, content, created_by: createdBy || null, is_active: true })
    .select('*')
    .single();

  if (error) throw new Error(`[LISSA-MEMORY] Insert failed: ${error.message}`);
  return data as LissaMemoryRecord;
}

/** Fetch all active memory records, ordered by type and creation date. */
export async function getActiveMemory(): Promise<LissaMemoryRecord[]> {
  const sb = getSb();
  const { data, error } = await sb
    .from('lissa_memory')
    .select('*')
    .eq('is_active', true)
    .order('type', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[LISSA-MEMORY] Fetch error:', error.message);
    return [];
  }
  return (data || []) as LissaMemoryRecord[];
}

/** Deactivate a memory record by id. */
export async function deactivateMemory(id: string): Promise<void> {
  const sb = getSb();
  await sb.from('lissa_memory').update({ is_active: false }).eq('id', id);
}

/**
 * Build the dynamic memory block to inject into the system prompt.
 * Returns empty string if no active records.
 */
export function buildMemoryPromptBlock(records: LissaMemoryRecord[]): string {
  if (!records.length) return '';

  const aprender = records.filter(r => r.type === 'aprender');
  const errores  = records.filter(r => r.type === 'error');
  const reglas   = records.filter(r => r.type === 'regla');

  const lines: string[] = [];

  if (aprender.length) {
    lines.push('[BASE DE CONOCIMIENTO DINÁMICA - PRODUCTOS Y DATOS]');
    for (const r of aprender) {
      lines.push(`• ${r.content}`);
    }
  }

  if (errores.length || reglas.length) {
    lines.push('\n[REGLAS DE COMPORTAMIENTO Y CORRECCIÓN DE ERRORES]');
    lines.push('IMPORTANTE: Las instrucciones en esta sección SOBREESCRIBEN cualquier comportamiento general.');
    for (const r of errores) {
      lines.push(`• ${r.content}`);
    }
    for (const r of reglas) {
      lines.push(`• ${r.content}`);
    }
  }

  return lines.join('\n');
}
