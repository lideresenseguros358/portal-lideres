'use client';

import { useState } from 'react';
import { FaUpload } from 'react-icons/fa';
import { actionUploadImport } from '@/app/(app)/commissions/actions';

interface Props {
  insurers: { id: string; name: string }[];
  draftFortnightId: string;
  onImport: () => void; // Callback to refresh data
}

export default function ImportForm({ insurers, draftFortnightId, onImport }: Props) {
  const [selectedInsurer, setSelectedInsurer] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isLifeInsurance, setIsLifeInsurance] = useState(false);

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('=== IMPORT FORM SUBMIT ===');
    console.log('File:', file?.name);
    console.log('Insurer:', selectedInsurer);
    console.log('Amount:', totalAmount);
    console.log('Fortnight ID:', draftFortnightId);
    
    if (!file) {
      alert('Por favor seleccione un archivo');
      return;
    }
    if (!selectedInsurer) {
      alert('Por favor seleccione una aseguradora');
      return;
    }
    if (!totalAmount) {
      alert('Por favor ingrese el monto total');
      return;
    }
    if (!draftFortnightId) {
      alert('Error: No hay quincena en borrador');
      console.error('Missing draftFortnightId');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('insurer_id', selectedInsurer);
    formData.append('total_amount', totalAmount);
    formData.append('fortnight_id', draftFortnightId);
    formData.append('is_life_insurance', String(isLifeInsurance));
    
    // Get invert_negatives setting from localStorage
    const invertNegatives = localStorage.getItem(`invert_negatives_${selectedInsurer}`) === 'true';
    formData.append('invert_negatives', String(invertNegatives));

    try {
      const result = await actionUploadImport(formData);
      
      if (result.ok) {
        alert('Importación exitosa');
        setFile(null);
        setSelectedInsurer('');
        setTotalAmount('');
        setIsLifeInsurance(false);
        onImport();
      } else {
        console.error('Import error:', result.error);
        alert(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert(`Error inesperado: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="import-form-container">
      <h3 className="section-title">1. Importar Reportes</h3>
      <form onSubmit={handleFileUpload} className="form-content">
        <div className="field">
          <label htmlFor="insurer">Aseguradora</label>
          <select
            id="insurer"
            value={selectedInsurer}
            onChange={(e) => setSelectedInsurer(e.target.value)}
            required
          >
            <option value="">Seleccionar...</option>
            {insurers.map((ins) => (
              <option key={ins.id} value={ins.id}>{ins.name}</option>
            ))}
          </select>
        </div>
        
        <div className="field">
          <label htmlFor="totalAmount">Monto Total del Reporte</label>
          <input
            id="totalAmount"
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            placeholder="0.00"
            step="0.01"
            required
          />
        </div>

        {/* Show checkbox only for ASSA */}
        {insurers.find(i => i.id === selectedInsurer)?.name === 'ASSA' && (
          <div className="field checkbox-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isLifeInsurance}
                onChange={(e) => setIsLifeInsurance(e.target.checked)}
              />
              <span>Este es un reporte de Vida (PJ750 o PJ750-6)</span>
            </label>
          </div>
        )}

        <div className="dropzone" onClick={() => document.getElementById('file-upload')?.click()}>
          <FaUpload className="dropzone-icon" />
          <p className="dropzone-label">
            {file ? file.name : 'Click para seleccionar archivo (CSV, XLSX, PDF)'}
          </p>
          <input
            id="file-upload"
            type="file"
            accept=".csv,.xlsx,.pdf,.jpg,.png"
            onChange={(e) => {
              const selectedFile = e.target.files?.[0];
              console.log('File selected:', selectedFile?.name);
              setFile(selectedFile || null);
            }}
            style={{ display: 'none' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={uploading || !file || !selectedInsurer || !totalAmount} 
          className="btn-primary"
        >
          {uploading ? 'Importando...' : 'Importar Archivo'}
        </button>
      </form>

      <style>{`
        .import-form-container {
          background: #f8f9fa;
          border-radius: 12px;
          padding: 24px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 600;
          color: #010139;
          margin-bottom: 16px;
        }
        .form-content {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .grid-fields {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        
        .checkbox-field {
          margin: 1rem 0;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        
        .checkbox-label input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .checkbox-label span {
          font-size: 14px;
          color: #4B5563;
        }
        .field label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #344054;
        }
        .field select, .field input {
          width: 100%;
          padding: 10px;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
        }
        .dropzone {
          border: 2px dashed #d0d5dd;
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s;
        }
        .dropzone:hover {
          border-color: #010139;
        }
        .dropzone-icon {
          color: #8aaa19;
          font-size: 24px;
          margin-bottom: 12px;
        }
        .dropzone-label {
          color: #475467;
          font-weight: 500;
        }
        .btn-primary {
          padding: 12px 24px;
          background: #010139;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-primary:hover {
          background: #8aaa19;
        }
        .btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
