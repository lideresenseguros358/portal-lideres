'use client';

import { FaClipboardList, FaCheckCircle } from 'react-icons/fa';
import { getRequirements } from '@/lib/downloads/constants';

interface RequirementsGuideProps {
  policyType: string;
}

export default function RequirementsGuide({ policyType }: RequirementsGuideProps) {
  const requirements = getRequirements(policyType);

  if (requirements.length === 0) {
    return null;
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg border-2 border-blue-200 p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <FaClipboardList className="text-3xl text-[#010139]" />
        <h3 className="text-xl font-bold text-[#010139]">
          Requisitos Necesarios
        </h3>
      </div>

      <p className="text-sm text-gray-700 mb-4">
        Los siguientes documentos son necesarios para el trámite. Esta es una guía visual, no son archivos descargables.
      </p>

      <ul className="space-y-2">
        {requirements.map((req, idx) => (
          <li key={idx} className="flex items-start gap-3">
            <FaCheckCircle className="text-[#8AAA19] mt-1 flex-shrink-0" />
            <span className={`${req.startsWith('  •') ? 'ml-4 text-sm text-gray-600' : 'text-gray-800'}`}>
              {req.replace('  • ', '')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
