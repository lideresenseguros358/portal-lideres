"use client";

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FaTimes, FaPlus, FaEdit, FaTrash, FaFolderPlus, FaExclamationTriangle } from "react-icons/fa";
import { actionCreateClientWithPolicy, actionFindDuplicateByNationalId, actionMergeClients } from '@/app/(app)/db/actions';
import type { Tables } from "@/lib/supabase/client";
import { supabaseClient } from '@/lib/supabase/client';
import { toUppercasePayload, createUppercaseHandler, uppercaseInputClass } from '@/lib/utils/uppercase';
import ExpedienteManager from '@/components/expediente/ExpedienteManager';
import { POLICY_TYPES, checkSpecialOverride } from '@/lib/constants/policy-types';
import { getTodayLocalDate, addOneYearToDate } from '@/lib/utils/dates';
import NationalIdInput from '@/components/ui/NationalIdInput';
import PolicyNumberInput from '@/components/ui/PolicyNumberInput';
import MergeDuplicateModal from './MergeDuplicateModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BrokerReassignmentModal from './BrokerReassignmentModal';
import { toast } from 'sonner';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

import { ClientWithPolicies } from '@/types/db';

type PolicyRow = Tables<'policies'>;

// The shape of the policy object when it's part of ClientWithPolicies
type PolicyWithInsurer = ClientWithPolicies['policies'][0];

interface ClientFormProps {
  client: ClientWithPolicies | null;
  onClose: () => void;
  readOnly?: boolean; // Modo solo lectura
  expedienteModalOpen?: boolean;
  onExpedienteModalChange?: (open: boolean) => void;
}

const ClientForm = memo(function ClientForm({ client, onClose, readOnly = false, expedienteModalOpen: externalExpedienteModalOpen, onExpedienteModalChange }: ClientFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editPolicyId = searchParams.get('editPolicy');
  
  const [formData, setFormData] = useState({
    name: client?.name || "",
    national_id: client?.national_id || "",
    email: client?.email || "",
    phone: client?.phone || "",
    birth_date: (client as any)?.birth_date || "",
    active: client?.active ?? true,
    policy_number: '', // Add policy number
    broker_id: client?.broker_id || '',
  });

  const [policies, setPolicies] = useState<PolicyWithInsurer[]>(client?.policies || []);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Usar estado externo si está disponible, sino usar interno
  const [internalExpedienteModalOpen, setInternalExpedienteModalOpen] = useState(false);
  const expedienteModalOpen = externalExpedienteModalOpen !== undefined ? externalExpedienteModalOpen : internalExpedienteModalOpen;
  
  // Estados para detección de duplicados
  const [duplicateClient, setDuplicateClient] = useState<any>(null);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [mergingClients, setMergingClients] = useState(false);
  
  // Estados para gestión de corredor
  const [brokers, setBrokers] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>('');
  const [checkingCommissions, setCheckingCommissions] = useState(false);
  const [commissionWarning, setCommissionWarning] = useState<{
    show: boolean;
    totalAmount: number;
    fortnightCount: number;
  } | null>(null);
  const [commissionData, setCommissionData] = useState<any>(null);
  const [showReassignmentModal, setShowReassignmentModal] = useState(false);
  const [savingWithAdjustments, setSavingWithAdjustments] = useState(false);
  const [previousBrokerId, setPreviousBrokerId] = useState<string>('');
  
  const { dialogState, closeDialog, confirm } = useConfirmDialog();
  
  const handleExpedienteModalChange = useCallback((open: boolean) => {
    if (onExpedienteModalChange) {
      onExpedienteModalChange(open);
    } else {
      setInternalExpedienteModalOpen(open);
    }
  }, [onExpedienteModalChange]);
  
  // Abrir automáticamente el formulario de edición de póliza si se especifica editPolicy
  useEffect(() => {
    if (editPolicyId && client) {
      // Buscar la póliza en las pólizas del cliente
      const policyToEdit = client.policies?.find(p => p.id === editPolicyId);
      if (policyToEdit) {
        // Usar los datos de la póliza tal como están, agregando campos opcionales si faltan
        const policyData = {
          id: policyToEdit.id,
          policy_number: policyToEdit.policy_number,
          insurer_id: policyToEdit.insurer_id,
          ramo: policyToEdit.ramo,
          start_date: policyToEdit.start_date,
          renewal_date: policyToEdit.renewal_date,
          status: policyToEdit.status as "ACTIVA" | "CANCELADA" | "VENCIDA",
          notas: policyToEdit.notas,
          broker_id: client.broker_id || null,
          client_id: client.id,
          created_at: new Date().toISOString(),
          percent_override: null,
        } as PolicyRow;
        setEditingPolicy(policyData);
        setShowPolicyForm(true);
      }
    }
  }, [editPolicyId, client]);

  // Cargar lista de brokers y rol del usuario
  useEffect(() => {
    const loadBrokersAndRole = async () => {
      try {
        // Obtener rol del usuario
        const { data: { user } } = await supabaseClient().auth.getUser();
        if (!user) return;

        const { data: profile } = await supabaseClient()
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        setUserRole(profile?.role || '');

        // Solo cargar brokers si es Master
        if (profile?.role === 'master') {
          const { data: brokersData } = await supabaseClient()
            .from('brokers')
            .select('id, name')
            .eq('active', true)
            .order('name');

          console.log('[ClientForm] Brokers cargados:', brokersData);
          console.log('[ClientForm] Broker ID del cliente:', client?.broker_id);
          setBrokers(brokersData || []);
          
          // Establecer el broker_id inicial del cliente
          if (client?.broker_id) {
            setFormData(prev => ({ ...prev, broker_id: client.broker_id }));
            setPreviousBrokerId(client.broker_id);
          }
        }
      } catch (error) {
        console.error('Error loading brokers:', error);
      }
    };

    loadBrokersAndRole();
  }, [client?.broker_id]);

  // Detectar cambio de corredor y verificar comisiones
  useEffect(() => {
    const checkCommissionsOnBrokerChange = async () => {
      console.log('[BROKER CHANGE DEBUG] Verificando condiciones:', {
        hasClient: !!client,
        clientBrokerId: client?.broker_id,
        formBrokerId: formData.broker_id,
        userRole,
        brokerChanged: formData.broker_id !== client?.broker_id
      });
      
      // Solo verificar si:
      // 1. Estamos editando un cliente (no creando uno nuevo)
      // 2. El broker_id cambió
      // 3. El usuario es Master
      if (!client || !client.broker_id || formData.broker_id === client.broker_id || userRole !== 'master') {
        setCommissionWarning(null);
        return;
      }

      console.log('[BROKER CHANGE DEBUG] Verificando comisiones para cliente:', client.id);
      setCheckingCommissions(true);
      try {
        const response = await fetch('/api/clients/check-commissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: client.id,
            oldBrokerId: client.broker_id
          })
        });

        const data = await response.json();
        console.log('[BROKER CHANGE DEBUG] Respuesta de comisiones:', data);
        
        if (data.success && data.hasPaidCommissions) {
          console.log('[BROKER CHANGE DEBUG] ⚠️ Comisiones detectadas - mostrando warning');
          setCommissionWarning({
            show: true,
            totalAmount: data.totalAmount,
            fortnightCount: data.commissionsByFortnight.length
          });
          // Guardar datos completos para el modal
          setCommissionData(data);
        } else {
          console.log('[BROKER CHANGE DEBUG] ✅ No hay comisiones pagadas');
          setCommissionWarning(null);
          setCommissionData(null);
        }
      } catch (error) {
        console.error('[BROKER CHANGE DEBUG] Error checking commissions:', error);
        setCommissionWarning(null);
      } finally {
        setCheckingCommissions(false);
      }
    };

    checkCommissionsOnBrokerChange();
  }, [formData.broker_id, client, userRole]);

  // Detectar duplicados al cambiar la cédula
  const checkForDuplicates = useCallback(async (nationalId: string) => {
    if (!client || !nationalId || !nationalId.trim()) {
      setDuplicateClient(null);
      return;
    }
    
    // Si la cédula no cambió, no verificar
    if (nationalId.trim().toUpperCase() === client.national_id?.trim().toUpperCase()) {
      setDuplicateClient(null);
      return;
    }
    
    setCheckingDuplicate(true);
    try {
      const result = await actionFindDuplicateByNationalId(nationalId, client.id);
      if (result.ok && result.data) {
        setDuplicateClient(result.data);
        setShowMergeModal(true);
      } else {
        setDuplicateClient(null);
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    } finally {
      setCheckingDuplicate(false);
    }
  }, [client]);
  
  // Fusionar clientes
  const handleMergeClients = async () => {
    if (!client || !duplicateClient) return;
    
    setMergingClients(true);
    try {
      const result = await actionMergeClients(client.id, duplicateClient.id);
      if (result.ok) {
        toast.success('Clientes fusionados exitosamente');
        setShowMergeModal(false);
        onClose();
        // Refrescar página
        window.location.href = '/db?tab=clients';
      } else {
        toast.error(result.error || 'Error al fusionar clientes');
      }
    } catch (error) {
      toast.error('Error inesperado al fusionar');
    } finally {
      setMergingClients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Si hay duplicado detectado, mostrar modal primero
    if (duplicateClient && client) {
      setShowMergeModal(true);
      return;
    }
    
    // Si hay cambio de broker con comisiones, mostrar modal de confirmación
    if (client && commissionWarning?.show && formData.broker_id !== client.broker_id) {
      setShowReassignmentModal(true);
      return;
    }
    
    // Proceder con guardado normal
    await saveClient(false);
  };
  
  const saveClient = async (makeAdjustments: boolean) => {
    
    setLoading(true);
    setSavingWithAdjustments(makeAdjustments);
    setError("");

    try {
      if (client) {
        const payload = toUppercasePayload({
          name: formData.name,
          national_id: formData.national_id || null,
          email: formData.email || null,
          phone: formData.phone || null,
          birth_date: formData.birth_date,
          active: formData.active,
          broker_id: formData.broker_id || null,
        });

        // Si hay cambio de broker con ajustes, usar endpoint especial
        if (makeAdjustments && formData.broker_id !== client.broker_id && commissionData) {
          const response = await fetch('/api/clients/reassign-broker', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: client.id,
              oldBrokerId: client.broker_id,
              newBrokerId: formData.broker_id,
              makeAdjustments: true,
              commissionsData: commissionData.commissionsByFortnight,
              clientData: payload
            })
          });
          
          if (!response.ok) {
            const errorJson = await response.json().catch(() => null);
            throw new Error(errorJson?.error || "Error en reasignación con ajustes");
          }
          
          toast.success('Cliente reasignado con ajustes retroactivos creados');
        } else {
          // Guardado normal
          const response = await fetch(`/api/db/clients/${client.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          
          if (!response.ok) {
            const errorJson = await response.json().catch(() => null);
            throw new Error(errorJson?.error || "Error actualizando cliente");
          }
          
          toast.success('Cliente actualizado correctamente');
        }

      } else {
        const rawClientData = {
          name: formData.name,
          national_id: formData.national_id,
          email: formData.email,
          phone: formData.phone,
          birth_date: formData.birth_date,
          active: formData.active,
        };
        const clientData = toUppercasePayload(rawClientData);
        const policyData = { policy_number: formData.policy_number.toUpperCase() };
        const result = await actionCreateClientWithPolicy(clientData, policyData);
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
      // Cerrar inmediatamente para mejor UX
      onClose();
      // Refrescar después para que el usuario no vea demora
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!confirm("¿Está seguro de eliminar esta póliza?")) return;

    try {
      const response = await fetch(`/api/db/policies/${policyId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error eliminando póliza");

      setPolicies(policies.filter(p => p.id !== policyId));
    } catch {
      alert("Error al eliminar la póliza");
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-3xl w-full my-4 sm:my-8 shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] text-white p-4 sm:p-6 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-2xl font-bold truncate">
              {client ? "Editar Cliente" : "Nuevo Cliente"}
            </h2>
            <p className="text-white/80 text-xs sm:text-sm mt-1 hidden sm:block">
              {client ? "Actualizar información del cliente" : "Agregar un nuevo cliente al sistema"}
            </p>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-200 transition ml-2 flex-shrink-0">
            <FaTimes size={20} className="sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <form id="client-form" onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit} className="space-y-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {/* Datos del Cliente */}
          <fieldset disabled={readOnly}>
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b-2 border-[#8AAA19] pb-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#8AAA19] to-[#6d8814] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl">👤</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#010139]">
                  Información del Cliente
                </h3>
                <p className="text-xs text-gray-600">Datos personales y de contacto</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {/* Nombre - Full width */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nombre Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, name: e.target.value }))}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-all text-sm sm:text-base ${uppercaseInputClass}`}
                  placeholder="JUAN PÉREZ GÓMEZ"
                />
              </div>

              {/* Cédula y Teléfono - 2 columnas */}
              <div className="relative">
                <NationalIdInput
                  value={formData.national_id}
                  onChange={(value) => {
                    setFormData({ ...formData, national_id: value });
                    // Detectar duplicados si estamos editando un cliente
                    if (client && value && value.trim()) {
                      checkForDuplicates(value);
                    }
                  }}
                  label="Documento de Identidad"
                />
                {checkingDuplicate && (
                  <div className="absolute right-2 top-9 text-xs text-gray-500 flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#8AAA19]"></div>
                    Verificando...
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className="text-green-600">📞</span>
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-all text-sm sm:text-base"
                  placeholder="6123-4567"
                />
              </div>

              {/* Email - Full width */}
              <div className="sm:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className="text-purple-600">✉️</span>
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-all text-sm sm:text-base"
                  placeholder="cliente@email.com"
                />
              </div>

              {/* Fecha Nacimiento y Estado - 2 columnas */}
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                  <span className="text-pink-600">🎂</span>
                  Fecha de Nacimiento
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
                  className="w-full max-w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none transition-all text-sm sm:text-base"
                  style={{ WebkitAppearance: 'none' }}
                />
              </div>

              {/* Corredor - Solo Master */}
              {userRole === 'master' && client && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                    <span className="text-blue-600">👔</span>
                    Corredor Asignado <span className="text-red-500">*</span>
                  </label>
                  <Select 
                    value={formData.broker_id || ''} 
                    onValueChange={async (value) => {
                      // Si es el mismo broker, no hacer nada
                      if (value === formData.broker_id) return;
                      
                      // Pedir confirmación al cambiar el broker
                      const oldBrokerName = brokers.find(b => b.id === formData.broker_id)?.name || 'Corredor anterior';
                      const newBrokerName = brokers.find(b => b.id === value)?.name || 'Nuevo corredor';
                      
                      const confirmed = await confirm(
                        `¿Está seguro de cambiar el corredor asignado de "${oldBrokerName}" a "${newBrokerName}"?\n\nEsto puede afectar las comisiones futuras de este cliente.`,
                        'Confirmar cambio de corredor'
                      );
                      
                      if (confirmed) {
                        setFormData({ ...formData, broker_id: value });
                      }
                    }}
                    disabled={checkingCommissions}
                  >
                    <SelectTrigger className="w-full border-2 border-gray-300 focus:border-[#8AAA19]">
                      <SelectValue placeholder="Seleccionar corredor...">
                        {formData.broker_id 
                          ? (brokers.find(b => b.id === formData.broker_id)?.name || 'Seleccionar corredor...')
                          : 'Seleccionar corredor...'
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-auto">
                      {brokers.map((broker) => (
                        <SelectItem key={broker.id} value={broker.id}>
                          {broker.name || 'Sin nombre'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {checkingCommissions && (
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#8AAA19]"></div>
                      Verificando comisiones...
                    </p>
                  )}
                </div>
              )}

              {/* Advertencia de comisiones existentes */}
              {commissionWarning?.show && (
                <div className="sm:col-span-2 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FaExclamationTriangle className="text-yellow-600 text-xl flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-yellow-800 mb-1">
                        ⚠️ Cliente con Comisiones Pagadas
                      </h4>
                      <p className="text-sm text-yellow-700 mb-2">
                        Este cliente tiene <strong>{commissionWarning.fortnightCount} quincena(s)</strong> con comisiones pagadas 
                        al corredor anterior por un total de <strong>${commissionWarning.totalAmount.toFixed(2)}</strong>.
                      </p>
                      <p className="text-xs text-yellow-600">
                        <strong>Nota:</strong> En la Fase 2 podrás realizar ajustes retroactivos de comisiones. 
                        Por ahora, el cambio de corredor solo afectará las comisiones futuras.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Estado
                </label>
                <label className="flex items-center gap-2 sm:gap-3 h-[40px] sm:h-[44px] px-3 sm:px-4 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-[#8AAA19] transition-all cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="sr-only"
                  />
                  <span className="text-xs sm:text-sm font-semibold text-gray-700">{formData.active ? '☑️' : '☐'} Cliente Activo</span>
                </label>
              </div>
            </div>
          </div>

          {/* Póliza Inicial para clientes nuevos */}
          {!client && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-[#010139] border-b-2 border-[#8AAA19] pb-2">
                📄 Póliza Inicial
              </h3>
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                <label className="block text-sm font-bold text-[#010139] mb-2">
                  Número de Póliza *
                </label>
                <input
                  type="text"
                  required
                  value={formData.policy_number}
                  onChange={createUppercaseHandler((e) => setFormData({ ...formData, policy_number: e.target.value }))}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-blue-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium ${uppercaseInputClass}`}
                  placeholder="AUTO-12345"
                />
                <p className="text-xs text-blue-700 mt-2">
                  💡 Podrás agregar más pólizas después de crear el cliente
                </p>
              </div>
            </div>
          )}

          {client && (
            <div className="space-y-4">
              {/* Sección de Pólizas con mejor layout */}
              <div className="space-y-3">
                <h3 className="text-base sm:text-lg font-bold text-[#010139] border-b-2 border-[#8AAA19] pb-2">
                  📄 Pólizas del Cliente
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPolicyForm(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg transition-all text-sm font-semibold"
                >
                  <FaPlus size={14} />
                  <span>Nueva Póliza</span>
                </button>
              </div>

              {policies.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <p className="text-gray-500 text-sm">📄 No hay pólizas registradas</p>
                  <p className="text-xs text-gray-400 mt-1">Haz clic en "Nueva Póliza" para agregar una</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {policies.map((policy) => (
                    <div key={policy.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-lg border-2 border-gray-200 hover:border-[#8AAA19] transition-all">
                      <div className="flex-1">
                        <div className="font-bold text-sm text-[#010139]">{policy.policy_number}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          <span className="font-medium">{policy.ramo}</span>
                          {policy.status && (
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                              policy.status === 'ACTIVA' ? 'bg-green-100 text-green-700' :
                              policy.status === 'VENCIDA' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {policy.status}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const policyToEdit = client?.policies?.find(p => p.id === policy.id) || null;
                            setEditingPolicy(policyToEdit as PolicyRow | null);
                            setShowPolicyForm(true);
                          }}
                          className="p-2 text-[#010139] hover:bg-blue-100 rounded-lg transition-all"
                          title="Editar póliza"
                        >
                          <FaEdit size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePolicy(policy.id)}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-all"
                          title="Eliminar póliza"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </fieldset>
          </form>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gray-50 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 rounded-b-2xl flex-shrink-0">
          {client && (client as any).id && (
            <button
              type="button"
              onClick={() => {
                if (onExpedienteModalChange) {
                  onExpedienteModalChange(true);
                }
              }}
              className="px-4 sm:px-6 py-2 text-sm sm:text-base bg-white border-2 border-[#8AAA19] text-[#8AAA19] rounded-lg hover:bg-[#8AAA19] hover:text-white transition font-medium flex items-center justify-center gap-2"
            >
              <FaFolderPlus />
              <span>Expediente</span>
            </button>
          )}
          {!client || !(client as any).id && <div className="hidden sm:block"></div>}
          
          <div className="flex gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm sm:text-base text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="client-form"
              disabled={loading}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2 text-sm sm:text-base bg-[#8AAA19] text-white rounded-lg hover:bg-[#010139] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span className="hidden sm:inline">Guardando...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <span>{client ? "Guardar" : "Crear"}</span>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Policy Form Modal - Renderizado por separado */}
      {showPolicyForm && client && (
        <PolicyForm
          clientId={(client as any).id}
          policy={editingPolicy}
          readOnly={readOnly}
          onClose={() => {
            setShowPolicyForm(false);
            setEditingPolicy(null);
            // Remover el parámetro editPolicy de la URL
            if (editPolicyId) {
              const params = new URLSearchParams(window.location.search);
              params.delete('editPolicy');
              router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
            }
          }}
          onSave={(savedPolicy) => {
            const newPolicyForState: PolicyWithInsurer = {
              ...savedPolicy,
              insurers: null,
            };

            if (editingPolicy) {
              setPolicies(policies.map(p => (p.id === savedPolicy.id ? newPolicyForState : p)));
            } else {
              setPolicies([...policies, newPolicyForState]);
            }
            setShowPolicyForm(false);
            setEditingPolicy(null);
            router.refresh();
          }}
        />
      )}
      
      {/* Modal de fusión de duplicados */}
      {showMergeModal && duplicateClient && client && (
        <MergeDuplicateModal
          currentClient={{
            id: client.id,
            name: formData.name,
            national_id: formData.national_id,
            policies_count: policies.length
          }}
          duplicateClient={duplicateClient}
          onConfirm={handleMergeClients}
          onCancel={() => {
            setShowMergeModal(false);
            setDuplicateClient(null);
            // Revertir la cédula al valor original
            if (client.national_id) {
              setFormData({ ...formData, national_id: client.national_id });
            }
          }}
          loading={mergingClients}
        />
      )}

      {/* Diálogo de confirmación corporativo */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        onClose={() => closeDialog(false)}
        onConfirm={() => closeDialog(true)}
        title={dialogState.title}
        message={dialogState.message}
        type={dialogState.type}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
      />
      
      {/* Modal de reasignación de corredor */}
      {showReassignmentModal && client && commissionData && (
        <BrokerReassignmentModal
          isOpen={showReassignmentModal}
          onClose={() => {
            setShowReassignmentModal(false);
          }}
          onConfirm={async (makeAdjustments) => {
            setShowReassignmentModal(false);
            await saveClient(makeAdjustments);
          }}
          clientName={formData.name}
          oldBrokerName={brokers.find(b => b.id === client.broker_id)?.name || 'Corredor anterior'}
          newBrokerName={brokers.find(b => b.id === formData.broker_id)?.name || 'Nuevo corredor'}
          totalAmount={commissionData.totalAmount}
          commissionsByFortnight={commissionData.commissionsByFortnight}
          loading={loading}
        />
      )}
    </div>
  );
});

ClientForm.displayName = 'ClientForm';

export default ClientForm;

// Sub-component for Policy Form
interface PolicyFormProps {
  clientId: string;
  policy: PolicyRow | null;
  onClose: () => void;
  onSave: (policy: PolicyRow) => void;
  readOnly?: boolean;
}

type PolicyFormState = {
  policy_number: string;
  ramo: string;
  insurer_id: string;
  start_date: string;
  renewal_date: string;
  status: "ACTIVA" | "CANCELADA" | "VENCIDA";
  percent_override: string;
  notas: string;
};

function PolicyForm({ clientId, policy, onClose, onSave, readOnly = false }: PolicyFormProps) {
  // Obtener fecha de hoy para autocompletar
  const today = getTodayLocalDate();
  
  const [formData, setFormData] = useState<PolicyFormState>({
    policy_number: policy?.policy_number || "",
    ramo: policy?.ramo || "",
    insurer_id: policy?.insurer_id || "all",
    start_date: policy?.start_date || (!policy ? today : ""),
    renewal_date: policy?.renewal_date || "",
    status: (policy?.status as PolicyFormState['status']) || "ACTIVA",
    percent_override: policy?.percent_override !== null && policy?.percent_override !== undefined
      ? String(policy.percent_override)
      : "",
    notas: (policy as any)?.notas || "",
  });
  const [loading, setLoading] = useState(false);
  const [insurers, setInsurers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [specialOverride, setSpecialOverride] = useState<{ hasSpecialOverride: boolean; overrideValue: number | null; condition?: string }>({ hasSpecialOverride: false, overrideValue: null });
  const [userRole, setUserRole] = useState<string>('');

  // Cargar aseguradoras y rol del usuario
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Obtener rol del usuario
        const { data: { user } } = await supabaseClient().auth.getUser();
        if (user) {
          const { data: profile } = await supabaseClient()
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
          if (mounted) {
            setUserRole(profile?.role || '');
          }
        }
        
        const response = await fetch('/api/insurers', { cache: 'no-store' });
        if (!response.ok) throw new Error('Error cargando aseguradoras');
        const result = await response.json();
        if (mounted) {
          // La API devuelve { success: true, insurers: [...] }
          if (result.success && Array.isArray(result.insurers)) {
            setInsurers(result.insurers);
          } else {
            console.warn('Formato inesperado de insurers:', result);
            setInsurers([]);
          }
        }
      } catch (err) {
        console.error('Error loading insurers:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Error cargando aseguradoras');
          setInsurers([]); // Set empty array on error
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Auto-calcular fecha de renovación (1 año después de inicio)
  useEffect(() => {
    if (formData.start_date && !policy?.renewal_date) {
      const calculatedRenewalDate = addOneYearToDate(formData.start_date);
      setFormData(prev => ({ ...prev, renewal_date: calculatedRenewalDate }));
    }
  }, [formData.start_date, policy?.renewal_date]);

  // Verificar condición especial ASSA + VIDA
  useEffect(() => {
    if (formData.insurer_id && formData.ramo && insurers.length > 0) {
      const selectedInsurer = insurers.find((i: { id: string; name: string }) => i.id === formData.insurer_id);
      const override = checkSpecialOverride(selectedInsurer?.name, formData.ramo);
      
      setSpecialOverride(override);
      
      // Aplicar automáticamente el override si es condición especial
      if (override.hasSpecialOverride && override.overrideValue !== null) {
        setFormData(prev => ({
          ...prev,
          percent_override: String(override.overrideValue)
        }));
      }
    }
  }, [formData.insurer_id, formData.ramo, insurers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (formData.insurer_id === 'all') {
        setError('Selecciona una aseguradora.');
        setLoading(false);
        return;
      }

      if (!formData.ramo.trim()) {
        setError('Ingresa el ramo de la póliza.');
        setLoading(false);
        return;
      }

      // Validar que si es OTROS, las notas contengan el tipo específico
      if (formData.ramo === 'OTROS' && (!formData.notas || formData.notas.trim().length < 5)) {
        setError('Cuando el tipo es OTROS, debes especificar el tipo de póliza en las notas (mínimo 5 caracteres).');
        setLoading(false);
        return;
      }

      const url = policy 
        ? `/api/db/policies/${policy.id}`
        : "/api/db/policies";
      
      const method = policy ? "PUT" : "POST";

      console.log('[PolicyForm] Guardando póliza...');
      console.log('[PolicyForm] Method:', method);
      console.log('[PolicyForm] URL:', url);

      // Construir notas con indicador de condición especial si aplica
      let notasFinales = formData.notas.trim().toUpperCase();
      if (specialOverride.hasSpecialOverride && !notasFinales.includes('[ASSA-VIDA-1.0%]')) {
        notasFinales = notasFinales 
          ? `[ASSA-VIDA-1.0%] ${notasFinales}` 
          : '[ASSA-VIDA-1.0% - OVERRIDE PROTEGIDO]';
      }

      const payload = {
        client_id: clientId,
        insurer_id: formData.insurer_id,
        policy_number: formData.policy_number.trim().toUpperCase(),
        ramo: formData.ramo.trim().toUpperCase(),
        start_date: formData.start_date || null,
        renewal_date: formData.renewal_date || null,
        status: formData.status,
        percent_override:
          formData.percent_override === ""
            ? null
            : Number(formData.percent_override),
        notas: notasFinales || null,
      };
      
      console.log('[PolicyForm] Payload:', payload);

      if (payload.percent_override !== null && Number.isNaN(payload.percent_override)) {
        setError('El porcentaje debe ser un número válido.');
        setLoading(false);
        return;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log('[PolicyForm] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[PolicyForm] Error response:', errorData);
        throw new Error(errorData.error || "Error guardando póliza");
      }
      
      const savedPolicy = await response.json();
      console.log('[PolicyForm] Póliza guardada:', savedPolicy);
      onSave(savedPolicy);
      onClose(); // Cerrar modal automáticamente después de guardar
    } catch (err) {
      console.error('[PolicyForm] Error:', err);
      setError(err instanceof Error ? err.message : "Error al guardar la póliza");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col my-4 sm:my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header con gradiente corporativo */}
        <div className="bg-gradient-to-r from-[#010139] to-[#020270] px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="p-1.5 sm:p-2 bg-white/10 rounded-lg flex-shrink-0">
              <FaPlus size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-lg font-bold text-white truncate">
                {policy ? "Editar Póliza" : "Nueva Póliza"}
              </h3>
              <p className="text-xs text-white/80 hidden sm:block truncate">
                {policy ? "Actualizar información de la póliza" : "Agregar una nueva póliza al cliente"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg transition-all flex-shrink-0 ml-2"
          >
            <FaTimes size={16} className="text-white sm:w-[18px] sm:h-[18px]" />
          </button>
        </div>

        <form id="policy-form" onSubmit={readOnly ? (e) => e.preventDefault() : handleSubmit} className="p-3 sm:p-5 space-y-3 sm:space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}
          <fieldset disabled={readOnly}>
            {/* Primero: Aseguradora */}
            <div>
              <label className="block text-sm font-bold text-[#010139] mb-2">
                🏢 Aseguradora *
              </label>
              <select
                required
                value={formData.insurer_id}
                onChange={(e) => setFormData({ ...formData, insurer_id: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium transition-all"
                disabled={!insurers.length}
              >
                <option value="all" disabled>
                  {insurers.length === 0 ? 'Cargando aseguradoras...' : 'Selecciona una aseguradora'}
                </option>
                {Array.isArray(insurers) && insurers.map((insurer) => (
                  <option key={insurer.id} value={insurer.id}>
                    {insurer.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Segundo: Número de Póliza con autoayuda */}
            {formData.insurer_id && formData.insurer_id !== 'all' ? (
              <PolicyNumberInput
                insurerName={insurers.find(i => i.id === formData.insurer_id)?.name || ''}
                value={formData.policy_number}
                onChange={(value) => setFormData({ ...formData, policy_number: value })}
                label="Número de Póliza"
                required
              />
            ) : (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Primero selecciona una aseguradora para ver el formato correcto del número de póliza
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-[#010139] mb-2">
                📊 Tipo de Póliza *
              </label>
              <select
                required
                value={formData.ramo}
                onChange={(e) => setFormData({ ...formData, ramo: e.target.value })}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium transition-all"
              >
                <option value="" disabled>
                  Selecciona el tipo de póliza
                </option>
                {POLICY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {specialOverride.hasSpecialOverride && (
                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2 text-xs">
                  <span className="font-bold text-blue-700">ℹ️</span>
                  <span className="text-blue-700">
                    Esta combinación (ASSA + VIDA) tiene un override automático de 1.0%. Protegido de cambios masivos.
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-[#010139] mb-2">
                🟢 Estado
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as PolicyFormState['status'] })}
                className="w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium transition-all"
              >
                <option value="ACTIVA">☑️ ACTIVA</option>
                <option value="VENCIDA">🔴 VENCIDA</option>
                <option value="CANCELADA">❌ CANCELADA</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-sm font-bold text-[#010139] mb-2">
                  📅 Fecha de Inicio
                </label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full max-w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium transition-all"
                  style={{ WebkitAppearance: 'none' }}
                />
              </div>
              <div className="w-full max-w-full overflow-hidden">
                <label className="block text-sm font-bold text-[#010139] mb-2">
                  🔁 Fecha de Renovación
                </label>
                <input
                  type="date"
                  value={formData.renewal_date}
                  onChange={(e) => setFormData({ ...formData, renewal_date: e.target.value })}
                  className="w-full max-w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-[#8AAA19] focus:ring-2 focus:ring-[#8AAA19]/20 focus:outline-none text-sm font-medium transition-all"
                  style={{ WebkitAppearance: 'none' }}
                />
              </div>
            </div>

            {/* % Comisión Override - Solo visible para Master */}
            {userRole === 'master' && (
              <div>
                <label className="block text-sm font-bold text-[#010139] mb-2">
                  💰 % Comisión Override {specialOverride.hasSpecialOverride ? '(Condición Especial)' : '(opcional)'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.percent_override}
                  onChange={(e) => setFormData({ ...formData, percent_override: e.target.value })}
                  className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg focus:ring-2 focus:outline-none text-sm font-medium transition-all ${
                    specialOverride.hasSpecialOverride 
                      ? 'border-blue-300 bg-blue-50 focus:border-blue-500 focus:ring-blue-500/20' 
                      : 'border-gray-300 focus:border-[#8AAA19] focus:ring-[#8AAA19]/20'
                  }`}
                  placeholder="Ej: 5.50"
                />
                {specialOverride.hasSpecialOverride ? (
                  <p className="text-xs text-blue-600 mt-1 font-semibold">
                    🔒 1.0% automático (ASSA + VIDA). Editable pero protegido de cambios masivos.
                  </p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    💡 Dejar vacío para usar el porcentaje por defecto
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-[#010139] mb-2">
                💬 Notas {formData.ramo === 'OTROS' && <span className="text-red-600">*</span>}
              </label>
              <textarea
                value={formData.notas}
                onChange={createUppercaseHandler((e) => setFormData({ ...formData, notas: e.target.value }))}
                className={`w-full px-3 sm:px-4 py-2 sm:py-3 border-2 rounded-lg focus:ring-2 focus:outline-none text-sm font-medium transition-all ${uppercaseInputClass} ${
                  formData.ramo === 'OTROS' 
                    ? 'border-orange-300 bg-orange-50 focus:border-orange-500 focus:ring-orange-500/20' 
                    : 'border-gray-300 focus:border-[#8AAA19] focus:ring-[#8AAA19]/20'
                }`}
                placeholder={formData.ramo === 'OTROS' 
                  ? "ESPECIFICAR TIPO DE PÓLIZA (REQUERIDO): EJ. FIANZA, CAUCIONES, ETC..."
                  : "AGREGAR NOTAS O COMENTARIOS SOBRE LA PÓLIZA..."
                }
                rows={3}
                required={formData.ramo === 'OTROS'}
              />
              {formData.ramo === 'OTROS' ? (
                <p className="text-xs text-orange-600 mt-1 font-semibold">
                  ⚠️ REQUERIDO: Debes especificar qué tipo de póliza es (mínimo 5 caracteres)
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  💡 Información adicional que quieras recordar sobre esta póliza
                </p>
              )}
            </div>
          </fieldset>
        </form>

        {/* Barra de botones fija en la parte inferior */}
        <div className="bg-gray-50 px-3 sm:px-5 py-3 sm:py-4 border-t-2 border-gray-100 flex justify-end gap-2 sm:gap-3 rounded-b-2xl flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-all font-semibold"
          >
            Cancelar
          </button>
          {!readOnly && (
            <button
              type="submit"
              form="policy-form"
              disabled={loading}
              className="flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-3 text-xs sm:text-base bg-gradient-to-r from-[#8AAA19] to-[#6d8814] text-white rounded-lg hover:shadow-lg hover:scale-[1.02] transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-1 sm:gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  <span className="hidden sm:inline">Guardando...</span>
                  <span className="sm:hidden">...</span>
                </>
              ) : (
                <>
                  <FaFolderPlus size={14} className="hidden sm:inline" />
                  <span>Guardar</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
