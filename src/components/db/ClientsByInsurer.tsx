import Link from 'next/link';
import { ClientWithPolicies, InsurerWithCount } from '@/types/db';

interface ClientsByInsurerProps {
  clients: ClientWithPolicies[];
  insurers: InsurerWithCount[];
}

export default function ClientsByInsurer({ clients, insurers }: ClientsByInsurerProps) {
  const clientsByInsurer = insurers.map(insurer => ({
    ...insurer,
    clients: clients.filter(client => 
      client.policies.some(policy => policy.insurer_id === insurer.id)
    ),
  }));

  return (
    <div className="space-y-4">
      {clientsByInsurer.map(insurer => (
        <div key={insurer.id} className="bg-white rounded-lg shadow-sm p-4">
          <h2 className="text-lg font-semibold text-[#010139]">{insurer.name}</h2>
          <div className="mt-2 space-y-2">
            {insurer.clients.map(client => (
              <Link key={client.id} href={`/db?tab=clients&modal=edit-client&editClient=${client.id}`} className="block p-2 rounded-md hover:bg-gray-50">
                <p className="font-medium">{client.name}</p>
                <p className="text-sm text-gray-500">{client.national_id}</p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
