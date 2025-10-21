"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabaseClient } from "@/lib/supabase/client";
import { FaCamera, FaUserCircle, FaTrash } from "react-icons/fa";
import { useUppercaseInput } from "@/lib/hooks/useUppercaseInput";
import { actionUpdateProfile } from "./actions";
import type { Database } from "@/lib/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type BrokerRow = Database["public"]["Tables"]["brokers"]["Row"];

export default function AccountPage() {
  const router = useRouter();
  const supabase = supabaseClient();
  const handleUppercase = useUppercaseInput();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [broker, setBroker] = useState<BrokerRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarTimestamp, setAvatarTimestamp] = useState(Date.now());
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      // Load profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single() as { data: any };

      if (profileData) {
        setProfile(profileData as any);
        setFullName(profileData.full_name || "");
        setEmail(profileData.email);
        setPhone("");
        setAvatarUrl(profileData.avatar_url);

        // Load broker data
        const { data: brokerData } = await supabase
          .from("brokers")
          .select("*")
          .eq("p_id", user.id)
          .single() as { data: any };

        if (brokerData) {
          setBroker(brokerData);
          setPhone(brokerData.phone || "");
        }
      }
    } catch (err) {
      console.error("Error loading profile:", err);
      setError("Error al cargar el perfil");
    } finally {
      setLoading(false);
    }
  }, [router, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      console.log('🔄 Iniciando actualización de perfil...');

      // Use server action for proper synchronization
      const result = await actionUpdateProfile({
        fullName,
        email,
        phone,
        avatarUrl
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      console.log('✅ Perfil actualizado correctamente');
      setSuccess("Perfil actualizado correctamente");
      
      // Reload profile to reflect changes
      await loadProfile();
      
      // Refresh to update navbar and other components
      router.refresh();
    } catch (err: any) {
      console.error('❌ Error en handleUpdateProfile:', err);
      setError(err.message || "Error al actualizar el perfil");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setSuccess("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Error al actualizar la contraseña");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("El archivo es muy grande. Máximo 2MB");
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError("Solo se permiten imágenes");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const timestamp = Date.now();
      const fileName = `${user.id}_${timestamp}.${fileExt}`;
      const filePath = fileName;

      console.log('🔄 Subiendo avatar:', { 
        fileName, 
        fileSize: file.size, 
        fileType: file.type,
        userId: user.id 
      });

      // Primero, intenta eliminar el avatar anterior si existe
      if (avatarUrl) {
        try {
          const oldFileName = avatarUrl.split('/').pop()?.split('?')[0]; // Remove query params
          if (oldFileName && oldFileName.startsWith(user.id)) {
            console.log('🗑️ Eliminando avatar anterior:', oldFileName);
            const { error: removeError } = await supabase.storage
              .from('avatar')
              .remove([oldFileName]);
            
            if (removeError) {
              console.warn('⚠️ No se pudo eliminar avatar anterior:', removeError);
              // No throw, continuar con el upload
            }
          }
        } catch (cleanupErr) {
          console.warn('⚠️ Error en limpieza de avatar anterior:', cleanupErr);
          // Continue with upload anyway
        }
      }

      // Upload to storage con upsert para sobrescribir
      console.log('📤 Iniciando upload a bucket "avatar"...');
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('avatar')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        console.error('❌ Error de upload:', uploadError);
        
        // Proporcionar mensaje más específico según el error
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('El bucket de storage "avatar" no existe. Contacta al administrador.');
        } else if (uploadError.message.includes('policy')) {
          throw new Error('No tienes permisos para subir archivos. Contacta al administrador.');
        } else {
          throw new Error(`Error al subir: ${uploadError.message}`);
        }
      }

      console.log('✅ Upload exitoso:', uploadData);

      // Get public URL with timestamp to force cache refresh
      const { data: { publicUrl } } = supabase.storage
        .from('avatar')
        .getPublicUrl(filePath, {
          transform: {
            width: 300,
            height: 300,
            quality: 80
          }
        });

      console.log('🔗 Public URL generada:', publicUrl);

      // Update profile in database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (updateError) {
        console.error('❌ Error actualizando perfil en BD:', updateError);
        
        // Intentar eliminar el archivo subido si falla la actualización
        await supabase.storage.from('avatar').remove([filePath]);
        
        throw new Error(`Error al actualizar perfil: ${updateError.message}`);
      }

      console.log('✅ Perfil actualizado en BD');

      // Update local state
      setAvatarUrl(publicUrl);
      setAvatarTimestamp(Date.now());
      setSuccess("✅ Foto de perfil actualizada correctamente");
      
      // Reload profile to ensure consistency
      console.log('🔄 Recargando perfil...');
      await loadProfile();
      
      // Refresh layout to update navbar avatar
      console.log('🔄 Refrescando layout...');
      router.refresh();
      
      console.log('✅ Proceso completo exitoso');
    } catch (err: any) {
      console.error('❌ Error completo:', err);
      setError(err.message || "Error al subir la foto");
    } finally {
      setSaving(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!confirm("¿Eliminar foto de perfil?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuario no autenticado");

      console.log('🗑️ Eliminando foto de perfil...');

      // Delete from storage if exists
      if (avatarUrl) {
        try {
          const fileName = avatarUrl.split('/').pop()?.split('?')[0]; // Remove query params
          if (fileName) {
            console.log('🗑️ Eliminando archivo del storage:', fileName);
            const { error: deleteError } = await supabase.storage
              .from('avatar')
              .remove([fileName]);
            
            if (deleteError) {
              console.warn('⚠️ Error eliminando archivo del storage:', deleteError);
              // No throw, continue to update profile
            } else {
              console.log('✅ Archivo eliminado del storage');
            }
          }
        } catch (storageErr) {
          console.warn('⚠️ Error en eliminación de storage:', storageErr);
          // Continue anyway
        }
      }

      // Update profile
      console.log('🔄 Actualizando perfil en BD...');
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", user.id);

      if (updateError) {
        console.error('❌ Error actualizando perfil:', updateError);
        throw new Error(`Error al actualizar perfil: ${updateError.message}`);
      }

      console.log('✅ Perfil actualizado en BD');

      setAvatarUrl(null);
      setAvatarTimestamp(Date.now());
      setSuccess("✅ Foto de perfil eliminada correctamente");
      
      // Reload profile
      console.log('🔄 Recargando perfil...');
      await loadProfile();
      
      // Refresh layout to update navbar avatar
      console.log('🔄 Refrescando layout...');
      router.refresh();
      
      console.log('✅ Eliminación completa exitosa');
    } catch (err: any) {
      console.error('❌ Error al eliminar avatar:', err);
      setError(err.message || "Error al eliminar la foto");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <p>Cargando perfil...</p>
      </div>
    );
  }

  return (
    <div className="account-page">
      <h1 className="page-title">Configuración de Cuenta</h1>

      <div className="account-container">
        {/* Profile Photo Section */}
        <div className="photo-section">
          <div className="avatar-container">
            {avatarUrl ? (
              <div className="avatar-wrapper">
                <Image 
                  key={`${avatarUrl}-${avatarTimestamp}`}
                  src={`${avatarUrl}${avatarUrl.includes('?') ? '&' : '?'}t=${avatarTimestamp}`}
                  alt="Avatar" 
                  className="avatar-img" 
                  width={150} 
                  height={150}
                  unoptimized
                  onError={(e) => {
                    console.error('Error cargando imagen:', e);
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <button 
                  onClick={handleRemoveAvatar} 
                  className="avatar-remove-btn" 
                  title="Eliminar foto"
                  disabled={saving}
                >
                  <FaTrash />
                </button>
              </div>
            ) : (
              <div className="avatar-placeholder-large">
                <FaUserCircle className="avatar-icon-large" />
              </div>
            )}
            <label htmlFor="avatar-upload" className={`avatar-upload-btn ${saving ? 'disabled' : ''}`}>
              <FaCamera />
              <span className="upload-text">{saving ? 'Subiendo...' : 'Cambiar foto'}</span>
              <input
                type="file"
                id="avatar-upload"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={saving}
                hidden
              />
            </label>
          </div>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleUpdateProfile} className="account-form">
          <h2 className="section-title">Información Personal</h2>
          
          <div className="form-group">
            <label htmlFor="fullName">NOMBRE COMPLETO</label>
            <input
              type="text"
              id="fullName"
              value={fullName}
              onChange={handleUppercase((e) => setFullName(e.target.value))}
              className="uppercase"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">TELÉFONO</label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </form>

        {/* Banking Info ACH - Read Only */}
        {broker && (
          <div className="banking-section">
            <h2 className="section-title">Información Bancaria ACH</h2>
            <p className="section-note">Solo el administrador puede modificar estos datos</p>
            
            <div className="info-group">
              <label>Banco (Código de Ruta)</label>
              <p>{broker.bank_route || "No especificado"}</p>
            </div>

            <div className="info-group">
              <label>Tipo de Cuenta</label>
              <p>
                {broker.tipo_cuenta === '03' ? 'Corriente (03)' : 
                 broker.tipo_cuenta === '04' ? 'Ahorro (04)' : 
                 broker.tipo_cuenta || "No especificado"}
              </p>
            </div>

            <div className="info-group">
              <label>Número de Cuenta</label>
              <p>{broker.bank_account_no || "No especificado"}</p>
            </div>

            <div className="info-group">
              <label>Titular de la Cuenta</label>
              <p>{broker.nombre_completo || "No especificado"}</p>
            </div>

            <div className="info-group">
              <label>Cédula del Titular</label>
              <p>{broker.national_id || "No especificado"}</p>
            </div>

            <div style={{ 
              marginTop: '16px', 
              padding: '12px', 
              backgroundColor: '#EFF6FF', 
              border: '1px solid #BFDBFE', 
              borderRadius: '8px',
              fontSize: '13px',
              color: '#1E40AF'
            }}>
              💡 <strong>Info ACH:</strong> Estos datos se utilizan para generar los archivos TXT de pagos ACH en Banco General.
            </div>
          </div>
        )}

        {/* Password Change Form */}
        <form onSubmit={handleUpdatePassword} className="password-form">
          <h2 className="section-title">Cambiar Contraseña</h2>
          
          <div className="form-group">
            <label htmlFor="newPassword">Nueva Contraseña</label>
            <input
              type="password"
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Contraseña</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={saving || !newPassword}>
            {saving ? "Actualizando..." : "Actualizar Contraseña"}
          </button>
        </form>

        {/* Messages */}
        {error && <div className="message error">{error}</div>}
        {success && <div className="message success">{success}</div>}
      </div>

      <style jsx>{`
        .account-page {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .page-title {
          font-size: 28px;
          color: #010139;
          margin-bottom: 32px;
        }

        .account-container {
          background: #ffffff;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

        .photo-section {
          display: flex;
          justify-content: center;
          margin-bottom: 40px;
        }

        .avatar-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .avatar-wrapper {
          position: relative;
          width: 150px;
          height: 150px;
        }

        .avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid #e5e7eb;
        }

        .avatar-placeholder-large {
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8aaa19 0%, #6d8814 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 4px solid #e5e7eb;
        }

        .avatar-icon-large {
          width: 80px;
          height: 80px;
          color: white;
        }

        .avatar-remove-btn {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #ef4444;
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 3px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .avatar-remove-btn:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .avatar-upload-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #8aaa19;
          color: white;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          font-weight: 600;
        }

        .avatar-upload-btn:hover:not(.disabled) {
          background: #6f8815;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(138, 170, 25, 0.3);
        }

        .avatar-upload-btn.disabled {
          opacity: 0.6;
          cursor: not-allowed;
          pointer-events: none;
        }

        .upload-text {
          display: none;
        }

        @media (min-width: 640px) {
          .upload-text {
            display: inline;
          }
        }

        .account-form, .password-form, .banking-section {
          margin-bottom: 40px;
        }

        .section-title {
          font-size: 20px;
          color: #010139;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid #f0f0f0;
        }

        .section-note {
          color: #666;
          font-size: 14px;
          font-style: italic;
          margin-bottom: 20px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          color: #666;
          margin-bottom: 8px;
        }

        .form-group input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus {
          outline: none;
          border-color: #8aaa19;
        }

        .info-group {
          margin-bottom: 16px;
        }

        .info-group label {
          font-size: 14px;
          color: #666;
          margin-bottom: 4px;
          display: block;
        }

        .info-group p {
          font-size: 16px;
          color: #333;
          margin: 0;
        }

        .btn-primary {
          background: #010139;
          color: white;
          border: none;
          padding: 12px 24px;
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
          opacity: 0.6;
          cursor: not-allowed;
        }

        .message {
          padding: 12px;
          border-radius: 8px;
          margin-top: 20px;
        }

        .message.error {
          background: #fee;
          color: #c00;
          border: 1px solid #fcc;
        }

        .message.success {
          background: #efe;
          color: #060;
          border: 1px solid #cfc;
        }

        .page-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 400px;
        }
      `}</style>
    </div>
  );
}
