'use client';

import { useParams, useRouter } from 'next/navigation';
import { FaArrowLeft } from 'react-icons/fa';
import TypesList from '@/components/downloads/TypesList';
import { getPolicyTypeLabel } from '@/lib/downloads/constants';

export default function DownloadsScopePage() {
  const params = useParams();
  const router = useRouter();
  const scope = params.scope as 'generales' | 'personas';

  const title = scope === 'generales' ? 'Ramos Generales' : 'Ramo Personas';

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.push('/downloads')}
          className="
            flex items-center gap-2 mb-6
            text-[#010139] hover:text-[#8AAA19]
            font-semibold transition-colors
          "
        >
          <FaArrowLeft />
          <span>Volver a Descargas</span>
        </button>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#010139] mb-2">
            {title}
          </h1>
          <p className="text-gray-600">
            Selecciona el tipo de póliza
          </p>
        </div>

        <TypesList scope={scope} />
      </div>
    </div>
  );
}
