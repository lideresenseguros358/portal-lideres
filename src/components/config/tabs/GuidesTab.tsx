'use client';

import { useState, useEffect } from 'react';
import { FaBook, FaPlus, FaStar, FaBell, FaEdit, FaTrash, FaExternalLinkAlt } from 'react-icons/fa';
import { toast } from 'sonner';
import Link from 'next/link';

interface GuidesTabProps {
  userId: string;
}

interface GuideSection {
  id: string;
  name: string;
  display_order: number;
  files_count?: number;
  has_new_files?: boolean;
}

export default function GuidesTab({ userId }: GuidesTabProps) {
  const [sections, setSections] = useState<GuideSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  useEffect(() => {
    loadSections();
  }, []);

  const loadSections = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guides/sections');
      const data = await res.json();
      if (data.success) {
        setSections(data.sections);
      }
    } catch (error) {
      console.error('Error loading sections:', error);
      toast.error('Error al cargar secciones');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSection = async () => {
    if (!newSectionName.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      const res = await fetch('/api/guides/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSectionName })
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Sección creada exitosamente');
        setNewSectionName('');
        setShowCreateModal(false);
        loadSections();
      } else {
        toast.error(data.error || 'Error al crear sección');
      }
    } catch (error) {
      console.error('Error creating section:', error);
      toast.error('Error al crear sección');
    }
  };

  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!confirm(`¿Eliminar la sección "${sectionName}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/guides/sections?id=${sectionId}`, {
        method: 'DELETE'
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Sección eliminada');
        loadSections();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting section:', error);
      toast.error('Error al eliminar sección');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#010139] border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Cargando secciones...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Guides Management */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaBook className="text-[#8AAA19] text-2xl" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#010139]">Gestión de Guías</h2>
            <p className="text-sm text-gray-600">{sections.length} secciones activas</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/guides"
              className="flex items-center gap-2 px-4 py-2 bg-[#010139] text-white rounded-lg font-semibold hover:bg-[#020250] transition-all"
            >
              <FaExternalLinkAlt />
              <span className="text-sm">Ver Guías</span>
            </Link>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg font-semibold hover:shadow-lg transition-all"
            >
              <FaPlus />
              <span className="text-sm">Nueva Sección</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
            <p className="text-sm text-blue-800 mb-2">
              <strong>Características del sistema de guías:</strong>
            </p>
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• Secciones organizadas con PDFs descargables</li>
              <li>• Badge &quot;Nuevo&quot; durante 24-48h tras subir archivo</li>
              <li>• Duplicado sincronizado opcional entre secciones</li>
              <li>• Búsqueda global integrada</li>
            </ul>
          </div>

          {/* Sections List */}
          <div className="space-y-3">
            {sections.map((section) => (
              <div
                key={section.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-[#010139] text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {section.display_order}
                  </div>
                  <div>
                    <span className="font-semibold text-gray-800">{section.name}</span>
                    <p className="text-xs text-gray-500">{section.files_count || 0} archivo(s)</p>
                  </div>
                  {section.has_new_files && (
                    <span className="px-2 py-1 bg-[#8AAA19] text-white rounded-full text-xs font-semibold animate-pulse">
                      NUEVO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/guides/${section.id}`}
                    className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-semibold"
                  >
                    Ver Archivos
                  </Link>
                  <button
                    onClick={() => handleDeleteSection(section.id, section.name)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-semibold"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-[#010139] to-[#020250] rounded-xl p-6 text-white">
          <p className="text-sm opacity-80 mb-2">Total Secciones</p>
          <p className="text-3xl font-bold">{sections.length}</p>
        </div>
        <div className="bg-gradient-to-br from-[#8AAA19] to-[#6d8814] rounded-xl p-6 text-white">
          <p className="text-sm opacity-80 mb-2">Total Archivos</p>
          <p className="text-3xl font-bold">
            {sections.reduce((sum, s) => sum + (s.files_count || 0), 0)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
          <p className="text-sm opacity-80 mb-2">Con Archivos Nuevos</p>
          <p className="text-3xl font-bold">
            {sections.filter(s => s.has_new_files).length}
          </p>
        </div>
      </div>

      {/* Modal Crear Sección */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-[#010139]">Nueva Sección</h3>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-[#010139] mb-2">
                Nombre de la Sección *
              </label>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Ej: Cursos Avanzados"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSection();
                }}
              />
            </div>
            <div className="p-6 border-t border-gray-200 flex items-center gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewSectionName('');
                }}
                className="flex-1 px-6 py-3 rounded-lg bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateSection}
                className="flex-1 px-6 py-3 rounded-lg bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white font-bold hover:shadow-xl transition-all"
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
