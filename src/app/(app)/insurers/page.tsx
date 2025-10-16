import { Suspense } from 'react';
import Link from 'next/link';
import { FaPlus } from 'react-icons/fa';
import { getSupabaseServer } from '@/lib/supabase/server';
import InsurersList from '@/components/insurers/InsurersList';

interface Contact {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_primary?: boolean | null;
}

interface Insurer {
  id: string;
  name: string;
  active: boolean | null;
  logo_url?: string | null;
  contacts: Contact[];
}

async function getInsurers(): Promise<Insurer[]> {
  const supabase = await getSupabaseServer();
  
  // Fetch insurers
  const { data: insurersData, error: insurersError } = await supabase
    .from('insurers')
    .select('id, name, active, logo_url')
    .order('name', { ascending: true });

  if (insurersError) {
    console.error('Error fetching insurers:', insurersError);
    return [];
  }

  // Fetch all contacts
  const { data: contactsData, error: contactsError } = await supabase
    .from('insurer_contacts')
    .select('*')
    .order('is_primary', { ascending: false });

  if (contactsError) {
    console.error('Error fetching contacts:', contactsError);
  }

  // Map contacts to insurers
  const insurers: Insurer[] = (insurersData || []).map(insurer => ({
    ...insurer,
    contacts: (contactsData || []).filter(contact => contact.insurer_id === insurer.id).map(c => ({
      id: c.id,
      name: c.name,
      position: c.position,
      phone: c.phone,
      email: c.email,
      notes: c.notes,
      is_primary: (c as any).is_primary ?? null
    }))
  }));

  return insurers;
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
