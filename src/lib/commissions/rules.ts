import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { TablesUpdate } from '@/lib/supabase/server';

/**
 * Assign pending items older than 90 days to office broker
 */
export async function assignOldPendingsToOffice(): Promise<{ updated: number }> {
  const supabase = getSupabaseAdmin();
  
  // Get office broker ID (assuming it's a specific UUID in your system)
  // TODO: Replace with actual office broker ID from your configuration
  const OFFICE_BROKER_ID = '00000000-0000-0000-0000-000000000000';
  
  // Update items older than 90 days with no broker assigned
  // Direct update without RPC
  const { data: updateData, error: updateError } = await supabase
    .from('comm_items')
    .update({ 
      broker_id: OFFICE_BROKER_ID 
    } satisfies TablesUpdate<'comm_items'>)
    .is('broker_id', null)
    .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .select();
  
  if (updateError) {
    throw new Error(`Error assigning old pendings: ${updateError.message}`);
  }
  
  return { updated: updateData?.length || 0 };
}

/**
 * Get pending items grouped by policy number
 */
export async function getPendingGroups() {
  const supabase = getSupabaseAdmin();
  
  const { data, error } = await supabase
    .from('comm_items')
    .select('policy_number, gross_amount, created_at')
    .is('broker_id', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Error fetching pending items: ${error.message}`);
  }
  
  // Group by policy_number
  const groups = new Map<string, {
    policy_number: string;
    items_count: number;
    total_amount: number;
    oldest_created_at: string;
    items: typeof data;
  }>();
  
  for (const item of data || []) {
    const group = groups.get(item.policy_number);
    if (group) {
      group.items_count++;
      group.total_amount += Number(item.gross_amount) || 0;
      if (item.created_at < group.oldest_created_at) {
        group.oldest_created_at = item.created_at;
      }
      group.items.push(item);
    } else {
      groups.set(item.policy_number, {
        policy_number: item.policy_number,
        items_count: 1,
        total_amount: Number(item.gross_amount) || 0,
        oldest_created_at: item.created_at,
        items: [item],
      });
    }
  }
  
  return Array.from(groups.values());
}

/**
 * Calculate discount for a broker in a fortnight
 */
export function calculateDiscounts(
  advances: Array<{ amount: number; reason: string }>,
  grossAmount: number
): {
  total: number;
  details: Array<{ type: string; amount: number; reason?: string }>;
} {
  const details: Array<{ type: string; amount: number; reason?: string }> = [];
  let total = 0;
  
  // Add advances as discounts
  for (const advance of advances) {
    details.push({
      type: 'advance',
      amount: advance.amount,
      reason: advance.reason,
    });
    total += advance.amount;
  }
  
  // Add other business rules here
  // Example: 2% administrative fee
  const adminFee = grossAmount * 0.02;
  details.push({
    type: 'admin_fee',
    amount: adminFee,
    reason: 'Comisión administrativa (2%)',
  });
  total += adminFee;
  
  return { total, details };
}
