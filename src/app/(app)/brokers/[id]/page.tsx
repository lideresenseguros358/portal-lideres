import { Suspense } from 'react';
import { getSupabaseServer } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import BrokerDetailClient from '@/components/brokers/BrokerDetailClient';

export const metadata = {
  title: 'Detalle Corredor - Portal Líderes',
};

export default async function BrokerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile - only Master can access
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'master') {
    redirect('/dashboard');
  }

  const { id } = await params;

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6">
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
        </div>
      }>
        <BrokerDetailClient brokerId={id} />
      </Suspense>
    </div>
  );
}
