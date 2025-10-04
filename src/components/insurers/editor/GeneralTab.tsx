'use client';

import { useState, useTransition } from 'react';
import { FaSave, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { actionUpdateInsurer, actionToggleInsurerActive } from '@/app/(app)/insurers/actions';
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';

interface GeneralTabProps {
  insurer: {
    id: string;
    name: string;
    active: boolean | null;
  };
}

export default function GeneralTab({ insurer }: GeneralTabProps) {
  const [name, setName] = useState(insurer.name);
  const [isActive, setIsActive] = useState(insurer.active);
  const [isSaving, startSaving] = useTransition();
  const [isToggling, startToggling] = useTransition();

  const handleSave = () => {
    startSaving(async () => {
      const upperName = name.toUpperCase();
      const result = await actionUpdateInsurer(insurer.id, { name: upperName });
      if (!result.ok) {
        alert(`Error: ${result.error}`);
      } else {
        setName(upperName);
      }
    });
  };

  const handleToggle = () => {
    startToggling(async () => {
      const result = await actionToggleInsurerActive(insurer.id);
      if (result.ok && result.data) {
        setIsActive((result.data as any).active);
      } else {
        alert(`Error: ${result.error}`);
      }
    });
  };

  return (
    <div className="tab-pane">
      <h2 className="tab-title">Información General</h2>
      <div className="form-group">
        <label htmlFor="insurerName">Nombre de la Aseguradora</label>
        <input
          id="insurerName"
          type="text"
          value={name}
          onChange={createUppercaseHandler((e) => setName(e.target.value))}
          className={`form-input ${uppercaseInputClass}`}
        />
      </div>
      <div className="form-group">
        <label>Estado</label>
        <button onClick={handleToggle} className="status-toggle" disabled={isToggling}>
          {isActive ? <FaToggleOn size={24} className="active" /> : <FaToggleOff size={24} />}
          <span>{isActive ? 'Activa' : 'Inactiva'}</span>
        </button>
      </div>
      <div className="form-actions">
        <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
          <FaSave /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <style>{`
        .tab-pane { 
          padding: 12px;
          max-width: 100%;
          overflow-x: hidden;
        }
        .tab-title { 
          font-size: 20px; 
          font-weight: 600; 
          color: #010139; 
          margin-bottom: 20px;
          word-wrap: break-word;
        }
        .form-group { 
          margin-bottom: 16px;
          width: 100%;
        }
        .form-group label { 
          display: block; 
          font-weight: 500; 
          font-size: 14px;
          margin-bottom: 8px;
          color: #333;
        }
        .form-input { 
          width: 100%; 
          max-width: 100%;
          padding: 10px 12px;
          border: 2px solid #ddd; 
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .form-input:focus {
          outline: none;
          border-color: #8AAA19;
        }
        .status-toggle { 
          display: flex; 
          align-items: center; 
          gap: 8px; 
          background: none; 
          border: none; 
          cursor: pointer; 
          color: #333;
          padding: 8px 12px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .status-toggle:hover {
          background: #f6f6ff;
        }
        .status-toggle .active { color: #4caf50; }
        .form-actions { 
          margin-top: 24px;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }
        .btn-primary { 
          display: inline-flex; 
          align-items: center; 
          justify-content: center;
          gap: 8px; 
          padding: 10px 16px;
          border-radius: 8px; 
          font-weight: 500; 
          font-size: 14px;
          text-decoration: none; 
          background: #010139; 
          color: white; 
          border: none; 
          cursor: pointer;
          transition: background 0.2s;
          white-space: nowrap;
        }
        .btn-primary:hover {
          background: #8AAA19;
        }
        .btn-primary:disabled { 
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        /* Desktop */
        @media (min-width: 768px) {
          .tab-pane {
            padding: 24px;
          }
          .tab-title {
            font-size: 24px;
            margin-bottom: 24px;
          }
          .form-group {
            margin-bottom: 20px;
          }
          .form-group label {
            font-size: 15px;
          }
          .form-input {
            padding: 12px 16px;
            font-size: 15px;
          }
          .btn-primary {
            padding: 12px 24px;
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
}
