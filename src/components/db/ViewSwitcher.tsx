'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface ViewSwitcherProps {
  currentView: string;
}

export default function ViewSwitcher({ currentView }: ViewSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => setView('clients')}
        className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${
          currentView === 'clients' ? 'bg-white text-[#010139] shadow' : 'text-gray-600 hover:bg-gray-200'
        }`}
      >
        Por Cliente
      </button>
      <button
        onClick={() => setView('insurers')}
        className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${
          currentView === 'insurers' ? 'bg-white text-[#010139] shadow' : 'text-gray-600 hover:bg-gray-200'
        }`}
      >
        Por Aseguradora
      </button>
    </div>
  );
}
