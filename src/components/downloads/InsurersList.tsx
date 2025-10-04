'use client';

import Link from 'next/link';
import { FaBuilding, FaPlus } from 'react-icons/fa';

interface Insurer {
  id: string;
  name: string;
  sections_count?: number;
}

interface InsurersListProps {
  scope: string;
  policyType: string;
  insurers: Insurer[];
  isMaster: boolean;
}

export default function InsurersList({ scope, policyType, insurers, isMaster }: InsurersListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {insurers.map((insurer) => (
        <Link
          key={insurer.id}
          href={`/downloads/${scope}/${policyType}/${insurer.id}`}
          className="
            group
            bg-white rounded-xl shadow-lg
            border-2 border-gray-200
            hover:border-[#8AAA19] hover:shadow-xl
            transition-all duration-200
            p-6
            flex flex-col items-center justify-center
            min-h-[180px]
          "
        >
          <FaBuilding className="text-5xl text-gray-400 mb-4" />

          <h3 className="text-lg font-bold text-[#010139] group-hover:text-[#8AAA19] transition-colors text-center">
            {insurer.name}
          </h3>

          {insurer.sections_count !== undefined && (
            <p className="text-sm text-gray-500 mt-2">
              {insurer.sections_count} sección{insurer.sections_count !== 1 ? 'es' : ''}
            </p>
          )}
        </Link>
      ))}

      {isMaster && (
        <button
          className="
            bg-gradient-to-br from-gray-50 to-gray-100
            border-2 border-dashed border-gray-300
            rounded-xl
            hover:border-[#8AAA19] hover:bg-gray-50
            transition-all duration-200
            p-6
            flex flex-col items-center justify-center gap-3
            min-h-[180px]
          "
        >
          <FaPlus className="text-3xl text-gray-400" />
          <span className="font-semibold text-gray-600">Nueva Aseguradora</span>
        </button>
      )}
    </div>
  );
}
