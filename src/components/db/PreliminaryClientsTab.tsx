'use client';

import { useState, useEffect } from 'react';
import { FaExclamationTriangle, FaEdit, FaSave, FaTimes, FaTrash, FaCheckCircle, FaCalendar, FaUser, FaFileAlt, FaBuilding } from 'react-icons/fa';
import { toast } from 'sonner';
import { actionGetPreliminaryClients, actionUpdatePreliminaryClient, actionDeletePreliminaryClient, actionTriggerMigration } from '@/app/(app)/db/preliminary-actions';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PreliminaryClientsTabProps {
  insurers: any[];
  brokers: any[];
  userRole: string;
}

export default function PreliminaryClientsTab({ insurers, brokers, userRole }: PreliminaryClientsTabProps) {
  const [loading, setLoading] = useState(true);
  const [preliminaryClients, setPreliminaryClients] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPreliminaryClients();
  }, []);

  useEffect(() => {
    if (editForm.start_date && editingId) {
      const startDate = new Date(editForm.start_date);
      const renewalDate = new Date(startDate);
      renewalDate.setFullYear(startDate.getFullYear() + 1);
      const renewalDateStr = renewalDate.toISOString().split('T')[0] || '';
      
      if (!editForm.renewal_date) {
        setEditForm((prev: any) => ({ ...prev, renewal_date: renewalDateStr }));
      }
    }
  }, [editForm.start_date, editForm.renewal_date, editingId]);

  const loadPreliminaryClients = async () => {
    setLoading(true);
    const result = await actionGetPreliminaryClients();
    
    if (result.ok) {
      setPreliminaryClients(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const toggleExpand = (clientId: string) => {
    setExpandedClients(prev => {
      const newSet = new Set(prev);
      if (newSet.has(clientId)) {
        newSet.delete(clientId);
      } else {
        newSet.add(clientId);
      }
      return newSet;
    });
  };

  const startEdit = (client: any) => {
    const today = new Date().toISOString().split('T')[0];
    setEditingId(client.id);
    setExpandedClients(prev => new Set(prev).add(client.id));
    setEditForm({
      client_name: client.client_name || '',
      national_id: client.national_id || '',
      email: client.email || '',
      phone: client.phone || '',
      birth_date: client.birth_date || '',
      policy_number: client.policy_number || '',
      ramo: client.ramo || '',
      insurer_id: client.insurer_id || '',
      start_date: client.start_date || today,
      renewal_date: client.renewal_date || '',
      status: client.status || 'ACTIVA',
      broker_id: client.broker_id || '',
      notes: client.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;

    setSaving(true);
    const result = await actionUpdatePreliminaryClient(editingId, editForm);

    if (result.ok) {
      toast.success('Cliente preliminar actualizado');
      
      // Check if it was auto-migrated
      if (result.data?.migrated) {
        toast.success('✅ Cliente migrado automáticamente a la base de datos', {
          description: 'Todos los datos obligatorios fueron completados'
        });
      }
      
      setEditingId(null);
      setEditForm({});
      loadPreliminaryClients();
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, clientName: string) => {
    if (!confirm(`¿Eliminar cliente preliminar "${clientName}"?`)) return;

    const result = await actionDeletePreliminaryClient(id);
    if (result.ok) {
      toast.success(result.message);
      loadPreliminaryClients();
    } else {
      toast.error(result.error);
    }
  };

  const handleManualMigration = async (id: string) => {
    if (!confirm('¿Migrar este cliente a la base de datos principal?')) return;

    const result = await actionTriggerMigration(id);
    if (result.ok) {
      toast.success(result.message);
      loadPreliminaryClients();
    } else {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139]"></div>
      </div>
    );
  }

  if (preliminaryClients.length === 0) {
    return (
      <div className="text-center py-12">
        <FaCheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">
          No hay clientes preliminares
        </h3>
        <p className="text-gray-600">
          Todos los clientes han sido completados y migrados a la base de datos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Warning Banner */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <FaExclamationTriangle className="text-amber-600 mt-1 flex-shrink-0" size={20} />
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 mb-1">
              ⚠️ Clientes Preliminares - Datos Incompletos
            </h3>
            <p className="text-sm text-amber-800 mb-2">
              Estos clientes están pendientes de completar información obligatoria.
            </p>
            <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
              <li><strong>NO calculan comisiones</strong> hasta que sean migrados</li>
              <li><strong>NO aparecen en reportes de morosidad</strong></li>
              <li><strong>NO están incluidos en la base de datos principal</strong></li>
              <li>Se migrarán automáticamente al completar todos los campos obligatorios</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white rounded-lg shadow-md p-4 border-2 border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Clientes Preliminares</p>
            <p className="text-3xl font-bold text-amber-600">{preliminaryClients.length}</p>
          </div>
          <FaExclamationTriangle className="text-amber-400" size={40} />
        </div>
      </div>

      {/* List */}
      <div className="space-y-4">
        {preliminaryClients.map((client) => {
          const isEditing = editingId === client.id;
          const insurerName = insurers.find(i => i.id === client.insurer_id)?.name || 'Sin asignar';
          const brokerName = client.brokers?.name || (client.brokers?.profiles as any)?.full_name || 'Sin asignar';

          return (
            <div
              key={client.id}
              className="bg-white rounded-xl shadow-lg border-2 border-amber-200 hover:border-amber-400 transition-all overflow-hidden"
            >
              {/* Header Comprimido - Clickeable */}
              <div 
                className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                onClick={() => !isEditing && toggleExpand(client.id)}
              >
                <div className="flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    {client.client_name || '(Sin nombre)'}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {insurerName} • Póliza: <span className="font-mono font-semibold">{client.policy_number || '(Sin número)'}</span>
                  </p>
                  {client.missing_fields.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded inline-block">
                        ⚠️ {client.missing_fields.length} campo{client.missing_fields.length !== 1 ? 's' : ''} faltante{client.missing_fields.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {!isEditing && (
                  <div className="flex gap-2">
                    {client.is_complete && (
                      <div className="relative group">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleManualMigration(client.id);
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                        >
                          <FaCheckCircle />
                          <span className="hidden sm:inline">Migrar a BD</span>
                        </button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-72 z-50">
                          <div className="space-y-2">
                            <p className="font-bold text-sm">✅ Cliente Listo para Migrar</p>
                            <p>Este cliente tiene todos los campos obligatorios completados.</p>
                            <div className="border-t border-gray-700 pt-2 mt-2">
                              <p className="font-semibold">Al migrar a la base de datos:</p>
                              <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                                <li>Podrá generar comisiones</li>
                                <li>Aparecerá en reportes de morosidad</li>
                                <li>Estará en la base de datos oficial</li>
                              </ul>
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-8 border-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    {!client.is_complete && (
                      <div className="relative group">
                        <button
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold text-sm flex items-center gap-2 cursor-not-allowed opacity-75"
                          disabled
                        >
                          <FaExclamationTriangle />
                          <span className="hidden sm:inline">Datos Incompletos</span>
                        </button>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-4 py-3 bg-red-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-80 z-50">
                          <div className="space-y-2">
                            <p className="font-bold text-sm">⚠️ Cliente NO se puede migrar</p>
                            <p>Faltan campos obligatorios. Si se marca como completo sin llenarlos:</p>
                            <div className="border-t border-red-700 pt-2 mt-2">
                              <p className="font-semibold text-red-200">Consecuencias:</p>
                              <ul className="list-disc list-inside text-xs space-y-1 mt-1">
                                <li>❌ NO se pasará a la base de datos oficial</li>
                                <li>❌ NO generará comisiones</li>
                                <li>❌ NO aparecerá en morosidad</li>
                                <li>❌ NO se podrá usar para trámites</li>
                              </ul>
                              <p className="mt-2 text-xs text-amber-200 font-semibold">👉 Completa los campos antes de migrar</p>
                            </div>
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                            <div className="border-8 border-transparent border-t-red-900"></div>
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(client);
                      }}
                      className="px-4 py-2 bg-[#010139] hover:bg-[#8AAA19] text-white rounded-lg transition-all font-semibold text-sm flex items-center gap-2"
                    >
                      <FaEdit />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    {userRole === 'master' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(client.id, client.client_name);
                        }}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all font-semibold text-sm"
                      >
                        <FaTrash />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Sección Expandible */}
              {expandedClients.has(client.id) && !isEditing && (
                <div className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6">
                  {/* Campos faltantes con chips */}
                  {client.missing_fields.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <p className="text-sm font-semibold text-red-900 mb-3">
                        📋 Campos faltantes para migración:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {client.missing_fields.map((field: string, idx: number) => (
                          <span 
                            key={idx}
                            className="bg-red-100 text-red-800 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200"
                          >
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Datos actuales */}
                  <div className="bg-white rounded-lg p-4 border border-gray-200">
                    <h4 className="font-semibold text-gray-700 mb-4 text-sm">📊 Información Actual</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Nombre</p>
                        <p className="font-semibold text-sm">{client.client_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Cédula/RUC</p>
                        <p className="font-semibold text-sm">{client.national_id || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Email</p>
                        <p className="font-semibold text-sm">{client.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Teléfono</p>
                        <p className="font-semibold text-sm">{client.phone || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Fecha de Nacimiento</p>
                        <p className="font-semibold text-sm">{client.birth_date || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Aseguradora</p>
                        <p className="font-semibold text-sm">{insurerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Corredor</p>
                        <p className="font-semibold text-sm">{brokerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Ramo</p>
                        <p className="font-semibold text-sm">{client.ramo || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Estado</p>
                        <p className="font-semibold text-sm">{client.status || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Fecha Inicio</p>
                        <p className="font-semibold text-sm">{client.start_date || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Fecha Renovación</p>
                        <p className="font-semibold text-sm">{client.renewal_date || '—'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Form */}
              {isEditing && expandedClients.has(client.id) && (
                <div className="space-y-4">
                  {/* Client Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FaUser className="text-[#8AAA19]" />
                      Información del Cliente
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.client_name}
                          onChange={createUppercaseHandler((e) => setEditForm({ ...editForm, client_name: e.target.value }))}
                          className={`w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cédula / RUC</label>
                        <input
                          type="text"
                          value={editForm.national_id}
                          onChange={createUppercaseHandler((e) => setEditForm({ ...editForm, national_id: e.target.value }))}
                          className={`w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha de Nacimiento <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={editForm.birth_date}
                          onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                          className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Policy Info */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FaFileAlt className="text-[#8AAA19]" />
                      Información de la Póliza
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Número de Póliza <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.policy_number}
                          onChange={createUppercaseHandler((e) => setEditForm({ ...editForm, policy_number: e.target.value }))}
                          className={`w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ramo</label>
                        <input
                          type="text"
                          value={editForm.ramo}
                          onChange={createUppercaseHandler((e) => setEditForm({ ...editForm, ramo: e.target.value }))}
                          className={`w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none ${uppercaseInputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Aseguradora <span className="text-red-500">*</span>
                        </label>
                        <Select value={editForm.insurer_id} onValueChange={(value) => setEditForm({ ...editForm, insurer_id: value })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {insurers.map((ins) => (
                              <SelectItem key={ins.id} value={ins.id}>{ins.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Corredor <span className="text-red-500">*</span>
                        </label>
                        <Select value={editForm.broker_id} onValueChange={(value) => setEditForm({ ...editForm, broker_id: value })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent>
                            {brokers.map((broker: any) => (
                              <SelectItem key={broker.id} value={broker.id}>
                                {broker.name || (broker.profiles as any)?.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
                        <input
                          type="date"
                          value={editForm.start_date}
                          onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                          className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Fecha Renovación <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.renewal_date}
                          onChange={(e) => setEditForm({ ...editForm, renewal_date: e.target.value })}
                          className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                      className="w-full px-4 py-2 border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                      placeholder="Notas adicionales..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex-1 px-6 py-3 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaSave />
                      {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                      <FaTimes />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
