'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaClone, FaToggleOn, FaToggleOff, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import { toast } from 'sonner';

interface InsurersTabProps {
  userId: string;
}

interface Insurer {
  id: string;
  name: string;
  logo_url: string | null;
  is_active: boolean;
  has_delinquency_reports: boolean;
}

export default function InsurersTab({ userId }: InsurersTabProps) {
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [selectedInsurer, setSelectedInsurer] = useState<Insurer | null>(null);

  useEffect(() => {
    loadInsurers();
  }, []);

  const loadInsurers = async () => {
    try {
      const response = await fetch('/api/insurers');
      if (response.ok) {
        const data = await response.json();
        setInsurers(data);
      }
    } catch (error) {
      console.error('Error loading insurers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (insurer: Insurer) => {
    try {
      const response = await fetch(`/api/insurers/${insurer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !insurer.is_active }),
      });

      if (response.ok) {
        toast.success(insurer.is_active ? 'Aseguradora desactivada' : 'Aseguradora activada');
        loadInsurers();
      }
    } catch (error) {
      toast.error('Error al cambiar estado');
    }
  };

  const handleClone = async (insurer: Insurer) => {
    try {
      const response = await fetch(`/api/insurers/${insurer.id}/clone`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Aseguradora clonada exitosamente');
        loadInsurers();
      }
    } catch (error) {
      toast.error('Error al clonar aseguradora');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-[#010139] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-[#010139]">ASEGURADORAS</h2>
          <p className="text-xs sm:text-sm text-gray-600">GESTIÓN DE ASEGURADORAS Y SUS CONFIGURACIONES</p>
        </div>
        <button
          onClick={() => {
            setSelectedInsurer(null);
            setShowWizard(true);
          }}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-semibold hover:shadow-lg transition-all whitespace-nowrap text-sm sm:text-base"
        >
          <FaPlus />
          <span>NUEVA ASEGURADORA</span>
        </button>
      </div>

      {/* Insurers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {insurers.map((insurer) => (
          <div
            key={insurer.id}
            className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
          >
            {/* Logo */}
            <div className="h-20 flex items-center justify-center mb-4 bg-gray-50 rounded-lg">
              {insurer.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={insurer.logo_url}
                  alt={insurer.name}
                  className="max-h-16 max-w-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-sm">Sin logo</span>
              )}
            </div>

            {/* Name */}
            <h3 className="text-lg font-bold text-[#010139] mb-3 text-center">{insurer.name}</h3>

            {/* Status Badges */}
            <div className="flex gap-2 mb-4 justify-center">
              <span
                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                  insurer.is_active
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {insurer.is_active ? <FaCheckCircle /> : <FaTimesCircle />}
                {insurer.is_active ? 'Activa' : 'Inactiva'}
              </span>

              {!insurer.has_delinquency_reports && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                  Sin morosidad
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedInsurer(insurer);
                  setShowWizard(true);
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              >
                <FaEdit size={14} />
                <span className="text-sm">Editar</span>
              </button>

              <button
                onClick={() => handleToggleActive(insurer)}
                className={`flex items-center justify-center p-2 rounded-lg transition-colors ${
                  insurer.is_active
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                title={insurer.is_active ? 'Desactivar' : 'Activar'}
              >
                {insurer.is_active ? <FaToggleOff size={18} /> : <FaToggleOn size={18} />}
              </button>

              <button
                onClick={() => handleClone(insurer)}
                className="flex items-center justify-center p-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
                title="Clonar"
              >
                <FaClone size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {insurers.length === 0 && (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <FaPlus className="mx-auto text-6xl text-gray-300 mb-4" />
          <h3 className="text-xl font-bold text-gray-700 mb-2">No hay aseguradoras configuradas</h3>
          <p className="text-gray-600 mb-6">Crea tu primera aseguradora para comenzar</p>
          <button
            onClick={() => {
              setSelectedInsurer(null);
              setShowWizard(true);
            }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            <FaPlus />
            <span>Nueva Aseguradora</span>
          </button>
        </div>
      )}

      {/* Wizard Modal - Placeholder */}
      {showWizard && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold text-[#010139] mb-4">
              {selectedInsurer ? 'Editar Aseguradora' : 'Nueva Aseguradora'}
            </h2>
            <p className="text-gray-600 mb-6">Wizard en desarrollo...</p>
            <button
              onClick={() => setShowWizard(false)}
              className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
