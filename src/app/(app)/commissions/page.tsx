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
    <div>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#010139] mb-2">💰 Comisiones</h1>
          <p className="text-gray-600 text-lg">Gestión de comisiones, importaciones y pagos</p>
        </div>
        
        {/* Main Content */}
        <CommissionsTabs initialData={initialData} />
      </div>
    </div>
  );
}