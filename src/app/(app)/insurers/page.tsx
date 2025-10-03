import { Suspense } from 'react';
import Link from 'next/link';
import { FaPlus } from 'react-icons/fa';
import { getSupabaseServer } from '@/lib/supabase/server';
import InsurersList from '@/components/insurers/InsurersList';

interface Insurer {
  id: string;
  name: string;
  active: boolean | null;
}

async function getInsurers(): Promise<Insurer[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from('insurers')
    .select('id, name, active')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching insurers:', error);
    return [];
  }
  return data;
}

export default async function InsurersPage() {
  const insurers = await getInsurers();

  return (
    <div>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#010139] mb-2">🏢 Aseguradoras</h1>
          <p className="text-gray-600 text-lg">Gestión de aseguradoras y sus configuraciones</p>
        </div>

        <Suspense fallback={<div className="text-center p-8">Cargando...</div>}>
          <InsurersList initialInsurers={insurers} />
        </Suspense>
      </div>
    </div>
  );
}
