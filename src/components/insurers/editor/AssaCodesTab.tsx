'use client';

import { useState, useEffect, useTransition } from 'react';
import { FaSave } from 'react-icons/fa';
import { actionGetAllBrokers, actionUpdateBrokerAssaCode } from '@/app/(app)/insurers/actions';

interface Broker {
  id: string;
  name: string | null;
  assa_code: string | null;
}

interface AssaCodesTabProps {
  insurerId: string;
}

export default function AssaCodesTab({ insurerId }: AssaCodesTabProps) {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    actionGetAllBrokers().then(result => {
      if (result.ok) {
        setBrokers(result.data);
      }
    });
  }, []);

  const handleSave = (brokerId: string, newCode: string | null) => {
    startTransition(async () => {
      const result = await actionUpdateBrokerAssaCode(brokerId, newCode);
      if (!result.ok) {
        alert('Error al guardar el código.');
      }
    });
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Asignación de Códigos ASSA</h2>
      <p className="mb-4">Asigne un código único de ASSA a cada broker. Estos códigos se usan para identificar al broker en los reportes de comisiones.</p>

      <div className="broker-list">
        {brokers.map(broker => (
          <div key={broker.id} className="broker-item">
            <span className="broker-name">{broker.name}</span>
            <input 
              type="text"
              defaultValue={broker.assa_code || ''}
              onBlur={(e) => handleSave(broker.id, e.target.value || null)}
              className="code-input"
              placeholder="Sin código"
            />
          </div>
        ))}
      </div>

      <style>{`
        .broker-list { display: flex; flex-direction: column; gap: 12px; max-width: 600px; }
        .broker-item { display: grid; grid-template-columns: 1fr 200px; align-items: center; gap: 16px; padding: 8px; border-radius: 8px; background: #f9f9f9; }
        .broker-name { font-weight: 500; }
        .code-input { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; }
        .code-input:focus { border-color: #010139; outline: none; }
      `}</style>
    </div>
  );
}
