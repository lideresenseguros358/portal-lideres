import { getAuthContext } from '@/lib/db/context';
import { getSupabaseServer } from '@/lib/supabase/server';
import CommissionsTabs from '@/components/commissions/CommissionsTabs';

export const metadata = {
  title: 'LISSA | Comisiones',
  description: 'Gestión de comisiones, importaciones y pagos',
};

async function getInitialData() {
  const supabase = await getSupabaseServer();
  const { role, brokerId } = await getAuthContext();

  const { data: brokers } = await supabase
    .from('brokers')
    .select('id, name')
    .eq('active', true)
    .order('name');
    
  const { data: insurers } = await supabase
    .from('insurers')
    .select('id, name')
    .eq('active', true)
    .order('name');
    
  const { data: draftFortnight } = await supabase
    .from('fortnights')
    .select('*')
    .eq('status', 'DRAFT')
    .maybeSingle();

  return {
    brokers: brokers || [],
    insurers: insurers || [],
    draftFortnight: draftFortnight || null,
    role: role || 'broker',
    brokerId: brokerId || null,
  };
}

export default async function CommissionsPage() {
  const initialData = await getInitialData();

  return (
    <div className="px-2 sm:px-4">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Main Content */}
        <CommissionsTabs initialData={initialData} />
      </div>
    </div>
  );
}