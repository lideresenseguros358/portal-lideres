'use client';

import { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaIdCard, FaTimes } from 'react-icons/fa';
import Link from 'next/link';
import { actionGetExpiringCarnets } from '@/app/(app)/brokers/actions';

interface CarnetExpiryAlertsProps {
  userRole: 'master' | 'broker';
  brokerId?: string | null;
}

export default function CarnetExpiryAlerts({ userRole, brokerId }: CarnetExpiryAlertsProps) {
  const [expiringCarnets, setExpiringCarnets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    loadExpiringCarnets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadExpiringCarnets = async () => {
    setLoading(true);
    const result = await actionGetExpiringCarnets(userRole, brokerId || undefined);
    
    if (result.ok) {
      setExpiringCarnets(result.data);
    }
    setLoading(false);
  };

  const handleDismiss = (id: string) => {
    setDismissed([...dismissed, id]);
    // Could also save dismissed alerts to localStorage
    localStorage.setItem('dismissed_carnets', JSON.stringify([...dismissed, id]));
  };

  useEffect(() => {
    // Load dismissed alerts from localStorage
    const stored = localStorage.getItem('dismissed_carnets');
    if (stored) {
      try {
        setDismissed(JSON.parse(stored));
      } catch {}
    }
  }, []);

  if (loading) {
    return null;
  }

  const visibleCarnets = expiringCarnets.filter(carnet => !dismissed.includes(carnet.id));

  if (visibleCarnets.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 mb-6">
      {visibleCarnets.map((carnet) => {
        const isExpired = carnet.status === 'expired';
        const isCritical = carnet.status === 'critical';
        
        return (
          <div
            key={carnet.id}
            className={`
              rounded-xl shadow-lg border-2 p-4 relative
              ${isExpired ? 'bg-red-50 border-red-400' : 
                isCritical ? 'bg-orange-50 border-orange-400' : 
                'bg-yellow-50 border-yellow-400'}
            `}
          >
            <button
              onClick={() => handleDismiss(carnet.id)}
              className="absolute top-2 right-2 p-1 hover:bg-white/50 rounded transition-colors"
              title="Descartar alerta"
            >
              <FaTimes className="text-gray-600" size={14} />
            </button>

            <div className="flex items-start gap-3">
              <div className={`
                p-2 rounded-lg flex-shrink-0
                ${isExpired ? 'bg-red-100' : 
                  isCritical ? 'bg-orange-100' : 
                  'bg-yellow-100'}
              `}>
                {isExpired ? (
                  <FaExclamationTriangle className="text-red-600" size={20} />
                ) : (
                  <FaIdCard 
                    className={isCritical ? 'text-orange-600' : 'text-yellow-600'} 
                    size={20} 
                  />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={`
                  font-bold text-sm sm:text-base mb-1
                  ${isExpired ? 'text-red-900' : 
                    isCritical ? 'text-orange-900' : 
                    'text-yellow-900'}
                `}>
                  {isExpired ? '⚠️ Carnet Vencido' : 
                   isCritical ? '⚠️ Carnet por Vencer (Urgente)' : 
                   '⚠️ Carnet por Vencer'}
                </h4>
                
                <p className="text-sm text-gray-700">
                  <strong>{carnet.name}</strong>
                  {userRole === 'master' && carnet.email && (
                    <span className="text-gray-600"> ({carnet.email})</span>
                  )}
                </p>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                  <p className={`
                    text-sm font-semibold
                    ${isExpired ? 'text-red-700' : 
                      isCritical ? 'text-orange-700' : 
                      'text-yellow-700'}
                  `}>
                    {isExpired 
                      ? `Vencido hace ${Math.abs(carnet.daysUntilExpiry)} días` 
                      : `Vence en ${carnet.daysUntilExpiry} días`}
                  </p>
                  
                  <p className="text-xs text-gray-600">
                    Fecha de vencimiento: {new Date(carnet.carnet_expiry_date).toLocaleDateString('es-PA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>

                {userRole === 'master' && (
                  <Link
                    href={`/brokers/${carnet.id}`}
                    className={`
                      inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold transition-all
                      ${isExpired ? 'bg-red-600 hover:bg-red-700 text-white' : 
                        isCritical ? 'bg-orange-600 hover:bg-orange-700 text-white' : 
                        'bg-yellow-600 hover:bg-yellow-700 text-white'}
                    `}
                  >
                    Actualizar Carnet →
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
