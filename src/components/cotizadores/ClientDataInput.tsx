/**
 * Componente para captura de datos del cliente
 * Con opción de escanear QR (solo mobile) y búsqueda automática en BD
 */

'use client';

import { useState, useEffect } from 'react';
import { FaCamera, FaIdCard, FaUser, FaSpinner } from 'react-icons/fa';
import { toast } from 'sonner';
import dynamic from 'next/dynamic';
import { supabaseClient } from '@/lib/supabase/client';
import type { CedulaQRData } from '@/lib/utils/cedula-qr-parser';

// Cargar el escáner solo en cliente
const CedulaQRScanner = dynamic(
  () => import('./CedulaQRScanner'),
  { ssr: false }
);

interface ClientDataInputProps {
  cedula: string;
  nombreCompleto: string;
  email?: string;
  telefono?: string;
  onCedulaChange: (cedula: string) => void;
  onNombreChange: (nombre: string) => void;
  onEmailChange?: (email: string) => void;
  onTelefonoChange?: (telefono: string) => void;
  onClientFound?: (clientData: any) => void;
  errors?: {
    cedula?: string;
    nombreCompleto?: string;
    email?: string;
    telefono?: string;
  };
}

export default function ClientDataInput({
  cedula,
  nombreCompleto,
  email,
  telefono,
  onCedulaChange,
  onNombreChange,
  onEmailChange,
  onTelefonoChange,
  onClientFound,
  errors = {},
}: ClientDataInputProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detectar si es mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Buscar cliente cuando cambia la cédula
  useEffect(() => {
    const searchClient = async () => {
      if (!cedula || cedula.length < 5) return;

      setIsSearching(true);
      
      try {
        const { data, error } = await supabaseClient()
          .from('clients')
          .select('*')
          .eq('national_id', cedula)
          .single();

        if (error) {
          if (error.code !== 'PGRST116') { // Not found is OK
            console.error('Error buscando cliente:', error);
          }
          return;
        }

        if (data) {
          // Cliente encontrado en BD
          toast.success('¡Cliente encontrado en el sistema!');
          
          // Autocompletar datos
          onNombreChange(data.name || '');
          if (onEmailChange && data.email) onEmailChange(data.email);
          if (onTelefonoChange && data.phone) onTelefonoChange(data.phone);
          
          // Notificar al padre con todos los datos
          if (onClientFound) {
            onClientFound(data);
          }
        }
      } catch (err) {
        console.error('Error buscando cliente:', err);
      } finally {
        setIsSearching(false);
      }
    };

    // Debounce
    const timer = setTimeout(searchClient, 800);
    return () => clearTimeout(timer);
  }, [cedula]);

  const handleScanSuccess = (qrData: CedulaQRData) => {
    // Llenar cédula (esto disparará la búsqueda automática)
    onCedulaChange(qrData.cedula);
    
    // Llenar nombre completo
    const nombreFormateado = `${qrData.nombreCompleto} ${qrData.apellidoCompleto}`.trim();
    onNombreChange(nombreFormateado);
    
    toast.success('Datos de cédula cargados');
  };

  return (
    <>
      {/* Datos del Cliente */}
      <div className="space-y-4">
        {/* Header con botón de escaneo */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold text-[#010139] flex items-center gap-2">
            <FaUser className="text-[#8AAA19]" />
            Datos del Cliente
          </h3>
          
          {isMobile && (
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all text-sm"
            >
              <FaCamera className="text-lg" />
              Escanear QR
            </button>
          )}
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-lg">
          <p className="text-sm text-gray-700">
            {isMobile ? (
              <>
                <FaCamera className="inline mr-1 text-[#8AAA19]" />
                <strong>Escanea el QR</strong> de la cédula o completa manualmente
              </>
            ) : (
              <>
                <FaIdCard className="inline mr-1 text-[#8AAA19]" />
                Ingresa la cédula para buscar el cliente automáticamente
              </>
            )}
          </p>
        </div>

        {/* Cédula */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Cédula <span className="text-red-500">*</span>
            {isSearching && (
              <span className="ml-2 text-[#8AAA19] text-xs">
                <FaSpinner className="inline animate-spin mr-1" />
                Buscando...
              </span>
            )}
          </label>
          <div className="relative">
            <FaIdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={cedula}
              onChange={(e) => onCedulaChange(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                errors.cedula ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
              }`}
              placeholder="0-000-0000"
            />
          </div>
          {errors.cedula && (
            <p className="text-red-500 text-xs mt-1">{errors.cedula}</p>
          )}
        </div>

        {/* Nombre Completo */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre Completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nombreCompleto}
            onChange={(e) => onNombreChange(e.target.value)}
            className={`w-full px-4 py-2.5 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
              errors.nombreCompleto ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
            }`}
            placeholder="Juan Pérez González"
          />
          {errors.nombreCompleto && (
            <p className="text-red-500 text-xs mt-1">{errors.nombreCompleto}</p>
          )}
        </div>

        {/* Email (opcional) */}
        {onEmailChange && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email || ''}
              onChange={(e) => onEmailChange(e.target.value)}
              className={`w-full px-4 py-2.5 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                errors.email ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
              }`}
              placeholder="juan@email.com"
            />
            {errors.email && (
              <p className="text-red-500 text-xs mt-1">{errors.email}</p>
            )}
          </div>
        )}

        {/* Teléfono (opcional) */}
        {onTelefonoChange && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Teléfono
            </label>
            <input
              type="tel"
              value={telefono || ''}
              onChange={(e) => onTelefonoChange(e.target.value)}
              className={`w-full px-4 py-2.5 md:py-3 text-base border-2 rounded-lg focus:outline-none transition-colors ${
                errors.telefono ? 'border-red-500' : 'border-gray-300 focus:border-[#8AAA19]'
              }`}
              placeholder="6000-0000"
            />
            {errors.telefono && (
              <p className="text-red-500 text-xs mt-1">{errors.telefono}</p>
            )}
          </div>
        )}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <CedulaQRScanner
          onScanSuccess={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
}
