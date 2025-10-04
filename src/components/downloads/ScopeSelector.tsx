'use client';

import { FaCar, FaHeartbeat } from 'react-icons/fa';

interface ScopeSelectorProps {
  onSelect: (scope: 'generales' | 'personas') => void;
}

export default function ScopeSelector({ onSelect }: ScopeSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      {/* Ramos Generales */}
      <button
        onClick={() => onSelect('generales')}
        className="
          group
          bg-white rounded-2xl shadow-xl
          border-4 border-[#010139]
          hover:border-[#8AAA19] hover:shadow-2xl
          transition-all duration-300
          p-8
          flex flex-col items-center justify-center gap-6
          min-h-[300px]
          hover:scale-105
        "
      >
        <div className="p-6 bg-gradient-to-br from-[#010139] to-[#020250] rounded-full group-hover:from-[#8AAA19] group-hover:to-[#6d8814] transition-all">
          <FaCar className="text-6xl text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#010139] group-hover:text-[#8AAA19] transition-colors mb-2">
            Ramos Generales
          </h2>
          <p className="text-gray-600">
            Auto, Incendio, RC, Fianzas, y más
          </p>
        </div>
      </button>

      {/* Ramo Personas */}
      <button
        onClick={() => onSelect('personas')}
        className="
          group
          bg-white rounded-2xl shadow-xl
          border-4 border-[#010139]
          hover:border-[#8AAA19] hover:shadow-2xl
          transition-all duration-300
          p-8
          flex flex-col items-center justify-center gap-6
          min-h-[300px]
          hover:scale-105
        "
      >
        <div className="p-6 bg-gradient-to-br from-[#010139] to-[#020250] rounded-full group-hover:from-[#8AAA19] group-hover:to-[#6d8814] transition-all">
          <FaHeartbeat className="text-6xl text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-bold text-[#010139] group-hover:text-[#8AAA19] transition-colors mb-2">
            Ramo Personas
          </h2>
          <p className="text-gray-600">
            Vida, Salud, AP, Colectivos
          </p>
        </div>
      </button>
    </div>
  );
}
