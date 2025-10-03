import { z } from 'zod';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { getSupabaseServer, type Tables, type TablesInsert, type TablesUpdate } from '@/lib/supabase/server';

type BrokerRow = Tables<'brokers'>;

// ===== Zod Schemas =====
export const BrokerSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  assa_code: z.string().nullable(),
});

// ===== CRUD Brokers =====
export async function listAllBrokers() {
  const supabase = await getSupabaseServer();
  
  const { data, error } = await supabase
    .from('brokers')
    .select('id, name, assa_code')
    .order('name');
    
  if (error) throw new Error(`Error listing brokers: ${error.message}`);
  
  return data ?? [];
}
