'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaTimes, FaSave, FaEdit, FaTrash, FaLink, FaFileAlt, FaFolderOpen } from 'react-icons/fa';
import { toast } from 'sonner';

interface Requirement {
  id: string;
  ramo: string;
  label: string;
  required: boolean;
  standard_name: string;
  requirement_type: 'DOCUMENTO' | 'FORMULARIO'; // NUEVO
  linked_download_section?: string;
  linked_download_file?: string;
  display_order: number;
}

interface DownloadSection {
  id: string;
  name: string;
  insurer_id: string;
  insurer_name: string;
  files: DownloadFile[];
}

interface DownloadFile {
  id: string;
  name: string;
  section_id: string;
}

const RAMOS = [
  { value: 'AUTO', label: 'Auto' },
  { value: 'VIDA', label: 'Vida' },
  { value: 'VIDA_ASSA', label: 'Vida ASSA' },
  { value: 'SALUD', label: 'Salud' },
  { value: 'AP', label: 'Accidentes Personales' },
  { value: 'HOGAR', label: 'Hogar' },
  { value: 'PYME', label: 'PYME' },
  { value: 'INCENDIO', label: 'Incendio' },
  { value: 'RC', label: 'RC' },
  { value: 'TRANSPORTE', label: 'Transporte' },
  { value: 'OTROS', label: 'Otros' },
];

export default function RequirementsTab() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [downloadSections, setDownloadSections] = useState<DownloadSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRamo, setSelectedRamo] = useState('AUTO');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingReq, setEditingReq] = useState<Requirement | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    label: '',
    required: true,
    standard_name: '',
    requirement_type: 'DOCUMENTO' as 'DOCUMENTO' | 'FORMULARIO',
    linked_download_section: '',
    linked_download_file: '',
  });

  useEffect(() => {
    loadRequirements();
    loadDownloadSections();
  }, []);

  const loadRequirements = async () => {
    try {
      const res = await fetch('/api/config/requirements');
      const data = await res.json();
      if (data.success) {
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
      toast.error('Error al cargar requisitos');
    } finally {
      setLoading(false);
    }
  };

  const loadDownloadSections = async () => {
    try {
      const res = await fetch('/api/downloads/sections?with_files=true');
      const data = await res.json();
      if (data.success) {
        setDownloadSections(data.sections || []);
      }
    } catch (error) {
      console.error('Error loading download sections:', error);
    }
  };

  const handleSave = async () => {
    if (!formData.label.trim() || !formData.standard_name.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    try {
      const payload = {
        ...formData,
        ramo: selectedRamo,
        display_order: currentRequirements.length + 1,
      };

      const res = await fetch('/api/config/requirements', {
        method: editingReq ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingReq ? { id: editingReq.id, ...payload } : payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(editingReq ? 'Requisito actualizado' : 'Requisito agregado');
        loadRequirements();
        handleCloseModal();
      } else {
        toast.error(data.error || 'Error al guardar');
      }
    } catch (error) {
      console.error('Error saving requirement:', error);
      toast.error('Error al guardar requisito');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este requisito?')) return;

    try {
      const res = await fetch(`/api/config/requirements?id=${id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Requisito eliminado');
        loadRequirements();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error deleting requirement:', error);
      toast.error('Error al eliminar requisito');
    }
  };

  const handleEdit = (req: Requirement) => {
    setEditingReq(req);
    setFormData({
      label: req.label,
      required: req.required,
      standard_name: req.standard_name,
      requirement_type: req.requirement_type,
      linked_download_section: req.linked_download_section || '',
      linked_download_file: req.linked_download_file || '',
    });
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingReq(null);
    setFormData({
      label: '',
      required: true,
      standard_name: '',
      requirement_type: 'DOCUMENTO',
      linked_download_section: '',
      linked_download_file: '',
    });
  };

  const currentRequirements = requirements.filter(r => r.ramo === selectedRamo);
  const selectedSectionFiles = downloadSections.find(s => s.id === formData.linked_download_section)?.files || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#8AAA19] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#010139]">Requisitos por Ramo</h2>
            <p className="text-gray-600 mt-1">Configura los documentos requeridos según el tipo de póliza y vincúlalos con Descargas</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all flex items-center gap-2 font-semibold"
          >
            <FaPlus />
            Nuevo Requisito
          </button>
        </div>

        {/* Selector de Ramo */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {RAMOS.map(ramo => (
            <button
              key={ramo.value}
              onClick={() => setSelectedRamo(ramo.value)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-all ${
                selectedRamo === ramo.value
                  ? 'bg-[#010139] text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {ramo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Requisitos */}
      <div className="bg-white rounded-xl shadow-lg border-2 border-gray-100 p-6">
        <h3 className="text-lg font-bold text-[#010139] mb-4 flex items-center gap-2">
          <FaFileAlt className="text-[#8AAA19]" />
          Requisitos para {RAMOS.find(r => r.value === selectedRamo)?.label}
        </h3>

        {currentRequirements.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FaFileAlt className="text-6xl text-gray-300 mx-auto mb-4" />
            <p className="text-lg">No hay requisitos configurados para este ramo</p>
            <p className="text-sm mt-2">Haz clic en "Nuevo Requisito" para agregar</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentRequirements
              .sort((a, b) => a.display_order - b.display_order)
              .map((req) => (
                <div
                  key={req.id}
                  className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-[#8AAA19] transition-all"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-[#010139]">{req.label}</h4>
                      <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                        req.requirement_type === 'DOCUMENTO' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {req.requirement_type === 'DOCUMENTO' ? '📄 Documento' : '📋 Formulario'}
                      </span>
                      {req.required && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                          Obligatorio
                        </span>
                      )}
                      {req.linked_download_file && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-semibold flex items-center gap-1">
                          <FaLink size={10} />
                          Vinculado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Nombre estándar: <code className="bg-gray-200 px-2 py-0.5 rounded">{req.standard_name}</code></p>
                    {req.linked_download_file && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <FaFolderOpen size={10} />
                        Vinculado con archivo en Descargas
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(req)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="Editar"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleDelete(req.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Eliminar"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Modal Agregar/Editar */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-[#010139]">
                {editingReq ? 'Editar Requisito' : 'Nuevo Requisito'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg transition-all"
              >
                <FaTimes />
              </button>
            </div>

            <div className="space-y-4">
              {/* Etiqueta */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Etiqueta del requisito *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="Ej: Cédula del asegurado"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                />
              </div>

              {/* Nombre estándar */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre estándar (para archivos) *
                </label>
                <input
                  type="text"
                  value={formData.standard_name}
                  onChange={(e) => setFormData({ ...formData, standard_name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="Ej: cedula_asegurado"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-mono"
                />
                <p className="text-xs text-gray-500 mt-1">Sin espacios ni caracteres especiales (se convierte automáticamente)</p>
              </div>

              {/* Tipo de Requisito */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tipo de requisito *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, requirement_type: 'DOCUMENTO', linked_download_section: '', linked_download_file: '' })}
                    className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                      formData.requirement_type === 'DOCUMENTO'
                        ? 'border-[#8AAA19] bg-green-50 text-[#010139]'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    📄 DOCUMENTO
                    <p className="text-xs font-normal mt-1">Debe suministrarlo el cliente/broker</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, requirement_type: 'FORMULARIO' })}
                    className={`px-4 py-3 rounded-lg border-2 transition-all text-sm font-semibold ${
                      formData.requirement_type === 'FORMULARIO'
                        ? 'border-[#8AAA19] bg-green-50 text-[#010139]'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    📋 FORMULARIO
                    <p className="text-xs font-normal mt-1">Está en Descargas para descargar</p>
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  {formData.requirement_type === 'DOCUMENTO' 
                    ? '💡 Ejemplos: Cédula, fotos de inspección, licencia de conducir' 
                    : '💡 Ejemplos: Formulario de solicitud, declaración de salud'}
                </p>
              </div>

              {/* Obligatorio */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="required"
                  checked={formData.required}
                  onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                  className="w-5 h-5 text-[#8AAA19] rounded focus:ring-[#8AAA19]"
                />
                <label htmlFor="required" className="text-sm font-semibold text-gray-700">
                  Documento obligatorio
                </label>
              </div>

              {/* Vínculo con Descargas (solo para FORMULARIO) */}
              {formData.requirement_type === 'FORMULARIO' && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-bold text-[#010139] mb-3 flex items-center gap-2">
                    <FaLink className="text-[#8AAA19]" />
                    Vincular con archivo en Descargas
                  </h4>

                {/* Selector de Sección */}
                <div className="mb-3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sección de Descargas
                  </label>
                  <select
                    value={formData.linked_download_section}
                    onChange={(e) => setFormData({ ...formData, linked_download_section: e.target.value, linked_download_file: '' })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                  >
                    <option value="">-- Selecciona una sección --</option>
                    {downloadSections.map(section => (
                      <option key={section.id} value={section.id}>
                        {section.insurer_name} - {section.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selector de Archivo */}
                {formData.linked_download_section && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Archivo específico
                    </label>
                    <select
                      value={formData.linked_download_file}
                      onChange={(e) => setFormData({ ...formData, linked_download_file: e.target.value })}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                    >
                      <option value="">-- Selecciona un archivo --</option>
                      {selectedSectionFiles.map(file => (
                        <option key={file.id} value={file.id}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {formData.linked_download_file && (
                  <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                    <p className="text-sm text-blue-800">
                      ✓ Cuando un broker vea este requisito, podrá descargar directamente el archivo vinculado
                    </p>
                  </div>
                )}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={handleCloseModal}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2"
              >
                <FaSave />
                {editingReq ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
