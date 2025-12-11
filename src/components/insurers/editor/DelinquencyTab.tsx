'use client';

import { useState, useTransition } from 'react';
import { FaPlus, FaTrash } from 'react-icons/fa';
import { actionUpsertMappingRule, actionDeleteMappingRule } from '@/app/(app)/insurers/actions';

const DELINQUENCY_FIELDS = [
  'DELINQUENCY_POLICY_NUMBER',
  'DELINQUENCY_CLIENT_NAME',
  'DELINQUENCY_DUE_SOON',
  'DELINQUENCY_CURRENT',
  'DELINQUENCY_BUCKET_1_30',
  'DELINQUENCY_BUCKET_31_60',
  'DELINQUENCY_BUCKET_61_90',
  'DELINQUENCY_BUCKET_90_PLUS',
];

interface DelinquencyTabProps {
  rules: any[]; // Replace with actual type
  insurerId: string;
}

export default function DelinquencyTab({ rules, insurerId }: DelinquencyTabProps) {
  const delinquencyRules = rules.filter(r => r.target_field.startsWith('DELINQUENCY'));
  const [currentRules, setCurrentRules] = useState(delinquencyRules);
  const [newRule, setNewRule] = useState({ target_field: '', strategy: 'alias', aliases: '' });
  const [isPending, startTransition] = useTransition();

  const handleAdd = () => {
    startTransition(async () => {
      const result = await actionUpsertMappingRule({
        insurer_id: insurerId,
        target_field: newRule.target_field,
        strategy: newRule.strategy,
        aliases: newRule.aliases.split(',').map(a => a.trim()).filter(Boolean),
      });
      if (result.ok && result.data) {
        setCurrentRules(prev => [...prev, result.data]);
        setNewRule({ target_field: '', strategy: 'alias', aliases: '' });
      } else {
        alert(`Error: ${result.error}`);
      }
    });
  };

  const handleDelete = (ruleId: string) => {
    startTransition(async () => {
      const result = await actionDeleteMappingRule(ruleId);
      if (result.ok) {
        setCurrentRules(prev => prev.filter(r => r.id !== ruleId));
      } else {
        alert(`Error: ${result.error}`);
      }
    });
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Mapeo de Morosidad</h2>
      <p className="mb-4">Define los nombres de las columnas en los archivos de morosidad que corresponden a los campos estándar.</p>
      
      <div className="add-rule-form">
        <select value={newRule.target_field} onChange={e => setNewRule({...newRule, target_field: e.target.value})}>
          <option value="">-- Campo Estándar --</option>
          {DELINQUENCY_FIELDS.map(field => (
            <option key={field} value={field}>{field.replace('DELINQUENCY_', '')}</option>
          ))}
        </select>
        <input 
          type="text" 
          placeholder="Ej: Póliza, Asegurado, Saldo" 
          value={newRule.aliases} 
          onChange={e => setNewRule({...newRule, aliases: e.target.value})}
          className="form-input"
          data-no-uppercase="true"
        />
        <button onClick={handleAdd} className="btn-add" disabled={isPending}><FaPlus /> Agregar Regla</button>
      </div>

      <div className="rules-list">
        {currentRules.map(rule => (
          <div key={rule.id} className="rule-item">
            <div>
              <p className="rule-target">{rule.target_field.replace('DELINQUENCY_', '')}</p>
              <p className="rule-details">Aliases: {rule.aliases.join(', ')}</p>
            </div>
            <button onClick={() => handleDelete(rule.id)} className="btn-delete" disabled={isPending}><FaTrash /></button>
          </div>
        ))}
      </div>

      <style>{`
        /* Same styles as CommissionsTab */
        .add-rule-form { 
          display: grid; 
          grid-template-columns: 1fr; 
          gap: 12px; 
          margin-bottom: 24px; 
          max-width: 100%;
        }
        .add-rule-form select, .add-rule-form input { 
          padding: 10px; 
          border: 1px solid #ddd; 
          border-radius: 8px; 
          min-width: 0;
          width: 100%;
        }
        
        @media (min-width: 640px) {
          .add-rule-form {
            grid-template-columns: 1fr 2fr auto;
            gap: 16px;
          }
        }
        .btn-add { display: flex; align-items: center; justify-content: center; gap: 8px; background: #8aaa19; color: white; border: none; border-radius: 8px; cursor: pointer; }
        .rules-list { display: flex; flex-direction: column; gap: 12px; }
        .rule-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f9f9f9; border-radius: 8px; }
        .rule-target { font-weight: 600; }
        .rule-details { font-size: 14px; color: #666; }
        .btn-delete { background: none; border: none; color: #d32f2f; cursor: pointer; }
      `}</style>
    </div>
  );
}
