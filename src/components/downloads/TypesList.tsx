'use client';

import Link from 'next/link';
import { FaStar } from 'react-icons/fa';
import { POLICY_TYPES } from '@/lib/downloads/constants';

interface TypesListProps {
  scope: 'generales' | 'personas';
}

export default function TypesList({ scope }: TypesListProps) {
  const types = POLICY_TYPES[scope];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {types.map((type) => (
        <Link
          key={type.key}
          href={`/downloads/${scope}/${type.key}`}
          className={`
            group
            bg-white rounded-xl shadow-lg
            border-2 ${'featured' in type && type.featured ? 'border-[#8AAA19]' : 'border-gray-200'}
            hover:border-[#8AAA19] hover:shadow-xl
            transition-all duration-200
            p-6
            relative
            ${'featured' in type && type.featured ? 'ring-2 ring-[#8AAA19] ring-opacity-50' : ''}
          `}
        >
          {'featured' in type && type.featured && (
            <div className="absolute -top-3 -right-3 p-2 bg-[#8AAA19] rounded-full shadow-lg">
              <FaStar className="text-white" />
            </div>
          )}

          <h3 className="text-xl font-bold text-[#010139] group-hover:text-[#8AAA19] transition-colors mb-2">
            {type.label}
          </h3>

          <p className="text-sm text-gray-500">
            Click para ver aseguradoras
          </p>
        </Link>
      ))}
    </div>
  );
}
