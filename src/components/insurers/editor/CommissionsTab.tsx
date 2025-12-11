'use client';

import { useState, useTransition, useEffect } from 'react';
import { FaPlus, FaTrash, FaSave } from 'react-icons/fa';
import { actionUpsertMappingRule, actionDeleteMappingRule } from '@/app/(app)/insurers/actions';

interface CommissionsTabProps {
  rules: any[]; // Replace with actual type
  insurerId: string;
}

const COMMISSION_FIELDS = [
  { value: 'policy', label: 'Número de Póliza' },
  { value: 'insured', label: 'Nombre del Cliente/Asegurado' },
  { value: 'commission', label: 'Monto de Comisión' },
];

export default function CommissionsTab({ rules, insurerId }: CommissionsTabProps) {
  // Filter only commission-related rules
  const commissionRules = rules.filter(r => 
    ['policy', 'insured', 'commission'].includes(r.target_field)
  );
  const [currentRules, setCurrentRules] = useState(commissionRules);
  const [newRule, setNewRule] = useState({ target_field: '', strategy: 'alias', aliases: '' });
  const [invertNegatives, setInvertNegatives] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isPending, startTransition] = useTransition();
  
  // Load invert negatives setting
  useEffect(() => {
    const loadSettings = async () => {
      // TODO: Load from insurer_mappings.options
      const stored = localStorage.getItem(`invert_negatives_${insurerId}`);
      if (stored) {
        setInvertNegatives(stored === 'true');
      }
    };
    loadSettings();
  }, [insurerId]);

  const handleAdd = () => {
    if (!newRule.target_field || !newRule.aliases) {
      alert('Por favor complete todos los campos');
      return;
    }

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
        alert('Regla agregada correctamente');
      } else {
        alert(`Error creando regla: ${result.error}`);
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
      <h2 className="tab-title">Mapeo de Comisiones</h2>
      <p className="mb-4">Define los nombres de las columnas en los archivos CSV/Excel que corresponden a los campos estándar de comisiones.</p>
      
      {/* Add Rule Form */}
      <div className="add-rule-form">
        <select value={newRule.target_field} onChange={e => setNewRule({...newRule, target_field: e.target.value})}>
          <option value="">-- Seleccione Campo --</option>
          {COMMISSION_FIELDS.map(field => (
            <option key={field.value} value={field.value}>{field.label}</option>
          ))}
        </select>
        <input 
          type="text" 
          placeholder='Ej: Póliza, Asegurado, Monto Comisión' 
          value={newRule.aliases} 
          onChange={e => setNewRule({...newRule, aliases: e.target.value})}
          className="form-input"
          data-no-uppercase="true"
        />
        <button onClick={handleAdd} className="btn-add" disabled={isPending}>
          <FaPlus /> {isPending ? 'Guardando...' : 'Agregar'}
        </button>
      </div>
      
      <div className="help-text">
        <p><strong>💡 Cómo usar:</strong></p>
        <ul>
          <li>Escribe el nombre exacto de la columna como aparece en tu archivo Excel</li>
          <li>Puedes agregar varios nombres separados por coma: <code>Nro Poliza, No. Póliza, Policy Number</code></li>
          <li>No importan mayúsculas/minúsculas ni acentos</li>
        </ul>
      </div>

      {/* Invert Negatives Toggle */}
      <div className="toggle-section">
        <label className="toggle-label">
          <input 
            type="checkbox" 
            checked={invertNegatives}
            onChange={(e) => {
              setInvertNegatives(e.target.checked);
              setHasChanges(true);
            }}
            className="toggle-checkbox"
          />
          <span className="toggle-text">
            <strong>Invertir signos de montos</strong>
            <span className="toggle-description">
              Activa esto si los montos en el archivo vienen con signo invertido (negativos que son positivos)
            </span>
          </span>
        </label>
        
        {hasChanges && (
          <button 
            onClick={() => {
              localStorage.setItem(`invert_negatives_${insurerId}`, String(invertNegatives));
              setHasChanges(false);
              alert('Configuración guardada correctamente');
            }}
            className="btn-save"
            disabled={isPending}
          >
            <FaSave /> Guardar Configuración
          </button>
        )}
      </div>

      {/* Current Rules */}
      <div className="rules-list">
        <h3 className="text-lg font-semibold mb-3">Reglas Activas</h3>
        {currentRules.length === 0 ? (
          <p className="text-gray-500 italic">No hay reglas configuradas. Se usará detección automática.</p>
        ) : (
          currentRules.map(rule => (
            <div key={rule.id} className="rule-item">
              <div>
                <p className="rule-target">
                  {rule.target_field === 'policy' && '📋 Número de Póliza'}
                  {rule.target_field === 'insured' && '👤 Nombre del Cliente'}
                  {rule.target_field === 'commission' && '💰 Monto de Comisión'}
                </p>
                <p className="rule-details">
                  Busca columnas: <strong>{Array.isArray(rule.aliases) ? rule.aliases.join(', ') : rule.aliases}</strong>
                </p>
              </div>
              <button onClick={() => handleDelete(rule.id)} className="btn-delete" disabled={isPending} title="Eliminar regla">
                <FaTrash />
              </button>
            </div>
          ))
        )}
      </div>

      <style>{`
        .add-rule-form { 
          display: grid; 
          grid-template-columns: 1fr; 
          gap: 12px; 
          margin-bottom: 16px; 
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
        .btn-add { display: flex; align-items: center; justify-content: center; gap: 8px; background: #8aaa19; color: white; border: none; border-radius: 8px; cursor: pointer; padding: 10px 20px; }
        .btn-add:disabled { background: #ccc; cursor: not-allowed; }
        .help-text { background: #e3f2fd; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #2196f3; }
        .help-text p { margin: 0 0 8px 0; color: #1565c0; }
        .help-text ul { margin: 0; padding-left: 20px; }
        .help-text li { color: #424242; margin: 4px 0; }
        .help-text code { background: #fff; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        .rules-list { display: flex; flex-direction: column; gap: 12px; }
        .rule-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f9f9f9; border-radius: 8px; border-left: 4px solid #8aaa19; }
        .rule-target { font-weight: 600; font-size: 16px; margin-bottom: 4px; }
        .rule-details { font-size: 14px; color: #666; }
        .btn-delete { background: none; border: none; color: #d32f2f; cursor: pointer; font-size: 18px; padding: 8px; }
        .btn-delete:hover { color: #b71c1c; }
        .toggle-section { background: #fff3cd; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #ffc107; }
        .toggle-label { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; margin-bottom: 12px; }
        .toggle-checkbox { width: 20px; height: 20px; cursor: pointer; margin-top: 2px; }
        .toggle-text { display: flex; flex-direction: column; gap: 4px; }
        .toggle-text strong { color: #856404; font-size: 15px; }
        .toggle-description { font-size: 13px; color: #856404; font-weight: normal; }
        .btn-save { display: flex; align-items: center; gap: 8px; background: #8aaa19; color: white; border: none; border-radius: 8px; cursor: pointer; padding: 10px 20px; font-weight: 600; transition: background 0.2s; }
        .btn-save:hover { background: #010139; }
        .btn-save:disabled { background: #ccc; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
