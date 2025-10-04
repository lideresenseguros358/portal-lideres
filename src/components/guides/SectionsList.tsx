'use client';

import Link from 'next/link';
import { FaFolder, FaPlus } from 'react-icons/fa';
import { GuideSection } from '@/lib/guides/types';
import BadgeNuevo from '@/components/shared/BadgeNuevo';

interface SectionsListProps {
  sections: GuideSection[];
  isMaster: boolean;
}

export default function SectionsList({ sections, isMaster }: SectionsListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sections.map((section) => (
        <Link
          key={section.id}
          href={`/guides/${section.id}`}
          className="
            group
            bg-white rounded-xl shadow-lg
            border-2 border-gray-200
            hover:border-[#8AAA19] hover:shadow-xl
            transition-all duration-200
            overflow-hidden
          "
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-[#010139] to-[#020250] rounded-lg">
                  <FaFolder className="text-2xl text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#010139] group-hover:text-[#8AAA19] transition-colors">
                    {section.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {section.files_count || 0} archivo{section.files_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <BadgeNuevo show={section.has_new_files || false} />
            </div>

            <div className="text-sm text-gray-600">
              Click para ver documentos
            </div>
          </div>
        </Link>
      ))}

      {/* Agregar sección (Master) */}
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
            min-h-[150px]
          "
        >
          <FaPlus className="text-3xl text-gray-400" />
          <span className="font-semibold text-gray-600">Nueva Sección</span>
        </button>
      )}
    </div>
  );
}
