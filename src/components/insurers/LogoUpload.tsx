'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { FaUpload, FaTimes, FaImage } from 'react-icons/fa';
import { toast } from 'sonner';

interface LogoUploadProps {
  currentLogoUrl?: string | null;
  insurerId: string;
  insurerName: string;
  onLogoUpdated: (newLogoUrl: string) => void;
}

export default function LogoUpload({ currentLogoUrl, insurerId, insurerName, onLogoUpdated }: LogoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validaciones
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona una imagen válida');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      toast.error('La imagen no debe superar 5MB');
      return;
    }

    // Preview local
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('insurerId', insurerId);
      formData.append('insurerName', insurerName);

      const response = await fetch('/api/insurers/upload-logo', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.ok) {
        toast.success('Logo actualizado correctamente');
        onLogoUpdated(result.logoUrl);
      } else {
        toast.error(result.error || 'Error al subir el logo');
        // Revert preview
        setPreviewUrl(currentLogoUrl || null);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Error al subir el logo');
      setPreviewUrl(currentLogoUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('¿Estás seguro de eliminar el logo?')) return;

    setUploading(true);
    try {
      const response = await fetch('/api/insurers/remove-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insurerId }),
      });

      const result = await response.json();

      if (result.ok) {
        toast.success('Logo eliminado');
        setPreviewUrl(null);
        onLogoUpdated('');
      } else {
        toast.error(result.error || 'Error al eliminar el logo');
      }
    } catch (error) {
      console.error('Error removing logo:', error);
      toast.error('Error al eliminar el logo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Logo de la Aseguradora
        </label>
        <p className="text-xs text-gray-500 mb-3">
          ⚠️ El logo debe ser en formato PNG con fondo transparente. Se recomienda color blanco para mejor visualización.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Preview */}
        <div className="flex-shrink-0">
          <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#010139] to-[#020270] relative">
            {previewUrl ? (
              <>
                <Image
                  src={previewUrl}
                  alt={insurerName}
                  width={120}
                  height={120}
                  className="object-contain p-2"
                  unoptimized
                />
                {!uploading && (
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
                    title="Eliminar logo"
                  >
                    <FaTimes size={12} />
                  </button>
                )}
              </>
            ) : (
              <FaImage className="text-white/30" size={40} />
            )}
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Button */}
        <div className="flex-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full px-6 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FaUpload />
            {uploading ? 'Subiendo...' : previewUrl ? 'Cambiar Logo' : 'Subir Logo'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            disabled={uploading}
          />

          <div className="mt-3 space-y-1 text-xs text-gray-600">
            <p>✓ Formato: PNG, JPG, WebP</p>
            <p>✓ Tamaño máximo: 5MB</p>
            <p>✓ Recomendado: Logo blanco con fondo transparente</p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-blue-800">
            <p className="font-semibold mb-1">Consejos para el logo:</p>
            <ul className="space-y-1 text-xs">
              <li>• El logo se mostrará sobre fondo oscuro (#010139)</li>
              <li>• Usa un logo en color blanco o claro</li>
              <li>• Fondo transparente (PNG) es ideal</li>
              <li>• Proporción cuadrada funciona mejor</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
