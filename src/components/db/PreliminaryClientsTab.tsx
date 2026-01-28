'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { FaExclamationTriangle, FaEdit, FaSave, FaTimes, FaTrash, FaCheckCircle, FaCalendar, FaUser, FaFileAlt, FaBuilding, FaFolder, FaSearch } from 'react-icons/fa';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { MoreVertical } from 'lucide-react';
import { supabaseClient } from '@/lib/supabase/client';
import { formatDateForDisplay } from '@/lib/utils/dates';
import { getTodayLocalDate, addOneYearToDate } from '@/lib/utils/dates';
import { toast } from 'sonner';
import { actionGetPreliminaryClients, actionUpdatePreliminaryClient, actionDeletePreliminaryClient, actionTriggerMigration } from '@/app/(app)/db/preliminary-actions';
import { createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ExpedienteManager from '@/components/expediente/ExpedienteManager';
import { POLICY_TYPES } from '@/lib/constants/policy-types';
import Modal from '@/components/Modal';
import NationalIdInput from '@/components/ui/NationalIdInput';
import PolicyNumberInput from '@/components/ui/PolicyNumberInput';

interface PreliminaryClientsTabProps {
  insurers: any[];
  brokers: any[];
  userRole: string;
}

export default function PreliminaryClientsTab({ insurers, brokers: brokersProp, userRole }: PreliminaryClientsTabProps) {
  const [loading, setLoading] = useState(true);
  const [preliminaryClients, setPreliminaryClients] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [brokers, setBrokers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedExpedientes, setExpandedExpedientes] = useState<Set<string>>(new Set());
  const [searchingPolicy, setSearchingPolicy] = useState(false);
  const [existingPolicyClient, setExistingPolicyClient] = useState<any>(null);
  const [openMenuClient, setOpenMenuClient] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [expedienteModalOpen, setExpedienteModalOpen] = useState<Record<string, boolean>>({});
  const [showExpedienteInEdit, setShowExpedienteInEdit] = useState(false);
  const [documentType, setDocumentType] = useState<'cedula' | 'pasaporte' | 'ruc'>('cedula');

  useEffect(() => {
    loadPreliminaryClients();
    loadBrokers();
  }, []);
  
  const loadBrokers = async () => {
    try {
      const { data: brokersData } = await supabaseClient()
        .from('brokers')
        .select('id, name')
        .eq('active', true)
        .order('name');
      
      console.log('[PreliminaryClientsTab] Brokers cargados:', brokersData);
      setBrokers(brokersData || []);
    } catch (error) {
      console.error('[PreliminaryClientsTab] Error loading brokers:', error);
    }
  };

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuClient(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (editForm.start_date && editingId && !editForm.renewal_date) {
      const calculatedRenewalDate = addOneYearToDate(editForm.start_date);
      setEditForm((prev: any) => ({ ...prev, renewal_date: calculatedRenewalDate }));
    }
  }, [editForm.start_date, editingId, editForm.renewal_date]);

  // Buscar cliente existente cuando se ingresa cédula
  useEffect(() => {
    if (!editForm.national_id || editForm.national_id.trim() === '' || !editingId) {
      setExistingPolicyClient(null);
      return;
    }

    const timer = setTimeout(async () => {
      await searchExistingClient(editForm.national_id);
    }, 800);

    return () => clearTimeout(timer);
  }, [editForm.national_id, editingId]);

  const searchExistingClient = async (nationalId: string) => {
    setSearchingPolicy(true);
    try {
      const { data: client } = await supabaseClient()
        .from('clients')
        .select('*')
        .eq('national_id', nationalId.toUpperCase())
        .single();

      if (client) {
        setExistingPolicyClient(client);
        
        // Autocompletar datos del cliente existente
        setEditForm((prev: any) => ({
          ...prev,
          client_name: client.name || prev.client_name,
          email: client.email || prev.email,
          phone: client.phone || prev.phone,
          birth_date: client.birth_date || prev.birth_date,
        }));

        toast.success(`Cliente encontrado: ${client.name}`, {
          description: 'Datos autocompletados. Completa los datos de la póliza y actualiza cualquier dato faltante del cliente.'
        });
      } else {
        setExistingPolicyClient(null);
      }
    } catch (error) {
      console.error('Error buscando cliente:', error);
      setExistingPolicyClient(null);
    } finally {
      setSearchingPolicy(false);
    }
  };

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

  const toggleExpediente = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedExpedientes(prev => {
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
    const today = getTodayLocalDate();
    setEditingId(client.id);
    setExpandedClients(prev => new Set(prev).add(client.id));
    setExistingPolicyClient(null);
    setShowExpedienteInEdit(false);
    
    // Obtener broker_id desde la relación brokers
    const brokerId = client.broker_id || client.brokers?.id || '';
    
    // Detectar tipo de documento desde national_id
    const nationalId = client.national_id || '';
    let detectedType: 'cedula' | 'pasaporte' | 'ruc' = 'cedula';
    if (nationalId.includes('E-') || nationalId.includes('N-') || nationalId.includes('PE-')) {
      detectedType = 'pasaporte';
    } else if (nationalId.length > 0 && !nationalId.match(/^\d{1,2}-\d{1,4}-\d{1,5}$/)) {
      detectedType = 'ruc';
    }
    setDocumentType(detectedType);
    
    setEditForm({
      client_name: client.client_name || '',
      national_id: nationalId,
      email: client.email || '',
      phone: client.phone || '',
      birth_date: client.birth_date || '',
      policy_number: client.policy_number || '',
      ramo: client.ramo || '',
      insurer_id: client.insurer_id || '',
      start_date: client.start_date || today,
      renewal_date: client.renewal_date || '',
      status: client.status || 'ACTIVA',
      broker_id: brokerId,
      notes: client.notes || '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setExistingPolicyClient(null);
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

  // Agrupar clientes por aseguradora y ordenar alfabéticamente
  const clientsByInsurer = useMemo(() => {
    const groups: Record<string, any[]> = {};
    
    preliminaryClients.forEach((client) => {
      const insurerName = insurers.find(i => i.id === client.insurer_id)?.name || 'Sin Aseguradora';
      
      if (!groups[insurerName]) {
        groups[insurerName] = [];
      }
      
      groups[insurerName].push(client);
    });
    
    // Ordenar clientes alfabéticamente dentro de cada grupo
    Object.keys(groups).forEach((insurerName) => {
      if (groups[insurerName]) {
        groups[insurerName].sort((a, b) => {
          const nameA = a.client_name || '';
          const nameB = b.client_name || '';
          return nameA.localeCompare(nameB);
        });
      }
    });
    
    // Ordenar las aseguradoras alfabéticamente
    const sortedInsurerNames = Object.keys(groups).sort();
    
    return sortedInsurerNames.map((insurerName) => ({
      insurerName,
      clients: groups[insurerName]
    }));
  }, [preliminaryClients, insurers]);

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
            <h3 className="font-bold text-amber-900 mb-2 text-base">
              Clientes Preliminares - Datos Incompletos
            </h3>
            <p className="text-sm text-amber-800 mb-3">
              Estos clientes están pendientes de completar información para migración a la base de datos principal.
            </p>
            
            {/* Campos Obligatorios */}
            <div className="bg-white/60 rounded-lg p-3 mb-3 border border-amber-200">
              <p className="text-sm font-bold text-amber-900 mb-2">� Todos los datos son OBLIGATORIOS (excepto Notas):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                <ul className="text-xs text-amber-800 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Nombre del cliente</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Cédula/RUC</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Email</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Teléfono</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Fecha de nacimiento</strong></span>
                  </li>
                </ul>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Número de póliza</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Tipo de póliza</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Aseguradora</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Fecha de renovación</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold">•</span>
                    <span><strong>Corredor asignado</strong></span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Instructivo de Cliente Existente */}
            <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-300">
              <p className="text-sm font-bold text-green-900 mb-2">💡 ¿El cliente YA existe en base de datos?</p>
              <p className="text-xs text-green-800 mb-2">
                Si ingresas el <strong>número de cédula</strong> y el cliente ya existe, el sistema:
              </p>
              <ul className="text-xs text-green-800 space-y-1 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Autocompletará <strong>todos los datos del cliente</strong> que ya tenga en BD</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Completa los <strong>datos de la póliza</strong> (la póliza no existe, por eso está en preliminar)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Si faltan datos del cliente, <strong>complétalos aquí</strong> - actualizará el cliente en BD</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Al guardar, creará la nueva póliza y la <strong>anexará al cliente existente</strong></span>
                </li>
              </ul>
              <p className="text-xs text-green-700 mt-2 italic">
                La cédula conecta el preliminar con el cliente existente - evita duplicados.
              </p>
            </div>

            {/* Limitaciones */}
            <div className="bg-white/40 rounded p-2">
              <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ Mientras estén en Preliminar:</p>
              <ul className="text-xs text-amber-700 space-y-0.5 ml-4">
                <li>• NO calculan comisiones</li>
                <li>• NO aparecen en reportes de morosidad</li>
                <li>• NO están incluidos en la base de datos principal</li>
              </ul>
            </div>
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

      {/* List - Agrupado por Aseguradora en 2 Columnas */}
      {clientsByInsurer.map(({ insurerName, clients }) => (
        <div key={insurerName} className="mb-6">
          {/* Subtítulo de Aseguradora */}
          <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2 border-b-2 border-[#8AAA19] pb-2">
            <FaBuilding className="text-[#8AAA19]" />
            {insurerName}
            <span className="text-sm font-normal text-gray-600 ml-2">
              ({clients?.length || 0} {clients?.length === 1 ? 'cliente' : 'clientes'})
            </span>
          </h3>

          {/* Grid 2 columnas en PC, 1 en mobile */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {clients?.map((client) => {
          const isEditing = editingId === client.id;
          const insurerName = insurers.find(i => i.id === client.insurer_id)?.name || 'Sin asignar';
          const brokerName = client.brokers?.name || (client.brokers?.profiles as any)?.full_name || 'Sin asignar';

          return (
            <div
              key={client.id}
              className="bg-white rounded-lg shadow border border-gray-200 hover:shadow-md transition-all"
            >
              {/* Header Comprimido - Clickeable */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <button
                      className="w-full text-left group"
                      onClick={() => toggleExpand(client.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-[#010139] truncate group-hover:text-[#8AAA19] transition-colors">
                          {client.client_name || '(Sin nombre)'}
                        </h3>
                        {expandedClients.has(client.id) ? (
                          <ChevronUp size={20} className="text-[#8AAA19] flex-shrink-0" />
                        ) : (
                          <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                    <p className="text-xs text-gray-600 mt-1">
                      {insurerName} • Póliza: <span className="font-mono">{client.policy_number || '(Sin número)'}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {client.missing_fields.length > 0 && (
                    <div className="relative group">
                      <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded cursor-help">
                        ⚠️ {client.missing_fields.length}
                      </span>
                      <div className="absolute right-0 bottom-full mb-2 w-80 bg-red-900 text-white text-xs rounded-lg shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 p-4 z-[50000] pointer-events-none">
                        <div className="space-y-2">
                          <p className="font-bold text-sm">⚠️ {client.missing_fields.length} campo{client.missing_fields.length !== 1 ? 's' : ''} faltante{client.missing_fields.length !== 1 ? 's' : ''}</p>
                          <p className="text-xs font-semibold text-red-200">Mientras no se complete la información:</p>
                          <ul className="text-xs space-y-1 ml-4 list-disc">
                            <li>❌ NO puede ser ingresado en base de datos</li>
                            <li>❌ NO genera comisiones</li>
                            <li>❌ NO aparece en reportes de morosidad</li>
                            <li>❌ NO puede ser utilizado para trámites nuevos</li>
                          </ul>
                          <div className="border-t border-red-700 pt-2 mt-2">
                            <p className="font-semibold text-amber-200">📝 Para actualizar:</p>
                            <p className="text-xs mt-1">1. Haz click en los <strong>tres puntos (⋮)</strong></p>
                            <p className="text-xs">2. Selecciona <strong>"Editar"</strong></p>
                            <p className="text-xs">3. Completa todos los datos pendientes</p>
                            <p className="text-xs">4. Guarda los cambios</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Menú 3 puntos */}
                  <div className="relative" ref={openMenuClient === client.id ? menuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuClient(openMenuClient === client.id ? null : client.id);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                      aria-label="Acciones"
                    >
                      <MoreVertical size={18} className="text-gray-600" />
                    </button>
                    {openMenuClient === client.id && (
                      <>
                        <div className="fixed inset-0 z-[49999]" onClick={() => setOpenMenuClient(null)}></div>
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-[50000]">
                          {client.is_complete && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleManualMigration(client.id);
                                setOpenMenuClient(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-green-700"
                            >
                              <FaCheckCircle size={14} />
                              Migrar a BD
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(client);
                              setOpenMenuClient(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            <FaEdit size={14} />
                            Editar
                          </button>
                          {userRole === 'master' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(client.id, client.client_name);
                                setOpenMenuClient(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
                            >
                              <FaTrash size={14} />
                              Eliminar
                            </button>
                          )}
                        </div>
                      </>
                    )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sección Expandible - Info del cliente */}
              {expandedClients.has(client.id) && (
                <div className="ct-detail">
                  <div className="pol-panel">
                    {/* Campos faltantes */}
                    {client.missing_fields.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                        <p className="text-xs font-semibold text-red-900 mb-2 flex items-center gap-2">
                          <span>⚠️</span>
                          Campos faltantes para migración:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {client.missing_fields.map((field: string, idx: number) => (
                            <span 
                              key={idx}
                              className="px-2 py-0.5 text-xs font-medium bg-white border border-red-300 text-red-700 rounded"
                            >
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Datos del Cliente */}
                    <div className="pol-header">
                      <h4 className="pol-title">Datos del Cliente</h4>
                    </div>
                    <div className="pol-row">
                      <div className="pol-main">
                        <div className="pol-meta flex-wrap">
                          <span className="break-words max-w-full"><strong>Nombre:</strong> <span className="break-words">{client.client_name || '—'}</span></span>
                          <span>•</span>
                          <span className="break-words"><strong>Cédula:</strong> {client.national_id || '—'}</span>
                          <span>•</span>
                          <span className="break-words max-w-full truncate"><strong>Email:</strong> {client.email || '—'}</span>
                        </div>
                        <div className="pol-meta flex-wrap">
                          <span><strong>Teléfono:</strong> {client.phone || '—'}</span>
                          <span>•</span>
                          <span><strong>Nacimiento:</strong> {client.birth_date || '—'}</span>
                          <span>•</span>
                          <span className="break-words"><strong>Corredor:</strong> {brokerName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Datos de la Póliza */}
                    <div className="pol-header mt-4">
                      <h4 className="pol-title">Información de la Póliza</h4>
                    </div>
                    <div className="pol-row">
                      <div className="pol-main">
                        <div className="pol-number">
                          📋 {client.policy_number || 'Sin número'}
                        </div>
                        <div className="pol-meta">
                          <span><strong>Aseguradora:</strong> {insurerName}</span>
                          <span>•</span>
                          <span><strong>Ramo:</strong> {client.ramo || '—'}</span>
                        </div>
                        <div className="pol-meta">
                          <span><strong>Inicio:</strong> {client.start_date || '—'}</span>
                          <span>•</span>
                          <span><strong>Renovación:</strong> {client.renewal_date || '—'}</span>
                        </div>
                        {client.notes && (
                          <div className="pol-notas">
                            <span className="pol-notas-label">📝 Notas:</span>
                            <span className="pol-notas-text">{client.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expediente del Cliente */}
                    <div className="mt-4 border-t border-gray-300 pt-4">
                      <div className="pol-header">
                        <h4 className="pol-title flex items-center gap-2">
                          <FaFolder className="text-[#8AAA19]" />
                          Expediente del Cliente
                        </h4>
                      </div>
                      <ExpedienteManager
                        clientId={client.id}
                        showClientDocs={true}
                        showPolicyDocs={false}
                        showOtros={true}
                        readOnly={userRole !== 'master'}
                        externalModalOpen={expedienteModalOpen[client.id]}
                        onExternalModalChange={(open) => {
                          setExpedienteModalOpen(prev => ({ ...prev, [client.id]: open }));
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
          </div>
        </div>
      ))}

      {/* Modal para Editar */}
      {editingId && (
        <Modal title="Editar Cliente Preliminar" onClose={cancelEdit}>
          <div className="space-y-6">
                  {/* Client Info */}
                  <div className="space-y-4">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-700 flex items-center gap-2">
                      <FaUser className="text-[#8AAA19]" size={16} />
                      Información del Cliente
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Nombre <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={editForm.client_name}
                          onChange={createUppercaseHandler((e) => setEditForm({ ...editForm, client_name: e.target.value }))}
                          className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none min-h-[44px] ${uppercaseInputClass}`}
                          style={{ WebkitAppearance: 'none' }}
                          placeholder="NOMBRE COMPLETO DEL CLIENTE"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <NationalIdInput
                          value={editForm.national_id}
                          onChange={(value) => setEditForm({ ...editForm, national_id: value })}
                          onDocumentTypeChange={(type) => setDocumentType(type)}
                          label="Documento de Identidad"
                          helperText={existingPolicyClient ? (
                            <div className="mt-1 p-2 bg-green-50 border border-green-200 rounded-lg">
                              <p className="text-xs text-green-800 flex items-center gap-1">
                                <FaCheckCircle className="text-green-600" />
                                <strong>Cliente existente:</strong> {existingPolicyClient.name}
                              </p>
                              <p className="text-xs text-green-700 mt-1">Datos autocompletados. Completa la póliza y actualiza datos faltantes.</p>
                            </div>
                          ) : null}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Email
                        </label>
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value.toLowerCase() })}
                          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none min-h-[44px]"
                          style={{ WebkitAppearance: 'none' }}
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Teléfono
                        </label>
                        <input
                          type="tel"
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none min-h-[44px]"
                          style={{ WebkitAppearance: 'none' }}
                          placeholder="6000-0000"
                        />
                      </div>
                      {documentType !== 'ruc' && (
                        <div className="w-full max-w-full overflow-hidden">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Fecha de Nacimiento <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={editForm.birth_date}
                            onChange={(e) => setEditForm({ ...editForm, birth_date: e.target.value })}
                            className="w-full max-w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                            style={{ WebkitAppearance: 'none' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Policy Info */}
                  <div className="border-t border-gray-200 pt-4 space-y-4">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-700 flex items-center gap-2">
                      <FaFileAlt className="text-[#8AAA19]" size={16} />
                      Información de la Póliza
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="sm:col-span-2">
                        {editForm.insurer_id ? (
                          <>
                            <PolicyNumberInput
                              insurerName={insurers.find(i => i.id === editForm.insurer_id)?.name || ''}
                              value={editForm.policy_number}
                              onChange={(value) => {
                                if (userRole === 'master') {
                                  setEditForm({ ...editForm, policy_number: value });
                                }
                              }}
                              label="Número de Póliza"
                              required
                            />
                            {userRole !== 'master' && (
                              <p className="text-xs text-amber-600 mt-1">ℹ️ Solo Master puede editar el número de póliza</p>
                            )}
                          </>
                        ) : (
                          <div>
                            <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                              Número de Póliza <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={editForm.policy_number}
                              onChange={createUppercaseHandler((e) => setEditForm({ ...editForm, policy_number: e.target.value }))}
                              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none min-h-[44px] ${uppercaseInputClass} ${userRole !== 'master' ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                              style={{ WebkitAppearance: 'none' }}
                              placeholder="Selecciona aseguradora primero"
                              disabled={true}
                            />
                            <p className="text-xs text-amber-600 mt-1">⚠️ Selecciona una aseguradora para ver el formato correcto</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Tipo de Póliza
                        </label>
                        <Select value={editForm.ramo} onValueChange={(value) => setEditForm({ ...editForm, ramo: value })}>
                          <SelectTrigger className="w-full h-9 text-sm">
                            <SelectValue placeholder="Seleccionar tipo..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {POLICY_TYPES.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Aseguradora <span className="text-red-500">*</span>
                        </label>
                        <Select 
                          value={editForm.insurer_id} 
                          onValueChange={(value) => setEditForm({ ...editForm, insurer_id: value })}
                          disabled={userRole !== 'master'}
                        >
                          <SelectTrigger className={`w-full h-9 text-sm sm:text-base ${userRole !== 'master' ? 'bg-gray-100 cursor-not-allowed' : ''}`}>
                            <SelectValue placeholder="Seleccionar..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {insurers.map((ins) => (
                              <SelectItem key={ins.id} value={ins.id}>{ins.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {userRole === 'master' && (
                        <div className="sm:col-span-2">
                          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                            Corredor <span className="text-red-500">*</span>
                          </label>
                          <Select value={editForm.broker_id} onValueChange={(value) => setEditForm({ ...editForm, broker_id: value })}>
                            <SelectTrigger className="w-full h-9 text-sm border-2 border-gray-300 focus:border-[#8AAA19]">
                              <SelectValue placeholder="Seleccionar corredor...">
                                {editForm.broker_id 
                                  ? (brokers.find((b: any) => b.id === editForm.broker_id)?.name || 'Seleccionar corredor...')
                                  : 'Seleccionar corredor...'
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px] overflow-auto">
                              {brokers.length > 0 ? (
                                brokers.map((broker: any) => (
                                  <SelectItem key={broker.id} value={broker.id}>
                                    {broker.name || 'Sin nombre'}
                                  </SelectItem>
                                ))
                              ) : (
                                <div className="p-2 text-sm text-gray-500">No hay corredores disponibles</div>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="w-full max-w-full overflow-hidden">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Fecha Inicio
                        </label>
                        <input
                          type="date"
                          value={editForm.start_date}
                          onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                          className="w-full max-w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          style={{ WebkitAppearance: 'none' }}
                        />
                      </div>
                      <div className="w-full max-w-full overflow-hidden">
                        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                          Fecha Renovación <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={editForm.renewal_date}
                          onChange={(e) => setEditForm({ ...editForm, renewal_date: e.target.value })}
                          className="w-full max-w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                          style={{ WebkitAppearance: 'none' }}
                        />
                        {editForm.start_date && (
                          <p className="text-xs text-green-600 mt-1">✓ Auto-calculada (un año desde inicio)</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notas</label>
                    <textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-sm border-2 rounded-lg focus:border-[#8AAA19] focus:outline-none"
                      placeholder="Notas adicionales..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex-1 px-4 py-2.5 bg-[#8AAA19] hover:bg-[#7a9916] text-white rounded-lg transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaSave size={14} />
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => setShowExpedienteInEdit(true)}
                      disabled={saving}
                      className="px-4 py-2.5 bg-gradient-to-r from-[#010139] to-[#020270] hover:from-[#020270] hover:to-[#010139] text-white rounded-lg transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaFolder size={14} className="text-white" />
                      Expediente
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <FaTimes size={14} />
                      Cancelar
                    </button>
                  </div>
          </div>
        </Modal>
      )}

      {/* Modal de Expediente */}
      {showExpedienteInEdit && editingId && (
        <Modal 
          title="Expediente del Cliente" 
          onClose={() => setShowExpedienteInEdit(false)}
        >
          <ExpedienteManager
            clientId={editingId}
            showClientDocs={true}
            showPolicyDocs={false}
            showOtros={true}
            readOnly={userRole !== 'master'}
          />
        </Modal>
      )}
    </div>
  );
}
