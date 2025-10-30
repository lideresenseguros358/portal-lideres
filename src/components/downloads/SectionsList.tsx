'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FaFolder, FaPlus, FaEdit, FaTrash, FaTimes } from 'react-icons/fa';
import { DownloadSection } from '@/lib/downloads/types';
import BadgeNuevo from '@/components/shared/BadgeNuevo';
import { toast } from 'sonner';

interface SectionsListProps {
  scope: string;
  policyType: string;
  insurerId: string;
  sections: DownloadSection[];
  isMaster: boolean;
  onUpdate?: () => void;
}

export default function SectionsList({ scope, policyType, insurerId, sections, isMaster, onUpdate }: SectionsListProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<DownloadSection | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddSection = () => {
    setEditingSection(null);
    setSectionName('');
    setShowModal(true);
  };

  const handleEditSection = (e: React.MouseEvent, section: DownloadSection) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingSection(section);
    setSectionName(section.name);
    setShowModal(true);
  };

  const handleDeleteSection = async (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('¿Estás seguro de eliminar esta sección y todos sus archivos?')) return;
    
    try {
      const res = await fetch(`/api/downloads/sections/${sectionId}`, {
        method: 'DELETE',
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success('Sección eliminada exitosamente');
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al eliminar sección');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar sección');
    }
  };

  const handleSaveSection = async () => {
    if (!sectionName.trim()) {
      toast.error('Ingresa un nombre para la sección');
      return;
    }

    setSaving(true);
    try {
      const url = editingSection 
        ? `/api/downloads/sections/${editingSection.id}`
        : '/api/downloads/sections';
      
      const method = editingSection ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: sectionName,
          scope,
          policy_type: policyType,
          insurer_id: insurerId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(editingSection ? 'Sección actualizada' : 'Sección creada');
        setShowModal(false);
        onUpdate?.();
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al guardar sección');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {sections.map((section) => (
        <Link
          key={section.id}
          href={`/downloads/${scope}/${policyType}/${insurerId}/${section.id}`}
          className="
            group relative
            bg-white rounded-xl shadow-lg
            border-2 border-gray-200
            hover:border-[#8AAA19] hover:shadow-xl
            transition-all duration-200
            overflow-hidden
          "
        >
          {isMaster && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <button
                onClick={(e) => handleEditSection(e, section)}
                className="w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Editar sección"
              >
                <FaEdit size={14} />
              </button>
              <button
                onClick={(e) => handleDeleteSection(e, section.id)}
                className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                title="Eliminar sección"
              >
                <FaTrash size={14} />
              </button>
            </div>
          )}
          
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-[#010139] to-[#020250] rounded-lg">
                  <FaFolder className="text-2xl text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#010139] group-hover:text-[#8AAA19] transition-colors">
                    {section.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {section.files_count || 0} archivo{section.files_count !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <BadgeNuevo show={section.has_new_files || false} />
            </div>

            <div className="text-sm text-gray-600">
              Click para ver documentos
            </div>
          </div>
        </Link>
      ))}

      {isMaster && (
        <button
          onClick={handleAddSection}
          className="
            bg-gradient-to-br from-gray-50 to-gray-100
            border-2 border-dashed border-gray-300
            rounded-xl
            hover:border-[#8AAA19] hover:bg-gray-50
            transition-all duration-200
            p-6
            flex flex-col items-center justify-center gap-3
            min-h-[150px]
          "
        >
          <FaPlus className="text-3xl text-gray-400" />
          <span className="font-semibold text-gray-600">Nueva Sección</span>
        </button>
      )}
    </div>

    {/* Modal Agregar/Editar Sección */}
    {showModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
          <div className="bg-gradient-to-r from-[#010139] to-[#8AAA19] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">
                {editingSection ? 'Editar Sección' : 'Nueva Sección'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FaTimes size={24} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nombre de la Sección (Carpeta)
            </label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="Ej: Requisitos, Formularios, Guías..."
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
              autoFocus
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSection}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-[#010139] to-[#8AAA19] text-white rounded-lg hover:opacity-90 transition-opacity font-semibold disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingSection ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
