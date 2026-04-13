import { getSupabaseAdmin } from '@/lib/supabase/admin';

const BUCKET = 'ops-attachments';

/**
 * Deletes all Supabase-stored attachments for an ops case.
 * Reads stored paths from ops_case_messages.metadata.attachments.
 * Non-fatal: errors are logged but never thrown.
 */
export async function deleteCaseAttachments(caseId: string): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();

    const { data: messages } = await (supabase as any)
      .from('ops_case_messages')
      .select('metadata')
      .eq('case_id', caseId);

    if (!messages || messages.length === 0) return;

    const paths: string[] = [];
    for (const msg of messages) {
      const attachments = msg.metadata?.attachments;
      if (Array.isArray(attachments)) {
        for (const att of attachments) {
          if (att.path) paths.push(att.path);
        }
      }
    }

    if (paths.length === 0) return;

    const { error } = await (supabase as any).storage.from(BUCKET).remove(paths);

    if (error) {
      console.error(`[deleteAttachments] Storage remove error for case ${caseId}:`, error);
    } else {
      console.log(`[deleteAttachments] Deleted ${paths.length} attachment(s) for case ${caseId}`);
    }
  } catch (err) {
    console.error(`[deleteAttachments] Unexpected error for case ${caseId}:`, err);
  }
}
