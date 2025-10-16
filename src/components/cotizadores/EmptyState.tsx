/**
 * Empty State - Sin resultados
 */

import { FaSearch } from 'react-icons/fa';

interface EmptyStateProps {
  title?: string;
  message?: string;
}

export default function EmptyState({ 
  title = 'Sin resultados',
  message = 'No se encontraron opciones para los datos ingresados. Ajusta tu búsqueda e intenta de nuevo.'
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <FaSearch className="text-4xl text-gray-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
      <p className="text-gray-600 max-w-md">{message}</p>
    </div>
  );
}
