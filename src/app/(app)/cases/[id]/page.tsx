import { Suspense } from 'react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import CaseDetailClient from '@/components/cases/CaseDetailClient';

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Get case with details
  const { data: caseData, error } = await supabase
    .from('cases')
    .select(`
      *,
      broker:brokers!broker_id(
        *,
        profiles!brokers_p_id_fkey(id, email, name, full_name, role)
      ),
      client:clients!cases_client_id_fkey(id, name, national_id, email, phone),
      insurer:insurers(id, name, active)
    `)
    .eq('id', resolvedParams.id)
    .single();

  if (error || !caseData) {
    notFound();
  }

  // RLS: Broker only sees their own cases
  if (profile.role === 'broker' && profile.broker_id && caseData.broker_id !== profile.broker_id) {
    notFound();
  }

  // Get checklist
  const { data: checklist } = await supabase
    .from('case_checklist')
    .select('*')
    .eq('case_id', resolvedParams.id)
    .order('created_at', { ascending: true });

  // Get files
  const { data: files } = await supabase
    .from('case_files')
    .select('*')
    .eq('case_id', resolvedParams.id)
    .order('created_at', { ascending: false });

  // Get comments
  const { data: comments } = await supabase
    .from('case_comments')
    .select(`
      *,
      created_by_profile:profiles!created_by(id, name, email)
    `)
    .eq('case_id', resolvedParams.id)
    .order('created_at', { ascending: true });

  // Get history
  const { data: history } = await supabase
    .from('case_history')
    .select(`
      *,
      created_by_profile:profiles!created_by(id, name, email)
    `)
    .eq('case_id', resolvedParams.id)
    .order('created_at', { ascending: false });

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    }>
      <CaseDetailClient 
        caseData={{
          ...caseData,
          checklist: checklist || [],
          files: files || [],
          comments: comments || [],
          history: history || [],
        }}
        userProfile={profile}
      />
    </Suspense>
  );
}
