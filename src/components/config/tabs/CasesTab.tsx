'use client';

import { useState, useEffect } from 'react';
import { FaClock, FaFileAlt, FaTable, FaBell, FaThLarge, FaPlus, FaEdit, FaTrash, FaSave } from 'react-icons/fa';
import { toast } from 'sonner';

interface CasesTabProps {
  userId: string;
}

interface CaseType {
  id: string;
  name: string;
  min_days: number;
  max_days: number;
}

interface Requirement {
  id: string;
  case_type_id: string;
  name: string;
  is_required: boolean;
  is_downloadable: boolean;
  is_recurring: boolean;
}

export default function CasesTab({ userId }: CasesTabProps) {
  const [kanbanEnabled, setKanbanEnabled] = useState(false);
  const [deferredReminderDays, setDeferredReminderDays] = useState(5);
  const [caseTypes, setCaseTypes] = useState<CaseType[]>([
    { id: '1', name: 'Generales', min_days: 7, max_days: 15 },
    { id: '2', name: 'Personas', min_days: 8, max_days: 20 },
  ]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selectedCaseType, setSelectedCaseType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/config/cases');
      if (response.ok) {
        const data = await response.json();
        if (data.kanban_enabled !== undefined) setKanbanEnabled(data.kanban_enabled);
        if (data.deferred_reminder_days) setDeferredReminderDays(data.deferred_reminder_days);
        if (data.case_types) setCaseTypes(data.case_types);
        if (data.requirements) setRequirements(data.requirements);
      }
    } catch (error) {
      console.error('Error loading cases settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsChanged = () => {
    if (!hasChanges) setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/cases', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kanban_enabled: kanbanEnabled,
          deferred_reminder_days: deferredReminderDays,
          case_types: caseTypes,
          requirements,
        }),
      });

      if (response.ok) {
        toast.success('Configuración de trámites guardada');
        setHasChanges(false);
      } else {
        toast.error('Error al guardar configuración');
      }
    } catch (error) {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
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
      {/* SLA Defaults */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaClock className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">SLA por Tipo</h2>
            <p className="text-sm text-gray-600">Tiempos de respuesta por defecto (editables)</p>
          </div>
        </div>

        <div className="space-y-4">
          {caseTypes.map((caseType) => (
            <div key={caseType.id} className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-700 mb-3">{caseType.name}</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Mínimo (días)</label>
                  <input
                    type="number"
                    min="1"
                    value={caseType.min_days}
                    onChange={(e) => {
                      setCaseTypes(caseTypes.map(ct =>
                        ct.id === caseType.id ? { ...ct, min_days: parseInt(e.target.value) || 1 } : ct
                      ));
                      markAsChanged();
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-center font-bold text-[#010139]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Máximo (días)</label>
                  <input
                    type="number"
                    min="1"
                    value={caseType.max_days}
                    onChange={(e) => {
                      setCaseTypes(caseTypes.map(ct =>
                        ct.id === caseType.id ? { ...ct, max_days: parseInt(e.target.value) || 1 } : ct
                      ));
                      markAsChanged();
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-center font-bold text-[#010139]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            Estos valores se aplican automáticamente a nuevos trámites.
          </p>
        </div>
      </div>

      {/* Requirements Matrix */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaTable className="text-[#8AAA19] text-2xl" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#010139]">Tabla Maestra de Requisitos</h2>
            <p className="text-sm text-gray-600">Gestión por tipo de trámite</p>
          </div>
          <button
            onClick={() => toast.info('Agregar requisito - En desarrollo')}
            className="flex items-center gap-2 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-colors"
          >
            <FaPlus />
            <span className="text-sm">Nuevo Requisito</span>
          </button>
        </div>

        {/* Case Type Selector */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">Seleccionar Tipo de Trámite</label>
          <select
            value={selectedCaseType || ''}
            onChange={(e) => setSelectedCaseType(e.target.value || null)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none"
          >
            <option value="">-- Seleccionar --</option>
            {caseTypes.map((ct) => (
              <option key={ct.id} value={ct.id}>{ct.name}</option>
            ))}
          </select>
        </div>

        {selectedCaseType ? (
          <div className="space-y-3">
            {requirements.filter(r => r.case_type_id === selectedCaseType).length > 0 ? (
              requirements.filter(r => r.case_type_id === selectedCaseType).map((req) => (
                <div key={req.id} className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={req.name}
                        onChange={(e) => {
                          setRequirements(requirements.map(r =>
                            r.id === req.id ? { ...r, name: e.target.value } : r
                          ));
                          markAsChanged();
                        }}
                        className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none font-semibold mb-3"
                        placeholder="Nombre del requisito"
                      />
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={req.is_required}
                            onChange={(e) => {
                              setRequirements(requirements.map(r =>
                                r.id === req.id ? { ...r, is_required: e.target.checked } : r
                              ));
                              markAsChanged();
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Obligatorio</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={req.is_downloadable}
                            onChange={(e) => {
                              setRequirements(requirements.map(r =>
                                r.id === req.id ? { ...r, is_downloadable: e.target.checked } : r
                              ));
                              markAsChanged();
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Descargable</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={req.is_recurring}
                            onChange={(e) => {
                              setRequirements(requirements.map(r =>
                                r.id === req.id ? { ...r, is_recurring: e.target.checked } : r
                              ));
                              markAsChanged();
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-gray-700">Recurrente</span>
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setRequirements(requirements.filter(r => r.id !== req.id));
                        markAsChanged();
                      }}
                      className="text-red-600 hover:text-red-800 p-2"
                      title="Eliminar"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 bg-gray-50 rounded-lg text-center">
                <FaTable className="mx-auto text-4xl text-gray-300 mb-3" />
                <p className="text-gray-600">No hay requisitos para este tipo de trámite</p>
                <button
                  onClick={() => {
                    const newReq: Requirement = {
                      id: Date.now().toString(),
                      case_type_id: selectedCaseType,
                      name: 'Nuevo Requisito',
                      is_required: true,
                      is_downloadable: false,
                      is_recurring: false,
                    };
                    setRequirements([...requirements, newReq]);
                    markAsChanged();
                  }}
                  className="mt-4 px-4 py-2 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6d8814] transition-colors"
                >
                  Agregar Primero
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 bg-gray-50 rounded-lg text-center">
            <p className="text-gray-600">Selecciona un tipo de trámite para ver/editar sus requisitos</p>
          </div>
        )}

        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Aprendizaje automático:</strong> Al capturar ítems nuevos desde un trámite, se puede marcar como recurrente para futuros casos similares
          </p>
        </div>
      </div>

      {/* Database Creation */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaFileAlt className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Emisión → Base de Datos</h2>
            <p className="text-sm text-gray-600">Registro preliminar automático</p>
          </div>
        </div>

        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800 mb-2">
            <strong>Proceso automático:</strong>
          </p>
          <p className="text-sm text-green-800">
            Al marcar un trámite como "Emitido" (excepto VIDA ASSA), si la póliza no está registrada en la base de datos, se pregunta al Master si desea crear un registro preliminar.
          </p>
        </div>
      </div>

      {/* Deferred Reminders */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaBell className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Aplazados</h2>
            <p className="text-sm text-gray-600">Configuración de recordatorios (editable)</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-semibold text-gray-700 mb-3">Tiempo de Alerta</p>
          <div className="flex items-center gap-4">
            <input
              type="number"
              min="1"
              max="30"
              value={deferredReminderDays}
              onChange={(e) => {
                setDeferredReminderDays(parseInt(e.target.value) || 5);
                markAsChanged();
              }}
              className="w-24 px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:outline-none text-center font-bold text-2xl text-[#010139]"
            />
            <span className="text-gray-600">días antes de la fecha aplazada</span>
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Se envía recordatorio automático con esta anticipación
          </p>
        </div>
      </div>

      {/* Kanban Toggle */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b">
          <FaThLarge className="text-[#8AAA19] text-2xl" />
          <div>
            <h2 className="text-xl font-bold text-[#010139]">Vista Kanban</h2>
            <p className="text-sm text-gray-600">Habilitar vista de tablero</p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <p className="font-semibold text-gray-800">Vista Kanban</p>
            <p className="text-sm text-gray-600">Permite visualizar trámites en formato de tablero</p>
          </div>
          <button
            onClick={() => {
              setKanbanEnabled(!kanbanEnabled);
              markAsChanged();
            }}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
              kanbanEnabled ? 'bg-[#8AAA19]' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                kanbanEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save Button */}
      {hasChanges && (
        <div className="sticky bottom-4 bg-white rounded-2xl shadow-2xl p-4 border-2 border-[#8AAA19] animate-[slideUp_0.3s_ease-out]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <FaSave />
                <span>Guardar Configuración de Trámites</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
