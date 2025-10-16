/**
 * Offline Banner - Sin conexión
 */

'use client';

import { FaWifi } from 'react-icons/fa';
import { useOnline } from '@/lib/cotizadores/hooks/useOnline';

export default function OfflineBanner() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <FaWifi className="text-xl" />
        <p className="font-semibold">No hay señal para esta acción</p>
      </div>
    </div>
  );
}
