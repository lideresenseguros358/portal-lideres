'use client';

import { useState, useEffect } from 'react';
import { FaTimes, FaEdit, FaFolderOpen, FaExclamationCircle, FaDollarSign, FaUser, FaIdCard, FaEnvelope, FaPhone, FaBirthdayCake, FaFileAlt, FaBuilding, FaCalendarAlt, FaCheckCircle, FaTimesCircle, FaClock, FaEye } from 'react-icons/fa';
import Modal from '@/components/Modal';
import { ClientWithPolicies } from '@/types/db';
import { supabaseClient } from '@/lib/supabase/client';

// Helper para formatear moneda
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

interface ClientDetailsModalProps {
  client: ClientWithPolicies;
  onClose: () => void;
  onEdit: () => void;
  onOpenExpediente: () => void;
}

interface PolicyMorosidad {
  policy_id: string;
  policy_number: string;
  insurer_name: string;
  total_morosidad: number;
  payments_count: number;
}

interface PolicyCommissions {
  policy_id: string;
  policy_number: string;
  insurer_name: string;
  total_commissions: number;
  commissions_count: number;
}

interface FortnightCommission {
  fortnight_id: string;
  period_start: string;
  period_end: string;
  amount: number;
  policy_number: string;
}

export default function ClientDetailsModal({ client, onClose, onEdit, onOpenExpediente }: ClientDetailsModalProps) {
  const [showMorosidadModal, setShowMorosidadModal] = useState(false);
  const [showComisionesModal, setShowComisionesModal] = useState(false);
  const [showFortnightDetailModal, setShowFortnightDetailModal] = useState(false);
  const [selectedPolicyForDetail, setSelectedPolicyForDetail] = useState<string | null>(null);
  
  const [morosidadData, setMorosidadData] = useState<PolicyMorosidad[]>([]);
  const [comisionesData, setComisionesData] = useState<PolicyCommissions[]>([]);
  const [fortnightDetail, setFortnightDetail] = useState<FortnightCommission[]>([]);
  
  const [loadingMorosidad, setLoadingMorosidad] = useState(false);
  const [loadingComisiones, setLoadingComisiones] = useState(false);
  const [loadingFortnight, setLoadingFortnight] = useState(false);

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('es-PA', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVA':
        return <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold flex items-center gap-1"><FaCheckCircle /> Activa</span>;
      case 'CANCELADA':
        return <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold flex items-center gap-1"><FaTimesCircle /> Cancelada</span>;
      case 'VENCIDA':
        return <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-semibold flex items-center gap-1"><FaClock /> Vencida</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">{status}</span>;
    }
  };

  const loadMorosidad = async () => {
    setLoadingMorosidad(true);
    try {
      const policyIds = client.policies.map(p => p.id);
      
      if (policyIds.length === 0) {
        setMorosidadData([]);
        return;
      }

      const { data: payments } = await (supabaseClient() as any)
        .from('policy_payments')
        .select(`
          policy_id,
          amount,
          policies!inner(
            policy_number,
            insurers(name)
          )
        `)
        .in('policy_id', policyIds)
        .eq('status', 'PENDIENTE');

      const grouped = (payments || []).reduce((acc: Record<string, PolicyMorosidad>, payment: any) => {
        const policyId = payment.policy_id;
        if (!acc[policyId]) {
          acc[policyId] = {
            policy_id: policyId,
            policy_number: (payment.policies as any).policy_number || 'N/A',
            insurer_name: (payment.policies as any).insurers?.name || 'N/A',
            total_morosidad: 0,
            payments_count: 0
          };
        }
        acc[policyId].total_morosidad += payment.amount;
        acc[policyId].payments_count += 1;
        return acc;
      }, {} as Record<string, PolicyMorosidad>);

      setMorosidadData(Object.values(grouped));
    } catch (error) {
      console.error('Error loading morosidad:', error);
    } finally {
      setLoadingMorosidad(false);
    }
  };

  const loadComisiones = async () => {
    setLoadingComisiones(true);
    try {
      const policyIds = client.policies.map(p => p.id);
      
      if (policyIds.length === 0) {
        setComisionesData([]);
        return;
      }

      const { data: items } = await (supabaseClient() as any)
        .from('comm_items')
        .select(`
          policy_id,
          gross_amount,
          policies!inner(
            policy_number,
            insurers(name)
          )
        `)
        .in('policy_id', policyIds)
        .not('gross_amount', 'is', null);

      const grouped = (items || []).reduce((acc: Record<string, PolicyCommissions>, item: any) => {
        const policyId = item.policy_id;
        if (!policyId) return acc;
        
        if (!acc[policyId]) {
          acc[policyId] = {
            policy_id: policyId,
            policy_number: (item.policies as any).policy_number || 'N/A',
            insurer_name: (item.policies as any).insurers?.name || 'N/A',
            total_commissions: 0,
            commissions_count: 0
          };
        }
        acc[policyId].total_commissions += Math.abs(item.gross_amount);
        acc[policyId].commissions_count += 1;
        return acc;
      }, {} as Record<string, PolicyCommissions>);

      setComisionesData(Object.values(grouped));
    } catch (error) {
      console.error('Error loading comisiones:', error);
    } finally {
      setLoadingComisiones(false);
    }
  };

  const loadFortnightDetail = async (policyId: string) => {
    setLoadingFortnight(true);
    try {
      const { data: items } = await (supabaseClient() as any)
        .from('comm_items')
        .select(`
          policy_id,
          gross_amount,
          policies!inner(policy_number),
          comm_imports!inner(
            period_label,
            fortnights!inner(period_start, period_end)
          )
        `)
        .eq('policy_id', policyId)
        .not('gross_amount', 'is', null)
        .order('comm_imports(fortnights(period_start))', { ascending: false });

      const detail: FortnightCommission[] = (items || []).map((item: any) => ({
        fortnight_id: (item.comm_imports as any).period_label,
        period_start: (item.comm_imports as any).fortnights.period_start,
        period_end: (item.comm_imports as any).fortnights.period_end,
        amount: Math.abs(item.gross_amount),
        policy_number: (item.policies as any).policy_number
      }));

      setFortnightDetail(detail);
    } catch (error) {
      console.error('Error loading fortnight detail:', error);
    } finally {
      setLoadingFortnight(false);
    }
  };

  return (
    <>
      <Modal title="Detalles del Cliente" onClose={onClose}>
        <div className="space-y-6">
          {/* Header con acciones */}
          <div className="flex flex-wrap gap-3 pb-4 border-b border-gray-200">
            <button
              onClick={onEdit}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition font-semibold flex items-center justify-center gap-2 shadow-md"
            >
              <FaEdit className="text-white" /> Editar Cliente
            </button>
            <button
              onClick={onOpenExpediente}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-[#8AAA19] text-white rounded-lg hover:bg-[#6f8815] transition font-semibold flex items-center justify-center gap-2 shadow-md"
            >
              <FaFolderOpen className="text-white" /> Ver Expediente
            </button>
            <button
              onClick={() => {
                loadMorosidad();
                setShowMorosidadModal(true);
              }}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition font-semibold flex items-center justify-center gap-2 shadow-md"
            >
              <FaExclamationCircle className="text-white" /> Morosidad
            </button>
            <button
              onClick={() => {
                loadComisiones();
                setShowComisionesModal(true);
              }}
              className="flex-1 min-w-[140px] px-4 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition font-semibold flex items-center justify-center gap-2 shadow-md"
            >
              <FaDollarSign className="text-white" /> Comisiones
            </button>
          </div>

          {/* Información del Cliente */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <h3 className="text-lg font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaUser className="text-[#010139]" />
              Información Personal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <FaUser className="text-[#010139] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 font-medium">Nombre Completo</p>
                  <p className="text-sm font-semibold text-gray-900">{client.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaIdCard className="text-[#010139] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 font-medium">Cédula/RUC</p>
                  <p className="text-sm font-semibold text-gray-900">{client.national_id || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaEnvelope className="text-[#010139] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 font-medium">Email</p>
                  <p className="text-sm font-semibold text-gray-900">{client.email || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaPhone className="text-[#010139] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 font-medium">Teléfono</p>
                  <p className="text-sm font-semibold text-gray-900">{client.phone || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaBirthdayCake className="text-[#010139] mt-1 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-600 font-medium">Fecha de Nacimiento</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDate((client as any).birth_date)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaCheckCircle className={`mt-1 flex-shrink-0 ${client.active ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <p className="text-xs text-gray-600 font-medium">Estado</p>
                  <p className={`text-sm font-semibold ${client.active ? 'text-green-600' : 'text-red-600'}`}>
                    {client.active ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Pólizas */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200">
            <h3 className="text-lg font-bold text-[#010139] mb-4 flex items-center gap-2">
              <FaFileAlt className="text-[#8AAA19]" />
              Pólizas ({client.policies?.length || 0})
            </h3>
            
            {client.policies && client.policies.length > 0 ? (
              <div className="space-y-3">
                {client.policies.map((policy, index) => (
                  <div key={policy.id} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-[#010139]">#{index + 1}</span>
                        {getStatusBadge(policy.status)}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      <div className="flex items-start gap-2">
                        <FaFileAlt className="text-[#8AAA19] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-600">Número de Póliza</p>
                          <p className="font-semibold text-gray-900">{policy.policy_number || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaBuilding className="text-[#010139] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-600">Aseguradora</p>
                          <p className="font-semibold text-gray-900">{policy.insurers?.name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaFileAlt className="text-[#8AAA19] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-600">Ramo</p>
                          <p className="font-semibold text-gray-900">{policy.ramo || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCalendarAlt className="text-[#010139] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-600">Fecha de Inicio</p>
                          <p className="font-semibold text-gray-900">{formatDate(policy.start_date)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <FaCalendarAlt className="text-[#010139] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs text-gray-600">Fecha de Renovación</p>
                          <p className="font-semibold text-gray-900">{formatDate(policy.renewal_date)}</p>
                        </div>
                      </div>
                      {policy.notas && (
                        <div className="md:col-span-2 flex items-start gap-2">
                          <FaFileAlt className="text-[#8AAA19] mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs text-gray-600">Notas</p>
                            <p className="font-semibold text-gray-900">{policy.notas}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FaFileAlt className="mx-auto text-4xl mb-2 opacity-30" />
                <p>No hay pólizas registradas</p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal de Morosidad */}
      {showMorosidadModal && (
        <Modal 
          title="Morosidad del Cliente" 
          onClose={() => setShowMorosidadModal(false)}
        >
          <div className="space-y-4">
            {loadingMorosidad ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
                <p className="text-gray-600 mt-4">Cargando morosidad...</p>
              </div>
            ) : morosidadData.length > 0 ? (
              <>
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-900 font-semibold">
                    Total de morosidad: {formatCurrency(morosidadData.reduce((sum, p) => sum + p.total_morosidad, 0))}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    {morosidadData.reduce((sum, p) => sum + p.payments_count, 0)} pagos pendientes
                  </p>
                </div>
                {morosidadData.map(policy => (
                  <div key={policy.policy_id} className="bg-white border-2 border-red-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{policy.policy_number}</p>
                        <p className="text-sm text-gray-600">{policy.insurer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{formatCurrency(policy.total_morosidad)}</p>
                        <p className="text-xs text-gray-600">{policy.payments_count} pagos</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8">
                <FaCheckCircle className="mx-auto text-5xl text-green-500 mb-3" />
                <p className="text-gray-900 font-semibold">Sin morosidad</p>
                <p className="text-sm text-gray-600 mt-1">Este cliente no tiene pagos pendientes</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal de Comisiones */}
      {showComisionesModal && (
        <Modal 
          title="Comisiones del Cliente" 
          onClose={() => setShowComisionesModal(false)}
        >
          <div className="space-y-4">
            {loadingComisiones ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
                <p className="text-gray-600 mt-4">Cargando comisiones...</p>
              </div>
            ) : comisionesData.length > 0 ? (
              <>
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-green-900 font-semibold">
                    Total comisionado: {formatCurrency(comisionesData.reduce((sum, p) => sum + p.total_commissions, 0))}
                  </p>
                  <p className="text-xs text-green-700 mt-1">
                    {comisionesData.reduce((sum, p) => sum + p.commissions_count, 0)} comisiones generadas
                  </p>
                </div>
                {comisionesData.map(policy => (
                  <div key={policy.policy_id} className="bg-white border-2 border-green-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-bold text-gray-900">{policy.policy_number}</p>
                        <p className="text-sm text-gray-600">{policy.insurer_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(policy.total_commissions)}</p>
                        <p className="text-xs text-gray-600">{policy.commissions_count} comisiones</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedPolicyForDetail(policy.policy_id);
                        loadFortnightDetail(policy.policy_id);
                        setShowFortnightDetailModal(true);
                      }}
                      className="w-full px-4 py-2 bg-[#010139] text-white rounded-lg hover:bg-[#020270] transition font-semibold flex items-center justify-center gap-2"
                    >
                      <FaEye className="text-white" /> Ver Detalle por Quincena
                    </button>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-8">
                <FaDollarSign className="mx-auto text-5xl text-gray-300 mb-3" />
                <p className="text-gray-900 font-semibold">Sin comisiones</p>
                <p className="text-sm text-gray-600 mt-1">Este cliente no ha generado comisiones aún</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal de Detalle de Quincenas */}
      {showFortnightDetailModal && (
        <Modal 
          title="Detalle de Comisiones por Quincena" 
          onClose={() => setShowFortnightDetailModal(false)}
        >
          <div className="space-y-3">
            {loadingFortnight ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#010139] mx-auto"></div>
                <p className="text-gray-600 mt-4">Cargando detalle...</p>
              </div>
            ) : fortnightDetail.length > 0 ? (
              <>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-3 mb-3">
                  <p className="text-sm text-blue-900 font-semibold">
                    Póliza: {fortnightDetail[0]?.policy_number}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Total: {formatCurrency(fortnightDetail.reduce((sum, f) => sum + f.amount, 0))}
                  </p>
                </div>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {fortnightDetail.map((fortnight, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatDate(fortnight.period_start)} - {formatDate(fortnight.period_end)}
                          </p>
                          <p className="text-xs text-gray-600">Quincena ID: {fortnight.fortnight_id}</p>
                        </div>
                        <p className="text-base font-bold text-[#8AAA19]">
                          {formatCurrency(fortnight.amount)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">No hay detalle disponible</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
