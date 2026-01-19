'use client';

import { useState, useEffect } from 'react';
import { FaCog, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'sonner';
import {
  actionGetRamosCatalog,
  actionGetAseguradorasCatalog,
  actionGetTramitesCatalog,
  actionCreateRamo,
  actionUpdateRamo,
  actionCreateAseguradora,
  actionUpdateAseguradora,
  actionCreateTramite,
  actionUpdateTramite,
} from '@/app/(app)/config/catalog-actions';
import type { RamoCatalog, AseguradoraCatalog, TramiteCatalog } from '@/lib/ticketing/types';

export default function TicketingTab() {
  const [activeSubTab, setActiveSubTab] = useState<'ramos' | 'aseguradoras' | 'tramites'>('ramos');
  const [loading, setLoading] = useState(true);

  // Catalogs data
  const [ramos, setRamos] = useState<RamoCatalog[]>([]);
  const [aseguradoras, setAseguradoras] = useState<AseguradoraCatalog[]>([]);
  const [tramites, setTramites] = useState<TramiteCatalog[]>([]);

  // Editing state
  const [editingRamo, setEditingRamo] = useState<RamoCatalog | null>(null);
  const [editingAseguradora, setEditingAseguradora] = useState<AseguradoraCatalog | null>(null);
  const [editingTramite, setEditingTramite] = useState<TramiteCatalog | null>(null);

  // New item state
  const [showNewRamo, setShowNewRamo] = useState(false);
  const [showNewAseguradora, setShowNewAseguradora] = useState(false);
  const [showNewTramite, setShowNewTramite] = useState(false);

  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    setLoading(true);
    
    const [ramosResult, aseguradorasResult, tramitesResult] = await Promise.all([
      actionGetRamosCatalog(),
      actionGetAseguradorasCatalog(),
      actionGetTramitesCatalog(),
    ]);

    if (ramosResult.ok) setRamos(ramosResult.data || []);
    if (aseguradorasResult.ok) setAseguradoras(aseguradorasResult.data || []);
    if (tramitesResult.ok) setTramites(tramitesResult.data || []);

    setLoading(false);
  };

  const handleToggleActive = async (
    type: 'ramo' | 'aseguradora' | 'tramite',
    id: string,
    currentActive: boolean
  ) => {
    let result;
    
    if (type === 'ramo') {
      result = await actionUpdateRamo(id, { is_active: !currentActive });
    } else if (type === 'aseguradora') {
      result = await actionUpdateAseguradora(id, { is_active: !currentActive });
    } else {
      result = await actionUpdateTramite(id, { is_active: !currentActive });
    }

    if (result.ok) {
      toast.success(currentActive ? 'Desactivado correctamente' : 'Activado correctamente');
      loadCatalogs();
    } else {
      toast.error(result.error || 'Error al actualizar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-white rounded-xl p-6 border-l-4 border-[#010139] shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <FaCog className="text-2xl text-[#010139]" />
          <h2 className="text-2xl font-bold text-[#010139]">
            Configuración de Sistema de Tickets
          </h2>
        </div>
        <p className="text-gray-600">
          Administra los catálogos de ramos, aseguradoras y tipos de trámite para la generación automática de tickets de 12 dígitos.
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4">
        <h3 className="font-bold text-blue-900 mb-2">📋 Formato de Ticket: [AAMM][RAMO][ASEG][TRAMITE][CORRELATIVO]</h3>
        <p className="text-sm text-blue-800 mb-2">
          Ejemplo: <span className="font-mono font-bold">260103010001</span> = 
          <span className="ml-2">Enero 2026 + Ramo 03 + Aseguradora 01 + Trámite 01 + Correlativo 001</span>
        </p>
        <ul className="text-sm text-blue-700 space-y-1 ml-4">
          <li>• Los códigos deben ser numéricos y únicos</li>
          <li>• Ramos y Aseguradoras: 2 dígitos (01-99)</li>
          <li>• Trámites: 1-2 dígitos (1-99)</li>
          <li>• El correlativo se reinicia cada mes automáticamente</li>
        </ul>
      </div>

      {/* Sub-tabs */}
      <div className="bg-gray-50 rounded-xl p-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveSubTab('ramos')}
            className={`px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 min-w-fit ${
              activeSubTab === 'ramos'
                ? 'bg-[#010139] text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
            }`}
          >
            📋 Ramos ({ramos.length})
          </button>
          <button
            onClick={() => setActiveSubTab('aseguradoras')}
            className={`px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 min-w-fit ${
              activeSubTab === 'aseguradoras'
                ? 'bg-[#010139] text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
            }`}
          >
            🏢 Aseguradoras ({aseguradoras.length})
          </button>
          <button
            onClick={() => setActiveSubTab('tramites')}
            className={`px-4 py-2.5 rounded-lg font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-2 min-w-fit ${
              activeSubTab === 'tramites'
                ? 'bg-[#010139] text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 hover:border-gray-300'
            }`}
          >
            ⚙️ Tipos de Trámite ({tramites.length})
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
          <p className="text-gray-500 mt-4">Cargando catálogos...</p>
        </div>
      ) : (
        <>
          {activeSubTab === 'ramos' && (
            <RamosSection
              ramos={ramos}
              onToggleActive={(id, active) => handleToggleActive('ramo', id, active)}
              onReload={loadCatalogs}
            />
          )}
          {activeSubTab === 'aseguradoras' && (
            <AseguradorasSection
              aseguradoras={aseguradoras}
              onToggleActive={(id, active) => handleToggleActive('aseguradora', id, active)}
              onReload={loadCatalogs}
            />
          )}
          {activeSubTab === 'tramites' && (
            <TramitesSection
              tramites={tramites}
              onToggleActive={(id, active) => handleToggleActive('tramite', id, active)}
              onReload={loadCatalogs}
            />
          )}
        </>
      )}
    </div>
  );
}

// =====================================================
// RAMOS SECTION
// =====================================================

function RamosSection({
  ramos,
  onToggleActive,
  onReload,
}: {
  ramos: RamoCatalog[];
  onToggleActive: (id: string, active: boolean) => void;
  onReload: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<RamoCatalog | null>(null);

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="bg-[#8AAA19] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6d8814] transition-colors flex items-center gap-2 shadow-md"
        >
          <FaPlus className="text-white" /> Agregar Ramo
        </button>
      </div>

      {/* New ramo form */}
      {showNew && (
        <RamoForm
          onClose={() => setShowNew(false)}
          onSave={() => {
            setShowNew(false);
            onReload();
          }}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Código</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">SLA Base (días)</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ramos.map((ramo) => (
              <tr key={ramo.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-[#010139]">{ramo.code}</span>
                </td>
                <td className="px-6 py-4 font-semibold">{ramo.name}</td>
                <td className="px-6 py-4">{ramo.sla_days_default} días</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleActive(ramo.id, ramo.is_active)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      ramo.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {ramo.is_active ? <FaToggleOn className="text-green-600" /> : <FaToggleOff className="text-gray-600" />}
                    {ramo.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setEditing(ramo)}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <FaEdit className="inline mr-1" /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <RamoForm
          ramo={editing}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function RamoForm({
  ramo,
  onClose,
  onSave,
}: {
  ramo?: RamoCatalog;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    code: ramo?.code || '',
    name: ramo?.name || '',
    description: ramo?.description || '',
    sla_days_default: ramo?.sla_days_default || 10,
    display_order: ramo?.display_order || 0,
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let result;
    if (ramo) {
      result = await actionUpdateRamo(ramo.id, formData);
    } else {
      result = await actionCreateRamo({ ...formData, is_active: true });
    }

    if (result.ok) {
      toast.success(ramo ? 'Ramo actualizado' : 'Ramo creado');
      onSave();
    } else {
      toast.error(result.error || 'Error al guardar');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">
          <h3 className="text-xl font-bold">{ramo ? 'Editar Ramo' : 'Nuevo Ramo'}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Código (2 dígitos: 01-99)
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none font-mono"
              required
              maxLength={2}
              pattern="\d{2}"
              disabled={!!ramo}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción (opcional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">SLA Base (días)</label>
            <input
              type="number"
              value={formData.sla_days_default}
              onChange={(e) => setFormData({ ...formData, sla_days_default: parseInt(e.target.value) })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              required
              min={1}
              max={365}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <FaTimes className="inline mr-2" /> Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors disabled:opacity-50"
            >
              <FaSave className="inline mr-2 text-white" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================
// ASEGURADORAS SECTION
// =====================================================

function AseguradorasSection({
  aseguradoras,
  onToggleActive,
  onReload,
}: {
  aseguradoras: AseguradoraCatalog[];
  onToggleActive: (id: string, active: boolean) => void;
  onReload: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<AseguradoraCatalog | null>(null);

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="bg-[#8AAA19] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6d8814] transition-colors flex items-center gap-2 shadow-md"
        >
          <FaPlus className="text-white" /> Agregar Aseguradora
        </button>
      </div>

      {/* New aseguradora form */}
      {showNew && (
        <AseguradoraForm
          onClose={() => setShowNew(false)}
          onSave={() => {
            setShowNew(false);
            onReload();
          }}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Código</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Nombre Corto</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {aseguradoras.map((aseg) => (
              <tr key={aseg.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-[#010139]">{aseg.code}</span>
                </td>
                <td className="px-6 py-4 font-semibold">{aseg.name}</td>
                <td className="px-6 py-4 text-gray-600">{aseg.short_name || '-'}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleActive(aseg.id, aseg.is_active)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      aseg.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {aseg.is_active ? <FaToggleOn className="text-green-600" /> : <FaToggleOff className="text-gray-600" />}
                    {aseg.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setEditing(aseg)}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <FaEdit className="inline mr-1" /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <AseguradoraForm
          aseguradora={editing}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function AseguradoraForm({
  aseguradora,
  onClose,
  onSave,
}: {
  aseguradora?: AseguradoraCatalog;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    code: aseguradora?.code || '',
    name: aseguradora?.name || '',
    short_name: aseguradora?.short_name || '',
    display_order: aseguradora?.display_order || 0,
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let result;
    if (aseguradora) {
      result = await actionUpdateAseguradora(aseguradora.id, formData);
    } else {
      result = await actionCreateAseguradora({ ...formData, is_active: true, insurer_id: null });
    }

    if (result.ok) {
      toast.success(aseguradora ? 'Aseguradora actualizada' : 'Aseguradora creada');
      onSave();
    } else {
      toast.error(result.error || 'Error al guardar');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">
          <h3 className="text-xl font-bold">{aseguradora ? 'Editar Aseguradora' : 'Nueva Aseguradora'}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Código (2 dígitos: 01-99)
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none font-mono"
              required
              maxLength={2}
              pattern="\d{2}"
              disabled={!!aseguradora}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Completo</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              required
              placeholder="Ej: ASSA Compañía de Seguros"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Nombre Corto (opcional)
            </label>
            <input
              type="text"
              value={formData.short_name}
              onChange={(e) => setFormData({ ...formData, short_name: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              placeholder="Ej: ASSA"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Orden de visualización</label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              min={0}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <FaTimes className="inline mr-2" /> Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors disabled:opacity-50"
            >
              <FaSave className="inline mr-2 text-white" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =====================================================
// TRAMITES SECTION
// =====================================================

function TramitesSection({
  tramites,
  onToggleActive,
  onReload,
}: {
  tramites: TramiteCatalog[];
  onToggleActive: (id: string, active: boolean) => void;
  onReload: () => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<TramiteCatalog | null>(null);

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowNew(true)}
          className="bg-[#8AAA19] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#6d8814] transition-colors flex items-center gap-2 shadow-md"
        >
          <FaPlus className="text-white" /> Agregar Trámite
        </button>
      </div>

      {/* New tramite form */}
      {showNew && (
        <TramiteForm
          onClose={() => setShowNew(false)}
          onSave={() => {
            setShowNew(false);
            onReload();
          }}
        />
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Código</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Nombre</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">SLA Modifier</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Requiere Póliza</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Estado</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tramites.map((tramite) => (
              <tr key={tramite.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-mono font-bold text-[#010139]">{tramite.code}</span>
                </td>
                <td className="px-6 py-4 font-semibold">{tramite.name}</td>
                <td className="px-6 py-4">
                  <span className={`font-semibold ${tramite.sla_modifier >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tramite.sla_modifier > 0 ? '+' : ''}{tramite.sla_modifier} días
                  </span>
                </td>
                <td className="px-6 py-4">
                  {tramite.requires_policy_number ? (
                    <span className="text-green-600 font-semibold">✓ Sí</span>
                  ) : (
                    <span className="text-gray-400">- No</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => onToggleActive(tramite.id, tramite.is_active)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                      tramite.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {tramite.is_active ? <FaToggleOn className="text-green-600" /> : <FaToggleOff className="text-gray-600" />}
                    {tramite.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setEditing(tramite)}
                    className="text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    <FaEdit className="inline mr-1" /> Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editing && (
        <TramiteForm
          tramite={editing}
          onClose={() => setEditing(null)}
          onSave={() => {
            setEditing(null);
            onReload();
          }}
        />
      )}
    </div>
  );
}

function TramiteForm({
  tramite,
  onClose,
  onSave,
}: {
  tramite?: TramiteCatalog;
  onClose: () => void;
  onSave: () => void;
}) {
  const [formData, setFormData] = useState({
    code: tramite?.code || '',
    name: tramite?.name || '',
    description: tramite?.description || '',
    requires_policy_number: tramite?.requires_policy_number || false,
    sla_modifier: tramite?.sla_modifier || 0,
    display_order: tramite?.display_order || 0,
  });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let result;
    if (tramite) {
      result = await actionUpdateTramite(tramite.id, formData);
    } else {
      result = await actionCreateTramite({ ...formData, is_active: true });
    }

    if (result.ok) {
      toast.success(tramite ? 'Trámite actualizado' : 'Trámite creado');
      onSave();
    } else {
      toast.error(result.error || 'Error al guardar');
    }

    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl my-8">
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-6 rounded-t-2xl">
          <h3 className="text-xl font-bold">{tramite ? 'Editar Trámite' : 'Nuevo Trámite'}</h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Código (1-2 dígitos: 1-99)
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none font-mono"
              required
              maxLength={2}
              pattern="\d{1,2}"
              disabled={!!tramite}
            />
            <p className="text-xs text-gray-500 mt-1">Se usará en el ticket (ej: 1 para Emisión)</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              required
              placeholder="Ej: Emisión, Renovación, Siniestro..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Descripción (opcional)</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              rows={2}
              placeholder="Descripción del tipo de trámite..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Modificador de SLA (días)
            </label>
            <input
              type="number"
              value={formData.sla_modifier}
              onChange={(e) => setFormData({ ...formData, sla_modifier: parseInt(e.target.value) })}
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2 focus:border-[#8AAA19] focus:outline-none"
              min={-30}
              max={30}
            />
            <p className="text-xs text-gray-500 mt-1">
              Se suma al SLA base del ramo. Ej: +5 días para siniestros, -3 días para cotizaciones
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.requires_policy_number}
                onChange={(e) => setFormData({ ...formData, requires_policy_number: e.target.checked })}
                className="w-5 h-5 rounded mt-0.5"
              />
              <div>
                <span className="font-bold text-blue-900 text-sm">Requiere número de póliza</span>
                <p className="text-xs text-blue-700 mt-1">
                  Marca esta opción si este trámite siempre requiere un número de póliza existente
                  (ej: renovaciones, endosos, siniestros)
                </p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <FaTimes className="inline mr-2" /> Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-[#010139] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#020270] transition-colors disabled:opacity-50"
            >
              <FaSave className="inline mr-2 text-white" />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
