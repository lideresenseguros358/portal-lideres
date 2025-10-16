/**
 * Error State - Error al cotizar
 */

import { FaExclamationTriangle } from 'react-icons/fa';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ 
  message = 'Ocurrió un error al cotizar. Verifica tu conexión e inténtalo de nuevo.',
  onRetry
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-24 h-24 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <FaExclamationTriangle className="text-4xl text-red-600" />
      </div>
      <h3 className="text-xl font-bold text-red-800 mb-2">Error</h3>
      <p className="text-gray-600 max-w-md mb-6">{message}</p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-3 bg-[#010139] text-white rounded-lg font-semibold hover:bg-[#8AAA19] transition-colors"
        >
          REINTENTAR
        </button>
      )}
    </div>
  );
}
