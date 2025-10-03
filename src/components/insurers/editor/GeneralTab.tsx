'use client';

import { useState, useTransition } from 'react';
import { FaSave, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { actionUpdateInsurer, actionToggleInsurerActive } from '@/app/(app)/insurers/actions';

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
      const result = await actionUpdateInsurer(insurer.id, { name });
      if (!result.ok) {
        alert(`Error: ${result.error}`);
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
          onChange={(e) => setName(e.target.value)}
          className="form-input"
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
        .tab-pane { padding: 16px; }
        .tab-title { font-size: 24px; font-weight: 600; color: #010139; margin-bottom: 24px; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; font-weight: 500; margin-bottom: 8px; }
        .form-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; }
        .status-toggle { display: flex; align-items: center; gap: 8px; background: none; border: none; cursor: pointer; color: #333; }
        .status-toggle .active { color: #4caf50; }
        .form-actions { margin-top: 32px; }
        .btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; font-weight: 500; text-decoration: none; background: #010139; color: white; border: none; cursor: pointer; }
        .btn-primary:disabled { opacity: 0.7; }
      `}</style>
    </div>
  );
}
