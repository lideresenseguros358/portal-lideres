'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaPlus, FaTimes } from 'react-icons/fa';
import InsurerLogo from '@/components/shared/InsurerLogo';
import { toast } from 'sonner';

interface Insurer {
  id: string;
  name: string;
  logo_url?: string | null;
  sections_count?: number;
}

interface InsurersListProps {
  scope: string;
  policyType: string;
  insurers: Insurer[];
  isMaster: boolean;
  onUpdate?: () => void;
}

export default function InsurersList({ scope, policyType, insurers, isMaster, onUpdate }: InsurersListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [allInsurers, setAllInsurers] = useState<Insurer[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const handleOpenAddModal = async () => {
    setLoadingModal(true);
    try {
      const res = await fetch('/api/insurers');
      const data = await res.json();
      if (data.success) {
        setAllInsurers(data.insurers);
        setShowAddModal(true);
      }
    } catch (error) {
      toast.error('Error al cargar aseguradoras');
    } finally {
      setLoadingModal(false);
    }
  };

  const handleRemoveInsurer = async (e: React.MouseEvent, insurerId: string, insurerName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`¿Deseas eliminar "${insurerName}" de este tipo de póliza? Se eliminarán todas sus secciones y archivos.`)) return;
    
    setRemoving(true);
    try {
      const res = await fetch(
        `/api/downloads/insurers?scope=${scope}&policy_type=${policyType}&insurer_id=${insurerId}`,
        { method: 'DELETE' }
      );
      
      const data = await res.json();
      if (data.success) {
        toast.success('Aseguradora eliminada correctamente');
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al eliminar aseguradora');
      }
    } catch (error) {
      console.error('Error removing insurer:', error);
      toast.error('Error al eliminar aseguradora');
    } finally {
      setRemoving(false);
    }
  };

  const handleAddInsurer = async (insurerId: string, insurerName: string) => {
    setAdding(insurerId);
    try {
      const res = await fetch('/api/downloads/insurers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope,
          policy_type: policyType,
          insurer_id: insurerId
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success(`${insurerName} agregada correctamente`);
        setShowAddModal(false);
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al agregar aseguradora');
      }
    } catch (error) {
      console.error('Error adding insurer:', error);
      toast.error('Error al agregar aseguradora');
    } finally {
      setAdding(null);
    }
  };

  // Filtrar aseguradoras disponibles para agregar
  const availableToAdd = allInsurers.filter(ins => 
    !insurers.some(existing => existing.id === ins.id)
  );

  return (
    <>
    {/* Información de gestión para Master */}
    {isMaster && (
      <div className="mb-6 p-4 bg-gradient-to-r from-[#8AAA19]/10 to-[#6d8814]/10 border-l-4 border-[#8AAA19] rounded-lg">
        <p className="text-sm text-[#010139] font-semibold">
          🛠️ <strong>Gestión de Aseguradoras:</strong> Puedes agregar aseguradoras con el botón "+" o eliminarlas haciendo hover sobre ellas.
        </p>
        <p className="text-xs text-gray-600 mt-1">
          ⚠️ Al eliminar una aseguradora se borrarán todas sus secciones y archivos.
        </p>
      </div>
    )}
    
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      {insurers.map((insurer) => (
        <Link
          key={insurer.id}
          href={`/downloads/${scope}/${policyType}/${insurer.id}`}
          className="
            group relative
            bg-white rounded-xl shadow-lg
            border-2 border-gray-200
            hover:border-[#8AAA19] hover:shadow-2xl
            transition-all duration-200
            p-8
            flex items-center justify-center
            aspect-square
          "
        >
          {isMaster && (
            <button
              onClick={(e) => handleRemoveInsurer(e, insurer.id, insurer.name)}
              disabled={removing}
              className="
                absolute top-2 right-2
                w-6 h-6 rounded-full
                bg-red-500 text-white
                flex items-center justify-center
                opacity-0 group-hover:opacity-100
                hover:bg-red-600
                transition-opacity
                z-10
                disabled:opacity-50
              "
              title="Eliminar aseguradora"
            >
              <FaTimes size={12} />
            </button>
          )}
          
          <InsurerLogo 
            logoUrl={insurer.logo_url} 
            insurerName={insurer.name} 
            size="xl"
          />
        </Link>
      ))}

      {isMaster && (
        <button
          onClick={handleOpenAddModal}
          disabled={loadingModal}
          className="
            aspect-square
            bg-gradient-to-br from-gray-50 to-gray-100
            border-2 border-dashed border-gray-300
            rounded-xl
            hover:border-[#8AAA19] hover:bg-gray-50
            transition-all duration-200
            p-8
            flex flex-col items-center justify-center gap-3
            disabled:opacity-50
          "
        >
          <FaPlus className="text-4xl text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Agregar</span>
        </button>
      )}
    </div>

    {/* Modal Agregar Aseguradora */}
    {showAddModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
          <div className="bg-gradient-to-r from-[#010139] to-[#8AAA19] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Agregar Aseguradora</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
            <p className="text-gray-600 mb-6">
              Selecciona las aseguradoras que deseas agregar a este ramo
            </p>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {availableToAdd.length === 0 ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <p>Todas las aseguradoras ya están en este tipo de póliza</p>
                </div>
              ) : (
                availableToAdd.map((insurer) => (
                  <button
                    key={insurer.id}
                    onClick={() => handleAddInsurer(insurer.id, insurer.name)}
                    disabled={adding === insurer.id}
                    className="
                      relative
                      rounded-xl shadow-lg
                      border-2 border-gray-200
                      bg-white
                      transition-all duration-200
                      p-6
                      flex items-center justify-center
                      aspect-square
                      hover:scale-105 hover:border-[#8AAA19]
                      disabled:opacity-50 disabled:cursor-not-allowed
                    "
                  >
                    {adding === insurer.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#8AAA19] border-t-transparent"></div>
                      </div>
                    )}
                    <InsurerLogo 
                      logoUrl={insurer.logo_url} 
                      insurerName={insurer.name} 
                      size="lg"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
