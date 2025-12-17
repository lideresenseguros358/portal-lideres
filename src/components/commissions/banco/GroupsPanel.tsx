'use client';

import { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaChevronDown, FaChevronRight } from 'react-icons/fa';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { actionGetBankGroups, actionCreateBankGroup } from '@/app/(app)/commissions/banco-actions';
import type { GroupTemplate, GroupStatus } from '@/app/(app)/commissions/banco-actions';
import CreateGroupModal from './CreateGroupModal';
import { toast } from 'sonner';

interface GroupsPanelProps {
  insurers: { id: string; name: string }[];
  onRefresh: () => void;
}

export default function GroupsPanel({ insurers, onRefresh }: GroupsPanelProps) {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: 'all',
    insurerId: '',
  });

  useEffect(() => {
    loadGroups();
  }, [filters]);

  const loadGroups = async () => {
    setLoading(true);
    const result = await actionGetBankGroups({
      status: filters.status !== 'all' ? filters.status : undefined,
      insurerId: filters.insurerId || undefined,
    });

    if (result.ok) {
      setGroups(result.data || []);
    } else {
      toast.error('Error al cargar grupos');
    }
    setLoading(false);
  };

  const handleCreateGroup = () => {
    setShowCreateModal(true);
  };

  const handleGroupCreated = () => {
    setShowCreateModal(false);
    loadGroups();
    onRefresh();
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const getStatusBadge = (status: GroupStatus) => {
    const badges = {
      EN_PROCESO: { label: 'En proceso', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
      OK_CONCILIADO: { label: 'OK Conciliado', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      PAGADO: { label: 'Pagado', color: 'bg-green-100 text-green-800 border-green-300' },
    };
    const badge = badges[status] || badges.EN_PROCESO;
    return (
      <span className={`px-2 py-1 rounded text-xs font-semibold border ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  const getTemplateBadge = (template: GroupTemplate) => {
    const labels: Record<GroupTemplate, string> = {
      NORMAL: 'Normal',
      ASSA_CODIGOS: 'ASSA Códigos',
      ASSA_PJ750: 'ASSA PJ750',
      ASSA_PJ750_1: 'ASSA PJ750-1',
      ASSA_PJ750_6: 'ASSA PJ750-6',
      ASSA_PJ750_9: 'ASSA PJ750-9',
    };
    return (
      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
        {labels[template]}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-white shadow-lg border-2 border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-[#010139]">Grupos Bancarios</h3>
          <Button
            onClick={handleCreateGroup}
            className="bg-[#8AAA19] hover:bg-[#010139] text-white"
            size="sm"
          >
            <FaPlus className="mr-2 text-white" />
            Crear Grupo
          </Button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#8AAA19]"
            >
              <option value="all">Todos</option>
              <option value="EN_PROCESO">En proceso</option>
              <option value="OK_CONCILIADO">OK Conciliado</option>
              <option value="PAGADO">Pagado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Aseguradora</label>
            <select
              value={filters.insurerId}
              onChange={(e) => setFilters(prev => ({ ...prev, insurerId: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#8AAA19]"
            >
              <option value="">Todas</option>
              {insurers.map(ins => (
                <option key={ins.id} value={ins.id}>{ins.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Lista de grupos */}
      <Card className="bg-white shadow-lg border-2 border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <p className="text-gray-600">Cargando grupos...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-600 text-sm">No hay grupos creados</p>
            <p className="text-gray-500 text-xs mt-1">Crea un grupo para agrupar transferencias</p>
          </div>
        ) : (
          <div className="divide-y">
            {groups.map(group => (
              <div key={group.id} className="p-4">
                {/* Header del grupo */}
                <div 
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-2 rounded"
                  onClick={() => toggleGroup(group.id)}
                >
                  <div className="flex items-center gap-2">
                    {expandedGroups.has(group.id) ? (
                      <FaChevronDown className="text-gray-400" size={12} />
                    ) : (
                      <FaChevronRight className="text-gray-400" size={12} />
                    )}
                    <div>
                      <div className="font-semibold text-sm text-gray-900">{group.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {getTemplateBadge(group.group_template)}
                        {group.is_life_insurance !== null && (
                          <span className={`px-2 py-0.5 rounded text-xs ${group.is_life_insurance ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                            {group.is_life_insurance ? 'VIDA' : 'NO VIDA'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-bold text-[#8AAA19]">
                      ${group.total_amount?.toFixed(2) || '0.00'}
                    </div>
                    <div className="mt-1">{getStatusBadge(group.status)}</div>
                  </div>
                </div>

                {/* Detalles expandidos */}
                {expandedGroups.has(group.id) && (
                  <div className="mt-3 pl-6 border-l-2 border-gray-200">
                    <div className="text-xs text-gray-600 space-y-1">
                      <div>
                        <span className="font-semibold">Aseguradora:</span> {group.insurers?.name || 'N/A'}
                      </div>
                      <div>
                        <span className="font-semibold">Transferencias:</span> {group.transfers?.length || 0}
                      </div>
                      {group.fortnight_paid_id && (
                        <div>
                          <span className="font-semibold">Quincena pagada:</span>{' '}
                          {group.fortnights ? (
                            <>
                              {new Date(group.fortnights.period_start).toLocaleDateString('es-PA')} -{' '}
                              {new Date(group.fortnights.period_end).toLocaleDateString('es-PA')}
                            </>
                          ) : (
                            group.fortnight_paid_id
                          )}
                        </div>
                      )}
                      {group.paid_at && (
                        <div>
                          <span className="font-semibold">Fecha de pago:</span>{' '}
                          {new Date(group.paid_at).toLocaleDateString('es-PA')}
                        </div>
                      )}
                    </div>

                    {/* Lista de transferencias del grupo */}
                    {group.transfers && group.transfers.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Transferencias incluidas:</div>
                        <div className="space-y-1">
                          {group.transfers.map((gt: any) => (
                            <div key={gt.transfer_id} className="bg-gray-50 p-2 rounded text-xs">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-mono">{gt.bank_transfers_comm?.reference_number}</div>
                                  <div className="text-gray-500 text-[11px]">
                                    {gt.bank_transfers_comm?.description_raw?.substring(0, 40)}...
                                  </div>
                                </div>
                                <div className="font-bold text-[#8AAA19]">
                                  ${gt.bank_transfers_comm?.amount?.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de crear grupo */}
      {showCreateModal && (
        <CreateGroupModal
          insurers={insurers}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleGroupCreated}
        />
      )}
    </div>
  );
}
