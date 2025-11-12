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
  const [excludedInsurers, setExcludedInsurers] = useState<string[]>([]);

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

  const handleRemoveInsurer = async (e: React.MouseEvent, insurerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('¿Deseas excluir esta aseguradora de este tipo de póliza?')) return;
    
    // Agregar a la lista de excluidos (temporal - se reinicia al recargar)
    setExcludedInsurers(prev => [...prev, insurerId]);
    toast.success('Aseguradora excluida. Recarga la página para restaurar.');
    // Nota: En producción, esto debería persistirse en BD con una tabla de mapeo
  };

  const handleAddInsurer = (insurerId: string) => {
    // Remover de excluidos si estaba
    setExcludedInsurers(prev => prev.filter(id => id !== insurerId));
    setShowAddModal(false);
    toast.success('Aseguradora agregada al listado');
    // Nota: En producción, esto debería persistirse en BD
  };

  // Filtrar aseguradoras excluidas
  const visibleInsurers = insurers.filter(ins => !excludedInsurers.includes(ins.id));
  const availableToAdd = allInsurers.filter(ins => 
    !insurers.some(existing => existing.id === ins.id) || excludedInsurers.includes(ins.id)
  );

  return (
    <>
    {/* Información de gestión para Master */}
    {isMaster && (
      <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
        <p className="text-sm text-blue-800">
          🛠️ <strong>Gestión de Aseguradoras:</strong> Puedes agregar aseguradoras con el botón "+" o excluir las existentes haciendo hover sobre ellas.
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Nota: Los cambios son temporales. Para persistencia permanente, requiere implementación de mapeo en BD.
        </p>
      </div>
    )}
    
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
      {visibleInsurers.map((insurer) => (
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
              onClick={(e) => handleRemoveInsurer(e, insurer.id)}
              className="
                absolute top-2 right-2
                w-6 h-6 rounded-full
                bg-red-500 text-white
                flex items-center justify-center
                opacity-0 group-hover:opacity-100
                hover:bg-red-600
                transition-opacity
                z-10
              "
              title="Ocultar aseguradora"
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
                availableToAdd.map((insurer) => {
                  const isExcluded = excludedInsurers.includes(insurer.id);
                  return (
                    <button
                      key={insurer.id}
                      onClick={() => handleAddInsurer(insurer.id)}
                      className={`
                        relative
                        rounded-xl shadow-lg
                        border-2
                        transition-all duration-200
                        p-6
                        flex items-center justify-center
                        aspect-square
                        hover:scale-105
                        ${isExcluded ? 'border-[#8AAA19] bg-green-50' : 'border-gray-200 bg-white hover:border-gray-400'}
                      `}
                    >
                      {isExcluded && (
                        <div className="absolute top-1 right-1 px-2 py-0.5 rounded-full bg-[#8AAA19] text-white text-[10px] font-bold">
                          Excluida
                        </div>
                      )}
                      <InsurerLogo 
                        logoUrl={insurer.logo_url} 
                        insurerName={insurer.name} 
                        size="lg"
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
