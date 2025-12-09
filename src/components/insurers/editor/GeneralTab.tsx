'use client';

import { useState, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FaSave, FaToggleOn, FaToggleOff, FaImage, FaTrash } from 'react-icons/fa';
import Image from 'next/image';
import { toast } from 'sonner';
import { actionUpdateInsurer, actionToggleInsurerActive } from '@/app/(app)/insurers/actions';
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { supabaseClient } from '@/lib/supabase/client';

interface GeneralTabProps {
  insurer: {
    id: string;
    name: string;
    active: boolean | null;
    logo_url?: string | null;
  };
}

export default function GeneralTab({ insurer }: GeneralTabProps) {
  const router = useRouter();
  const [name, setName] = useState(insurer.name);
  const [isActive, setIsActive] = useState(insurer.active);
  const [logoUrl, setLogoUrl] = useState(insurer.logo_url || null);
  const [uploading, setUploading] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const [isToggling, startToggling] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    startSaving(async () => {
      const upperName = name.toUpperCase();
      const result = await actionUpdateInsurer(insurer.id, { 
        name: upperName,
        logo_url: logoUrl
      });
      if (!result.ok) {
        toast.error(`Error: ${result.error}`);
      } else {
        setName(upperName);
        toast.success('✅ Cambios guardados exitosamente');
        // Redirigir automáticamente después de guardar
        setTimeout(() => {
          router.push('/insurers');
        }, 500);
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen');
      return;
    }

    // Validar tamaño (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('El archivo es muy grande. Máximo 2MB');
      return;
    }

    setUploading(true);

    try {
      // Generar nombre único
      const fileExt = file.name.split('.').pop();
      const fileName = `${insurer.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const supabase = supabaseClient();

      // Eliminar logo anterior si existe
      if (logoUrl) {
        const oldPath = logoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('insurer-logos')
            .remove([oldPath]);
        }
      }

      // Subir nuevo archivo
      const { data, error } = await supabase.storage
        .from('insurer-logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      // Obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('insurer-logos')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);
      
      // Auto-guardar el logo
      const result = await actionUpdateInsurer(insurer.id, { logo_url: publicUrl });
      if (!result.ok) {
        throw new Error(result.error);
      }

      toast.success('✅ Logo actualizado exitosamente');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error(`Error al subir logo: ${error.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteLogo = async () => {
    if (!logoUrl) return;
    if (!confirm('¿Estás seguro de eliminar el logo?')) return;

    setUploading(true);

    try {
      const supabase = supabaseClient();
      
      // Eliminar del storage
      const oldPath = logoUrl.split('/').pop();
      if (oldPath) {
        await supabase.storage
          .from('insurer-logos')
          .remove([oldPath]);
      }

      // Actualizar BD
      const result = await actionUpdateInsurer(insurer.id, { logo_url: null });
      if (!result.ok) {
        throw new Error(result.error);
      }

      setLogoUrl(null);
      toast.success('✅ Logo eliminado exitosamente');
    } catch (error: any) {
      console.error('Error deleting logo:', error);
      toast.error(`Error al eliminar logo: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleToggle = () => {
    startToggling(async () => {
      const result = await actionToggleInsurerActive(insurer.id);
      if (result.ok && result.data) {
        setIsActive((result.data as any).active);
        toast.success('✅ Estado actualizado');
      } else {
        toast.error(`Error: ${result.error}`);
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
      
      {/* Logo Upload */}
      <div className="form-group">
        <label>Logo de la Aseguradora</label>
        <div className="logo-container">
          {logoUrl ? (
            <div className="logo-preview">
              <Image 
                src={logoUrl} 
                alt={name} 
                width={120} 
                height={120}
                className="logo-image"
                unoptimized
              />
              <button 
                type="button"
                onClick={handleDeleteLogo} 
                className="delete-logo-btn"
                disabled={uploading}
              >
                <FaTrash /> Eliminar
              </button>
            </div>
          ) : (
            <div className="logo-placeholder">
              <FaImage size={32} />
              <p>Sin logo</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            style={{ display: 'none' }}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="upload-logo-btn"
            disabled={uploading}
          >
            <FaImage /> {uploading ? 'Subiendo...' : logoUrl ? 'Cambiar Logo' : 'Subir Logo'}
          </button>
          <p className="logo-hint">Tamaño recomendado: 200x200px. Máximo 2MB.</p>
        </div>
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
        
        .logo-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .logo-preview {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 2px solid #e0e0e0;
        }
        
        .logo-image {
          border-radius: 8px;
          object-fit: contain;
          background: white;
          padding: 8px;
        }
        
        .delete-logo-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        .delete-logo-btn:hover {
          background: #b91c1c;
        }
        
        .delete-logo-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .logo-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          background: #f9f9f9;
          border: 2px dashed #d0d0d0;
          border-radius: 8px;
          color: #999;
          gap: 8px;
        }
        
        .logo-placeholder p {
          margin: 0;
          font-size: 14px;
        }
        
        .upload-logo-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: #8AAA19;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          align-self: flex-start;
        }
        
        .upload-logo-btn:hover {
          background: #738914;
        }
        
        .upload-logo-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .logo-hint {
          margin: 0;
          font-size: 12px;
          color: #666;
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
